'use client';

import { useCallback, useMemo } from 'react';
import { useHomeAssistant } from './useHomeAssistant';
import { useDeviceStructure, refreshRegistry } from './useDevices';
import type {
  AreaRegistryEntry,
  FloorRegistryEntry,
  LabelRegistryEntry,
  AreaWriteFields,
  FloorWriteFields,
  LabelWriteFields,
} from '@/lib/homeassistant';

/** An area joined with the device/entity counts the list view shows. */
export interface AreaWithCounts extends AreaRegistryEntry {
  deviceCount: number;
  entityCount: number;
}

/** A floor joined with the areas assigned to it (registry order). */
export interface FloorWithAreas extends FloorRegistryEntry {
  areas: AreaWithCounts[];
}

export interface AreasFloorsModel {
  /** Floors in registry order (the user's custom priority), each carrying its assigned areas. */
  floors: FloorWithAreas[];
  /** Areas with no floor_id (or a dangling floor_id), shown under "Unassigned". */
  unassignedAreas: AreaWithCounts[];
  /** Flat list of all areas with counts, in registry order. */
  areas: AreaWithCounts[];
  labels: LabelRegistryEntry[];
  loading: boolean;
  /** False when in demo mode or disconnected — writes are blocked then. */
  editable: boolean;

  createArea: (fields: AreaWriteFields) => Promise<void>;
  updateArea: (areaId: string, fields: AreaWriteFields) => Promise<void>;
  deleteArea: (areaId: string) => Promise<void>;
  reassignAreaToFloor: (areaId: string, floorId: string | null) => Promise<void>;
  /** Persist a full custom area order (every area id exactly once). HA 2025.12+. */
  reorderAreas: (areaIds: string[]) => Promise<void>;
  /** Reassign + reposition in one gesture: update floor_id, then persist the new global order. */
  moveArea: (areaId: string, floorId: string | null, areaIds: string[]) => Promise<void>;

  createFloor: (fields: FloorWriteFields) => Promise<void>;
  updateFloor: (floorId: string, fields: FloorWriteFields) => Promise<void>;
  deleteFloor: (floorId: string) => Promise<void>;
  /** Persist a full custom floor order (every floor id exactly once). HA 2025.12+. */
  reorderFloors: (floorIds: string[]) => Promise<void>;

  createLabel: (fields: LabelWriteFields) => Promise<void>;
  updateLabel: (labelId: string, fields: LabelWriteFields) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;
}

/**
 * Joins the area/floor/label registries with per-area device & entity counts
 * and exposes CRUD actions that refresh the shared registry store on success
 * (so the whole app re-renders with the new layout immediately).
 *
 * Real-HA only: in demo mode / disconnected, `editable` is false and the write
 * methods reject (the underlying context guards enforce this too).
 */
