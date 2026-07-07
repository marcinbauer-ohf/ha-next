// ─────────────────────────────────────────────────────────────────────────────
// Area map geometry — the vector layer behind the Areas & Floors V2 map editor.
// Each area can carry a closed polygon describing its physical footprint, drawn
// on a per-floor "artboard". Points are GRID UNITS (integer vertices on the
// graph paper), not pixels — resolution-independent and clean to export to SVG
// or a 3D view later. HA's area registry has no geometry field, so this lives in
// localStorage (keyed by area_id), mirroring the `ha_device_order` pattern.
// ─────────────────────────────────────────────────────────────────────────────

export type Vec2 = [number, number];

export interface AreaShape {
  areaId: string;
  /** Which floor plane the shape lives on (null → unassigned floor). */
  floorId: string | null;
  /** Closed polygon, >= 3 vertices, in grid coordinates. */
  points: Vec2[];
  /** Optional rotation in degrees (reserved; UI is a follow-up). */
  rotation?: number;
}

export type AreaGeometryMap = Record<string, AreaShape>;

const LS_KEY = 'ha_area_geometry';

/** Load the geometry map from localStorage. Safe on the server (returns {}). */
export function loadAreaGeometry(): AreaGeometryMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AreaGeometryMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist the geometry map. No-op on the server. */
export function saveAreaGeometry(map: AreaGeometryMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* quota / private-mode — geometry just won't persist */
  }
}

/** Drop shapes whose area no longer exists in the registry (orphan reconcile). */
export function reconcileGeometry(map: AreaGeometryMap, knownAreaIds: Set<string>): AreaGeometryMap {
  const next: AreaGeometryMap = {};
  let changed = false;
  for (const [id, shape] of Object.entries(map)) {
    if (knownAreaIds.has(id)) next[id] = shape;
    else changed = true;
  }
  return changed ? next : map;
}

// ── Area accents ─────────────────────────────────────────────────────────────
// One palette + hash for every surface that colours by area (editor polygons,
// dashboard chips), so an area keeps the same accent everywhere.

export const AREA_PALETTE = ['#18bcf2', '#2aa361', '#8b5cf6', '#f97316', '#e11d48', '#14b8a6', '#eab308', '#6366f1'];

export function colorForArea(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AREA_PALETTE[h % AREA_PALETTE.length];
}

// ── Geometry math (pure) ─────────────────────────────────────────────────────

/** Snap a grid-space point to the nearest integer vertex. */
export function snapToGrid(p: Vec2): Vec2 {
  return [Math.round(p[0]), Math.round(p[1])];
}

/** Centroid of a polygon (simple vertex average — good enough for label placement). */
export function centroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
}

/** Ray-casting point-in-polygon test (grid space). */
export function pointInPolygon(p: Vec2, points: Vec2[]): boolean {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Squared distance between two points (avoids sqrt for nearest-checks). */
export function dist2(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Nearest existing vertex across all given shapes within `radius` grid units.
 * Lets a new room snap its corners onto a neighbour's corner so they share walls.
 */
export function nearestVertex(p: Vec2, shapes: AreaShape[], radius = 0.5): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = radius * radius;
  for (const s of shapes) {
    for (const v of s.points) {
      const d = dist2(p, v);
      if (d <= bestD) {
        bestD = d;
        best = v;
      }
    }
  }
  return best;
}

/** Axis-aligned bounding box of a set of points (grid space). */
export function bbox(points: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
