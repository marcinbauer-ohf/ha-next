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
export function SectionHeader({ title, href, leading, trailing }: {
  title: string;
  href?: string;
  /** A badge ahead of the title — for a section that is a notice, not a room. */
  leading?: React.ReactNode;
  /** Controls on the row's right edge (a "more" menu). */
  trailing?: React.ReactNode;
}) {
  const heading = (
    <>
      {leading}
      <span className={`truncate text-xl font-semibold tracking-tight text-text-primary transition-colors ${href ? 'group-hover:text-ha-blue' : ''}`}>{title}</span>
      {href && <NavChevron size={20} className="text-text-tertiary group-hover:text-ha-blue" />}
    </>
  );
  return (
    <div
      className="-mx-ha-1 flex items-center gap-ha-2 pr-ha-1 pt-ha-2 pb-ha-3"
      // The negative margin gives the link a little bleed for its hit area, so
      // the card's inset has to be added back on top of it.
      style={{ paddingLeft: 'calc(var(--ha-space-1) + var(--dct-pad, calc(12px * var(--ha-density, 1))))' }}
      data-section-header
    >
      {href ? (
        <Link href={href} prefetch={false} className={`flex w-fit min-w-0 items-center group ${leading ? 'gap-2.5' : 'gap-1'}`}>{heading}</Link>
      ) : (
        <span className={`flex min-w-0 items-center ${leading ? 'gap-2.5' : 'gap-1'}`}>{heading}</span>
      )}
      {trailing && <span className="ml-auto flex shrink-0 items-center">{trailing}</span>}
    </div>
  );
}
