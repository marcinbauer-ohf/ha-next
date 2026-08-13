'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  mdiWhiteBalanceSunny,
  mdiWeatherNight,
  mdiThemeLightDark,
  mdiPalette,
} from '@mdi/js';
import { flashHud } from '@/lib/hudFlashBus';

// Note: the CSS gates the shared Material rules on [data-theme^="material"] and
// the shared default rules on [data-theme^="default"], so any future variant of
// either must keep the `material` / `default` prefix.
export const THEMES = ['default', 'default-tinted', 'glass', 'teenage', 'cyberpunk', 'material', 'material-ha', 'eink', 'fallout'] as const;
export type Theme = (typeof THEMES)[number];
export type ColorMode = 'light' | 'dark' | 'system';
export type Background = 'gradient' | 'image' | 'solid' | 'none' | 'pulse';

/**
 * Accessibility preferences — surfaced by the top bar's accessibility button
 * (AccessibilityPanel). Each one is applied as an attribute on <html> that
 * globals.css keys off; reduceMotion additionally puts framer-motion into its
 * reduced-motion mode for the whole tree (see MotionConfig below).
 */
export interface A11yPrefs {
  /** Off by default, but the OS setting still wins on its own via CSS media queries. */
  reduceMotion: boolean;
  /** Drops backdrop blur — cheaper to read, and cheaper to render. */
  reduceTransparency: boolean;
  biggerText: boolean;
}

export const A11Y_DEFAULTS: A11yPrefs = {
  reduceMotion: false,
  reduceTransparency: false,
  biggerText: false,
};

const LS_A11Y = 'ha-a11y-prefs';

interface ThemeContextType {
  theme: Theme;
  mode: ColorMode;
  background: Background;
  /** Superellipse ("squircle") corner smoothing on every radiused element. */
  squircle: boolean;
  toggleTheme: () => void;
  toggleMode: () => void;
  toggleBackground: () => void;
  toggleSquircle: () => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: ColorMode) => void;
  setBackground: (bg: Background) => void;
  setSquircle: (on: boolean) => void;
  a11y: A11yPrefs;
  toggleA11y: (key: keyof A11yPrefs) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Display labels + icons for the HUD flash fired on the appearance shortcuts.
const MODE_LABEL: Record<ColorMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const MODE_ICON: Record<ColorMode, string> = {
  light: mdiWhiteBalanceSunny,
  dark: mdiWeatherNight,
  system: mdiThemeLightDark,
};
const THEME_LABEL: Record<Theme, string> = {
  default: 'Default',
  'default-tinted': 'Default Tinted',
  glass: 'Glass',
  teenage: 'Teenage Engineering',
  cyberpunk: 'Cyberpunk',
  material: 'Material',
  'material-ha': 'HA Material',
  eink: 'E-ink',
  fallout: 'Fallout',
};

