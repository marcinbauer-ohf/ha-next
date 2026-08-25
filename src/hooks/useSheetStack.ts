'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// The stack — one register for every dialog, sheet and confirm that covers the
// page. When a second one opens over a first, the first shouldn't vanish behind
// the new scrim: it sits back and, on the phone, its rounded top stays visible
// above the newcomer, so "there is something under this" is legible.
//
// Every overlay family owns its own portal, scrim and panel, so each opts in:
//   const { above, below } = useSheetStack(open);
//   …animate={{ ...recede(above) }} and a lighter scrim while `below > 0`.
// ─────────────────────────────────────────────────────────────────────────────

let stack: object[] = [];
const listeners = new Set<() => void>();
const read = () => stack;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** `above`: overlays now covering this one. `below`: overlays it covers. */
export function useSheetStack(open: boolean): { above: number; below: number } {
  const [token] = useState(() => ({}));

  useEffect(() => {
    if (!open) return;
    stack = [...stack, token];
    listeners.forEach((fn) => fn());
    return () => {
      stack = stack.filter((s) => s !== token);
      listeners.forEach((fn) => fn());
    };
  }, [open, token]);

  const current = useSyncExternalStore(subscribe, read, read);
  const i = current.indexOf(token);
  return i < 0 ? { above: 0, below: 0 } : { above: current.length - 1 - i, below: i };
}

/**
 * How a sheet sits back under `above` newer overlays: a nudge away from its own
 * anchored edge so that edge clears the newcomer, and a touch narrower. Scaled
 * from the anchored edge (`transformOrigin`) so the shift is what you see. Two
 * steps is all the eye reads — deeper stacks just look smaller.
 *
 * `fromTop` for a sheet hanging off the top edge instead of rising from the
 * bottom: it recedes downward, so its bottom edge is the one still showing.
 */
export function recede(above: number, fromTop = false): { y: number; scale: number } {
  const n = Math.min(above, 2);
  return { y: (fromTop ? 1 : -1) * n * 14, scale: 1 - n * 0.05 };
}
