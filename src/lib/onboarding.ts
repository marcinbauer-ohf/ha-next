'use client';

import { useSyncExternalStore } from 'react';

/**
 * First-run onboarding gate.
 *
 * The flow shows exactly once per browser: on a truly fresh visit there are no
 * stored credentials (`ha_url`) and the flow hasn't been completed
 * (`ha_onboarding_done_v2`). Finishing — or explicitly skipping — marks it
 * done. Browsers that already talk to a real instance never see it.
 *
 * Kept as a tiny module store (not React context) so AppShell, the screensaver
 * provider and toast gating can all read the same flag without new providers.
 */

const LS_DONE_KEY = 'ha_onboarding_done_v2';
const LS_URL_KEY = 'ha_url';

const listeners = new Set<() => void>();
let cachedActive: boolean | null = null;

function computeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(LS_DONE_KEY) === '1') return false;
    if (localStorage.getItem(LS_URL_KEY)) return false; // already connected before this flag existed
    return true;
  } catch {
    return false; // storage unavailable — never trap the user in onboarding
  }
}

function snapshot(): boolean {
  if (cachedActive === null) cachedActive = computeActive();
  return cachedActive;
}

function serverSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the first-run onboarding flow should cover the app. */
export function useOnboardingGate(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Non-reactive read for places that can't use hooks. */
export function isOnboardingActive(): boolean {
  return snapshot();
}

/** Mark the flow finished (also used by "skip") and notify subscribers. */
export function completeOnboarding(): void {
  try {
    localStorage.setItem(LS_DONE_KEY, '1');
  } catch {
    /* private mode — the session still proceeds, it may just show again */
  }
  cachedActive = false;
  listeners.forEach((l) => l());
}

/** Dev helper: clear the done flag so the flow can be replayed. */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(LS_DONE_KEY);
  } catch {
    /* ignore */
  }
  cachedActive = null;
  listeners.forEach((l) => l());
}
