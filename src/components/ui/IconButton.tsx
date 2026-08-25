'use client';

import { clsx } from 'clsx';
import { Icon } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// IconButton — the one bare-glyph button. Before this there were ~30 hand-rolled
// close buttons alone, spread over seven box sizes, four radii and a different
// hover tone each. A glyph with no label has nothing but its size, its hit area
// and its states to say "this is a control", so those are the parts that must
// not drift.
//
// Three sizes, and nothing between them. The glyph stays 24px (the project's
// legibility floor) and the box grows around it, so the scale is really a scale
// of breathing room and hit area:
//   sm  36px  inside a dense row (a chip's clear ✕, a list row's action)
//   md  40px  the default — headers, toolbars, panel chrome
//   lg  48px  the primary touch target on a phone sheet or an overlay,
//             and the same 48px as Button's `lg` so the two line up in a row.
// ─────────────────────────────────────────────────────────────────────────────

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonTone = 'default' | 'quiet' | 'accent' | 'danger' | 'onImage';

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string;
  /** Required — a glyph-only control has no other accessible name. */
  label: string;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  /** Square with a soft radius instead of a circle — for toolbar tiles. */
  shape?: 'round' | 'square';
  /** Filled resting background (a standing tile) rather than bare-until-hover. */
  filled?: boolean;
  /**
   * Also expose the label as a native browser tooltip. Off by default: the app
   * has its own <Tooltip>, and a native one appearing on some glyph buttons and
   * not others is the inconsistency this component exists to remove.
   */
  titled?: boolean;
  /** Bypass the Icon 24px legibility floor for glyphs that read fine small. */
  exact?: boolean;
}

const BOX: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const GLYPH: Record<IconButtonSize, number> = { sm: 18, md: 20, lg: 22 };

const BASE = clsx(
  'inline-flex shrink-0 items-center justify-center outline-none',
  'transition-[background-color,color,transform,box-shadow] duration-150 ease-out',
  // One press feedback for every glyph button in the app, and the same
  // grow-on-hover as Button and the chips (see `.ha-hover-grow`).
  'ha-hover-grow',
  'active:scale-95 motion-reduce:active:scale-100',
  'focus-visible:ring-2 focus-visible:ring-ha-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-default',
  'disabled:opacity-40 disabled:pointer-events-none',
);

const TONE: Record<IconButtonTone, { rest: string; hover: string; fill: string }> = {
  default: {
    rest: 'text-text-secondary',
    hover: 'hover:bg-surface-low hover:text-text-primary',
    fill: 'bg-surface-low',
  },
  quiet: {
    rest: 'text-text-tertiary',
    hover: 'hover:bg-surface-low hover:text-text-secondary',
    fill: 'bg-surface-low',
  },
  accent: {
    rest: 'text-ha-blue [--ha-hover-grow:color-mix(in_srgb,var(--ha-color-blue)_10%,transparent)]',
    hover: 'hover:bg-ha-blue/10',
    fill: 'bg-ha-blue/10',
  },
  danger: {
    rest: 'text-red-500 [--ha-hover-grow:color-mix(in_srgb,var(--color-red-500)_10%,transparent)]',
    hover: 'hover:bg-red-500/10',
    fill: 'bg-red-500/10',
  },
  // Over a photo, a video or the screensaver, where the page's surfaces don't
  // exist: a glass chip that carries its own contrast.
  onImage: {
    rest: 'text-white/85 backdrop-blur-md border border-white/15 [--ha-hover-grow:rgba(255,255,255,0.2)] [--ha-hover-grow-edge:rgba(255,255,255,0.15)]',
    hover: 'hover:bg-white/20 hover:text-white',
    fill: 'bg-white/10',
  },
};

/**
 * The same shape as a class string, for the rare control that must be an anchor
 * or a drag handle rather than a <button> — so a link in a dialog header is
 * built from the same numbers as the button beside it instead of a copy of them.
 */
export function iconButtonClass({
  size = 'md',
  tone = 'default',
  shape = 'round',
  filled = false,
}: { size?: IconButtonSize; tone?: IconButtonTone; shape?: 'round' | 'square'; filled?: boolean } = {}) {
  const t = TONE[tone];
  return clsx(
    BASE,
    shape === 'round' ? 'rounded-full' : 'rounded-ha-xl',
    BOX[size],
    t.rest,
    t.hover,
    filled && t.fill,
  );
}

export function IconButton({
  icon,
  label,
  size = 'md',
  tone = 'default',
  shape = 'round',
  filled = false,
  titled = false,
  exact,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={titled ? label : undefined}
      className={clsx(iconButtonClass({ size, tone, shape, filled }), className)}
      {...rest}
    >
      <Icon path={icon} size={GLYPH[size]} exact={exact} />
    </button>
  );
}
