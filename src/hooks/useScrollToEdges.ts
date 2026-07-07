'use client';

import { useCallback } from 'react';
import type { RefObject } from 'react';

/**
 * Smooth-scroll helpers for a scroll container, paired with the top/bottom
 * ScrollFadeEdge tap targets. Matches the app's scroll convention
 * (behavior: 'smooth', see ScrollIndexRail).
 */
export function useScrollToEdges(ref: RefObject<HTMLElement | null>) {
  const scrollToTop = useCallback(() => {
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ref]);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [ref]);

  return { scrollToTop, scrollToBottom };
}
