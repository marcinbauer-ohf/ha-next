'use client';

import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import type { SummaryCardProps } from '@/types';

const colorClasses = {
  primary: 'bg-surface-low',
  danger: 'bg-fill-danger-normal',
  success: 'bg-surface-low',
  yellow: 'bg-surface-low',
  default: 'bg-surface-low',
};

const iconColorClasses = {
  primary: 'text-ha-blue',
  danger: 'text-red-600',
  success: 'text-green-600',
  yellow: 'text-yellow-600',
  default: 'text-text-secondary',
};


export function SummaryCard({ icon, title, state, color = 'default', compact = false, variant = 'filled', size = 'sm' }: SummaryCardProps) {
  if (compact) {
    const isOutlined = variant === 'outlined';
    const isLg = size === 'lg';
    const isMd = size === 'md';

    return (
      <div
        className={clsx(
          'flex items-center transition-colors',
          isLg ? 'gap-ha-3 px-ha-5 py-ha-3 rounded-ha-2xl' : 
          isMd ? 'gap-ha-2 px-ha-4 py-ha-2.5 rounded-ha-xl' :
          'gap-ha-2 px-ha-3 py-ha-2 rounded-ha-pill',
          'whitespace-nowrap',
          isOutlined ? 'bg-surface-default border border-surface-lower' : colorClasses[color]
        )}
      >
        <div className={clsx('flex-shrink-0', iconColorClasses[color])}>
          <Icon path={icon} size={isLg ? 28 : isMd ? 22 : 18} />
        </div>
        <span className={clsx(
          'font-medium text-text-primary text-left',
          isLg ? 'text-xl' : isMd ? 'text-base' : 'text-sm'
        )}>{state}</span>
      </div>
    );
  }

  const isOutlined = variant === 'outlined';
  const isLg = size === 'lg';

  return (
    <div
      className={clsx(
        'flex items-center gap-ha-3 p-ha-3 rounded-ha-xl transition-colors',
        isLg ? 'p-ha-4' : 'p-ha-3',
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
    </div>
  );
}

