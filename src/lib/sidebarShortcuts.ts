'use client';

// User-defined sidebar shortcuts — pinned views, one-tap actions (scenes,
// scripts, device toggles) and custom links. Stored per browser and merged
// into the sidebar items pipeline (useSidebarItems), so both the desktop rail
// and the mobile nav sheet render them and the existing arrange machinery
// (reorder, jiggle, delete badge) applies by id.

import { useSyncExternalStore } from 'react';

export type ShortcutKind = 'view' | 'action' | 'url';

export interface SidebarShortcut {
  /** Always `shortcut:<unique>` — surfaces detect shortcuts by prefix. */
  id: string;
  kind: ShortcutKind;
  label: string;
  /** mdi:* icon name. */
  icon: string;
  /** kind 'view': in-app route to navigate to. */
  path?: string;
  /** kind 'action': entity to activate/toggle (scene.*, script.*, light.*, …). */
  entityId?: string;
  /** kind 'url': external link, opened in a new tab. */
  url?: string;
}

const LS_KEY = 'ha-sidebar-shortcuts';
const EMPTY: SidebarShortcut[] = [];

function load(): SidebarShortcut[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (s): s is SidebarShortcut =>
        !!s && typeof s.id === 'string' && typeof s.label === 'string' && typeof s.kind === 'string'
    );
  } catch {
    return EMPTY;
  }
}

let shortcuts: SidebarShortcut[] = load();
const listeners = new Set<() => void>();

function commit(next: SidebarShortcut[]) {
  shortcuts = next;
  if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function addShortcut(shortcut: Omit<SidebarShortcut, 'id'>): SidebarShortcut {
  const id = `shortcut:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const full: SidebarShortcut = { ...shortcut, id };
  commit([...shortcuts, full]);
  return full;
}

export function removeShortcut(id: string) {
  commit(shortcuts.filter((s) => s.id !== id));
}

export function isShortcutId(id: string): boolean {
  return id.startsWith('shortcut:');
}

/** True if an equivalent shortcut already exists (same target). */
export function hasShortcutFor(target: { path?: string; entityId?: string; url?: string }): boolean {
  return shortcuts.some(
    (s) =>
      (target.path && s.path === target.path) ||
      (target.entityId && s.entityId === target.entityId) ||
      (target.url && s.url === target.url)
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSidebarShortcuts(): SidebarShortcut[] {
  return useSyncExternalStore(
    subscribe,
    () => shortcuts,
    () => EMPTY
  );
}
