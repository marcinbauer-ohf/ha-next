'use client';

// A tiny pub/sub bus for the center-screen HUD flash — the brief pill that
// confirms a keyboard shortcut fired (e.g. ⌘⇧T → "Cycle theme"). Module-level,
// like statusPulseBus, so the scattered keydown handlers (AppShell, useTheme,
// useFont, the dashboard) can trigger it without sharing a React tree or
// threading a provider through everything. A single <HudFlash /> mounted in
// AppShell listens and renders the latest flash.

import type { ShortcutKeys } from './keyboardShortcuts';

export interface HudFlashPayload {
  /** Primary line — the command name. Falls back to the shortcut's label. */
  label?: string;
  /** Pull the label and key caps from the shortcut registry when set. */
  shortcutId?: string;
  /** Explicit key caps to show — overrides the registry lookup. */
  keys?: ShortcutKeys;
  /** Secondary line — the value a toggle landed on ('Dark', 'Cyberpunk', …). */
  value?: string;
  /** Leading mdi icon path. */
  icon?: string;
}

type Listener = (payload: HudFlashPayload) => void;

const listeners = new Set<Listener>();

export function flashHud(payload: HudFlashPayload): void {
  listeners.forEach((l) => l(payload));
}

export function subscribeHudFlash(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Dev-only hook so the flash can be triggered from the console / E2E checks.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__flashHud = flashHud;
}
