'use client';

import { useSyncExternalStore } from 'react';

/**
 * Onboarding gate.
 *
 * The flow is parked for now: nobody sees it on a first visit. It runs only
 * when launched on purpose (Settings → Prototype & Debug → Onboarding v1), which
 * sets `ha_onboarding_launch`; finishing or skipping clears it again.
 *
 * Kept as a tiny module store (not React context) so AppShell, the screensaver
 * provider and toast gating can all read the same flag without new providers.
 */

const LS_LAUNCH_KEY = 'ha_onboarding_launch';

const listeners = new Set<() => void>();
let cachedActive: boolean | null = null;

function computeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LS_LAUNCH_KEY) === '1';
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
    localStorage.removeItem(LS_LAUNCH_KEY);
  } catch {
    /* ignore */
  }
  cachedActive = false;
  listeners.forEach((l) => l());
}

/** Put the flow over the app — Prototype & Debug's "Launch" and the dev page. */
export function launchOnboarding(): void {
  try {
    localStorage.setItem(LS_LAUNCH_KEY, '1');
  } catch {
    /* ignore */
  }
  cachedActive = true;
  listeners.forEach((l) => l());
}
