'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  type AutomationNode,
  type NodeKind,
  defOf,
} from './automationFlow';
import { mdiCrosshairsGps, mdiDrag, mdiFlash, mdiHelpCircle, mdiPlay } from '@mdi/js';

// ─────────────────────────────────────────────────────────────────────────────
// Node-graph view of an automation flow — a full-bleed canvas (grid background,
// pan + draggable cards) where triggers / conditions / actions are nodes wired
// together with bezier "noodles". Selecting a card raises the same node-config
// sidebar the list view uses. Demo-only: layout is auto-derived, edges encode
// HA's run logic (any trigger → all conditions → action sequence) and the
// dragged positions live in local state.
// ─────────────────────────────────────────────────────────────────────────────

const NODE_W = 248;
const NODE_H = 76;
const DOT_CELL = NODE_H / 2; // 38px — a card is two cells tall
const COL_GAP = 120; // horizontal gap between kind columns
const ROW_GAP = 28; // vertical gap between stacked cards
const PAD_X = 64;
const PAD_Y = 72;

const COLUMNS: NodeKind[] = ['trigger', 'condition', 'action'];

interface Pt { x: number; y: number; }

/** Auto-layout: one column per kind, cards stacked and vertically centered. */
function computeLayout(nodes: AutomationNode[]): Record<string, Pt> {
  const byKind = COLUMNS.map((kind) => nodes.filter((n) => n.kind === kind));
  const colHeight = (count: number) => count * NODE_H + Math.max(0, count - 1) * ROW_GAP;
  const maxH = Math.max(0, ...byKind.map((col) => colHeight(col.length)));
  const pos: Record<string, Pt> = {};
  byKind.forEach((col, ci) => {
    const x = PAD_X + ci * (NODE_W + COL_GAP);
    const startY = PAD_Y + (maxH - colHeight(col.length)) / 2;
    col.forEach((node, ri) => {
      pos[node.id] = { x, y: startY + ri * (NODE_H + ROW_GAP) };
    });
  });
  return pos;
}

/** Edges encode HA semantics: any trigger fires → every condition must pass →
 *  actions run in order. With no conditions, triggers feed the first action. */
function computeEdges(nodes: AutomationNode[]): Array<[string, string]> {
  const triggers = nodes.filter((n) => n.kind === 'trigger');
  const conditions = nodes.filter((n) => n.kind === 'condition');
  const actions = nodes.filter((n) => n.kind === 'action');
  const edges: Array<[string, string]> = [];

  const gate = conditions.length ? conditions : actions.slice(0, 1);
  triggers.forEach((t) => gate.forEach((g) => edges.push([t.id, g.id])));
  if (conditions.length && actions.length) {
    conditions.forEach((c) => edges.push([c.id, actions[0].id]));
  }
  for (let i = 0; i < actions.length - 1; i += 1) edges.push([actions[i].id, actions[i + 1].id]);
  return edges;
}

/** Cubic bezier from a node's right port to another's left port. */
function noodlePath(from: Pt, to: Pt): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// Kind badge — a small icon overlaying the card's main (grey) icon in the
// bottom-right corner, mirroring the device-add toast's protocol badge: bolt
// for triggers, a condition glyph for conditions, play for actions.
const KIND_BADGE: Record<NodeKind, { icon: string; color: string }> = {
  trigger: { icon: mdiFlash, color: 'text-ha-blue' },
  condition: { icon: mdiHelpCircle, color: 'text-amber-500' },
  action: { icon: mdiPlay, color: 'text-green-500' },
};

interface DragState {
  id: string | null; // null → panning the canvas
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
}

