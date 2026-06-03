'use client';

import { clsx } from 'clsx';

interface ListSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable grouped list container — same pattern as settings profile sections.
 * Wrap list rows (anchor tags, divs, buttons) as direct children;
 * they get automatic divider borders via CSS sibling selectors.
 */
export function ListSection({ title, children, className }: ListSectionProps) {
  return (
    <div className={clsx('space-y-ha-2', className)}>
      {title && (
        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider px-ha-1">
          {title}
        </p>
      )}
      <div className="bg-surface-default rounded-ha-2xl border border-surface-lower overflow-hidden [&>*]:border-b [&>*]:border-surface-lower [&>*:last-child]:border-0">
        {children}
      </div>
    </div>
  );
}
