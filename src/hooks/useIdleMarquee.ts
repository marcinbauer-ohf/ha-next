'use client';

import { useEffect, type RefObject } from 'react';

// ── Tuning ──────────────────────────────────────────────────────────────────
// Inverse of useFastScrollLabels: the marquee runs while the list is idle or
// drifting slowly, and cuts out the moment the user flicks. Velocity is px/ms
// between scroll samples (~one frame apart); hysteresis keeps a fling's
// deceleration tail from strobing the animation on/off around one threshold.
const FAST_V = 1.0;    // px/ms — scroll this fast → marquee off
const SLOW_V = 0.4;    // px/ms — decelerate below this → marquee back on
const SETTLE_MS = 160; // no scroll samples for this long → back on regardless
// Scroll events can arrive a couple of ms apart (event-dispatch jitter), which
// turns a calm 0.2 px/ms drift into a phantom 1.5 px/ms spike. Accumulate
// distance and only judge velocity over windows at least this long.
const WINDOW_MS = 24;

/**
 * Lets truncated card names breathe: while the given scroll container is idle
 * or moving slowly it carries the `ha-marquee-on` class, and CSS slides each
 * overflowing `.ha-card-marquee` label back and forth to reveal its tail (see
 * globals.css — labels that fit never move). A fast scroll adds
 * `ha-marquee-paused`, which freezes each glide in place via
 * animation-play-state — pausing (not removing) the animation, so labels never
 * snap back to the origin or restart in sync when scrolling stops.
 *
 * Like useFastScrollLabels, the classes are toggled imperatively on the DOM
 * node — never through React state — so scrolling doesn't re-render the cards.
 */
export function useIdleMarquee(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    let lastY = el.scrollTop;
    let windowT = performance.now();
    let windowDy = 0;
    let on = true;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const setOn = (next: boolean) => {
      if (next === on) return;
      on = next;
      el.classList.toggle('ha-marquee-paused', !next);
    };

    el.classList.add('ha-marquee-on');

    const onScroll = () => {
      const now = performance.now();
      // Clamp out rubber-band overscroll (see useFastScrollLabels) — a bounce
      // at the top shouldn't read as a fling and blink the marquee off.
      const y = Math.max(0, Math.min(el.scrollTop, el.scrollHeight - el.clientHeight));
      windowDy += Math.abs(y - lastY);
      lastY = y;

      const dt = now - windowT;
      if (dt >= WINDOW_MS) {
        const v = windowDy / dt;
        if (on && v >= FAST_V) setOn(false);
        else if (!on && v <= SLOW_V) setOn(true);
        windowT = now;
        windowDy = 0;
      }

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        setOn(true);
        // Scrolling stopped — restart the measuring window so the idle gap
        // doesn't dilute the first sample of the next gesture.
        windowT = performance.now();
        windowDy = 0;
      }, SETTLE_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
      el.classList.remove('ha-marquee-on', 'ha-marquee-paused');
    };
  }, [scrollRef, enabled]);
}
