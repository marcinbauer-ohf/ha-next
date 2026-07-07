'use client';

/**
 * Persisted activity dismissals, shared by the desktop status bar and the
 * mobile nav. Dismissal is consent withdrawal: a dismissed item never
 * reappears for the same content key (release notes re-appear only when
 * their updatedAt changes; ended cards never return).
 *
 * Dismissing only affects display — it never calls a service or cancels the
 * underlying task.
 */

const STORAGE_KEY = 'ha-activity-dismissals-v1';
const MAX_ENTRIES = 100;

type DismissalMap = Record<string, string>;

let dismissals: DismissalMap = {};
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) dismissals = JSON.parse(raw) as DismissalMap;
  } catch {
    dismissals = {};
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(dismissals);
    if (keys.length > MAX_ENTRIES) {
      // Oldest keys are unrecoverable (no timestamps) — drop the overflow head.
      const trimmed: DismissalMap = {};
      keys.slice(keys.length - MAX_ENTRIES).forEach((key) => {
        trimmed[key] = dismissals[key];
      });
      dismissals = trimmed;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissals));
  } catch {
    // Storage full or unavailable — dismissals stay session-only.
  }
}

export function subscribeDismissals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isDismissed(id: string, key: string): boolean {
  load();
  return dismissals[id] === key;
}

export function dismissActivity(id: string, key: string): void {
  load();
  if (dismissals[id] === key) return;
  dismissals = { ...dismissals, [id]: key };
  persist();
  listeners.forEach((listener) => listener());
}