function isTheme(value: string | null): value is Theme {
  return value !== null && THEMES.includes(value as Theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'default';
    const stored = localStorage.getItem('ha-theme-pref');
    return isTheme(stored) ? stored : 'default';
  });

  const [mode, setModeState] = useState<ColorMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('ha-mode-pref') as ColorMode | null;
    return stored || 'system';
  });

  const [background, setBackgroundState] = useState<Background>(() => {
    if (typeof window === 'undefined') return 'gradient';
    const stored = localStorage.getItem('ha-bg-pref') as Background | null;
    return stored || 'gradient';
  });

  // Squircle corners are on by default; only an explicit '0' disables them.
  const [squircle, setSquircleState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ha-squircle-pref') !== '0';
  });

  const [a11y, setA11y] = useState<A11yPrefs>(() => {
    if (typeof window === 'undefined') return A11Y_DEFAULTS;
    try {
      return { ...A11Y_DEFAULTS, ...JSON.parse(localStorage.getItem(LS_A11Y) ?? '{}') };
    } catch {
      return A11Y_DEFAULTS;
    }
  });

  const toggleA11y = useCallback((key: keyof A11yPrefs) => {
    setA11y((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(LS_A11Y, JSON.stringify(next));
      } catch {
        /* private mode — the pref just won't survive a reload */
      }
      return next;
    });
  }, []);

  // Each pref is one attribute on <html>; globals.css does the rest. Bigger text
  // scales the root font size, so every rem-based type size follows.
  // ponytail: fixed-px heights (min-h-[52px] etc.) don't grow with it — if text
  // starts clipping in those, convert the offenders to rem rather than adding a
  // second scale knob here.
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-reduce-motion', a11y.reduceMotion);
    root.toggleAttribute('data-reduce-transparency', a11y.reduceTransparency);
    root.style.fontSize = a11y.biggerText ? '18px' : '';
  }, [a11y]);

  function triggerTransition() {
    document.documentElement.setAttribute('data-theme-transition', 'true');
    setTimeout(() => {
      document.documentElement.removeAttribute('data-theme-transition');
    }, 300);
  }

  // Sync state to DOM attributes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-background', background);
    
    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateSystemMode = (e: MediaQueryList | MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-mode', e.matches ? 'dark' : 'light');
      };
      
      updateSystemMode(mediaQuery);
      
      const handleChange = (e: MediaQueryListEvent) => {
        triggerTransition();
        updateSystemMode(e);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      document.documentElement.setAttribute('data-mode', mode);
    }
  }, [theme, mode, background]);

  // Squircle toggle → data-squircle attribute; CSS keys corner-shape off it.
  useEffect(() => {
    document.documentElement.setAttribute('data-squircle', squircle ? 'on' : 'off');
  }, [squircle]);

  const setTheme = useCallback((newTheme: Theme) => {
    triggerTransition();
    setThemeState(newTheme);
    localStorage.setItem('ha-theme-pref', newTheme);
  }, []);

  const setMode = useCallback((newMode: ColorMode) => {
    triggerTransition();
    setModeState(newMode);
    localStorage.setItem('ha-mode-pref', newMode);
  }, []);

  const setBackground = useCallback((newBg: Background) => {
    triggerTransition();
    setBackgroundState(newBg);
    localStorage.setItem('ha-bg-pref', newBg);
  }, []);

  const setSquircle = useCallback((on: boolean) => {
    setSquircleState(on);
    localStorage.setItem('ha-squircle-pref', on ? '1' : '0');
  }, []);

  const toggleSquircle = useCallback(() => {
    setSquircleState((prev) => {
      const next = !prev;
      localStorage.setItem('ha-squircle-pref', next ? '1' : '0');
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const currentIndex = THEMES.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    setTheme(THEMES[nextIndex]);
  }, [theme, setTheme]);

  const toggleMode = useCallback(() => {
    const modes: ColorMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  }, [mode, setMode]);

  const toggleBackground = useCallback(() => {
    const order: Background[] = ['gradient', 'image', 'none'];
    const currentIndex = order.indexOf(background);
    const nextIndex = (currentIndex + 1) % order.length;
    setBackground(order[nextIndex]);
  }, [background, setBackground]);

  // Keyboard shortcut: Cmd/Ctrl + Shift + D to toggle MODE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const modes: ColorMode[] = ['light', 'dark', 'system'];
        const next = modes[(modes.indexOf(mode) + 1) % modes.length];
        toggleMode();
        flashHud({ shortcutId: 'global.color-mode', value: MODE_LABEL[next], icon: MODE_ICON[next] });
      }
      // Cmd/Ctrl + Shift + Y cycles the THEME; add Alt/Option to cycle back.
      // Not T — browsers claim Cmd/Ctrl+Shift+T for "reopen closed tab" and
      // never surrender it. Matched on e.code too: holding Option can rewrite
      // e.key to a dead-key character on some macOS layouts.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'y' || e.code === 'KeyY')
      ) {
        e.preventDefault();
        const step = e.altKey ? -1 : 1;
        const next = THEMES[(THEMES.indexOf(theme) + step + THEMES.length) % THEMES.length];
        setTheme(next);
        flashHud({
          shortcutId: e.altKey ? 'global.theme-prev' : 'global.theme',
          value: THEME_LABEL[next],
          icon: mdiPalette,
        });
      }
      // Cmd/Ctrl + Shift + U to toggle SQUIRCLE corners. No HUD flash here —
      // squircle already fires its own corner toast (in AppShell) on any change.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        toggleSquircle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMode, toggleSquircle, setTheme, mode, theme]);

  return (
    <ThemeContext.Provider value={{ theme, mode, background, squircle, toggleTheme, toggleMode, toggleBackground, toggleSquircle, setTheme, setMode, setBackground, setSquircle, a11y, toggleA11y }}>
      {/* 'user' defers to the OS setting, so the app-level toggle only ever adds
          reduced motion on top of it — it never overrides someone's OS choice. */}
      <MotionConfig reducedMotion={a11y.reduceMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
