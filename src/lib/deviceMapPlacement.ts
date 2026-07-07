// ─────────────────────────────────────────────────────────────────────────────
// Device map placement — where each device sits on its floor's artboard. Points
// are in the same GRID space as AreaShape.points (see areaGeometry.ts), so a
// device pinned at [4, 3] lands on the same coordinate the room was drawn in.
// HA has no such field, so this persists to localStorage keyed by device id,
// mirroring `ha_area_geometry` / `ha_device_order`.
// ─────────────────────────────────────────────────────────────────────────────

import type { Vec2 } from './areaGeometry';

export interface DevicePlacement {
  deviceId: string;
  /** Which floor plane the chip is pinned to (null → unassigned floor). */
  floorId: string | null;
  /** Position in grid coordinates. */
  point: Vec2;
}

export type DevicePlacementMap = Record<string, DevicePlacement>;

const LS_KEY = 'ha_device_map_positions';

export function loadDevicePlacements(): DevicePlacementMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DevicePlacementMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDevicePlacements(map: DevicePlacementMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* quota / private-mode — placements just won't persist */
  }
}

/** Drop placements whose device no longer exists (orphan reconcile). */
export function reconcilePlacements(map: DevicePlacementMap, knownDeviceIds: Set<string>): DevicePlacementMap {
  const next: DevicePlacementMap = {};
  let changed = false;
  for (const [id, p] of Object.entries(map)) {
    if (knownDeviceIds.has(id)) next[id] = p;
    else changed = true;
  }
  return changed ? next : map;
}
