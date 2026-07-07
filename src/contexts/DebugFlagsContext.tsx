'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Prototype-only debug flags shared between the settings "Prototype & Debug"
 * page and the command palette so toggling from either stays in sync.
 *
 * Persisted to localStorage like the other ha-flag-* keys. Both default off.
 */

const LS_DEBUG_BADGES_KEY = 'ha-flag-debug-badges';
// Device-card layout experiment. Unlike the two flags above this defaults ON
// (only an explicit '0' opts out) — the new "hero" layout is the current design,
// the toggle exists so the previous layout can be compared.
const LS_HERO_CARD_LAYOUT_KEY = 'ha-flag-hero-card-layout';

interface DebugFlagsContextValue {
  debugBadgesEnabled: boolean;
  setDebugBadgesEnabled: (value: boolean) => void;
  toggleDebugBadges: () => void;
  /** true = new hero layout (name top-left, image right, toggle bottom-left); false = previous layout. */
  heroCardLayoutEnabled: boolean;
  setHeroCardLayoutEnabled: (value: boolean) => void;
  toggleHeroCardLayout: () => void;
}

const DebugFlagsContext = createContext<DebugFlagsContextValue | undefined>(undefined);

export function DebugFlagsProvider({ children }: { children: ReactNode }) {
  const [debugBadgesEnabled, setDebugBadgesEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_DEBUG_BADGES_KEY) === '1';
  });

  // Opt-out flag: default on unless localStorage explicitly holds '0'.
  const [heroCardLayoutEnabled, setHeroCardLayoutEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LS_HERO_CARD_LAYOUT_KEY) !== '0';
  });

  const setDebugBadgesEnabled = useCallback((value: boolean) => {
    setDebugBadgesEnabledState(value);
    localStorage.setItem(LS_DEBUG_BADGES_KEY, value ? '1' : '0');
  }, []);

  const toggleDebugBadges = useCallback(() => {
    setDebugBadgesEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_DEBUG_BADGES_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const setHeroCardLayoutEnabled = useCallback((value: boolean) => {
    setHeroCardLayoutEnabledState(value);
    localStorage.setItem(LS_HERO_CARD_LAYOUT_KEY, value ? '1' : '0');
  }, []);

  const toggleHeroCardLayout = useCallback(() => {
    setHeroCardLayoutEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_HERO_CARD_LAYOUT_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <DebugFlagsContext.Provider
      value={{
        debugBadgesEnabled,
        setDebugBadgesEnabled,
        toggleDebugBadges,
        heroCardLayoutEnabled,
        setHeroCardLayoutEnabled,
        toggleHeroCardLayout,
      }}
    >
      {children}
    </DebugFlagsContext.Provider>
  );
}

export function useDebugFlags() {
  const context = useContext(DebugFlagsContext);
  if (context === undefined) {
    throw new Error('useDebugFlags must be used within a DebugFlagsProvider');
  }
  return context;
}
