'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useIdleTimer } from '@/hooks';
import { RollingDigit } from '@/components/ui/RollingDigit';
import { AskPill } from './DockAsk';

const IDLE_MS = 60000;

/**
 * Idle/keyboard control for the dock's screensaver. State lives with the caller
 * because the ask pill morphs between the saver and the dock chip — only one of
 * the two may be mounted at a time, so both sides read the same flag.
 */
export function useDockScreensaver() {
  const [active, setActive] = useState(false);
  const { wake } = useIdleTimer({ timeout: IDLE_MS, onIdle: () => setActive(true) });

  const dismiss = useCallback(() => {
    setActive(false);
    wake();
  }, [wake]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setActive((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { active, dismiss };
}

/**
 * The dock spinoff's own screensaver — the global one is suppressed under
 * /dev/, and this prototype wants the plain version: light palette, clock,
 * date, and the ask pill. Anything outside the pill dismisses it.
 */
export function DockScreensaver({
  active,
  onDismiss,
  onAsk,
}: {
  active: boolean;
  onDismiss: () => void;
  /** Tapping the pill leaves the saver and opens the chat page behind it. */
  onAsk: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  // Only tick while it's up; the minute is all that's shown, but a 1s interval
  // keeps the rollover honest without tracking when the next minute lands.
  useEffect(() => {
    if (!active) return;
    // rAF for the first tick: a bare setState in an effect body is a lint error
    // (cascading renders), and waiting a full second would show a blank clock.
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [active]);

  const hours = now ? (now.getHours() % 12 || 12).toString() : '';
  const minutes = now ? now.getMinutes().toString().padStart(2, '0') : '';
  const date = now
    ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <>
      <div
        onClick={onDismiss}
        // Kept mounted so it can fade both ways; inert while hidden.
        className={clsx(
          'fixed inset-0 z-[200] flex select-none flex-col items-center justify-center bg-[#f2f2f2] transition-opacity duration-500 ease-out',
          active ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!active}
      >
        <div className="flex items-center tabular-nums text-[5rem] font-semibold leading-none tracking-tight text-neutral-800 md:text-[9rem]">
          {hours.split('').map((d, i) => (
            <RollingDigit key={i} digit={d} />
          ))}
          <span className="ha-colon-blink px-1">:</span>
          {minutes.split('').map((d, i) => (
            <RollingDigit key={i} digit={d} />
          ))}
        </div>
        <p className="mt-6 text-lg text-neutral-500 md:text-2xl">{date}</p>
      </div>

      {/* Outside the fading overlay on purpose: the pill is the *same element*
          as the dock chip (shared layoutId), so it has to survive the swap and
          animate to its new home rather than fade out with the backdrop. */}
      {active && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[18%] z-[201] flex justify-center px-5">
          <AskPill variant="saver" onOpen={onAsk} />
        </div>
      )}
    </>
  );
}
