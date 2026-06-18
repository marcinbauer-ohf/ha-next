'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

/**
 * Live typeface switcher for the prototype.
 *
 * Every option here is licensed under the SIL Open Font License 1.1 (OFL) —
 * permissive, redistributable, and safe to ship inside Home Assistant with no
 * licensing strings attached (the same class of license HA already relies on).
 *
 * Mechanism: the chosen font's CSS stack is written as an inline custom
 * property on <body> (`--ha-font-family-base`). `body { font-family: ... }`
 * and the `default`/`glass` themes consume that var, so they update instantly.
 * Themes that hard-set their own face (cyberpunk, material, eink, fallout,
 * teenage) reference `var(--font-*)` directly and intentionally keep their
 * identity. Picking "Theme default" removes the inline override.
 *
 * The `var(--font-*)` tokens are emitted by next/font/google in layout.tsx and
 * defined on <body>, which is also where we write the override — so they always
 * resolve.
 */

export interface FontOption {
  key: string;
  label: string;
  caption: string;
  /** CSS value for --ha-font-family-base, or null to defer to the active theme. */
  stack: string | null;
  /** Google Fonts family name to lazy-load via <link> when first selected. */
  google?: string;
  /**
   * Per-font typographic tuning applied to <body> when this face is active.
   * Every typeface has a different ideal tracking at UI sizes — wide geometrics
   * and tight modern grotesks both read better nudged toward 0 apparent
   * spacing. `tracking` is a letter-spacing value (em); `features` is
   * font-feature-settings (e.g. slashed zero on monospaces). Omit = browser
   * default (the font's own metrics).
   */
  tracking?: string;
  features?: string;
}

