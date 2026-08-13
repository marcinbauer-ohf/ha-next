'use client';

import { clsx } from 'clsx';
import { useEditMode } from '@/contexts';

/**
 * Blue-ish accent border that grows around the dashboard surface while the
 * dashboard is being edited. Rendered as an inset overlay inside the surface
 * (which is overflow-hidden), so it adds no layout shift and hugs the rounded
 * corners. Mirror `roundedClassName` to the host surface's own rounding.
 *
 * The reveal is a clip circle anchored at the bottom centre — the same corner
 * the editor toolbar rises from — so the line propagates outward along the
 * bottom edge, up the sides, and closes across the top. Exiting runs it back in.
 */
export function DashboardEditBorder({
  roundedClassName = 'rounded-ha-3xl',
  active,
}: {
  roundedClassName?: string;
  /** Override the dashboard edit-mode signal — e.g. the automation/areas editors,
   *  which have their own open/closed state but the same focus treatment. */
  active?: boolean;
}) {
  const { isEditing: dashboardEditing } = useEditMode();
  const isEditing = active ?? dashboardEditing;
  return (
    <div
      aria-hidden
      className={clsx(
        'pointer-events-none absolute inset-0 z-30 border-2 border-ha-blue/70 transition-[clip-path,opacity] duration-500 ease-out',
        roundedClassName,
        isEditing ? 'opacity-100' : 'opacity-0',
      )}
      // 150% clears the far corners on any aspect ratio (the percentage is
      // relative to the box diagonal, so 100% alone can fall short on a wide
      // surface). Same shape function both ways, so it interpolates.
      style={{ clipPath: isEditing ? 'circle(150% at 50% 100%)' : 'circle(0% at 50% 100%)' }}
    />
  );
}
