'use client';

/**
 * Where the user last pressed. Dialogs read this on open so they can grow from
 * the thing that was clicked instead of from the middle of the screen — without
 * every caller having to thread coordinates through props.
 *
 * Stale points are worse than none (a dialog opened by keyboard or by a toast
 * would fly in from wherever the mouse last was), so reads past MAX_AGE_MS come
 * back null and the caller falls back to its centred animation.
 */
const MAX_AGE_MS = 1200;

let point: { x: number; y: number; t: number } | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => { point = { x: e.clientX, y: e.clientY, t: performance.now() }; },
    { capture: true, passive: true },
  );
}

export function lastPointerPoint(): { x: number; y: number } | null {
  if (!point) return null;
  if (performance.now() - point.t > MAX_AGE_MS) return null;
  return { x: point.x, y: point.y };
}
