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
  onIncrement,
  onDecrement,
}: EntityCardProps) {
  if (size === 'sm') {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'relative hover:z-50 flex items-center gap-ha-3 p-ha-3 rounded-ha-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group',
          colorClasses[color]
        )}
        role="button"
        tabIndex={0}
      >
        <div className="relative flex-shrink-0">
          <div className={clsx('flex-shrink-0', iconColorClasses[color])}>
            <Icon path={icon} size={24} />
          </div>
        </div>
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-sm font-medium text-text-primary truncate w-full text-left">
            {title}
          </span>
          <span className="text-xs text-text-secondary truncate w-full text-left">
            {state}
          </span>
        </div>
        
        {(onIncrement || onDecrement) && (
          <div className="flex items-center gap-1 transition-opacity">
            {onDecrement && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDecrement(e); }}
                className={clsx('w-6 h-6 flex items-center justify-center rounded-full transition-colors shadow-sm', color !== 'default' ? 'bg-black/10 hover:bg-black/20 text-text-primary' : 'bg-surface-default hover:bg-surface-mid text-text-secondary')}
              >
                <span className="text-sm font-bold leading-none mb-px">-</span>
              </button>
            )}
            {onIncrement && (
              <button 
                onClick={(e) => { e.stopPropagation(); onIncrement(e); }}
                className={clsx('w-6 h-6 flex items-center justify-center rounded-full transition-colors shadow-sm', color !== 'default' ? 'bg-black/10 hover:bg-black/20 text-text-primary' : 'bg-surface-default hover:bg-surface-mid text-text-primary')}
              >
                <span className="text-sm font-bold leading-none mb-px">+</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative hover:z-50 flex flex-col items-start p-ha-4 rounded-ha-2xl transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[120px] cursor-pointer group',
        colorClasses[color]
      )}
      role="button"
      tabIndex={0}
    >
      <div className="flex justify-between w-full">
        <div className="relative">
          <div className={clsx('mb-ha-3', iconColorClasses[color])}>
            <Icon path={icon} size={32} />
          </div>
        </div>
        
        {(onIncrement || onDecrement) && (
          <div className="flex flex-col gap-1 transition-opacity">
            {onIncrement && (
              <button 
                onClick={(e) => { e.stopPropagation(); onIncrement(e); }}
                className={clsx('w-8 h-8 flex items-center justify-center rounded-full transition-colors shadow-sm', color !== 'default' ? 'bg-black/10 hover:bg-black/20 text-text-primary' : 'bg-surface-default hover:bg-surface-mid text-text-primary')}
              >
                <span className="text-lg font-bold leading-none mb-0.5">+</span>
              </button>
            )}
            {onDecrement && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDecrement(e); }}
                className={clsx('w-8 h-8 flex items-center justify-center rounded-full transition-colors shadow-sm', color !== 'default' ? 'bg-black/10 hover:bg-black/20 text-text-primary' : 'bg-surface-default hover:bg-surface-mid text-text-secondary')}
              >
                <span className="text-lg font-bold leading-none mb-0.5">-</span>
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="flex flex-col items-start mt-auto w-full">
        <span className="text-base font-medium text-text-primary text-left">{title}</span>
        <span className="text-sm text-text-secondary text-left">{state}</span>
      </div>
    </div>
  );
}
