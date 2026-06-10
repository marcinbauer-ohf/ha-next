'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface DeferredCardProps {
  /** The full card to mount once near the viewport. */
  children: ReactNode;
  /**
   * Reserved height (px) for the placeholder before the real card mounts, so
   * masonry column heights stay roughly stable and the layout doesn't collapse.
   */
  minHeight?: number;
}

/**
 * Mounts its children only once they scroll near the viewport. Dashboards render
 * every device card at once; on a real Home Assistant instance that single
 * synchronous commit (dozens of cards, each with mask-image layers + a sparkline
 * observer) is a multi-hundred-ms long task that freezes navigation into the
 * dashboard. Deferring offscreen cards shrinks the mount commit to the handful of
 * visible cards. Mirrors the lazy-fetch pattern already used by EntityMiniSparkline.
 *
 * Once mounted the card stays mounted (no unmount on scroll-away) — cards are
 * cheap to keep alive and re-mounting would drop their local state / re-run
 * history fetches.
 */
export function DeferredCard({ children, minHeight = 88 }: DeferredCardProps) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    // Fallback for environments without IntersectionObserver — mount immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      // Generous margin so cards mount before they're visible — no blank flash
      // during fast scrolls, and no layout jump from late growth above the fold.
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  if (mounted) return <>{children}</>;

  return <div ref={ref} aria-hidden style={{ minHeight }} />;
}
