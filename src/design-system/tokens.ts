/**
 * Design-system tokens — the onboarding-v2 visual language, extracted.
 * Values lifted from the Figma --ha/* tokens (see /dev/onboarding-v2).
 */

export const color = {
  /** Page/stage background. */
  surface: '#e6e6e6',
  /** Selection, active states, primary accents. */
  accent: '#009ac7',
  /** Dark fills: CTA, bottom nav, toast. */
  ink: '#202020',
  /** Primary text. */
  text: '#141414',
  /** Secondary text. */
  text2: '#5e5e5e',
  /** Placeholders, eyebrows, tertiary. */
  textDim: '#989898',
  /** Input/chip resting fill. */
  field: '#f3f3f3',
  /** Accent-tinted resting fill. */
  tint: '#eef6f9',
  white: '#ffffff',
  /** Toggle/checkbox off-track. */
  off: '#e3e3e3',
  /** Warning/error accents (drawn from the key-cap palette). */
  warn: '#e8a33d',
  danger: '#d96c6c',
} as const;

/** Plastic key-cap colors — a person's identity color, picked by seed. */
export const KEY_CAPS = ['#009ac7', '#e8a33d', '#7bb662', '#d96c6c', '#8e7cc3', '#e58f65'];

/** Stable string hash — cuts keys, seeds identity colors. */
export function keyHash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** The cap color a person's key wears — reused wherever they're represented. */
export const capColorFor = (seed: string) => KEY_CAPS[keyHash(seed) % KEY_CAPS.length];

export const shadow = {
  rest: '0 2px 8px rgba(0,0,0,0.06)',
  float: '0 8px 30px rgba(0,0,0,0.12)',
  toast: '0 8px 30px rgba(0,0,0,0.2)',
  sheet: '0 -8px 40px rgba(0,0,0,0.12)',
} as const;

/** Framer-motion spring presets. */
export const spring = {
  /** Button press feedback. */
  press: { type: 'spring', stiffness: 600, damping: 32 },
  /** Popovers, toasts. */
  pop: { type: 'spring', stiffness: 500, damping: 32 },
  /** Step/panel slides. */
  slide: { type: 'spring', stiffness: 380, damping: 34 },
  /** Bottom sheets. */
  sheet: { type: 'spring', stiffness: 340, damping: 34 },
  /** Items dropping into place. */
  drop: { type: 'spring', stiffness: 320, damping: 17, mass: 0.9 },
} as const;

/** The system face — Onest is loaded by the root layout. */
export const font = 'var(--font-onest), Onest, system-ui, sans-serif';

/** Snappy settle with a touch of overshoot — a real-life toggle. The one
 *  curve for toggles, segmented controls, and anything that clicks into
 *  place. */
export const ease = {
  snap: 'cubic-bezier(0.7, 0, 0.3, 1.4)',
} as const;
