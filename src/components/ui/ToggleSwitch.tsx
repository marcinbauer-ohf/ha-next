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
  /** Placement only — the track's own metrics stay with the size. */
  className?: string;
}

// Sized like a system switch (iOS 51×31, Material 52×32), not bigger: the `md`
// track rides the name row of a two-column phone card, where every extra pixel
// of switch is a pixel the name can't have. The hit area is the card row itself
// (44px+), so the track doesn't have to be the touch target. Heights land on
// the 8px control grid the rest of the app uses (26 / 32 / 38 / 44).
const TRACK = {
  sm: 'w-[44px] h-[26px] px-[3px]',
  md: 'w-[52px] h-[32px] px-[3px]',
  lg: 'w-[64px] h-[38px] px-[4px]',
  xl: 'w-[76px] h-[44px] px-[5px]',
} as const;
const KNOB = { sm: 'w-[20px] h-[20px]', md: 'w-[26px] h-[26px]', lg: 'w-[30px] h-[30px]', xl: 'w-[34px] h-[34px]' } as const;
const SHIFT = { sm: 'translate-x-[18px]', md: 'translate-x-[20px]', lg: 'translate-x-[26px]', xl: 'translate-x-[32px]' } as const;

/**
 * Pill toggle for binary on/off entities. State reads from the knob position
 * and the track fill; the knob itself is a plain disc.
 */
export function ToggleSwitch({ on, onToggle, size = 'md', disabled, label, className }: ToggleSwitchProps) {
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
        className,
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
