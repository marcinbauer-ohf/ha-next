'use client';

// Single source of truth for the app's keyboard shortcuts. The registry drives
// the help dialog (?), the tooltips that advertise a shortcut, the developer
// settings reference card, and the actual matching in each surface's keydown
// handler — so display and behavior can't drift apart.
//
// Conventions:
// - Plain letters (H, S, A, E, G, …) are app shortcuts in the Gmail/Linear
//   style: they never fire while a text field is focused or a dialog is open,
//   and they can't collide with browser/OS chords on any platform.
// - `mod` is the platform command modifier — ⌘ on macOS, Ctrl elsewhere.
//   Mac-reserved chords (⌘H hide, ⌘, preferences) are deliberately not used
//   as primary bindings.

import { useSyncExternalStore } from 'react';

export type ShortcutGroup = 'Global' | 'Home dashboard' | 'Settings' | 'Debug';

export interface ShortcutKeys {
  /** KeyboardEvent.key, lowercased for letters ('k', '\\', '?', '['). */
  key: string;
  /** Platform command modifier — ⌘ on macOS, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  /** Key-cap display override (e.g. 'Esc', '1–9'). */
  display?: string;
  /** Matched but not shown in the help dialog (legacy aliases). */
  hidden?: boolean;
}

export interface ShortcutDef {
  id: string;
  group: ShortcutGroup;
  label: string;
  /** First entry is the primary binding; extras are aliases. */
  keys: ShortcutKeys[];
  /** Listed in the help dialog but matched elsewhere (own handler or key range). */
  displayOnly?: boolean;
  /**
   * Reached through the command palette rather than a dedicated key. Destructive
   * actions (resets) stay here so they can't fire from a stray keypress — the
   * dialog renders these with the search combo and a "then search" hint.
   */
  palette?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  // ── Global ──────────────────────────────────────────────────────
  { id: 'global.search', group: 'Global', label: 'Search & commands', keys: [{ key: 'k', mod: true }, { key: '/' }] },
  { id: 'global.assistant', group: 'Global', label: 'Toggle assistant', keys: [{ key: 'a' }] },
  { id: 'global.home', group: 'Global', label: 'Go to home dashboard', keys: [{ key: 'h' }, { key: 'h', mod: true, hidden: true }] },
  { id: 'global.settings', group: 'Global', label: 'Open settings', keys: [{ key: 's' }] },
  { id: 'global.sidebar', group: 'Global', label: 'Toggle sidebar', keys: [{ key: 'b', mod: true }] },
  { id: 'global.help', group: 'Global', label: 'Show keyboard shortcuts', keys: [{ key: '?' }] },
  { id: 'global.color-mode', group: 'Global', label: 'Toggle light / dark mode', keys: [{ key: 'd', mod: true, shift: true }], displayOnly: true },
  { id: 'global.theme', group: 'Global', label: 'Cycle theme', keys: [{ key: 't', mod: true, shift: true }], displayOnly: true },
  { id: 'global.font', group: 'Global', label: 'Cycle typeface', keys: [{ key: 'f', mod: true, shift: true }], displayOnly: true },
  { id: 'global.squircle', group: 'Global', label: 'Toggle squircle corners', keys: [{ key: 'u', mod: true, shift: true }], displayOnly: true },
  { id: 'global.screensaver', group: 'Global', label: 'Toggle screensaver', keys: [{ key: 's', mod: true, shift: true }], displayOnly: true },
  { id: 'global.close', group: 'Global', label: 'Close dialog or overlay', keys: [{ key: 'escape', display: 'Esc' }], displayOnly: true },

  // ── Home dashboard ──────────────────────────────────────────────
  { id: 'dashboard.edit', group: 'Home dashboard', label: 'Toggle edit mode', keys: [{ key: 'e' }] },
  { id: 'dashboard.grouping', group: 'Home dashboard', label: 'Cycle grouping (areas → types → categories)', keys: [{ key: 'g' }] },
  { id: 'dashboard.map', group: 'Home dashboard', label: 'Toggle floor plan view', keys: [{ key: 'm' }] },
  { id: 'dashboard.floor', group: 'Home dashboard', label: 'Switch floor', keys: [{ key: '1', display: '1–9' }], displayOnly: true },
  { id: 'dashboard.floor-all', group: 'Home dashboard', label: 'Show all floors', keys: [{ key: '0' }], displayOnly: true },
  { id: 'dashboard.immersive', group: 'Home dashboard', label: 'Toggle immersive mode', keys: [{ key: '\\', mod: true }], displayOnly: true },

