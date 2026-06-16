import { clsx } from 'clsx';
import { Icon } from './Icon';
import { mdiChevronRight, mdiChevronLeft } from '@mdi/js';

/**
 * Project-wide "go deeper" affordance: a chevron that nudges a few pixels toward
 * its own direction when the nearest `group` ancestor is hovered. Use it for any
 * row / link / button that drills into a detail view, and make sure that
 * clickable ancestor carries Tailwind's `group` class. Honours reduced motion.
 *
 * Pass `className` for colour (e.g. `text-text-disabled`) — the movement classes
 * are applied on top.
 */
export function NavChevron({
  direction = 'right',
  size = 16,
  className,
}: {
  direction?: 'right' | 'left';
  size?: number;
  className?: string;
}) {
  return (
    <Icon
      path={direction === 'left' ? mdiChevronLeft : mdiChevronRight}
      size={size}
      className={clsx(
        'transition-[color,transform] duration-150 ease-out motion-reduce:transform-none',
        direction === 'left' ? 'group-hover:-translate-x-[3px]' : 'group-hover:translate-x-[3px]',
        className,
      )}
    />
  );
}
