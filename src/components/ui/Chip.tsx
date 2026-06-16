'use client';

import type { ReactNode } from 'react';

// Pill toggle used across filter rows and mobile filter sheets. Active state
// echoes the brand accent; inactive sits quietly on the surface. Fixed h-10 so
// every filter control (sort/group/facets/layout toggle) lines up at one height.
export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-ha-2 rounded-ha-xl border px-ha-3 text-sm font-semibold transition-colors ${
        active
          ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
          : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low'
      }`}
    >
      {children}
    </button>
  );
}
