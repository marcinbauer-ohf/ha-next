'use client';

import { clsx } from 'clsx';
import { useEditMode } from '@/contexts';

/**
 * Blue-ish accent border that fades in around the dashboard surface while the
 * dashboard is being edited. Rendered as an inset overlay inside the surface
 * (which is overflow-hidden), so it adds no layout shift and hugs the rounded
 * corners. Mirror `roundedClassName` to the host surface's own rounding.
 */
export function DashboardEditBorder({ roundedClassName = 'rounded-ha-3xl' }: { roundedClassName?: string }) {
  const { isEditing } = useEditMode();
  return (
    <div
      aria-hidden
      className={clsx(
        'pointer-events-none absolute inset-0 z-30 border-2 border-ha-blue/70 transition-opacity duration-500 ease-out',
        roundedClassName,
        isEditing ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}
