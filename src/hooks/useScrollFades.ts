'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Drives the standard top+bottom scroll gradient fades (the convention every
 * scrollable list in the app follows). Attach the returned callback ref to the
 * scroll container and render two always-mounted gradient overlays whose
 * opacity follows showTop/showBottom.
 *
 * Handles ref swaps (conditional mounts), container/child resizes, and content
 * swaps (children added or removed) without the callers wiring their own
 * listeners.
 */
export function useScrollFades<T extends HTMLElement = HTMLElement>() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback((el: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) {
      setShowTop(false);
      setShowBottom(false);
      return;
    }

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTop(scrollTop > 10);
      setShowBottom(scrollHeight > clientHeight + 10 && scrollTop + clientHeight < scrollHeight - 10);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) ro.observe(n);
        });
      }
      update();
    });
    mo.observe(el, { childList: true });

    cleanupRef.current = () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return { attach, showTop, showBottom };
}
