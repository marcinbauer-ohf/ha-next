'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { mdiCrosshairsGps, mdiMinus, mdiPlus, mdiVectorPolygon } from '@mdi/js';
import {
  type AreaShape,
  type Vec2,
  centroid,
  nearestVertex,
  pointInPolygon,
  snapToGrid,
} from '@/lib/areaGeometry';
import type { DevicePlacement } from '@/lib/deviceMapPlacement';

// ─────────────────────────────────────────────────────────────────────────────
// Area map canvas — one shared artboard per floor. Area footprints are drawn as
// closed polygons (mode 'areas'); devices are pinned as live chips on top
// (mode 'devices' to place/reposition, mode 'view' for a read-only dashboard).
// Reuses the automation node canvas's pan + dot-grid + pointer-capture idiom.
// Geometry is grid-space; screen = grid*CELL + pan.
// ─────────────────────────────────────────────────────────────────────────────

const CELL = 40; // px per grid cell
const SNAP_RADIUS = 0.6; // grid units — snap a corner onto a neighbour's vertex
const CLOSE_RADIUS = 0.7; // grid units — click this close to the first vertex to close

export type CanvasMode = 'areas' | 'devices' | 'view';

export interface AreaInfo {
  name: string;
  icon: string;
  color: string; // hex/css accent for the polygon fill+stroke
}

export interface DeviceChipInfo {
  name: string; // device name — the primary identifier on the chip
  state: string; // live state, shown as secondary text; '' to hide
  image?: string | null; // product thumbnail (preferred over the icon)
  icon: string; // fallback when there's no image
  active: boolean; // tints the chip
  color: string; // area accent (matches the room)
  /** Entity can be toggled in place — view-mode chips get an inline switch. */
  toggleable?: boolean;
}

interface Pt {
  x: number;
  y: number;
}

interface DragState {
  mode: 'pan' | 'move';
  pointerId: number;
  startX: number;
  startY: number;
  origin: Pt; // pan origin (mode 'pan')
  areaId: string | null; // shape being moved (mode 'move')
  moved: boolean;
}

interface ChipDragState {
  deviceId: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

/** Snap a grid point to the nearest quarter cell — finer than area vertices. */
function snapQuarter(p: Vec2): Vec2 {
  return [Math.round(p[0] * 4) / 4, Math.round(p[1] * 4) / 4];
}

/**
 * A device pin on the map: product image (falls back to a tinted icon on missing
 * art) + the device name, with the live state as secondary text. Name identifies
 * the device; the room is obvious from position, so state is the useful detail.
 */
function DeviceChip({
  info,
  left,
  top,
  selected,
  draggable,
  live,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  onToggle,
}: {
  info: DeviceChipInfo;
  left: number;
  top: number;
  selected: boolean;
  draggable: boolean;
  /** Reflect live on/off state (dashboard). Off in the editor → neutral chips. */
  live: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onClick: () => void;
  /** Inline toggle for toggleable entities (view mode) — chip body still opens more-info. */
  onToggle?: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const showImg = !!info.image && imgOk;
  // On the dashboard, make on/off unmistakable: ON pops (coloured ring/avatar/
  // state), OFF recedes (muted, desaturated). In the editor (live=false) chips
  // stay neutral since there's no live state to show.
  const on = live && info.active;
  const off = live && !info.active;
  const showToggle = live && !!info.toggleable && !!onToggle;
  return (
    // Not a <button>: the inline toggle nests inside, and buttons can't nest.
    <div
      role="button"
      tabIndex={0}
      aria-label={info.state ? `${info.name} — ${info.state}` : info.name}
      title={info.state ? `${info.name} — ${info.state}` : info.name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ left, top }}
      className={`absolute flex max-w-[180px] -translate-x-1/2 -translate-y-1/2 items-center gap-ha-2 rounded-ha-2xl bg-surface-default py-1 pl-1 pr-ha-2 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60 ${
        selected
          ? 'shadow-[0_8px_24px_-6px_rgba(24,188,242,0.75)]'
          : on
            ? 'shadow-[0_8px_22px_-8px_rgba(15,23,42,0.55)]'
            : 'shadow-[0_6px_18px_-12px_rgba(15,23,42,0.45)]'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${off ? 'opacity-60 saturate-50' : ''}`}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.image as string}
          alt=""
          onError={() => setImgOk(false)}
          style={on ? { boxShadow: `0 0 0 2px ${info.color}` } : undefined}
          className={`h-7 w-7 flex-shrink-0 rounded-full bg-surface-mid object-cover ${off ? 'grayscale' : ''}`}
        />
      ) : (
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: on ? info.color : 'var(--ha-color-surface-mid)' }}
        >
          <Icon path={info.icon} size={15} className={on ? 'text-white' : 'text-text-secondary'} />
        </span>
      )}
      <span className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate text-[11px] font-semibold text-text-primary">{info.name}</span>
        {info.state && (
          <span
            className={`truncate text-[10px] ${on ? 'font-semibold' : 'text-text-tertiary'}`}
            style={on ? { color: info.color } : undefined}
          >
            {info.state}
          </span>
        )}
      </span>
      {showToggle && (
        <button
          type="button"
          aria-label={info.active ? `Turn off ${info.name}` : `Turn on ${info.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle!();
          }}
          className={`relative h-[18px] w-8 flex-shrink-0 rounded-full transition-colors ${
            info.active ? 'bg-ha-blue' : 'bg-surface-mid'
          }`}
        >
          <span
            className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-[left] ${
              info.active ? 'left-[16px]' : 'left-[2px]'
            }`}
          />
        </button>
      )}
    </div>
  );
}