  // ── Settings ────────────────────────────────────────────────────
  { id: 'settings.prev', group: 'Settings', label: 'Previous section', keys: [{ key: '[' }] },
  { id: 'settings.next', group: 'Settings', label: 'Next section', keys: [{ key: ']' }] },
  { id: 'settings.debug', group: 'Settings', label: 'Open Prototype & Debug Tools', keys: [{ key: 'd' }] },

  // ── Debug ───────────────────────────────────────────────────────
  // Safe toggles get real keys; destructive resets stay behind the command
  // palette (palette: true) so a stray keypress can't wipe customisations.
  { id: 'debug.badges', group: 'Debug', label: 'Toggle debug badges', keys: [{ key: 'b' }] },
  { id: 'debug.card-tuner', group: 'Debug', label: 'Toggle device card tuner', keys: [{ key: 'x', mod: true, shift: true }] },
  { id: 'debug.reset', group: 'Debug', label: 'Prototype reset (wipe & reload)', keys: [], palette: true },
  { id: 'debug.more', group: 'Debug', label: 'More toggles & resets (Settings › Prototype & Debug Tools)', keys: [], palette: true },
];

export function getShortcut(id: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.id === id);
}

// ── Platform detection ────────────────────────────────────────────

const MAC_RE = /mac|iphone|ipad|ipod/i;
let cachedIsMac: boolean | null = null;

export function isMacPlatform(): boolean {
  if (cachedIsMac === null) {
    if (typeof navigator === 'undefined') return true;
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    // `||`, not `??` — userAgentData.platform can be an empty string.
    cachedIsMac = MAC_RE.test(nav.userAgentData?.platform || nav.platform || nav.userAgent || '');
  }
  return cachedIsMac;
}

const noopSubscribe = () => () => {};

/**
 * Hydration-safe platform flag: SSR renders the macOS symbols, the client
 * snapshot corrects Windows/Linux at hydration without a mismatch warning.
 */
export function useIsMacPlatform(): boolean {
  return useSyncExternalStore(noopSubscribe, isMacPlatform, () => true);
}

// ── Display formatting ────────────────────────────────────────────

const KEY_DISPLAY: Record<string, string> = { escape: 'Esc' };

function keyCap(keys: ShortcutKeys): string {
  if (keys.display) return keys.display;
  if (keys.key.length === 1) return keys.key.toUpperCase();
  return KEY_DISPLAY[keys.key] ?? keys.key[0].toUpperCase() + keys.key.slice(1);
}

/** Individual key caps, e.g. ['⌘', 'K'] on macOS or ['Ctrl', 'K'] elsewhere. */
export function formatKeycaps(keys: ShortcutKeys, mac: boolean): string[] {
  const caps: string[] = [];
  if (keys.mod) caps.push(mac ? '⌘' : 'Ctrl');
  if (keys.shift) caps.push(mac ? '⇧' : 'Shift');
  caps.push(keyCap(keys));
  return caps;
}

/** Compact single-string hint for tooltips: '⌘K' on macOS, 'Ctrl+K' elsewhere. */
export function shortcutHint(id: string, mac: boolean): string {
  const def = getShortcut(id);
  if (!def) return '';
  return formatKeycaps(def.keys[0], mac).join(mac ? '' : '+');
}

// ── Event matching ────────────────────────────────────────────────

// Keys whose character already encodes Shift on common layouts.
const SHIFT_AGNOSTIC = new Set(['?']);

export function eventMatchesKeys(e: KeyboardEvent, keys: ShortcutKeys): boolean {
  if (e.altKey) return false;
  if ((e.metaKey || e.ctrlKey) !== !!keys.mod) return false;
  if (!SHIFT_AGNOSTIC.has(keys.key) && e.shiftKey !== !!keys.shift) return false;
  return e.key.toLowerCase() === keys.key;
}

export function matchShortcut(e: KeyboardEvent, id: string): boolean {
  const def = getShortcut(id);
  return !!def && def.keys.some((keys) => eventMatchesKeys(e, keys));
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest('input, textarea, select');
}

function hasBlockingOverlay(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Gate for the unmodified single-key shortcuts: never while typing, never
 * while a dialog/overlay owns the keyboard, never on held-key repeats.
 */
export function canFireBareShortcut(e: KeyboardEvent): boolean {
  return !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && !isEditableTarget(e.target) && !hasBlockingOverlay();
}

// ── Help dialog bus ───────────────────────────────────────────────
// Same module-level pub/sub as settingsResetBus: the dialog lives in AppShell,
// but the command palette and settings reference card need to open it too.

type Listener = () => void;
const helpListeners = new Set<Listener>();

export function openShortcutsHelp(): void {
  helpListeners.forEach((l) => l());
}

export function subscribeShortcutsHelp(listener: Listener): () => void {
  helpListeners.add(listener);
  return () => {
    helpListeners.delete(listener);
  };
}
