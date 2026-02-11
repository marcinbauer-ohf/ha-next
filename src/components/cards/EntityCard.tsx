'use client';

import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import type { EntityCardProps } from '@/types';

const colorClasses = {
  primary: 'bg-fill-primary-normal',
  danger: 'bg-fill-danger-normal',
  success: 'bg-fill-success-normal',
  yellow: 'bg-yellow-95',
  default: 'bg-surface-low',
};

const iconColorClasses = {
  primary: 'text-ha-blue',
  danger: 'text-red-600',
  success: 'text-green-600',
  yellow: 'text-yellow-600',
  default: 'text-text-secondary',
};

export function EntityCard({
  icon,
  title,
  state,
  color = 'default',
  size = 'sm',
  onClick,
}: EntityCardProps) {
  if (size === 'sm') {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'relative hover:z-50 flex items-center gap-ha-3 p-ha-3 rounded-ha-xl transition-all hover:scale-[1.02] active:scale-[0.98]',
          colorClasses[color]
        )}
      >
        <div className={clsx('flex-shrink-0', iconColorClasses[color])}>
          <Icon path={icon} size={24} />
        </div>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-medium text-text-primary truncate w-full text-left">
            {title}
          </span>
          <span className="text-xs text-text-secondary truncate w-full text-left">
            {state}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative hover:z-50 flex flex-col items-start p-ha-4 rounded-ha-2xl transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[120px]',
        colorClasses[color]
      )}
    >
      <div className={clsx('mb-ha-3', iconColorClasses[color])}>
        <Icon path={icon} size={32} />
      </div>
      <div className="flex flex-col items-start mt-auto">
        <span className="text-base font-medium text-text-primary text-left">{title}</span>
        <span className="text-sm text-text-secondary text-left">{state}</span>
      </div>
    </button>
  );
}
