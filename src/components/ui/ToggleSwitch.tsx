'use client';

import { clsx } from 'clsx';
import { haptic } from '@/lib/haptics';

interface ToggleSwitchProps {
  on?: boolean;
  onToggle: () => void;
  /** 'md' = card/list pill (default), 'lg' = hero size in the entity detail panel */
  size?: 'md' | 'lg';
}

/** Pill toggle switch for binary on/off entities */
export function ToggleSwitch({ on, onToggle, size = 'md' }: ToggleSwitchProps) {
  const lg = size === 'lg';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); haptic('toggle'); onToggle(); }}
      className={clsx(
        'flex items-center shrink-0 rounded-full transition-colors',
        lg ? 'w-[76px] h-[44px] px-[5px]' : 'w-11 h-[26px] px-[4px]',
        on ? 'bg-green-500' : 'bg-surface-mid hover:bg-surface-lower',
      )}
      aria-checked={on}
      role="switch"
    >
      <div className={clsx(
        'rounded-full bg-white shadow-sm transition-transform duration-200',
        lg ? 'w-[34px] h-[34px]' : 'w-[18px] h-[18px]',
        on ? (lg ? 'translate-x-[32px]' : 'translate-x-[18px]') : 'translate-x-0',
      )} />
    </button>
  );
}
