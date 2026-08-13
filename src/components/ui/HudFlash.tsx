'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { subscribeHudFlash, type HudFlashPayload } from '@/lib/hudFlashBus';
import {
  getShortcut,
  formatKeycaps,
  useIsMacPlatform,
  type ShortcutKeys,
} from '@/lib/keyboardShortcuts';

/** How long a flash stays on screen before it fades out. */
const VISIBLE_MS = 1100;

const SPRING = { type: 'spring' as const, stiffness: 460, damping: 30, mass: 0.7 };

// Client-only flag without a mount effect: SSR gets false, the client snapshot
// flips true after hydration, so createPortal never runs on the server or on the
// first (hydrating) client render — same trick as useIsMacPlatform.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

interface Current extends HudFlashPayload {
  /** Monotonic id so re-firing the same shortcut restarts the animation. */
  seq: number;
}

/**
 * Center-screen HUD flash: a small pill that pops in the middle of the viewport
 * for a beat to confirm a keyboard shortcut fired, then fades. Shows the command
 * label, an optional value the toggle landed on, and the shortcut's key caps.
 *
 * Fired imperatively through the module-level flashHud() bus, so any keydown
 * handler can trigger it. Mounted once in AppShell. pointer-events-none — it
 * never intercepts clicks, and portals to document.body so it floats above every
 * overlay (theme chords fire even while a modal owns the keyboard).
 */
export function HudFlash() {
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const mac = useIsMacPlatform();
  const isClient = useIsClient();

  useEffect(() => {
    return subscribeHudFlash((payload) => {
      seq.current += 1;
      setCurrent({ ...payload, seq: seq.current });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCurrent(null), VISIBLE_MS);
    });
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!isClient) return null;

  const def = current?.shortcutId ? getShortcut(current.shortcutId) : undefined;
  const label = current?.label ?? def?.label ?? '';
  const keys: ShortcutKeys | undefined =
    current?.keys ?? def?.keys.find((k) => !k.hidden) ?? def?.keys[0];

  const node = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="popLayout">
        {current && (
          <motion.div
            key={current.seq}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={SPRING}
            className="flex items-center gap-ha-3 px-ha-4 py-ha-3 rounded-ha-2xl bg-surface-default/90 backdrop-blur-xl border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.12)]"
          >
            {current.icon && (
              <span className="shrink-0 w-9 h-9 rounded-ha-xl bg-surface-mid flex items-center justify-center">
                <Icon path={current.icon} size={20} className="text-text-primary" />
              </span>
            )}
            {(label || current.value) && (
              <div className="flex flex-col gap-0.5">
                {label && (
                  <span className="text-sm font-semibold text-text-primary leading-tight whitespace-nowrap">
                    {label}
                  </span>
                )}
                {current.value && (
                  <span className="text-xs text-text-secondary leading-tight whitespace-nowrap">
                    {current.value}
                  </span>
                )}
              </div>
            )}
            {keys && (
              <span className="flex items-center gap-1 ml-ha-1">
                {formatKeycaps(keys, mac).map((cap, i) => (
                  <kbd
                    key={i}
                    className="min-w-[1.75rem] px-1.5 py-0.5 rounded-ha-md bg-surface-low border border-surface-lower text-[12px] leading-5 font-medium text-text-secondary text-center"
                  >
                    {cap}
                  </kbd>
                ))}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return createPortal(node, document.body);
}
