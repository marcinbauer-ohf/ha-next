'use client';

import { useEffect, type RefObject } from 'react';
import { useHeader } from '@/contexts';
import { sectionReadingLine } from '@/lib/sectionScroll';

/**
 * Reversed breadcrumb: tracks which section header has scrolled above the top
 * of the scroll container and publishes its title to the top bar (as a small
 * line under the page title). Section headers don't pin; the top bar carries
 * the "where am I" context instead.
 *
 * Sections are found via `[data-section-key]` anchors inside the container;
 * the published title comes from their `data-section-title`. The active
 * section is the last one whose top has crossed above the reading line
 * (container top + any sticky chrome from --dashboard-sticky-top).
 */
export function useSectionCrumb(
  scrollableRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const { setSectionCrumb } = useHeader();

  useEffect(() => {
    const el = scrollableRef.current;
    if (!el || !enabled) {
      setSectionCrumb(undefined);
      return;
    }
    let lastTop = el.scrollTop;
    const update = () => {
      // Shared with the scroll-index rail so a rail jump lands the header on
      // exactly the line that flips the crumb to that same section.
      const line = sectionReadingLine(el) + 1;
      let active: string | undefined;
      // At the very top nothing has scrolled past — no crumb, even if the
      // first header already sits at the reading line.
      if (el.scrollTop > 1) {
        el.querySelectorAll<HTMLElement>('[data-section-key]').forEach((node) => {
          if (node.getBoundingClientRect().top <= line) {
            active = node.dataset.sectionTitle ?? undefined;
          }
        });
      }
      // Roll direction is inverted from scroll: scrolling DOWN rolls the new
      // section in from the bottom, scrolling UP from the top.
      const goingDown = el.scrollTop > lastTop;
      lastTop = el.scrollTop;
      setSectionCrumb(active, !goingDown);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Content changes (devices load in, grouping/view switches) move section
    // tops without a scroll event — re-measure when content resizes.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach(child => ro.observe(child));
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
      setSectionCrumb(undefined);
    };
  }, [scrollableRef, enabled, setSectionCrumb]);
}
