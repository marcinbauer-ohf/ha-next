'use client';

import { useSyncExternalStore } from 'react';

/**
 * The home's display name — localStorage-backed (`ha_home_name`, written by
 * onboarding and the Home Center editor). One tiny store so the dashboard
 * title, Home Center hero and onboarding all agree — same-tab and cross-tab.
 */

const LS_HOME_NAME = 'ha_home_name';
const DEFAULT_NAME = 'Home';

const listeners = new Set<() => void>();

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

function getHomeName(): string {
  try {
    return localStorage.getItem(LS_HOME_NAME) || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

function getServerHomeName(): string {
  return DEFAULT_NAME;
}

/** Live home name (SSR-safe, updates same-tab and cross-tab). */
export function useHomeName(): string {
  return useSyncExternalStore(subscribe, getHomeName, getServerHomeName);
}

/** Write the home name and notify all subscribers in this tab. */
export function setHomeName(name: string): void {
  try {
    localStorage.setItem(LS_HOME_NAME, name.trim() || DEFAULT_NAME);
  } catch {
    /* private mode — non-fatal */
  }
  emit();
}
