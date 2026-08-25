'use client';

import { clsx } from 'clsx';
import { Icon } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Button — the labelled action. Its counterpart for glyph-only controls is
// IconButton; anything with words belongs here.
//
// The shape is the one the app already converged on by hand: a 44px pill-ish
// tile (rounded-ha-xl), sentence-case `text-sm font-semibold`, glyph and label
// on a ha-2 gap. What had drifted was everything around it — three heights, four
// press scales, and two different "confirm" colours (blue and green) doing the
// same job on adjacent screens. Green stayed with state (a switch that is on, an
// alarm that is armed); the accent carries actions.
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'neutral' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading glyph (mdi path). */
  icon?: string;
  /** Trailing glyph — for a button that opens or advances something. */
  iconTrailing?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container — the standard sheet/form footer action. */
  block?: boolean;
}

const SIZE: Record<ButtonSize, { box: string; glyph: number }> = {
  sm: { box: 'h-9 px-ha-3 text-[13px] gap-ha-1', glyph: 16 },
  md: { box: 'h-11 px-ha-4 text-sm gap-ha-2', glyph: 18 },
  lg: { box: 'h-12 px-ha-5 text-base gap-ha-2', glyph: 20 },
};

// Each variant names the paint for its grow band (`--ha-hover-grow`), so a
// filled button grows seamlessly into its own colour. `ghost` leaves the
// default — surface-low is already the fill its hover paints in.
const VARIANT: Record<ButtonVariant, string> = {
  // Brightness rather than a second blue: one accent, lit on hover, so a primary
  // action looks the same whichever screen it lands on.
  primary: 'bg-ha-blue text-white shadow-sm shadow-ha-blue/20 hover:brightness-110 [--ha-hover-grow:var(--ha-color-blue)]',
  neutral: 'bg-surface-low text-text-primary hover:bg-surface-mid [--ha-hover-grow:var(--ha-color-surface-mid)]',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-low hover:text-text-primary',
  danger: 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white [--ha-hover-grow:var(--color-red-500)]',
};

export function Button({
  icon,
  iconTrailing,
  children,
  variant = 'neutral',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const s = SIZE[size];
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-ha-xl font-semibold whitespace-nowrap outline-none',
        'transition-[background-color,color,filter,transform,box-shadow] duration-150 ease-out',
        // Hover grows the button's own edge outward rather than only tinting it
        // — same reflex as the cards and chips. See `.ha-hover-grow`.
        'ha-hover-grow',
        // Two press depths, picked by how big the thing being pressed is: a
        // hand-sized control can take the full 95%, but a full-width button
        // scaled that far throws its edges ~10px inward and reads as a glitch.
        block ? 'active:scale-[0.98]' : 'active:scale-95',
        'motion-reduce:active:scale-100',
        'focus-visible:ring-2 focus-visible:ring-ha-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-default',
        'disabled:opacity-40 disabled:pointer-events-none',
        s.box,
        VARIANT[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon && <Icon path={icon} size={s.glyph} exact />}
      {children}
      {iconTrailing && <Icon path={iconTrailing} size={s.glyph} exact />}
    </button>
  );
}