/** Fonts bundled at build time via next/font/google (always present). */
const BUNDLED_FONTS: FontOption[] = [
  {
    key: 'theme',
    label: 'Theme default',
    caption: 'Use whatever the active theme defines',
    stack: null,
  },
  {
    key: 'noto',
    label: 'Noto Sans',
    caption: 'OFL · widest language & character coverage (recommended)',
    stack: 'var(--font-noto), "Noto Sans", system-ui, sans-serif',
  },
  {
    key: 'inter',
    label: 'Inter',
    caption: 'OFL · neutral UI workhorse',
    stack: 'var(--font-inter), "Inter", system-ui, sans-serif',
    // Inter's designer recommends slight negative tracking at UI sizes.
    tracking: '-0.011em',
  },
  {
    key: 'plex',
    label: 'IBM Plex Sans',
    caption: 'OFL · technical, distinctive',
    stack: 'var(--font-plex), "IBM Plex Sans", system-ui, sans-serif',
  },
  {
    key: 'source',
    label: 'Source Sans 3',
    caption: 'OFL · humanist, highly legible',
    stack: 'var(--font-source), "Source Sans 3", system-ui, sans-serif',
  },
  {
    key: 'figtree',
    label: 'Figtree',
    caption: 'OFL · friendly, rounded',
    stack: 'var(--font-figtree), "Figtree", system-ui, sans-serif',
    // Tall x-height geometric — tightens up nicely.
    tracking: '-0.006em',
  },
  {
    key: 'atkinson',
    label: 'Atkinson Hyperlegible',
    caption: 'OFL · low-vision accessibility champion',
    stack: 'var(--font-atkinson), "Atkinson Hyperlegible", "Hyperlegible Sans", system-ui, sans-serif',
  },
  {
    key: 'system',
    label: 'System UI',
    caption: 'No web font — uses the OS default UI face (SF, Segoe, Roboto…)',
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
];

/**
 * Ship-ready Google Fonts, lazy-loaded on first selection (see
 * `ensureGoogleFont`). Selection criteria — every one must satisfy both:
 *   1. License: all Google Fonts are OFL / Apache-2.0 / UFL → safe to ship in
 *      open-source Home Assistant.
 *   2. Script coverage: HA is translated to ~70 locales. Each face here ships
 *      Cyrillic (Russian) at minimum; most also ship Greek. CJK (Chinese etc.)
 *      is NOT in any Latin web font — it resolves through the `system-ui`
 *      fallback in each stack on a CJK-configured OS.
 * Latin-only faces (Lato, Poppins, Work Sans, DM Sans, Quicksand, Outfit, …)
 * were dropped: they'd show fallback tofu for Russian.
 * Varied across sans / condensed / mono / rounded / serif / display.
 */
interface GoogleFontDef {
  family: string;
  /** Short style note shown as the caption. */
  note: string;
  /** Per-font letter-spacing (see FontOption.tracking). Omit for faces that read best at 0. */
  tracking?: string;
  features?: string;
}

// Tracking values follow standard UI-typography practice: wide geometrics and
// condensed display faces are nudged toward even rhythm, tight modern grotesks
// get slight negative tracking (the look their designers intend), monospaces
// get a slashed zero so digits/zeros never read as the letter O. Serifs and
// faces designed at 0 (Roboto, Open Sans) are left untouched.
const GOOGLE_EXPERIMENT_FONTS: GoogleFontDef[] = [
  { family: 'Roboto', note: 'sans · neutral grotesk' },
  { family: 'Open Sans', note: 'sans · humanist' },
  { family: 'Montserrat', note: 'geometric · urban', tracking: '-0.01em' },
  { family: 'Roboto Condensed', note: 'condensed', tracking: '0.01em' },
  { family: 'Roboto Mono', note: 'monospace', features: '"zero" 1' },
  { family: 'Manrope', note: 'modern grotesk · tight', tracking: '-0.012em' },
  { family: 'Fira Sans', note: 'sans · technical' },
  { family: 'Nunito', note: 'rounded · friendly', tracking: '-0.005em' },
  { family: 'Rubik', note: 'sans · rounded corners' },
  { family: 'Oswald', note: 'display · condensed', tracking: '0.02em' },
  { family: 'Merriweather', note: 'serif · readable' },
  { family: 'Lora', note: 'serif · contemporary' },
  // ── Futuristic / modern sans (all OFL, all Cyrillic-capable). Geist & Geist
  // Mono originate from Vercel; Golos Text from ParaType — all mirrored on
  // Google Fonts, so they load through the same lazy-loader. ──
  { family: 'Exo 2', note: 'techno · futuristic', tracking: '-0.005em' },
  { family: 'Jura', note: 'geometric · futuristic', tracking: '0.01em' },
  { family: 'Geist', note: 'minimalist modern (Vercel)', tracking: '-0.012em' },
  { family: 'Geist Mono', note: 'modern mono (Vercel)', features: '"zero" 1' },
  { family: 'Unbounded', note: 'geometric · display', tracking: '-0.01em' },
  { family: 'Onest', note: 'clean modern', tracking: '-0.008em' },
  { family: 'Golos Text', note: 'modern · Russian-native', tracking: '-0.005em' },
  { family: 'Geologica', note: 'technical · variable', tracking: '-0.006em' },
  { family: 'Commissioner', note: 'flared grotesk', tracking: '-0.003em' },
  { family: 'Hanken Grotesk', note: 'modern grotesk', tracking: '-0.011em' },
];

function fontSlug(family: string): string {
  return family.toLowerCase().replace(/\s+/g, '-');
}

const DYNAMIC_FONTS: FontOption[] = GOOGLE_EXPERIMENT_FONTS.map((def) => ({
  key: fontSlug(def.family),
  label: def.family,
  caption: `Google Fonts · ${def.note}`,
  stack: `"${def.family}", system-ui, sans-serif`,
  google: def.family,
  tracking: def.tracking,
  features: def.features,
}));

export const FONTS: FontOption[] = [...BUNDLED_FONTS, ...DYNAMIC_FONTS];

/**
 * Inject a Google Fonts stylesheet for `family` once. Requests the four weights
 * the UI actually uses — 400 (body), 500 (medium), 600 (semibold), 700 (bold) —
 * so labels/headings render in real cut weights instead of faux-synthesized
 * ones (a real legibility hit otherwise). Every curated face covers 400–700.
 * No-op if already present.
 */
function ensureGoogleFont(family: string): void {
  const id = `gf-${fontSlug(family)}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export type FontKey = (typeof FONTS)[number]['key'];

const FONT_KEYS = FONTS.map((f) => f.key);

interface FontContextType {
  font: FontKey;
  fonts: FontOption[];
  setFont: (key: FontKey) => void;
  cycleFont: () => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

function isFontKey(value: string | null): value is FontKey {
  return value !== null && FONT_KEYS.includes(value);
}

export function FontProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<FontKey>(() => {
    if (typeof window === 'undefined') return 'theme';
    const stored = localStorage.getItem('ha-font-pref');
    return isFontKey(stored) ? stored : 'theme';
  });

  // Brief on-screen confirmation when cycled via keyboard.
  const [flash, setFlash] = useState(false);

  // Apply the selected font — plus its per-face typographic tuning — to the
  // live document. Tracking/features are written to <body> so they cascade to
  // all text that doesn't set its own; "Theme default" clears every override.
  useEffect(() => {
    const body = document.body.style;
    const def = FONTS.find((f) => f.key === font);
    if (!def || def.stack === null) {
      body.removeProperty('--ha-font-family-base');
      body.removeProperty('letter-spacing');
      body.removeProperty('font-feature-settings');
      return;
    }
    if (def.google) ensureGoogleFont(def.google);
    body.setProperty('--ha-font-family-base', def.stack);
    if (def.tracking) body.setProperty('letter-spacing', def.tracking);
    else body.removeProperty('letter-spacing');
    if (def.features) body.setProperty('font-feature-settings', def.features);
    else body.removeProperty('font-feature-settings');
  }, [font]);

  const setFont = useCallback((key: FontKey) => {
    setFontState(key);
    localStorage.setItem('ha-font-pref', key);
  }, []);

  const cycleFont = useCallback(() => {
    setFontState((current) => {
      const idx = FONT_KEYS.indexOf(current);
      const next = FONT_KEYS[(idx + 1) % FONT_KEYS.length];
      localStorage.setItem('ha-font-pref', next);
      return next;
    });
    setFlash(true);
  }, []);

  // Auto-dismiss the flash pill.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1300);
    return () => clearTimeout(t);
  }, [flash, font]);

  // Quick live toggle: Cmd/Ctrl + Shift + F cycles the typeface.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        cycleFont();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleFont]);

  const activeLabel = FONTS.find((f) => f.key === font)?.label ?? font;

  return (
    <FontContext.Provider value={{ font, fonts: FONTS, setFont, cycleFont }}>
      {children}
      {flash && (
        <div
          aria-hidden
          className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-ha-pill border border-surface-lower bg-surface-default/95 px-ha-4 py-ha-2 text-sm font-semibold text-text-primary shadow-lg"
        >
          Aa · {activeLabel}
        </div>
      )}
    </FontContext.Provider>
  );
}

export function useFont() {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error('useFont must be used within a FontProvider');
  }
  return context;
}
