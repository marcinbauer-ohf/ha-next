'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Mobile haptic feedback via the Vibration API.
 *
 * Reserve haptics for moments where state *changed* or a gesture *committed* —
 * a toggle fired, a drag dropped, a pull crossed its threshold — not for every
 * touch. Overuse reads as noise.
 *
 * Platform note: Android Chrome supports `navigator.vibrate`; iOS Safari does
 * NOT (no web haptics on iPhone/iPad at all). Calls no-op gracefully there.
 */
export type HapticKind =
  | 'tap' // light acknowledgement
  | 'select' // micro-tick (selection change)
  | 'toggle' // on/off flip
  | 'impact' // committed gesture: drop, threshold cross, long-press fire
  | 'success'
  | 'error'
  | 'warning'; // destructive / cautionary confirm

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 15,
  select: 10,
  toggle: 25,
  impact: 40,
  success: [15, 40, 15],
  warning: [30, 50, 30],
  error: [40, 60, 40, 60, 40],
};

const STORAGE_KEY = 'ha_haptics_enabled';

function loadEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  // Default on; only an explicit "false" disables.
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

// Module-level cache so the non-React call path (haptic()) stays synchronous and
// cheap — no localStorage read per vibration.
let enabled = loadEnabled();
const listeners = new Set<() => void>();

/** Fire a haptic pulse if supported and not disabled by the user. */
export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(PATTERNS[kind]);
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next));
  listeners.forEach((l) => l());
}

/** True if the running browser exposes the Vibration API at all (Android, not iOS). */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** React binding for the settings toggle. */
export function useHaptics() {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  const value = useSyncExternalStore(subscribe, isHapticsEnabled, () => true);
  return { enabled: value, setEnabled: setHapticsEnabled, supported: hapticsSupported() };
}
