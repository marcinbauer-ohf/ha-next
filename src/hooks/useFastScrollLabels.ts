'use client';

import { useEffect, type RefObject } from 'react';

// ── Tuning ──────────────────────────────────────────────────────────────────
// Binary decision: scroll velocity (px/ms between samples, ~one frame apart)
// crossing ENTER flips labels ON; dropping below EXIT (or going idle) flips
// them OFF. Hysteresis keeps it from flickering around the threshold. The
// reveal itself is a quick slide+fade in CSS, so the switch reads as eased, not
// a hard pop.
const ENTER_V = 1.6;   // px/ms — flick this fast → labels on
const EXIT_V = 0.6;    // px/ms — slow below this → labels off
const SETTLE_MS = 120; // also flip off this long after the last scroll sample

/**
 * Prototype "gist while flicking" affordance. While the given scroll container
 * moves fast it gains the `ha-fast-scroll` class; CSS then slides + fades in the
 * large name overlay baked into every DeviceCardV2 (see globals.css). It's a
 * binary on/off (with hysteresis), animated by a short CSS transition so it
 * eases rather than snaps. Detail (icons, art, sparklines) is unreadable at
 * speed anyway, so we trade it for a single big label.
 *
 * The class is toggled imperatively on the DOM node — never through React
 * state — so a fling never re-renders the cards it's helping you read. A short
 * settle timer guarantees the labels clear once scrolling stops.
 */
export function useFastScrollLabels(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    let lastY = el.scrollTop;
    let lastT = performance.now();
    let on = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const setOn = (next: boolean) => {
      if (next === on) return;
      on = next;
      el.classList.toggle('ha-fast-scroll', next);
    };

    const onScroll = () => {
      const now = performance.now();
      // Clamp out rubber-band overscroll: iOS reports negative/past-max
      // scrollTop while bouncing, and the resulting |Δy| spike would flash
      // the gist labels on a plain pull-down at the top of the list.
      const y = Math.max(0, Math.min(el.scrollTop, el.scrollHeight - el.clientHeight));
      // Scroll-index-rail scrubs teleport whole sections per frame — that's a
      // programmatic jump, not flicking. Keep the baseline synced so the first
      // real scroll after the scrub doesn't read as a huge Δy either.
      if (el.dataset.railScrub) {
        lastT = now;
        lastY = y;
        setOn(false);
        return;
      }
      const dt = now - lastT;
      const dy = Math.abs(y - lastY);
      lastT = now;
      lastY = y;

      if (dt > 0) {
        const v = dy / dt;
        if (!on && v >= ENTER_V) setOn(true);
        else if (on && v <= EXIT_V) setOn(false);
      }

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => setOn(false), SETTLE_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
      el.classList.remove('ha-fast-scroll');
    };
  }, [scrollRef, enabled]);
}
