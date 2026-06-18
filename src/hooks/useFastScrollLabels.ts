'use client';

import { useEffect, type RefObject } from 'react';

// ── Tuning ──────────────────────────────────────────────────────────────────
// Scroll velocity (px per millisecond between samples, ~one frame apart) maps
// to a 0..1 "blur past" intensity. A gentle drag sits near MIN_V; a hard fling
// saturates past MAX_V. Lower MIN_V → labels engage sooner.
const MIN_V = 0.35;   // px/ms — labels start bleeding in
const MAX_V = 1.5;    // px/ms — labels reach full strength
const IDLE_MS = 70;   // no scroll for this long → decay back toward 0
const ATTACK = 0.5;   // ease toward a HIGHER target — rises fast (snappy in)
const DECAY = 0.12;   // ease toward a LOWER target — fades gently (soft out)

/**
 * Prototype "gist while flicking" affordance. Maps the given scroll
 * container's velocity to a continuous 0..1 intensity and writes it to the
 * `--ha-fast-scroll` custom property on the container; CSS then fades the
 * large name overlay baked into every DeviceCardV2 (see globals.css)
 * PROPORTIONALLY — a slow drag only lightly veils each card, a hard fling fully
 * replaces detail with the name. Detail (icons, art, sparklines) is unreadable
 * at speed anyway, so we trade it for a single big label.
 *
 * The value is eased frame-by-frame in a rAF loop and written straight to the
 * DOM node — never through React state — so a fling never re-renders the cards
 * it's helping you read. The loop parks itself when idle.
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
    let lastScrollT = lastT;
    let target = 0;   // velocity-derived goal, 0..1
    let current = 0;  // eased value actually written to CSS
    let raf = 0;

    const setVar = (v: number) => el.style.setProperty('--ha-fast-scroll', v.toFixed(3));

    const tick = () => {
      const now = performance.now();
      // No recent scroll sample → glide back to rest.
      if (now - lastScrollT > IDLE_MS) target = 0;
      const rate = target > current ? ATTACK : DECAY;
      current += (target - current) * rate;
      if (target === 0 && current < 0.001) {
        current = 0;
        setVar(0);
        raf = 0;
        return; // park the loop until the next scroll
      }
      setVar(current);
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const now = performance.now();
      const y = el.scrollTop;
      const dt = now - lastT;
      const dy = Math.abs(y - lastY);
      lastT = now;
      lastY = y;
      lastScrollT = now;
      if (dt > 0) {
        const v = dy / dt;
        target = Math.max(0, Math.min(1, (v - MIN_V) / (MAX_V - MIN_V)));
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      el.style.removeProperty('--ha-fast-scroll');
    };
  }, [scrollRef, enabled]);
}
