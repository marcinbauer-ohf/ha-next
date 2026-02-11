'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Theme = 'default' | 'glass';
export type ColorMode = 'light' | 'dark';
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('default');
  const [mode, setModeState] = useState<ColorMode>('light');
  const [background, setBackgroundState] = useState<Background>('gradient');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Initialize from localStorage or system preference
  useEffect(() => {
    // Theme (Default / Glass)
    const storedTheme = localStorage.getItem('ha-theme-pref') as Theme | null;
    if (storedTheme) {
      setThemeState(storedTheme);
      document.documentElement.setAttribute('data-theme', storedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'default');
    }

    // Mode (Light / Dark)
    const storedMode = localStorage.getItem('ha-mode-pref') as ColorMode | null;
    if (storedMode) {
      setModeState(storedMode);
      document.documentElement.setAttribute('data-mode', storedMode);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setModeState('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
    } else {
      document.documentElement.setAttribute('data-mode', 'light');
    }

    // Background (Gradient / Image)
    const storedBg = localStorage.getItem('ha-bg-pref') as Background | null;
    if (storedBg) {
      setBackgroundState(storedBg);
      document.documentElement.setAttribute('data-background', storedBg);
    } else {
      document.documentElement.setAttribute('data-background', 'gradient');
    }
  }, []);

  const triggerTransition = () => {
    setIsTransitioning(true);
    document.documentElement.setAttribute('data-theme-transition', 'true');
    setTimeout(() => {
      setIsTransitioning(false);
      document.documentElement.removeAttribute('data-theme-transition');
    }, 300);
  };

  const setTheme = useCallback((newTheme: Theme) => {
    triggerTransition();
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ha-theme-pref', newTheme);
  }, []);

  const setMode = useCallback((newMode: ColorMode) => {
    triggerTransition();
    setModeState(newMode);
    document.documentElement.setAttribute('data-mode', newMode);
    localStorage.setItem('ha-mode-pref', newMode);
  }, []);

  const setBackground = useCallback((newBg: Background) => {
    triggerTransition();
    setBackgroundState(newBg);
    document.documentElement.setAttribute('data-background', newBg);
    localStorage.setItem('ha-bg-pref', newBg);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'default' ? 'glass' : 'default');
  }, [theme, setTheme]);

  const toggleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light');
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
