'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  mdiWhiteBalanceSunny,
  mdiWeatherNight,
  mdiThemeLightDark,
  mdiPalette,
} from '@mdi/js';
import { flashHud } from '@/lib/hudFlashBus';

export const THEMES = ['default', 'glass', 'teenage', 'cyberpunk', 'material', 'eink', 'fallout'] as const;
export type Theme = (typeof THEMES)[number];
export type ColorMode = 'light' | 'dark' | 'system';
export type Background = 'gradient' | 'image' | 'solid' | 'none' | 'pulse';

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
  glass: 'Glass',
  teenage: 'Teenage Engineering',
  cyberpunk: 'Cyberpunk',
  material: 'Material',
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
      // Cmd/Ctrl + Shift + T to toggle THEME (optional, but helpful)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
        toggleTheme();
        flashHud({ shortcutId: 'global.theme', value: THEME_LABEL[next], icon: mdiPalette });
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
  }, [toggleMode, toggleTheme, toggleSquircle, mode, theme]);

  return (
    <ThemeContext.Provider value={{ theme, mode, background, squircle, toggleTheme, toggleMode, toggleBackground, toggleSquircle, setTheme, setMode, setBackground, setSquircle }}>
      {children}
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