export function useAreasFloors(): AreasFloorsModel {
  const ha = useHomeAssistant();
  const { devices, areaReg, floors: floorReg, labelReg, loading } = useDeviceStructure();

  const editable = ha.connected && !ha.demoMode;

  const getters = useMemo(
    () => ({
      getEntityRegistry: ha.getEntityRegistry,
      getDeviceRegistry: ha.getDeviceRegistry,
      getAreaRegistry: ha.getAreaRegistry,
      getFloorRegistry: ha.getFloorRegistry,
      getLabelRegistry: ha.getLabelRegistry,
    }),
    [ha.getEntityRegistry, ha.getDeviceRegistry, ha.getAreaRegistry, ha.getFloorRegistry, ha.getLabelRegistry],
  );

  // Per-area device & entity tallies, derived once from the device structure.
  const countsByArea = useMemo(() => {
    const map = new Map<string, { deviceCount: number; entityCount: number }>();
    for (const d of devices) {
      if (!d.areaId) continue;
      const prev = map.get(d.areaId) ?? { deviceCount: 0, entityCount: 0 };
      prev.deviceCount += 1;
      prev.entityCount += d.entities.length;
      map.set(d.areaId, prev);
    }
    return map;
  }, [devices]);

  // Registry order is preserved — HA returns areas in the user's custom order
  // (drag-reorder in HA 2025.12+), so no alphabetical re-sort here.
  const areas = useMemo<AreaWithCounts[]>(
    () =>
      areaReg.map((a) => ({
        ...a,
        deviceCount: countsByArea.get(a.area_id)?.deviceCount ?? 0,
        entityCount: countsByArea.get(a.area_id)?.entityCount ?? 0,
      })),
    [areaReg, countsByArea],
  );

  const { floors, unassignedAreas } = useMemo(() => {
    const floorIds = new Set(floorReg.map((f) => f.floor_id));
    const byFloor = new Map<string, AreaWithCounts[]>();
    const unassigned: AreaWithCounts[] = [];
    for (const a of areas) {
      const fid = a.floor_id;
      if (fid && floorIds.has(fid)) {
        const list = byFloor.get(fid) ?? [];
        list.push(a);
        byFloor.set(fid, list);
      } else {
        unassigned.push(a);
      }
    }
    // floorReg arrives in registry order (user's custom priority) from useDeviceStructure.
    const withAreas: FloorWithAreas[] = floorReg.map((f) => ({
      ...f,
      areas: byFloor.get(f.floor_id) ?? [],
    }));
    return { floors: withAreas, unassignedAreas: unassigned };
  }, [floorReg, areas]);

  // Each write hits HA then forces a registry re-pull so consumers re-render.
  const refresh = useCallback(() => refreshRegistry(getters), [getters]);

  const createArea = useCallback(async (f: AreaWriteFields) => { await ha.createArea(f); await refresh(); }, [ha, refresh]);
  const updateArea = useCallback(async (id: string, f: AreaWriteFields) => { await ha.updateArea(id, f); await refresh(); }, [ha, refresh]);
  const deleteArea = useCallback(async (id: string) => { await ha.deleteArea(id); await refresh(); }, [ha, refresh]);
  const reassignAreaToFloor = useCallback(async (id: string, floorId: string | null) => { await ha.updateArea(id, { floor_id: floorId }); await refresh(); }, [ha, refresh]);
  const reorderAreas = useCallback(async (ids: string[]) => { await ha.reorderAreas(ids); await refresh(); }, [ha, refresh]);
  const moveArea = useCallback(async (id: string, floorId: string | null, ids: string[]) => {
    await ha.updateArea(id, { floor_id: floorId });
    // Ordering is best-effort: pre-2025.12 HA lacks the reorder command, but
    // the floor reassignment above must still land (and trigger the refresh).
    try { await ha.reorderAreas(ids); } catch { /* order unsupported on this HA */ }
    await refresh();
  }, [ha, refresh]);

  const createFloor = useCallback(async (f: FloorWriteFields) => { await ha.createFloor(f); await refresh(); }, [ha, refresh]);
  const updateFloor = useCallback(async (id: string, f: FloorWriteFields) => { await ha.updateFloor(id, f); await refresh(); }, [ha, refresh]);
  const deleteFloor = useCallback(async (id: string) => { await ha.deleteFloor(id); await refresh(); }, [ha, refresh]);
  const reorderFloors = useCallback(async (ids: string[]) => { await ha.reorderFloors(ids); await refresh(); }, [ha, refresh]);

  const createLabel = useCallback(async (f: LabelWriteFields) => { await ha.createLabel(f); await refresh(); }, [ha, refresh]);
  const updateLabel = useCallback(async (id: string, f: LabelWriteFields) => { await ha.updateLabel(id, f); await refresh(); }, [ha, refresh]);
  const deleteLabel = useCallback(async (id: string) => { await ha.deleteLabel(id); await refresh(); }, [ha, refresh]);

  return {
    floors,
    unassignedAreas,
    areas,
    labels: labelReg,
    loading,
    editable,
    createArea,
    updateArea,
    deleteArea,
    reassignAreaToFloor,
    reorderAreas,
    moveArea,
    createFloor,
    updateFloor,
    deleteFloor,
    reorderFloors,
    createLabel,
    updateLabel,
    deleteLabel,
  };
}
