'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AreaGeometryMap,
  type AreaShape,
  type Vec2,
  loadAreaGeometry,
  saveAreaGeometry,
  reconcileGeometry,
} from '@/lib/areaGeometry';
import { useRemoteMapSync, persistRemoteMap } from './useRemoteMapSync';

const REMOTE_KEY = 'ha_next.area_geometry';

export interface AreaGeometryStore {
  /** Geometry keyed by area_id. */
  shapes: AreaGeometryMap;
  /** Flat list, convenient for rendering/snapping. */
  shapeList: AreaShape[];
  /** Create or replace the shape for an area. */
  upsert: (shape: AreaShape) => void;
  /** Remove an area's shape. */
  remove: (areaId: string) => void;
  /** Translate every vertex of a shape by (dx, dy) grid units. */
  moveBy: (areaId: string, dx: number, dy: number) => void;
  /** Set a single vertex of a shape to an absolute grid position. */
  setVertex: (areaId: string, index: number, point: Vec2) => void;
  /** Insert a new vertex at `index` (e.g. splitting an edge). */
  insertVertex: (areaId: string, index: number, point: Vec2) => void;
  /** Reassign a shape to a different floor plane. */
  setFloor: (areaId: string, floorId: string | null) => void;
}

/**
 * Single source of truth for the area-map geometry layer. Loads from
 * localStorage on mount, reconciles against the known area ids (dropping
 * orphans), and debounce-persists on change. Shared by the canvas and the
 * config sidebar so edits stay in sync.
 */
export function useAreaGeometry(knownAreaIds: string[]): AreaGeometryStore {
  const [shapes, setShapes] = useState<AreaGeometryMap>({});
  const loaded = useRef(false);

  // Load once on mount (client only).
  useEffect(() => {
    setShapes(loadAreaGeometry());
    loaded.current = true;
  }, []);

  // Once connected, reconcile with the copy stored on the HA server (per-user
  // frontend storage) so the floor plan follows the account across browsers.
  const remoteSynced = useRemoteMapSync<AreaGeometryMap>(REMOTE_KEY, setShapes, loaded);

  // Reconcile away orphans whenever the registry's area set changes. An empty
  // set means the registry simply hasn't loaded yet — reconciling against it
  // would wipe every shape and then persist the wipe.
  const knownKey = knownAreaIds.slice().sort().join('|');
  useEffect(() => {
    if (!loaded.current || knownAreaIds.length === 0) return;
    setShapes((prev) => reconcileGeometry(prev, new Set(knownAreaIds)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownKey]);

  // Debounced persistence — localStorage always (instant-paint cache), HA user
  // data once the initial remote reconcile has run.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      saveAreaGeometry(shapes);
      persistRemoteMap(REMOTE_KEY, shapes, remoteSynced);
    }, 250);
    return () => clearTimeout(t);
  }, [shapes, remoteSynced]);

  const upsert = useCallback((shape: AreaShape) => {
    setShapes((prev) => ({ ...prev, [shape.areaId]: shape }));
  }, []);

  const remove = useCallback((areaId: string) => {
    setShapes((prev) => {
      if (!prev[areaId]) return prev;
      const next = { ...prev };
      delete next[areaId];
      return next;
    });
  }, []);

  const moveBy = useCallback((areaId: string, dx: number, dy: number) => {
    setShapes((prev) => {
      const s = prev[areaId];
      if (!s) return prev;
      const points = s.points.map(([x, y]) => [x + dx, y + dy] as Vec2);
      return { ...prev, [areaId]: { ...s, points } };
    });
  }, []);

  const setVertex = useCallback((areaId: string, index: number, point: Vec2) => {
    setShapes((prev) => {
      const s = prev[areaId];
      if (!s || index < 0 || index >= s.points.length) return prev;
      const points = s.points.slice();
      points[index] = point;
      return { ...prev, [areaId]: { ...s, points } };
    });
  }, []);

  const insertVertex = useCallback((areaId: string, index: number, point: Vec2) => {
    setShapes((prev) => {
      const s = prev[areaId];
      if (!s) return prev;
      const i = Math.max(0, Math.min(index, s.points.length));
      const points = s.points.slice();
      points.splice(i, 0, point);
      return { ...prev, [areaId]: { ...s, points } };
    });
  }, []);

  const setFloor = useCallback((areaId: string, floorId: string | null) => {
    setShapes((prev) => {
      const s = prev[areaId];
      if (!s) return prev;
      return { ...prev, [areaId]: { ...s, floorId } };
    });
  }, []);

  const shapeList = useMemo(() => Object.values(shapes), [shapes]);

  return { shapes, shapeList, upsert, remove, moveBy, setVertex, insertVertex, setFloor };
}
