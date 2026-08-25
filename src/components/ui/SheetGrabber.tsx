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
 * Wrap it in the sheet's own drag handle; this renders the mark, not the gesture.
 */
export function SheetGrabber({
  tone = 'default',
  className,
}: {
  tone?: 'default' | 'light';
  className?: string;
}) {
  return (
    <div className={clsx('flex justify-center', className)}>
      <div
        className={clsx(
          'h-1 w-8 rounded-full',
          tone === 'light' ? 'bg-white/45' : 'bg-text-secondary/30',
        )}
      />
    </div>
  );
}