// Field-level comparator (same idiom as DeviceCardV2): chip info objects and
// pointer handlers get fresh identities on every entity tick, but a chip only
// needs to repaint when its position or displayed fields actually change.
const MemoDeviceChip = memo(DeviceChip, (prev, next) =>
  prev.left === next.left &&
  prev.top === next.top &&
  prev.selected === next.selected &&
  prev.draggable === next.draggable &&
  prev.live === next.live &&
  prev.info.name === next.info.name &&
  prev.info.state === next.info.state &&
  prev.info.image === next.info.image &&
  prev.info.icon === next.info.icon &&
  prev.info.active === next.info.active &&
  prev.info.color === next.info.color &&
  prev.info.toggleable === next.info.toggleable &&
  !!prev.onToggle === !!next.onToggle
);

/**
 * Static room layer — polygons + labels. Split out and memoized so live entity
 * ticks (which only touch chip info) never re-render the SVG geometry; it only
 * repaints on pan/zoom, floor switches, or editor drafts.
 */
const ShapeLayer = memo(function ShapeLayer({
  shapes,
  areaInfo,
  selectedAreaId,
  areaMode,
  showAllFloors,
  activeFloorId,
  moveDraft,
  vertexDraft,
  panX,
  panY,
  scale,
}: {
  shapes: AreaShape[];
  areaInfo: Record<string, AreaInfo>;
  selectedAreaId: string | null;
  areaMode: boolean;
  showAllFloors: boolean;
  activeFloorId: string | null;
  moveDraft: { areaId: string; dx: number; dy: number } | null;
  vertexDraft: { areaId: string; index: number; point: Vec2 } | null;
  panX: number;
  panY: number;
  scale: number;
}) {
  const g2s = (g: Vec2): Pt => ({ x: g[0] * CELL * scale + panX, y: g[1] * CELL * scale + panY });
  const renderPoints = (s: AreaShape): Vec2[] => {
    if (moveDraft && moveDraft.areaId === s.areaId) {
      return s.points.map(([x, y]) => [x + moveDraft.dx, y + moveDraft.dy] as Vec2);
    }
    if (vertexDraft && vertexDraft.areaId === s.areaId) {
      return s.points.map((p, i) => (i === vertexDraft.index ? vertexDraft.point : p));
    }
    return s.points;
  };
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {shapes.map((s) => {
        const info = areaInfo[s.areaId];
        const color = info?.color ?? 'var(--ha-color-blue)';
        const pts = renderPoints(s).map(g2s);
        const ptsAttr = pts.map((p) => `${p.x},${p.y}`).join(' ');
        const selected = areaMode && s.areaId === selectedAreaId;
        const dim = showAllFloors && s.floorId !== activeFloorId;
        const c = centroid(renderPoints(s));
        const cs = g2s(c);
        return (
          <g key={s.areaId} opacity={dim ? 0.35 : 1}>
            <polygon
              points={ptsAttr}
              fill={color}
              fillOpacity={selected ? 0.3 : 0.16}
              stroke={color}
              strokeWidth={selected ? 3 : 2}
              strokeLinejoin="round"
            />
            <text
              x={cs.x}
              y={cs.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-text-primary"
              style={{ fontSize: 13, fontWeight: 600, paintOrder: 'stroke' }}
              stroke="var(--ha-color-surface-low)"
              strokeWidth={3}
            >
              {info?.name ?? 'Area'}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

export function AreaMapCanvas({
  shapes,
  activeFloorId,
  showAllFloors,
  areaInfo,
  selectedAreaId,
  onSelect,
  drawing,
  onCommitDraft,
  moveBy,
  setVertex,
  insertVertex,
  mode = 'areas',
  placements = [],
  deviceChipInfo = {},
  selectedDeviceId = null,
  onMoveDevice,
  onSelectDevice,
  onToggleDevice,
  dropConverterRef,
}: {
  shapes: AreaShape[];
  activeFloorId: string | null;
  showAllFloors: boolean;
  areaInfo: Record<string, AreaInfo>;
  selectedAreaId: string | null;
  onSelect: (areaId: string | null) => void;
  drawing: boolean;
  onCommitDraft: (points: Vec2[]) => void;
  moveBy: (areaId: string, dx: number, dy: number) => void;
  /** Set one vertex of a shape (absolute grid coords) — used to drag points. */
  setVertex?: (areaId: string, index: number, point: Vec2) => void;
  /** Insert a vertex at an index — used to split an edge (add a corner). */
  insertVertex?: (areaId: string, index: number, point: Vec2) => void;
  /** 'areas' edits footprints, 'devices' places/repositions chips, 'view' is read-only. */
  mode?: CanvasMode;
  placements?: DevicePlacement[];
  deviceChipInfo?: Record<string, DeviceChipInfo>;
  selectedDeviceId?: string | null;
  onMoveDevice?: (deviceId: string, dx: number, dy: number) => void;
  onSelectDevice?: (deviceId: string) => void;
  /** Toggle a chip's primary entity in place (view mode inline switch). */
  onToggleDevice?: (deviceId: string) => void;
  /** Canvas writes a client→grid converter here so a tray drag can drop onto it. */
  dropConverterRef?: MutableRefObject<((clientX: number, clientY: number) => Vec2 | null) | null>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState<Pt>({ x: CELL * 2, y: CELL * 2 });
  const [scale, setScale] = useState(1);
  const drag = useRef<DragState | null>(null);
  // Mirrors for the native wheel listener (bound once) + multi-touch pinch.
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  useEffect(() => {
    panRef.current = pan;
    scaleRef.current = scale;
  });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ d0: number; gx: number; gy: number; scale0: number } | null>(null);

  // In-progress polygon (grid space) + the snapped cursor preview.
  const [draft, setDraft] = useState<Vec2[]>([]);
  const [hover, setHover] = useState<Vec2 | null>(null);
  // Live move preview (grid units) for the shape being dragged.
  const [moveDraft, setMoveDraft] = useState<{ areaId: string; dx: number; dy: number } | null>(null);
  // Live move preview for a chip being dragged.
  const chipDrag = useRef<ChipDragState | null>(null);
  const [chipMoveDraft, setChipMoveDraft] = useState<{ deviceId: string; dx: number; dy: number } | null>(null);
  // Live preview for a vertex being dragged on the selected shape.
  const vertexDrag = useRef<{ areaId: string; index: number; pointerId: number; startX: number; startY: number; orig: Vec2; moved: boolean } | null>(null);
  const [vertexDraft, setVertexDraft] = useState<{ areaId: string; index: number; point: Vec2 } | null>(null);

  const areaMode = mode === 'areas';
  const deviceMode = mode === 'devices';
  const drawingActive = areaMode && drawing;

  const onPlane = useCallback(
    (s: AreaShape) => showAllFloors || s.floorId === activeFloorId,
    [showAllFloors, activeFloorId],
  );
  const visibleShapes = useMemo(() => shapes.filter(onPlane), [shapes, onPlane]);
  const planeShapes = useMemo(
    () => shapes.filter((s) => s.floorId === activeFloorId),
    [shapes, activeFloorId],
  );
  const visiblePlacements = useMemo(
    () => (mode === 'areas' ? [] : placements.filter((p) => showAllFloors || p.floorId === activeFloorId)),
    [mode, placements, showAllFloors, activeFloorId],
  );

  // ── coordinate transforms (CELL * scale px per grid unit) ────────────────────
  const unit = CELL * scale;
  const gridToScreen = useCallback((g: Vec2): Pt => ({ x: g[0] * CELL * scale + pan.x, y: g[1] * CELL * scale + pan.y }), [pan, scale]);
  const clientToGrid = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const rect = containerRef.current?.getBoundingClientRect();
      const lx = clientX - (rect?.left ?? 0);
      const ly = clientY - (rect?.top ?? 0);
      return [(lx - pan.x) / (CELL * scale), (ly - pan.y) / (CELL * scale)];
    },
    [pan, scale],
  );

  // Expose a client→grid converter for tray drops (null when outside the canvas).
  useEffect(() => {
    if (!dropConverterRef) return;
    dropConverterRef.current = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      return snapQuarter(clientToGrid(clientX, clientY));
    };
    return () => {
      if (dropConverterRef) dropConverterRef.current = null;
    };
  }, [dropConverterRef, clientToGrid]);

  const snap = useCallback(
    (g: Vec2): Vec2 => nearestVertex(g, planeShapes, SNAP_RADIUS) ?? snapToGrid(g),
    [planeShapes],
  );

  const hitTest = useCallback(
    (g: Vec2): string | null => {
      for (let i = visibleShapes.length - 1; i >= 0; i -= 1) {
        if (pointInPolygon(g, visibleShapes[i].points)) return visibleShapes[i].areaId;
      }
      return null;
    },
    [visibleShapes],
  );

  // ── drawing (areas mode) ─────────────────────────────────────────────────────
  const commitIfClosable = useCallback(
    (g: Vec2): boolean => {
      if (draft.length >= 3) {
        const d0 = draft[0];
        const dx = g[0] - d0[0];
        const dy = g[1] - d0[1];
        if (dx * dx + dy * dy <= CLOSE_RADIUS * CLOSE_RADIUS) {
          onCommitDraft(draft);
          setDraft([]);
          setHover(null);
          return true;
        }
      }
      return false;
    },
    [draft, onCommitDraft],
  );

  const closeDraft = useCallback(() => {
    if (draft.length >= 3) {
      onCommitDraft(draft);
      setDraft([]);
      setHover(null);
    }
  }, [draft, onCommitDraft]);

  // ── canvas pointer handlers (pan + area select/move + drawing) ────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size >= 2) { drag.current = null; startPinch(); return; }
    if (drawingActive) return; // drawing is click-driven (pointerup)
    const g = clientToGrid(e.clientX, e.clientY);
    const hit = areaMode ? hitTest(g) : null;
    if (hit && areaMode) {
      drag.current = { mode: 'move', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: pan, areaId: hit, moved: false };
    } else {
      drag.current = { mode: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: pan, areaId: null, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) { updatePinch(); return; }
    if (drawingActive) {
      setHover(snap(clientToGrid(e.clientX, e.clientY)));
      return;
    }
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    if (!d.moved && Math.abs(dxPx) + Math.abs(dyPx) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.mode === 'pan') setPan({ x: d.origin.x + dxPx, y: d.origin.y + dyPx });
    else if (d.areaId) setMoveDraft({ areaId: d.areaId, dx: dxPx / unit, dy: dyPx / unit });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasPinch = pinch.current !== null;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (wasPinch) { setMoveDraft(null); return; } // ending a pinch — no click/draw
    if (drawingActive) {
      const g = snap(clientToGrid(e.clientX, e.clientY));
      if (commitIfClosable(g)) return;
      setDraft((prev) => [...prev, g]);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved) {
      if (areaMode) onSelect(d.areaId && d.areaId === selectedAreaId ? null : d.areaId);
      return;
    }
    if (d.mode === 'move' && d.areaId && moveDraft) {
      const dx = Math.round(moveDraft.dx);
      const dy = Math.round(moveDraft.dy);
      if (dx !== 0 || dy !== 0) moveBy(d.areaId, dx, dy);
    }
    setMoveDraft(null);
  };

  const onDoubleClick = () => {
    if (drawingActive) closeDraft();
  };

  // ── chip pointer handlers (devices mode reposition / select) ──────────────────
  const onChipPointerDown = (e: React.PointerEvent, deviceId: string) => {
    // Always stop the canvas from grabbing the pointer (its pan capture would
    // otherwise swallow the chip's click in view mode).
    e.stopPropagation();
    if (!deviceMode) return; // view mode taps open more-info via onClick
    chipDrag.current = { deviceId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onChipPointerMove = (e: React.PointerEvent) => {
    const c = chipDrag.current;
    if (!c || c.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - c.startX;
    const dyPx = e.clientY - c.startY;
    if (!c.moved && Math.abs(dxPx) + Math.abs(dyPx) > 4) c.moved = true;
    if (!c.moved) return;
    setChipMoveDraft({ deviceId: c.deviceId, dx: dxPx / unit, dy: dyPx / unit });
  };

  const onChipPointerUp = (e: React.PointerEvent) => {
    const c = chipDrag.current;
    chipDrag.current = null;
    if (!c || c.pointerId !== e.pointerId) return;
    if (!c.moved) {
      onSelectDevice?.(c.deviceId);
    } else if (chipMoveDraft) {
      const dx = Math.round(chipMoveDraft.dx * 4) / 4;
      const dy = Math.round(chipMoveDraft.dy * 4) / 4;
      if (dx !== 0 || dy !== 0) onMoveDevice?.(c.deviceId, dx, dy);
    }
    setChipMoveDraft(null);
  };

  // ── vertex pointer handlers (areas mode — reshape the selected polygon) ───────
  const onVertexPointerDown = (e: React.PointerEvent, areaId: string, index: number, orig: Vec2) => {
    if (!areaMode || drawingActive) return;
    e.stopPropagation();
    vertexDrag.current = { areaId, index, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, orig, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onVertexPointerMove = (e: React.PointerEvent) => {
    const v = vertexDrag.current;
    if (!v || v.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - v.startX;
    const dyPx = e.clientY - v.startY;
    if (!v.moved && Math.abs(dxPx) + Math.abs(dyPx) > 3) v.moved = true;
    if (!v.moved) return;
    const np = snap([v.orig[0] + dxPx / unit, v.orig[1] + dyPx / unit]);
    setVertexDraft({ areaId: v.areaId, index: v.index, point: np });
  };

  const onVertexPointerUp = (e: React.PointerEvent) => {
    const v = vertexDrag.current;
    vertexDrag.current = null;
    if (!v || v.pointerId !== e.pointerId) return;
    if (v.moved && vertexDraft) setVertex?.(v.areaId, v.index, vertexDraft.point);
    setVertexDraft(null);
  };

  const resetView = () => { setPan({ x: CELL * 2, y: CELL * 2 }); setScale(1); };

  /** Zoom toward a container-local point, keeping that point fixed on screen. */
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const cur = scaleRef.current;
    const next = Math.min(3, Math.max(0.3, cur * factor));
    if (next === cur) return;
    const ratio = next / cur;
    const p = panRef.current;
    setPan({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio });
    setScale(next);
  };

  const zoomByButton = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(rect.width / 2, rect.height / 2, factor);
  };

  // Wheel zoom — native non-passive listener (React's onWheel is passive, so it
  // can't preventDefault the page scroll). Bound once; reads pan/scale via refs.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  // ── pinch-to-zoom (two-finger) ────────────────────────────────────────────
  const startPinch = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midX = (a.x + b.x) / 2 - rect.left;
    const midY = (a.y + b.y) / 2 - rect.top;
    pinch.current = {
      d0,
      gx: (midX - pan.x) / unit,
      gy: (midY - pan.y) / unit,
      scale0: scale,
    };
  };

  const updatePinch = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const pc = pinch.current;
    if (!rect || !pc) return;
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const next = Math.min(3, Math.max(0.3, pc.scale0 * (d / pc.d0)));
    const midX = (a.x + b.x) / 2 - rect.left;
    const midY = (a.y + b.y) / 2 - rect.top;
    setScale(next);
    setPan({ x: midX - pc.gx * CELL * next, y: midY - pc.gy * CELL * next });
  };

  // Keyboard: Enter closes a draft, Esc cancels draft / deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draft.length) setDraft([]);
        else onSelect(null);
      } else if (e.key === 'Enter' && drawingActive) {
        closeDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft.length, drawingActive, closeDraft, onSelect]);

  // Cancel a half-drawn polygon when drawing is disarmed (state-during-render).
  const [prevDrawing, setPrevDrawing] = useState(drawingActive);
  if (prevDrawing !== drawingActive) {
    setPrevDrawing(drawingActive);
    if (!drawingActive) {
      setDraft([]);
      setHover(null);
    }
  }

  const renderPoints = useCallback(
    (s: AreaShape): Vec2[] => {
      if (moveDraft && moveDraft.areaId === s.areaId) {
        return s.points.map(([x, y]) => [x + moveDraft.dx, y + moveDraft.dy] as Vec2);
      }
      if (vertexDraft && vertexDraft.areaId === s.areaId) {
        return s.points.map((p, i) => (i === vertexDraft.index ? vertexDraft.point : p));
      }
      return s.points;
    },
    [moveDraft, vertexDraft],
  );

  const chipPoint = useCallback(
    (p: DevicePlacement): Vec2 => {
      if (chipMoveDraft && chipMoveDraft.deviceId === p.deviceId) {
        return [p.point[0] + chipMoveDraft.dx, p.point[1] + chipMoveDraft.dy];
      }
      return p.point;
    },
    [chipMoveDraft],
  );

  // The shape whose vertices are editable right now (areas mode, selected, idle).
  const selectedShape = areaMode && !drawingActive && selectedAreaId
    ? visibleShapes.find((s) => s.areaId === selectedAreaId) ?? null
    : null;

  const draftScreen = useMemo(() => draft.map((g) => gridToScreen(g)), [draft, gridToScreen]);
  const hoverScreen = hover ? gridToScreen(hover) : null;
  const canClose = draft.length >= 3 && hover != null
    ? (() => {
        const d0 = draft[0];
        const dx = hover[0] - d0[0];
        const dy = hover[1] - d0[1];
        return dx * dx + dy * dy <= CLOSE_RADIUS * CLOSE_RADIUS;
      })()
    : false;

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full touch-none select-none overflow-hidden ${
        drawingActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={
        // The editor shows graph paper; the dashboard map is transparent so the
        // dashboard's own background shows through.
        mode === 'view'
          ? { backgroundColor: 'transparent' }
          : {
              backgroundColor: 'var(--ha-color-surface-low)',
              backgroundImage: `radial-gradient(circle, var(--ha-color-surface-lower) ${2 * scale}px, transparent ${2 * scale}px)`,
              backgroundSize: `${unit}px ${unit}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <ShapeLayer
        shapes={visibleShapes}
        areaInfo={areaInfo}
        selectedAreaId={selectedAreaId}
        areaMode={areaMode}
        showAllFloors={showAllFloors}
        activeFloorId={activeFloorId}
        moveDraft={moveDraft}
        vertexDraft={vertexDraft}
        panX={pan.x}
        panY={pan.y}
        scale={scale}
      />

      {/* Draft polygon overlay — editor-only, so it lives outside ShapeLayer. */}
      {(draftScreen.length > 0 || (drawingActive && hoverScreen)) && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {draftScreen.length > 0 && (
            <g>
              <polyline
                points={draftScreen.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="var(--ha-color-blue)"
                strokeWidth={2}
                strokeDasharray="6 5"
                strokeLinejoin="round"
              />
              {hoverScreen && (
                <line
                  x1={draftScreen[draftScreen.length - 1].x}
                  y1={draftScreen[draftScreen.length - 1].y}
                  x2={hoverScreen.x}
                  y2={hoverScreen.y}
                  stroke="var(--ha-color-blue)"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  strokeOpacity={0.6}
                />
              )}
              {draftScreen.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === 0 && canClose ? 7 : 4}
                  fill={i === 0 && canClose ? 'var(--ha-color-blue)' : 'var(--ha-color-surface-default)'}
                  stroke="var(--ha-color-blue)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          {drawingActive && hoverScreen && draftScreen.length === 0 && (
            <circle cx={hoverScreen.x} cy={hoverScreen.y} r={4} fill="var(--ha-color-blue)" />
          )}
        </svg>
      )}

      {/* Device chips overlay (devices + view modes). */}
      {mode !== 'areas' && (
        <div className="absolute inset-0">
          {visiblePlacements.map((p) => {
            const info = deviceChipInfo[p.deviceId];
            if (!info) return null;
            const s = gridToScreen(chipPoint(p));
            const selected = deviceMode && p.deviceId === selectedDeviceId;
            return (
              <MemoDeviceChip
                key={p.deviceId}
                info={info}
                left={s.x}
                top={s.y}
                selected={selected}
                draggable={deviceMode}
                live={mode === 'view'}
                onPointerDown={(e) => onChipPointerDown(e, p.deviceId)}
                onPointerMove={onChipPointerMove}
                onPointerUp={onChipPointerUp}
                onClick={() => { if (mode === 'view') onSelectDevice?.(p.deviceId); }}
                onToggle={onToggleDevice ? () => onToggleDevice(p.deviceId) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Vertex + edge handles for the selected shape — drag corners to reshape,
          tap an edge "+" to add a new corner there. */}
      {selectedShape && (
        <div className="absolute inset-0">
          {insertVertex && renderPoints(selectedShape).map((g, i) => {
            const pts = renderPoints(selectedShape);
            const next = pts[(i + 1) % pts.length];
            const mid: Vec2 = [(g[0] + next[0]) / 2, (g[1] + next[1]) / 2];
            const sc = gridToScreen(mid);
            return (
              <button
                key={`e${i}`}
                type="button"
                aria-label={`Add corner on edge ${i + 1}`}
                title="Add corner"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => insertVertex(selectedShape.areaId, i + 1, mid)}
                style={{ left: sc.x, top: sc.y }}
                className="absolute flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-text-tertiary bg-surface-default/90 text-text-tertiary opacity-70 transition hover:scale-125 hover:opacity-100"
              >
                <Icon path={mdiPlus} size={11} />
              </button>
            );
          })}
          {renderPoints(selectedShape).map((g, i) => {
            const sc = gridToScreen(g);
            const color = areaInfo[selectedShape.areaId]?.color ?? 'var(--ha-color-blue)';
            return (
              <div
                key={i}
                role="button"
                aria-label={`Move corner ${i + 1}`}
                onPointerDown={(e) => onVertexPointerDown(e, selectedShape.areaId, i, selectedShape.points[i])}
                onPointerMove={onVertexPointerMove}
                onPointerUp={onVertexPointerUp}
                onPointerCancel={onVertexPointerUp}
                style={{ left: sc.x, top: sc.y, borderColor: color }}
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 bg-surface-default shadow-sm transition-transform hover:scale-125 active:cursor-grabbing"
              />
            );
          })}
        </div>
      )}

      {/* Zoom + reset controls. Stop pointerdown from reaching the canvas, whose
          pan capture would otherwise swallow these clicks. */}
      <div
        className="absolute bottom-ha-4 left-ha-4 z-10 flex flex-col gap-ha-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col overflow-hidden rounded-ha-xl border border-surface-lower bg-surface-default shadow-sm">
          <IconButton icon={mdiPlus} label="Zoom in" onClick={() => zoomByButton(1.2)} />
          <div className="h-px bg-surface-lower" />
          <IconButton icon={mdiMinus} label="Zoom out" onClick={() => zoomByButton(1 / 1.2)} />
        </div>
        <IconButton icon={mdiCrosshairsGps} label="Reset view" shape="square" filled onClick={resetView} />
      </div>

      {drawingActive && (
        <div className="pointer-events-none absolute left-1/2 top-ha-4 z-10 -translate-x-1/2 rounded-full border border-surface-lower bg-surface-default/95 px-ha-4 py-ha-2 text-[13px] font-medium text-text-secondary shadow-sm">
          <span className="inline-flex items-center gap-ha-2">
            <Icon path={mdiVectorPolygon} size={16} className="text-ha-blue" />
            {draft.length === 0
              ? 'Click to place the first corner'
              : draft.length < 3
                ? 'Keep clicking corners…'
                : 'Click the first corner (or press Enter) to close'}
          </span>
        </div>
      )}
    </div>
  );
}
