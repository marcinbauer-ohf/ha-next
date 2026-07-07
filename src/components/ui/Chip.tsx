'use client';

import type { ReactNode } from 'react';

// Pill toggle used across filter rows and mobile filter sheets. Active state
// echoes the brand accent; inactive sits quietly on the surface. Fixed h-10 so
// every filter control (sort/group/facets/layout toggle) lines up at one height.
export function Chip({
  active,
  onClick,
  children,
  fullWidth,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  // Stretch to a full-width row (vertical option lists) instead of hugging
  // its label (horizontal chip wraps).
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={`${fullWidth ? 'flex w-full' : 'inline-flex'} h-10 items-center gap-ha-2 rounded-ha-xl border px-ha-3 text-sm font-semibold transition-colors ${
        active
          ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
          : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low'
      }`}
    >
      {children}
    </button>
  );
}
