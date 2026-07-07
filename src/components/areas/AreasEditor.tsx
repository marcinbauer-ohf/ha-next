'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiDevices, mdiTrashCanOutline, mdiVectorSquare } from '@mdi/js';
import { Sidebar } from '../ui';
import { Icon } from '../ui/Icon';
import { useMobileToolbar } from '@/contexts';
import { useAreasFloors } from '@/hooks/useAreasFloors';
import { useAreaGeometry } from '@/hooks/useAreaGeometry';
import { useDeviceStructure } from '@/hooks/useDevices';
import { useDeviceMapPlacement } from '@/hooks/useDeviceMapPlacement';
import { domainIcon, deviceThumbnail } from '@/lib/homeassistant/entityHelpers';
import { bbox, colorForArea, type Vec2 } from '@/lib/areaGeometry';
import { AreasFloorsPanel } from '../profile/AreasFloorsPanel';
import { AreaMapCanvas, type AreaInfo, type DeviceChipInfo } from './AreaMapCanvas';
import { AreaAssignBody, AreaEditBody } from './AreaConfigPanel';
import { DeviceTray, type TrayDevice } from './DeviceTray';
import { AreasEditorToolbar, type AreaView, type MapSubMode } from './AreasEditorToolbar';

// ─────────────────────────────────────────────────────────────────────────────
// Areas & Floors V2 — full editor shell. The bottom toolbar switches List ↔ Map.
// Map has two sub-modes: "Areas" (draw/edit room footprints) and "Devices" (drag
// devices from a tray onto their room, reposition chips). Geometry + placement
// live in local stores; area names/floors still write to HA via useAreasFloors.
// The canvas is portaled to #app-surface-root so it fills the immersive surface.
// ─────────────────────────────────────────────────────────────────────────────


const ALL = '__all__';

interface Plane {
  id: string | null | typeof ALL;
  label: string;
}

