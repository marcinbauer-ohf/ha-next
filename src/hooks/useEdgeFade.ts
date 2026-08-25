'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Horizontal scroll-edge gradient fade, per the app-wide scrollable-list
 * pattern (the sideways sibling of the top/bottom fades).
 *
 * Spread the returned props onto the `overflow-x-auto` element. Edges are
 * re-measured on scroll and on resize, so a container whose content fits
 * (a wide desktop row, a list that shrank) resolves to a plain opaque mask
 * and shows no fade at all.
 */
export function useEdgeFade(fadePx = 48) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 8, right: el.scrollLeft < max - 8 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Content width changes without the box resizing (chips appearing/leaving).
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  // No mask unless an edge actually needs fading. A mask clips its element to
  // the border box, so a fully-opaque one is not free: it cut the hover-grow
  // band (and any selection ring) off every chip in the row.
  const style = useMemo(() => {
    if (!edges.left && !edges.right) return {};
    const from = edges.left ? `transparent 0, black ${fadePx}px` : 'black 0';
    const to = edges.right ? `black calc(100% - ${fadePx}px), transparent 100%` : 'black 100%';
    const mask = `linear-gradient(to right, ${from}, ${to})`;
    return { WebkitMaskImage: mask, maskImage: mask };
  }, [edges, fadePx]);

  return { ref, onScroll: measure, style };
}
