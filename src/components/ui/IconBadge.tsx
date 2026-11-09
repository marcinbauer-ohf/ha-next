'use client';

import { clsx } from 'clsx';
import { Icon } from './Icon';

/**
 * A glyph in a tinted circle — the one place a card or a summary chip shows
 * colour. The badge carries the state ("on", "needs attention"); the surface it
 * sits on stays neutral, so colour never means anything but status.
 *
 * Three sizes on the control tiers: 48 for a dialog's hero (24 glyph), 40 for a
 * device card's top row, 32 inside a chip (20 glyph in both).
 */
export type IconBadgeTone = 'default' | 'success' | 'primary' | 'warning' | 'danger' | 'yellow' | 'violet' | 'onImage';

const TONE: Record<IconBadgeTone, string> = {
  default: 'bg-surface-mid text-text-secondary',
  success: 'bg-green-500/15 text-green-600',
  primary: 'bg-ha-blue/15 text-ha-blue',
  warning: 'bg-amber-500/15 text-amber-600',
  danger: 'bg-red-500/15 text-red-600',
  yellow: 'bg-yellow-500/20 text-yellow-600',
  violet: 'bg-violet-500/15 text-violet-500',
  onImage: 'bg-white/15 text-white',
};

export function IconBadge({ icon, tone = 'default', size = 40, className }: {
  icon: string;
  tone?: IconBadgeTone;
  size?: 32 | 40 | 48;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200',
        size === 48 ? 'h-12 w-12' : size === 40 ? 'h-10 w-10' : 'h-8 w-8',
        TONE[tone],
        className,
      )}
    >
      <Icon path={icon} size={size === 48 ? 24 : 20} exact />
    </span>
  );
}
