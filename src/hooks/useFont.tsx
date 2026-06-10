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
}

export const FONTS: FontOption[] = [
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
  },
  {
    key: 'atkinson',
    label: 'Atkinson Hyperlegible',
    caption: 'OFL · low-vision accessibility champion',
    stack: 'var(--font-atkinson), "Atkinson Hyperlegible", "Hyperlegible Sans", system-ui, sans-serif',
  },
];

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

  // Apply the selected font to the live document.
  useEffect(() => {
    const def = FONTS.find((f) => f.key === font);
    if (!def || def.stack === null) {
      document.body.style.removeProperty('--ha-font-family-base');
    } else {
      document.body.style.setProperty('--ha-font-family-base', def.stack);
    }
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
          className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-ha-pill border border-surface-lower bg-surface-default/95 px-ha-4 py-ha-2 text-sm font-semibold text-text-primary shadow-lg backdrop-blur"
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
