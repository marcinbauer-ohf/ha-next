'use client';

import Link from 'next/link';
import { NavChevron } from '../ui/NavChevron';

/**
 * The heading above a section of device cards — on the home dashboard and on
 * every room / category / type page, which carried identical copies of it.
 *
 * Non-sticky: it scrolls away naturally, and as it leaves the top of the scroll
 * area the page republishes its title into the top bar as a reversed breadcrumb
 * (see `useSectionCrumb`), which is what `data-section-header` marks.
 *
 * Indented to the card's own padding, so the heading and the card titles under
 * it share one left edge — the same rule the grouped lists follow, measured off
 * the card instead of a list row. It reads `--dct-pad` directly, so a card
 * padding tuned in the card tuner takes the heading with it.
 */
export function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div
      className="-mx-ha-1 pr-ha-1 py-ha-2 mb-ha-1"
      // The negative margin gives the link a little bleed for its hit area, so
      // the card's inset has to be added back on top of it.
      style={{ paddingLeft: 'calc(var(--ha-space-1) + var(--dct-pad, 10px))' }}
      data-section-header
    >
      {href ? (
        <Link href={href} prefetch={false} className="flex items-center gap-1 group w-fit">
          <span className="text-xl font-semibold text-text-primary group-hover:text-ha-blue transition-colors">{title}</span>
          <NavChevron size={18} className="text-text-tertiary group-hover:text-ha-blue" />
        </Link>
      ) : (
        <span className="text-xl font-semibold text-text-primary">{title}</span>
      )}
    </div>
  );
}
