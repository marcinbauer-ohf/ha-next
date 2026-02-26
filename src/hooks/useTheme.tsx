'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export const THEMES = ['default', 'glass', 'teenage', 'cyberpunk', 'material', 'eink', 'fallout'] as const;
export type Theme = (typeof THEMES)[number];
export type ColorMode = 'light' | 'dark' | 'system';
export type Background = 'gradient' | 'image' | 'solid' | 'none';

interface ThemeContextType {
  theme: Theme;
  mode: ColorMode;
  background: Background;
  toggleTheme: () => void;
  toggleMode: () => void;
  toggleBackground: () => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: ColorMode) => void;
  setBackground: (bg: Background) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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
        toggleMode();
      }
      // Cmd/Ctrl + Shift + T to toggle THEME (optional, but helpful)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={{ theme, mode, background, toggleTheme, toggleMode, toggleBackground, setTheme, setMode, setBackground }}>
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
