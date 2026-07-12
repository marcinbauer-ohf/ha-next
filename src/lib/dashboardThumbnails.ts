'use client';

import { useSyncExternalStore } from 'react';

/**
 * Snapshot thumbnails for the sidebar hover preview.
 *
 * The dashboards/panels themselves are mostly native-view placeholders, so we
 * can't render a live miniature on hover. Instead we grab a one-off PNG snapshot
 * of a view's content the moment it's meaningfully "settled" — after the user
 * leaves edit mode, or the first time a view is visited with no stored shot —
 * and stash it in localStorage keyed by the route's pathname. On hover the
 * Sidebar paints that image; views never snapshotted just fall back to the
 * label-only tooltip.
 *
 * Capture is deliberately rare (edit-exit + first-visit) and best-effort: any
 * failure (tainted canvas, private-mode storage) is swallowed and the preview
 * simply stays absent. Kept small (downscaled, capped count) so the base64
 * payloads don't blow the ~5MB localStorage budget.
 */

const LS_KEY = 'ha_dashboard_thumbnails_v1';
// Keep the newest N; each downscaled PNG is ~10–40KB, so this stays well under
// the storage budget while covering a realistic sidebar's worth of views.
const MAX_ENTRIES = 24;

interface ThumbEntry {
  dataUrl: string;
  /** epoch ms of capture — used for LRU-ish pruning and staleness display. */
  ts: number;
}

type ThumbMap = Record<string, ThumbEntry>;

const listeners = new Set<() => void>();

// Cache the parsed map + a stable snapshot string so useSyncExternalStore's
// getSnapshot can return a referentially-stable value between writes (returning
// a fresh object each call would loop React).
let cache: ThumbMap | null = null;
let cacheRaw = '';

function read(): ThumbMap {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? '';
    if (raw === cacheRaw && cache) return cache;
    cacheRaw = raw;
    cache = raw ? (JSON.parse(raw) as ThumbMap) : {};
    return cache;
  } catch {
    cache = {};
    cacheRaw = '';
    return cache;
  }
}

function write(map: ThumbMap) {
  try {
    const raw = JSON.stringify(map);
    localStorage.setItem(LS_KEY, raw);
    cache = map;
    cacheRaw = raw;
  } catch {
    /* private mode / quota — non-fatal, preview just won't persist */
  }
  emit();
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function getDashboardThumbnail(path: string): ThumbEntry | null {
  return read()[path] ?? null;
}

export function setDashboardThumbnail(path: string, dataUrl: string, ts: number) {
  const next: ThumbMap = { ...read(), [path]: { dataUrl, ts } };

  // Prune to the newest MAX_ENTRIES by timestamp so old snapshots don't pile up.
  const paths = Object.keys(next);
  if (paths.length > MAX_ENTRIES) {
    paths
      .sort((a, b) => next[a].ts - next[b].ts)
      .slice(0, paths.length - MAX_ENTRIES)
      .forEach((p) => delete next[p]);
  }

  write(next);
}

/** Live thumbnail for a route (SSR-safe, same-tab + cross-tab). */
export function useDashboardThumbnail(path: string): ThumbEntry | null {
  return useSyncExternalStore(
    subscribe,
    () => read()[path] ?? null,
    () => null,
  );
}
