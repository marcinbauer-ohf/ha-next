'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Vec2 } from '@/lib/areaGeometry';
import {
  type DevicePlacement,
  type DevicePlacementMap,
  loadDevicePlacements,
  saveDevicePlacements,
  reconcilePlacements,
} from '@/lib/deviceMapPlacement';
import { useRemoteMapSync, persistRemoteMap } from './useRemoteMapSync';

const REMOTE_KEY = 'ha_next.device_map_placements';

export interface DevicePlacementStore {
  placements: DevicePlacementMap;
  placementList: DevicePlacement[];
  place: (deviceId: string, floorId: string | null, point: Vec2) => void;
  moveBy: (deviceId: string, dx: number, dy: number) => void;
  remove: (deviceId: string) => void;
}

/**
 * Source of truth for where devices sit on the floor map. Loads from
 * localStorage, reconciles away orphans when the device set changes, and
 * debounce-persists. Shared by the editor (placement) and the dashboard map
 * (display).
 */
export function useDeviceMapPlacement(knownDeviceIds: string[]): DevicePlacementStore {
  const [placements, setPlacements] = useState<DevicePlacementMap>({});
  const loaded = useRef(false);

  useEffect(() => {
    setPlacements(loadDevicePlacements());
    loaded.current = true;
  }, []);

  // Once connected, reconcile with the HA-server copy (see useRemoteMapSync).
  const remoteSynced = useRemoteMapSync<DevicePlacementMap>(REMOTE_KEY, setPlacements, loaded);

  // Empty set = device registry not loaded yet; reconciling would wipe every
  // placement and then persist the wipe.
  const knownKey = knownDeviceIds.slice().sort().join('|');
  useEffect(() => {
    if (!loaded.current || knownDeviceIds.length === 0) return;
    setPlacements((prev) => reconcilePlacements(prev, new Set(knownDeviceIds)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownKey]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      saveDevicePlacements(placements);
      persistRemoteMap(REMOTE_KEY, placements, remoteSynced);
    }, 250);
    return () => clearTimeout(t);
  }, [placements, remoteSynced]);

  const place = useCallback((deviceId: string, floorId: string | null, point: Vec2) => {
    setPlacements((prev) => ({ ...prev, [deviceId]: { deviceId, floorId, point } }));
  }, []);

  const moveBy = useCallback((deviceId: string, dx: number, dy: number) => {
    setPlacements((prev) => {
      const p = prev[deviceId];
      if (!p) return prev;
      return { ...prev, [deviceId]: { ...p, point: [p.point[0] + dx, p.point[1] + dy] } };
    });
  }, []);

  const remove = useCallback((deviceId: string) => {
    setPlacements((prev) => {
      if (!prev[deviceId]) return prev;
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  }, []);

  const placementList = useMemo(() => Object.values(placements), [placements]);

  return { placements, placementList, place, moveBy, remove };
}
