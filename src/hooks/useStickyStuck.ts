'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Detects whether a `position: sticky` block is currently pinned ("stuck") to
 * the top of its scroll container. Attach the returned ref to a zero-height
 * sentinel placed immediately *above* the sticky element (as the first child of
 * the section). When that sentinel scrolls up past the sticky line, the header
 * is pinned and `stuck` flips to true.
 *
 * The sticky line is read from the `--dashboard-sticky-top` CSS var (0 when
 * unset), matching where section headers pin.
 */
export function useStickyStuck<T extends HTMLElement = HTMLDivElement>() {
  const sentinelRef = useRef<T | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const root = sentinel.closest('[data-scrollable]') as HTMLElement | null;
    const topVar = getComputedStyle(document.documentElement)
      .getPropertyValue('--dashboard-sticky-top')
      .trim();
    const topPx = topVar ? parseFloat(topVar) : 0;

    const obs = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1),
      { root, rootMargin: `-${topPx + 1}px 0px 0px 0px`, threshold: [0, 1] },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  return { sentinelRef, stuck };
}
