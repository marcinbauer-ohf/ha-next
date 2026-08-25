'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useDebugFlags } from '@/contexts';

const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };

/**
 * The pill is painted in the accent blue and re-points the semantic colour
 * tokens at white, so every control inside it (icons, segment indicators, hover
 * fills) inverts without each toolbar restyling its own children. The tokens are
 * aliased on the outer wrapper first — see TOOLBAR_SURFACE_RESET.
 */
const THEMED_TOKENS = [
  'surface-default', 'surface-low', 'surface-mid', 'surface-lower',
  'text-primary', 'text-secondary', 'text-tertiary', 'text-disabled',
  'fill-primary-normal', 'blue',
] as const;

/** Page-palette copies, captured above the inversion so it can be undone below it. */
const TOKEN_ALIASES = Object.fromEntries(
  THEMED_TOKENS.map((t) => [`--tb-${t}`, `var(--ha-color-${t})`]),
) as CSSProperties;

/**
 * Restores the page palette. Put it on anything rendered inside a toolbar that
 * should NOT be blue — a popover that floats out over the page, say, where white
 * text on a white-tinted panel would be unreadable.
 */
export const TOOLBAR_SURFACE_RESET = Object.fromEntries(
  THEMED_TOKENS.map((t) => [`--ha-color-${t}`, `var(--tb-${t})`]),
) as CSSProperties;

/**
 * The pill's blue, darkened. The raw accent (#18bcf2 in the default theme) is a
 * light blue — white on it lands at 2.2:1, which fails AA and reads as glare.
 * Mixing it 62% with black keeps the hue but takes white to ~4.9:1. Used for the
 * pill's own fill and, inverted, for the Done button's label on white.
 */
const TOOLBAR_ACCENT = 'color-mix(in srgb, var(--tb-blue) 62%, #000)';

const BLUE_PILL = {
  backgroundColor: TOOLBAR_ACCENT,
  '--ha-color-surface-default': 'rgba(255,255,255,0.22)',
  '--ha-color-surface-low': 'rgba(255,255,255,0.14)',
  '--ha-color-surface-mid': 'rgba(255,255,255,0.28)',
  '--ha-color-surface-lower': 'rgba(255,255,255,0.10)',
  '--ha-color-fill-primary-normal': 'rgba(255,255,255,0.22)',
  '--ha-color-text-primary': '#fff',
  '--ha-color-text-secondary': 'rgba(255,255,255,0.86)',
  '--ha-color-text-tertiary': 'rgba(255,255,255,0.72)',
  '--ha-color-text-disabled': 'rgba(255,255,255,0.5)',
  // Accent-on-accent would vanish, so `text-ha-blue` (active segment labels)
  // inverts to white too. The real blue stays reachable as --tb-blue.
  '--ha-color-blue': '#fff',
} as CSSProperties;

/**
 * The toolbar's primary action ("Done"), inverted against the blue pill: a white
 * pill with blue text. Shared so the three editor toolbars can't drift.
 */
export function ToolbarPrimaryButton({ label, onClick, className = '' }: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 px-6 rounded-full bg-white font-semibold text-sm transition-all hover:bg-white/90 active:scale-95 ${className}`}
      style={{ color: TOOLBAR_ACCENT }}
    >
      {label}
    </button>
  );
}

/**
 * Shared chrome for the floating bottom editor toolbars (dashboard edit,
 * automation editor, areas & floors). Mobile: a full-width pill matching
 * MobileNav — same gradient hairline, inner padding, and --ha-edge-padding
 * offset from the screen edges and bottom. Desktop: a centered floating pill,
 * inset from the bottom by the same 1.5rem the corner toast uses.
 *
 * Renders a motion.div with enter/exit variants but no portal and no
 * AnimatePresence — callers own mount/unmount (and portal when they need to
 * escape a transformed ancestor).
 */
export function EditorToolbarShell({ mobile, desktop, tone = 'accent' }: {
  mobile: ReactNode;
  desktop: ReactNode;
  /**
   * `accent` — the blue editor pill that takes over the screen (and, on mobile,
   * the nav's slot). `neutral` — a plain card pill for toolbars you *browse*
   * with rather than edit in (the energy dashboard's period navigator): page
   * palette, no accent border, and on mobile it floats above the nav instead of
   * replacing it.
   */
  tone?: 'accent' | 'neutral';
}) {
  // The desktop offset clears the status bar. With the bottom bar hidden by the
  // prototyping flag there's nothing to clear, so the pill drops to the same
  // --ha-edge-padding inset as the dashboard surface's own bottom margin — and
  // the 1.5rem padding below keeps it off that edge either way.
  const { hideHomeCenterEnabled } = useDebugFlags();
  const neutral = tone === 'neutral';
  const pillStyle = neutral ? undefined : BLUE_PILL;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.96 }}
      transition={TOOLBAR_SPRING}
      className={`fixed z-[60] pointer-events-none inset-x-0 bottom-0 lg:left-[76px] lg:right-0 lg:pb-6 ${
        // Neutral toolbars coexist with the mobile nav, so they sit one pill
        // height above it rather than in its place.
        neutral ? 'pb-[calc(5.25rem+var(--ha-edge-padding))]' : 'pb-edge'
      } ${hideHomeCenterEnabled ? 'lg:bottom-edge' : 'lg:bottom-20'}`}
      style={TOKEN_ALIASES}
    >
      {/* Mobile: the same pill as MobileNav — identical radius, 1px gradient
          edge, 8px inner inset and 48px control band. The toolbar replaces the
          nav on mobile, so matching them makes that swap read as one surface
          changing its contents rather than two different bars trading places. */}
      <div className="lg:hidden px-edge pointer-events-auto">
        <div className={`relative rounded-[var(--mobile-nav-radius)] p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)] ${
          neutral ? 'bg-surface-lower' : 'bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70'
        }`}>
          {/* min-h-16 = the nav's 8px + 48px band + 8px, border-box, so both
              bars stand exactly as tall. Column flex so the caller's row still
              spans the full width. */}
          <div
            className={`relative flex min-h-16 flex-col justify-center rounded-[calc(var(--mobile-nav-radius)_-_1px)] px-ha-2 py-ha-2 ${neutral ? 'bg-surface-default' : ''}`}
            style={pillStyle}
          >
            {mobile}
          </div>
        </div>
      </div>

      {/* Desktop: centered floating pill */}
      <div className="hidden lg:flex justify-center pointer-events-auto">
        <div
          className={`px-ha-2 py-ha-2 rounded-ha-3xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] flex items-center gap-ha-1 ${
            neutral ? 'bg-surface-default border border-surface-lower' : ''
          }`}
          style={pillStyle}
        >
          {desktop}
        </div>
      </div>
    </motion.div>
  );
}