export function AreasEditor({ onExit }: { onExit?: () => void }) {
  const { floors, areas, editable, createArea, updateArea } = useAreasFloors();
  const { devices } = useDeviceStructure();
  const areaIds = useMemo(() => areas.map((a) => a.area_id), [areas]);
  const geom = useAreaGeometry(areaIds);
  const deviceIds = useMemo(() => devices.map((d) => d.id), [devices]);
  const placement = useDeviceMapPlacement(deviceIds);

  const [view, setView] = useState<AreaView>('list');
  const [subMode, setSubMode] = useState<MapSubMode>('areas');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [planeIdx, setPlaneIdx] = useState(0);
  // A committed polygon awaiting area assignment.
  const [pendingDraft, setPendingDraft] = useState<Vec2[] | null>(null);
  const [pendingCreateName, setPendingCreateName] = useState<string | null>(null);

  // Tray → canvas drag session.
  const [dragDeviceId, setDragDeviceId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const dropConverterRef = useRef<((cx: number, cy: number) => Vec2 | null) | null>(null);

  // Hide the mobile bottom nav while our toolbar is up.
  const { acquireToolbar } = useMobileToolbar();
  useEffect(() => acquireToolbar(), [acquireToolbar]);

  const planes = useMemo<Plane[]>(() => {
    if (floors.length === 0) return [{ id: null, label: 'All areas' }];
    const list: Plane[] = floors.map((f) => ({ id: f.floor_id, label: f.name }));
    list.push({ id: null, label: 'No floor' });
    list.push({ id: ALL, label: 'All floors' });
    return list;
  }, [floors]);

  const safeIdx = Math.min(planeIdx, planes.length - 1);
  const activePlane = planes[safeIdx];
  const showAllFloors = activePlane.id === ALL;
  const activeFloorId = showAllFloors ? null : (activePlane.id as string | null);

  const areaInfo = useMemo<Record<string, AreaInfo>>(() => {
    const map: Record<string, AreaInfo> = {};
    for (const a of areas) {
      map[a.area_id] = { name: a.name, icon: a.icon || mdiVectorSquare, color: colorForArea(a.area_id) };
    }
    return map;
  }, [areas]);

  // Device chip info for the canvas (editor: show name; colour follows the room).
  const deviceChipInfo = useMemo<Record<string, DeviceChipInfo>>(() => {
    const map: Record<string, DeviceChipInfo> = {};
    for (const d of devices) {
      map[d.id] = {
        name: d.name,
        state: '', // no live state in the editor
        image: d.primaryEntity ? deviceThumbnail(d.primaryEntity) : null,
        icon: d.primaryEntity ? domainIcon(d.primaryEntity) : mdiDevices,
        active: false,
        color: d.areaId ? colorForArea(d.areaId) : '#18bcf2',
      };
    }
    return map;
  }, [devices]);

  const unplacedAreas = useMemo(
    () => areas.filter((a) => !geom.shapes[a.area_id]).sort((x, y) => x.name.localeCompare(y.name)),
    [areas, geom.shapes],
  );

  // Devices on the active floor that aren't yet placed → tray candidates.
  const trayDevices = useMemo<TrayDevice[]>(() => {
    if (showAllFloors) return [];
    const areaFloor = new Map(areas.map((a) => [a.area_id, a.floor_id ?? null]));
    const nameOf = new Map(areas.map((a) => [a.area_id, a.name]));
    return devices
      .filter((d) => d.primaryEntity && d.areaId && (areaFloor.get(d.areaId) ?? null) === activeFloorId && !placement.placements[d.id])
      .map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.primaryEntity ? domainIcon(d.primaryEntity) : mdiDevices,
        areaName: nameOf.get(d.areaId as string) ?? 'Area',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, areas, activeFloorId, showAllFloors, placement.placements]);

  // Resolve "create & assign" once the new area lands in the refreshed registry.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!pendingDraft || !pendingCreateName) return;
    const match = areas.find((a) => a.name === pendingCreateName && !geom.shapes[a.area_id]);
    if (!match) return;
    geom.upsert({ areaId: match.area_id, floorId: activeFloorId, points: pendingDraft });
    setSelectedAreaId(match.area_id);
    setPendingDraft(null);
    setPendingCreateName(null);
    setDrawing(true);
  }, [areas, geom, pendingDraft, pendingCreateName, activeFloorId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedArea = selectedAreaId ? areas.find((a) => a.area_id === selectedAreaId) ?? null : null;
  const selectedDevice = selectedDeviceId ? devices.find((d) => d.id === selectedDeviceId) ?? null : null;

  // ── handlers ──────────────────────────────────────────────────────────────
  const clearSelections = () => {
    setSelectedAreaId(null);
    setSelectedDeviceId(null);
    setPendingDraft(null);
  };

  const handleCommitDraft = (points: Vec2[]) => {
    setPendingDraft(points);
    setDrawing(false);
  };

  const handleAssign = (areaId: string) => {
    if (!pendingDraft) return;
    geom.upsert({ areaId, floorId: activeFloorId, points: pendingDraft });
    if (editable && !showAllFloors) {
      const a = areas.find((x) => x.area_id === areaId);
      if (a && a.floor_id !== activeFloorId) updateArea(areaId, { floor_id: activeFloorId }).catch(() => {});
    }
    setSelectedAreaId(areaId);
    setPendingDraft(null);
    setDrawing(true);
  };

  const handleCreateAndAssign = (name: string) => {
    if (!editable || !pendingDraft) return;
    setPendingCreateName(name);
    createArea({ name, floor_id: activeFloorId }).catch(() => setPendingCreateName(null));
  };

  const handleDiscardDraft = () => {
    setPendingDraft(null);
    setDrawing(true);
  };

  // Testing helper: tile a rectangle per area (laid out in a grid per floor so
  // adjacency reads like a floor plan) and scatter every device inside its room.
  const generateTestLayout = () => {
    const COLS = 4;
    const BASE_W = 4;
    const BASE_H = 3;
    const STRIDE_X = BASE_W + 3; // > max width (6) + gap, so rooms never overlap
    const STRIDE_Y = BASE_H + 3;
    const rnd = (n: number) => Math.floor(Math.random() * n);

    const byFloor = new Map<string | null, typeof areas>();
    for (const a of areas) {
      const key = a.floor_id ?? null;
      const list = byFloor.get(key) ?? [];
      list.push(a);
      byFloor.set(key, list);
    }

    const newShapes = new Map<string, { floorId: string | null; points: Vec2[] }>();
    for (const [floorId, list] of byFloor) {
      list.forEach((a, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const w = BASE_W + rnd(3); // 4–6
        const h = BASE_H + rnd(2); // 3–4
        const x = col * STRIDE_X + 1;
        const y = row * STRIDE_Y + 1;
        const points: Vec2[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        newShapes.set(a.area_id, { floorId, points });
        geom.upsert({ areaId: a.area_id, floorId, points });
      });
    }

    const allShapes = [...newShapes.values()];
    for (const d of devices) {
      if (!d.primaryEntity) continue;
      const s = (d.areaId && newShapes.get(d.areaId)) || allShapes[rnd(allShapes.length)];
      if (!s) continue;
      const b = bbox(s.points);
      const px = b.minX + 0.5 + Math.random() * Math.max(0.5, b.maxX - b.minX - 1);
      const py = b.minY + 0.5 + Math.random() * Math.max(0.5, b.maxY - b.minY - 1);
      placement.place(d.id, s.floorId, [Math.round(px * 4) / 4, Math.round(py * 4) / 4]);
    }
    clearSelections();
    setDrawing(false);
  };

  // Devices mode: scatter every device randomly inside the room it's assigned to
  // (uses the already-drawn area shapes; doesn't touch them).
  const scatterDevices = () => {
    for (const d of devices) {
      if (!d.primaryEntity || !d.areaId) continue;
      const s = geom.shapes[d.areaId];
      if (!s) continue;
      const b = bbox(s.points);
      const px = b.minX + 0.5 + Math.random() * Math.max(0.5, b.maxX - b.minX - 1);
      const py = b.minY + 0.5 + Math.random() * Math.max(0.5, b.maxY - b.minY - 1);
      placement.place(d.id, s.floorId, [Math.round(px * 4) / 4, Math.round(py * 4) / 4]);
    }
    clearSelections();
  };

  const handleDeviceDrop = (clientX: number, clientY: number) => {
    if (!dragDeviceId) return;
    const pt = dropConverterRef.current?.(clientX, clientY) ?? null;
    if (pt) {
      placement.place(dragDeviceId, activeFloorId, pt);
      setSelectedDeviceId(dragDeviceId);
    }
    setDragDeviceId(null);
    setGhost(null);
  };

  const devicesSub = subMode === 'devices';
  const canvasMode = view === 'map' ? (devicesSub ? 'devices' : 'areas') : 'areas';

  const showSidebar = view === 'map'
    && ((!devicesSub && (pendingDraft != null || selectedArea != null)) || devicesSub);

  // Sidebar header + body.
  let sidebarHeader: { icon?: string; title: string; onClose?: () => void } = { title: '' };
  let sidebarBody: React.ReactNode = null;

  if (devicesSub && selectedDevice) {
    sidebarHeader = {
      icon: selectedDevice.primaryEntity ? domainIcon(selectedDevice.primaryEntity) : mdiDevices,
      title: selectedDevice.name,
      onClose: () => setSelectedDeviceId(null),
    };
    sidebarBody = (
      <div className="space-y-ha-4 px-ha-4 py-ha-4">
        <p className="text-sm text-text-secondary">Placed on the map. Drag the chip to reposition it.</p>
        <button
          type="button"
          onClick={() => {
            placement.remove(selectedDevice.id);
            setSelectedDeviceId(null);
          }}
          className="flex w-full items-center justify-center gap-ha-2 rounded-ha-2xl border border-surface-lower px-ha-4 py-ha-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
        >
          <Icon path={mdiTrashCanOutline} size={18} />
          Remove from map
        </button>
      </div>
    );
  } else if (devicesSub) {
    sidebarHeader = { icon: mdiDevices, title: 'Place devices' };
    sidebarBody = (
      <DeviceTray
        devices={trayDevices}
        onDragStart={setDragDeviceId}
        onDragMove={(x, y) => setGhost({ x, y })}
        onDrop={handleDeviceDrop}
      />
    );
  } else if (pendingDraft) {
    sidebarHeader = { icon: mdiVectorSquare, title: 'Assign area' };
    sidebarBody = (
      <AreaAssignBody
        unplacedAreas={unplacedAreas}
        editable={editable}
        onAssign={handleAssign}
        onCreateAndAssign={handleCreateAndAssign}
        onCancel={handleDiscardDraft}
      />
    );
  } else if (selectedArea) {
    sidebarHeader = { icon: selectedArea.icon || mdiVectorSquare, title: selectedArea.name, onClose: () => setSelectedAreaId(null) };
    sidebarBody = (
      <AreaEditBody
        area={selectedArea}
        floors={floors}
        editable={editable}
        onRename={(name) => updateArea(selectedArea.area_id, { name }).catch(() => {})}
        onChangeFloor={(floorId) => {
          geom.setFloor(selectedArea.area_id, floorId);
          if (editable) updateArea(selectedArea.area_id, { floor_id: floorId }).catch(() => {});
        }}
        onDeleteShape={() => {
          geom.remove(selectedArea.area_id);
          setSelectedAreaId(null);
        }}
      />
    );
  }

  const dismissSheet = () => {
    if (pendingDraft) handleDiscardDraft();
    else { setSelectedAreaId(null); setSelectedDeviceId(null); }
  };

  const appRoot = typeof document !== 'undefined' ? document.getElementById('app-surface-root') : null;

  return (
    <div className={onExit ? 'pb-32' : ''}>
      {view === 'list' && <AreasFloorsPanel />}

      {view === 'map' && !areas.length && (
        <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-5 py-ha-8 text-center text-sm text-text-tertiary">
          No areas yet. Switch to List to create areas, or use Draw to sketch one on the map.
        </div>
      )}

      {view === 'map' && appRoot && createPortal(
        <div className="absolute inset-0 z-30 flex overflow-hidden bg-surface-low">
          <div className="relative min-w-0 flex-1">
            <AreaMapCanvas
              shapes={geom.shapeList}
              activeFloorId={activeFloorId}
              showAllFloors={showAllFloors}
              areaInfo={areaInfo}
              selectedAreaId={selectedAreaId}
              onSelect={(id) => { setSelectedAreaId(id); setSelectedDeviceId(null); }}
              drawing={drawing}
              onCommitDraft={handleCommitDraft}
              moveBy={geom.moveBy}
              setVertex={geom.setVertex}
              insertVertex={geom.insertVertex}
              mode={canvasMode}
              placements={placement.placementList}
              deviceChipInfo={deviceChipInfo}
              selectedDeviceId={selectedDeviceId}
              onMoveDevice={placement.moveBy}
              onSelectDevice={(id) => { setSelectedDeviceId(id); setSelectedAreaId(null); }}
              dropConverterRef={dropConverterRef}
            />
          </div>
          {showSidebar && (
            <Sidebar
              resizable
              {...sidebarHeader}
              className="ha-pane-in mt-16 mr-ha-4 mb-ha-4 hidden flex-shrink-0 self-stretch lg:flex"
            >
              {sidebarBody}
            </Sidebar>
          )}
        </div>,
        appRoot,
      )}

      {/* Mobile config sheet. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSidebar && (
            <>
              <motion.div
                key="area-sheet-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-black/70 lg:hidden"
                onClick={dismissSheet}
              />
              <motion.div
                key="area-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-x-0 bottom-0 z-[100] px-ha-2 lg:hidden"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
              >
                <div className="flex justify-center pb-ha-2">
                  <div className="h-1.5 w-9 rounded-full bg-white/40" />
                </div>
                <Sidebar {...sidebarHeader} className="flex max-h-[82vh]">
                  {sidebarBody}
                </Sidebar>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Drag ghost following the pointer while dragging a tray device. */}
      {typeof document !== 'undefined' && dragDeviceId && ghost && createPortal(
        <div
          className="pointer-events-none fixed z-[120] flex -translate-x-1/2 -translate-y-1/2 items-center gap-ha-2 rounded-ha-2xl border border-ha-blue bg-surface-default py-1 pl-1 pr-ha-2 shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {deviceChipInfo[dragDeviceId]?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={deviceChipInfo[dragDeviceId]!.image as string} alt="" className="h-7 w-7 rounded-full bg-surface-mid object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ha-blue">
              <Icon path={deviceChipInfo[dragDeviceId]?.icon ?? mdiDevices} size={15} className="text-white" />
            </span>
          )}
          <span className="whitespace-nowrap text-[11px] font-semibold text-text-primary">
            {deviceChipInfo[dragDeviceId]?.name}
          </span>
        </div>,
        document.body,
      )}

      <AreasEditorToolbar
        view={view}
        onChangeView={(v) => {
          setView(v);
          if (v === 'list') { setDrawing(false); clearSelections(); }
        }}
        subMode={subMode}
        onChangeSubMode={(m) => {
          setSubMode(m);
          setDrawing(false);
          clearSelections();
        }}
        floorLabel={activePlane.label}
        onPrevFloor={() => setPlaneIdx((i) => Math.max(0, i - 1))}
        onNextFloor={() => setPlaneIdx((i) => Math.min(planes.length - 1, i + 1))}
        canPrevFloor={safeIdx > 0}
        canNextFloor={safeIdx < planes.length - 1}
        drawing={drawing}
        onToggleDraw={() => { setDrawing((d) => !d); clearSelections(); }}
        drawDisabled={showAllFloors}
        onGenerate={areas.length ? (() => (subMode === 'devices' ? scatterDevices() : generateTestLayout())) : undefined}
        onDone={() => onExit?.()}
      />
    </div>
  );
}
