'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Prototype-only debug flags shared between the settings "Prototype & Debug"
 * page and the command palette so toggling from either stays in sync.
 *
 * Persisted to localStorage like the other ha-flag-* keys. Both default off.
 */

const LS_DEBUG_BADGES_KEY = 'ha-flag-debug-badges';
const LS_MOCK_LATENCY_KEY = 'ha-flag-mock-latency';

interface DebugFlagsContextValue {
  debugBadgesEnabled: boolean;
  setDebugBadgesEnabled: (value: boolean) => void;
  toggleDebugBadges: () => void;
  mockLatencyEnabled: boolean;
  setMockLatencyEnabled: (value: boolean) => void;
  toggleMockLatency: () => void;
}

const DebugFlagsContext = createContext<DebugFlagsContextValue | undefined>(undefined);

export function DebugFlagsProvider({ children }: { children: ReactNode }) {
  const [debugBadgesEnabled, setDebugBadgesEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_DEBUG_BADGES_KEY) === '1';
  });

  const [mockLatencyEnabled, setMockLatencyEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_MOCK_LATENCY_KEY) === '1';
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

  const setMockLatencyEnabled = useCallback((value: boolean) => {
    setMockLatencyEnabledState(value);
    localStorage.setItem(LS_MOCK_LATENCY_KEY, value ? '1' : '0');
  }, []);

  const toggleMockLatency = useCallback(() => {
    setMockLatencyEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_MOCK_LATENCY_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <DebugFlagsContext.Provider
      value={{
        debugBadgesEnabled,
        setDebugBadgesEnabled,
        toggleDebugBadges,
        mockLatencyEnabled,
        setMockLatencyEnabled,
        toggleMockLatency,
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