export function AutomationNodeCanvas({
  nodes,
  selectedId,
  onSelect,
  configPanel,
}: {
  nodes: AutomationNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The node-config form, rendered in the canvas sidebar when a node is picked. */
  configPanel: React.ReactNode;
}) {
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  // User-dragged overrides; auto-layout is the fallback so new nodes still place.
  const [moved, setMoved] = useState<Record<string, Pt>>({});
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const drag = useRef<DragState | null>(null);

  const posOf = useCallback(
    (id: string): Pt => moved[id] ?? layout[id] ?? { x: 0, y: 0 },
    [moved, layout],
  );

  const edges = useMemo(() => computeEdges(nodes), [nodes]);

  // Canvas extent → SVG/scroll size so noodles aren't clipped after dragging.
  const extent = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const n of nodes) {
      const p = moved[n.id] ?? layout[n.id];
      if (!p) continue;
      w = Math.max(w, p.x + NODE_W);
      h = Math.max(h, p.y + NODE_H);
    }
    return { w: w + PAD_X, h: h + PAD_Y };
  }, [nodes, moved, layout]);

  const onPointerDown = (e: React.PointerEvent, id: string | null) => {
    if (e.button !== 0) return;
    const origin = id ? posOf(id) : pan;
    drag.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: origin.x,
      origY: origin.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.id) {
      setMoved((prev) => ({ ...prev, [d.id as string]: { x: d.origX + dx, y: d.origY + dy } }));
    } else {
      setPan({ x: d.origX + dx, y: d.origY + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent, id: string | null) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.pointerId !== e.pointerId) return;
    // A press that never moved is a click → (de)select the card.
    if (!d.moved && id !== null) onSelect(id === selectedId ? null : id);
    else if (!d.moved && id === null) onSelect(null);
  };

  const resetView = () => {
    setMoved({});
    setPan({ x: 0, y: 0 });
  };

  // Esc closes the config sidebar, mirroring its X.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSelect(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelect]);

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Scrollable, pannable plane. The grid scrolls with the pan offset. */}
      <div
        className="relative flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        style={{
          backgroundColor: 'var(--ha-color-surface-low)',
          // Dot-grid: one dot per cell. Cell size = NODE_H / 2 so a card spans
          // two cells vertically.
          backgroundImage:
            'radial-gradient(circle, var(--ha-color-surface-lower) 2px, transparent 2px)',
          backgroundSize: `${DOT_CELL}px ${DOT_CELL}px`,
          backgroundPosition: `${pan.x + DOT_CELL / 2}px ${pan.y + DOT_CELL / 2}px`,
        }}
        onPointerDown={(e) => onPointerDown(e, null)}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e, null)}
        onPointerCancel={(e) => onPointerUp(e, null)}
      >
        {/* Everything inside the plane shares the pan transform. */}
        <div
          className="absolute left-0 top-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, width: extent.w, height: extent.h }}
        >
          {/* Noodles behind the cards. */}
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={extent.w}
            height={extent.h}
          >
            {edges.map(([a, b]) => {
              const active = a === selectedId || b === selectedId;
              return (
                <path
                  key={`${a}->${b}`}
                  d={noodlePath(posOf(a), posOf(b))}
                  fill="none"
                  stroke={active ? 'var(--ha-color-blue)' : 'var(--ha-color-text-tertiary)'}
                  strokeOpacity={active ? 0.9 : 0.4}
                  strokeWidth={active ? 2.5 : 2}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Node cards. */}
          {nodes.map((node) => {
            const p = posOf(node.id);
            const def = defOf(node);
            const selected = node.id === selectedId;
            const badge = KIND_BADGE[node.kind];
            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, node.id); }}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => { e.stopPropagation(); onPointerUp(e, node.id); }}
                onPointerCancel={(e) => onPointerUp(e, node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(node.id === selectedId ? null : node.id);
                  }
                }}
                className={`group absolute cursor-grab touch-none rounded-ha-2xl border bg-surface-default text-left shadow-[0_10px_28px_-22px_rgba(15,23,42,0.5)] transition-shadow active:cursor-grabbing ${
                  selected
                    ? 'border-ha-blue/60 shadow-[0_0_0_2px_var(--ha-color-blue)]'
                    : 'border-surface-lower hover:shadow-[0_14px_32px_-20px_rgba(15,23,42,0.55)]'
                } ${node.enabled ? '' : 'opacity-60'}`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              >
                {/* Ports — neutral grey to match the de-coloured cards. */}
                {node.kind !== 'trigger' && (
                  <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-default bg-text-tertiary" />
                )}
                <span className="absolute right-0 top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-default bg-text-tertiary" />

                <div className="flex h-full items-center gap-ha-3 px-ha-3">
                  <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                    <Icon path={def.icon} size={18} />
                    {/* Kind badge, bottom-right (see device-add toast). */}
                    <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-surface-low bg-surface-default shadow-sm">
                      <Icon path={badge.icon} size={11} className={badge.color} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold leading-tight text-text-primary">
                      {def.summary(node.data)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-text-secondary">{def.label}</span>
                  </span>
                  <Icon
                    path={mdiDrag}
                    size={16}
                    className="flex-shrink-0 text-text-disabled opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset view — clears drag + pan. */}
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset layout"
          title="Reset layout"
          className="absolute bottom-ha-4 left-ha-4 z-10 flex h-10 w-10 items-center justify-center rounded-ha-xl border border-surface-lower bg-surface-default text-text-secondary shadow-sm transition-colors hover:bg-surface-low hover:text-text-primary"
        >
          <Icon path={mdiCrosshairsGps} size={18} />
        </button>
      </div>

      {/* Config sidebar — slides in when a node is selected. The panel brings its
          own docked chrome (header + border), so it's rendered directly. */}
      {selectedId && configPanel}
    </div>
  );
}
