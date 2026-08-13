'use client';

import { Fragment } from 'react';
import { ModalSheet } from '@/components/layout/ModalSheet';
import {
  SHORTCUTS,
  formatKeycaps,
  isMacPlatform,
  useIsMacPlatform,
  type ShortcutDef,
  type ShortcutGroup,
  type ShortcutKeys,
} from '@/lib/keyboardShortcuts';

const GROUP_ORDER: ShortcutGroup[] = ['Global', 'Home dashboard', 'Settings', 'Debug'];

// The combo that opens the command palette — shown next to palette-only actions.
const PALETTE_KEYS: ShortcutKeys = { key: 'k', mod: true };

/** Replay a shortcut's keypress on the window so the real handlers run it. */
function dispatchKeys(keys: ShortcutKeys) {
  const mac = isMacPlatform();
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: keys.key === 'escape' ? 'Escape' : keys.key,
      metaKey: !!keys.mod && mac,
      ctrlKey: !!keys.mod && !mac,
      shiftKey: !!keys.shift,
      altKey: !!keys.alt,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/**
 * Run a shortcut from a tap by replaying its keypress through the actual
 * handlers — no duplicated action wiring. Modifier chords fire immediately
 * (they're not gated by the open dialog); bare single keys are gated by
 * canFireBareShortcut while a modal is up, so we close first and dispatch once
 * the overlay has left the DOM.
 */
function runShortcut(def: ShortcutDef, close: () => void) {
  const keys = def.palette ? PALETTE_KEYS : def.keys.find((k) => !k.hidden) ?? def.keys[0];
  if (!keys) return;
  if (keys.mod || keys.shift || keys.alt) {
    dispatchKeys(keys);
    close();
    return;
  }
  close();
  let frames = 0;
  const tick = () => {
    if (typeof document === 'undefined' || !document.querySelector('[aria-modal="true"]')) {
      dispatchKeys(keys);
    } else if (frames++ < 40) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/** One rendered key combination — a row of key caps (⌘ K / Ctrl K). */
export function ShortcutKeycaps({ keys, mac }: { keys: ShortcutKeys; mac: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {formatKeycaps(keys, mac).map((cap, i) => (
        <kbd
          key={i}
          className="min-w-[1.75rem] px-1.5 py-0.5 rounded-ha-md bg-surface-low border border-surface-lower text-[12px] leading-5 font-medium text-text-secondary text-center"
        >
          {cap}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Grouped shortcut reference rows, generated from the registry. Shared by the
 * ? help dialog and the Prototype & Debug Tools documentation card.
 */
export function ShortcutList({
  groups = GROUP_ORDER,
  onRun,
}: {
  groups?: ShortcutGroup[];
  /** When set, rows become buttons that trigger the shortcut when tapped. */
  onRun?: (def: ShortcutDef) => void;
}) {
  const mac = useIsMacPlatform();
  return (
    <div className="space-y-ha-6">
      {groups.map((group) => (
        <section key={group}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-ha-2">
            {group}
          </h3>
          <ul className="divide-y divide-surface-lower">
            {SHORTCUTS.filter((s) => s.group === group).map((shortcut) => {
              const label = <span className="text-sm text-text-primary">{shortcut.label}</span>;
              const caps = (
                <span className="flex items-center gap-ha-2 flex-shrink-0">
                  {shortcut.palette ? (
                    <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <ShortcutKeycaps keys={PALETTE_KEYS} mac={mac} />
                      <span>then search</span>
                    </span>
                  ) : (
                    shortcut.keys.filter((k) => !k.hidden).map((keys, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span className="text-xs text-text-tertiary">or</span>}
                        <ShortcutKeycaps keys={keys} mac={mac} />
                      </Fragment>
                    ))
                  )}
                </span>
              );
              return (
                <li key={shortcut.id}>
                  {onRun ? (
                    <button
                      type="button"
                      onClick={() => onRun(shortcut)}
                      className="w-full flex items-center justify-between gap-ha-4 py-ha-2 -mx-ha-2 px-ha-2 text-left rounded-ha-lg hover:bg-surface-low active:bg-surface-mid transition-colors"
                    >
                      {label}
                      {caps}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-ha-4 py-ha-2">
                      {label}
                      {caps}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The common "press ? for shortcuts" overlay: a grouped cheat-sheet of every
 * binding, rendered with the platform's own modifier keys. Esc closes.
 */
export function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalSheet open={open} onClose={onClose} maxWidth={600}>
      <div className="px-ha-5 lg:px-ha-6 pt-ha-4 lg:pt-ha-6 pb-ha-5 lg:pb-ha-6">
        <div className="mb-ha-5">
          <h2 className="text-lg font-semibold text-text-primary">Keyboard shortcuts</h2>
          <p className="mt-ha-1 text-sm text-text-secondary">
            Tap any shortcut to run it. Letter keys stay out of the way while you type — they only fire outside text fields.
          </p>
        </div>
        <ShortcutList onRun={(def) => runShortcut(def, onClose)} />
      </div>
    </ModalSheet>
  );
}
