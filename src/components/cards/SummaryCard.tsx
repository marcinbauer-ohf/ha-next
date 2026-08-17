'use client';

import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import type { SummaryCardProps } from '@/types';

const colorClasses = {
  primary: 'bg-surface-low',
  danger: 'bg-fill-danger-normal',
  success: 'bg-surface-low',
  yellow: 'bg-surface-low',
  violet: 'bg-surface-low',
  default: 'bg-surface-low',
};

const iconColorClasses = {
  primary: 'text-ha-blue',
  danger: 'text-red-600',
  success: 'text-green-600',
  yellow: 'text-yellow-600',
  violet: 'text-violet-500',
  default: 'text-text-secondary',
};


// Shared glass fill for the translucent chips/pills floating over the
// screensaver canvas — keep the whole family on this exact string so their
// transparency can't drift apart. Dark (black) glass with white icons/text so
// the chips read against any shader while still letting the scene peek through.
export const TRANSLUCENT_CHIP_FILL = 'bg-black/55 border border-white/15';

export function SummaryCard({ icon, title, state, color = 'default', compact = false, variant = 'filled', size = 'sm', translucent = false, onClick }: SummaryCardProps) {
  const translucentFill = TRANSLUCENT_CHIP_FILL;
  // Interactive glances render as a button with hover/press affordance.
  const Tag = onClick ? 'button' : 'div';
  const interactive = onClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : '';

  if (compact) {
    const isOutlined = variant === 'outlined';
    const isLg = size === 'lg';
    const isMd = size === 'md';

    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={clsx(
          'flex items-center transition-all',
          isLg ? 'gap-ha-3 px-ha-5 py-ha-3 rounded-ha-2xl' :
          isMd ? 'gap-ha-2 px-ha-4 py-2.5 rounded-ha-xl' :
          // Fixed height, not padding: the chips carry different innards
          // (glyphs, stacked avatars) and only a set height keeps the row even.
          'gap-ha-2 px-ha-3 h-10 rounded-ha-pill',
          'whitespace-nowrap',
          interactive,
          translucent ? translucentFill : isOutlined ? 'bg-surface-default border border-surface-lower' : colorClasses[color]
        )}
      >
        <div className={clsx('flex-shrink-0', translucent ? 'text-white' : iconColorClasses[color])}>
          <Icon path={icon} size={isLg ? 28 : isMd ? 22 : 18} />
        </div>
        {/* Label above the value: the value alone ("3 on", "42 W") doesn't say
            what it's counting once the chips are read out of context. */}
        <div className="flex flex-col items-start leading-tight">
          <span className={clsx(
            translucent ? 'text-white/70' : 'text-text-secondary',
            isLg ? 'text-sm' : isMd ? 'text-xs' : 'text-[11px]'
          )}>{title}</span>
          {/* Mono, same as a device card's state line — readings should look
              like readings wherever they show up. */}
          <span className={clsx(
            'font-mono font-medium text-left',
            translucent ? 'text-white' : 'text-text-primary',
            isLg ? 'text-xl' : isMd ? 'text-base' : 'text-[13px]'
          )}>{state}</span>
        </div>
      </Tag>
    );
  }

  const isOutlined = variant === 'outlined';
  const isLg = size === 'lg';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-ha-3 p-ha-3 rounded-ha-xl transition-all w-full text-left',
        isLg ? 'p-ha-4' : 'p-ha-3',
        interactive,
        isOutlined ? 'bg-surface-default border border-surface-lower' : colorClasses[color]
      )}
    >
      <div className={clsx('flex-shrink-0', iconColorClasses[color])}>
        <Icon path={icon} size={isLg ? 32 : 24} />
      </div>
      <div className="flex flex-col items-start min-w-0 flex-1">
        <span className={clsx('font-medium text-text-primary text-left', isLg ? 'text-base' : 'text-sm')}>{title}</span>
        <span className={clsx('text-text-secondary text-left', isLg ? 'text-sm' : 'text-xs')}>{state}</span>
      </div>
    </Tag>
  );
}

