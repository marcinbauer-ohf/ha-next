'use client';

import { clsx } from 'clsx';

/**
 * The pill at the top of every bottom sheet. One size and one tone, because the
 * grabber is the only thing on a sheet that means "you can drag this" — seven
 * different pills said it seven slightly different ways.
 *
 * `tone="light"` is for a sheet sitting on media or the screensaver, where the
 * page's text colours don't apply.
 *
 * `bent` folds the pill into a shallow chevron (20° per arm) — the "there is
 * more above" hint the mobile nav's home tab shows. It is drawn as two arms that
 * overlap by one thickness at the joint, so flat they read as a single pill and
 * the fold animates from one to the other. The arms are painted solid and the
 * translucency sits on the group, so the overlap does not double up into a
 * darker dot. `size="sm"` is the tab-strip size.
 *
 * Wrap it in the sheet's own drag handle; this renders the mark, not the gesture.
 */
export function SheetGrabber({
  tone = 'default',
  size = 'md',
  bent = false,
  className,
}: {
  tone?: 'default' | 'light';
  size?: 'sm' | 'md';
  bent?: boolean;
  className?: string;
}) {
  const width = size === 'sm' ? 14 : 32;
  const thickness = 3;
  const arm = width / 2 + thickness / 2;
  const color = tone === 'light' ? 'bg-white' : 'bg-text-secondary';
  const armClass = clsx(
    'absolute top-0 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
    color,
  );
  return (
    <div className={clsx('flex justify-center', className)}>
      <div className="relative" style={{ width, height: thickness, opacity: tone === 'light' ? 0.45 : 0.3 }}>
        <span
          className={armClass}
          style={{
            left: 0,
            width: arm,
            height: thickness,
            transformOrigin: `${width / 2}px 50%`,
            transform: bent ? 'rotate(-20deg)' : 'none',
          }}
        />
        <span
          className={armClass}
          style={{
            right: 0,
            width: arm,
            height: thickness,
            transformOrigin: `${thickness / 2}px 50%`,
            transform: bent ? 'rotate(20deg)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
