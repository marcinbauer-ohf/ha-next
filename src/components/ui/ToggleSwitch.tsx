'use client';

import { clsx } from 'clsx';
import { haptic } from '@/lib/haptics';

interface ToggleSwitchProps {
  on?: boolean;
  onToggle: () => void;
  /**
   * 'md' = card/list pill (default), 'lg' = entity detail panel,
   * 'xl' = two-column hero, where the switch is the main control
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Dimmed and inert — used while the reading next to it is a scrubbed past one. */
  disabled?: boolean;
  /** Accessible name, for switches whose label isn't wired up by a <label>. */
  label?: string;
}

// Deliberately bigger than Home Assistant's own switch. A dashboard card is
// glanced at from across a room and hit with a thumb, so the control is sized
// for the hand, not for density: the `md` track is a 40px-tall hit target with a
// 30px knob, matching the 48px bento control grid it sits next to.
const TRACK = {
  sm: 'w-[52px] h-[32px] px-[3px]',
  md: 'w-[64px] h-[38px] px-[4px]',
  lg: 'w-[76px] h-[44px] px-[5px]',
  xl: 'w-[108px] h-[62px] px-[6px]',
} as const;
const KNOB = { sm: 'w-[24px] h-[24px]', md: 'w-[30px] h-[30px]', lg: 'w-[34px] h-[34px]', xl: 'w-[50px] h-[50px]' } as const;
const SHIFT = { sm: 'translate-x-[20px]', md: 'translate-x-[26px]', lg: 'translate-x-[32px]', xl: 'translate-x-[46px]' } as const;

/**
 * Pill toggle for binary on/off entities. State reads from the knob position
 * and the track fill; the knob itself is a plain disc.
 */
export function ToggleSwitch({ on, onToggle, size = 'md', disabled, label }: ToggleSwitchProps) {
  return (
    <button
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); haptic('toggle'); onToggle(); }}
      className={clsx(
        'group/switch flex items-center shrink-0 rounded-full outline-none transition-[background-color,box-shadow,transform,opacity]',
        'focus-visible:ring-2 focus-visible:ring-ha-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-default',
        'active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        TRACK[size],
        on
          ? 'bg-green-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
          : 'bg-surface-mid hover:bg-surface-lower shadow-[inset_0_1px_2px_rgba(0,0,0,0.10)]',
      )}
      aria-checked={on}
      aria-label={label}
      role="switch"
    >
      <div className={clsx(
        'rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out',
        KNOB[size],
        on ? SHIFT[size] : 'translate-x-0',
      )} />
    </button>
  );
}
