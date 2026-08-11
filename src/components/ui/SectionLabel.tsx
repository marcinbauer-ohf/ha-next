'use client';

import { clsx } from 'clsx';

/**
 * Canonical small uppercase section header used before/inside cards and nav groups.
 * Matches the style in settings panels, search overlays, and nav sections.
 *
 * `inset` is the alignment rule for a heading that floats above a grouped list:
 * the label lines up with the text inside the rows it labels (the standard row
 * padding, ha-4), not with the card edge. Pass it for every heading above a list
 * of rows; leave it off for headings above grids, tiles or full-bleed content,
 * where the card edge is the right reference. Groups whose rows use a different
 * padding pass their own `px-*` instead.
 */
export function SectionLabel({
  children,
  className = '',
  inset = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  inset?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <p
      className={clsx(
        'text-xs font-medium uppercase tracking-wider text-text-tertiary',
        inset && 'px-ha-4',
        className,
      )}
      style={style}
    >
      {children}
    </p>
  );
}
