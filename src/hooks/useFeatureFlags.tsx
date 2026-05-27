'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const LS_DESKTOP_SPLIT_VIEW_KEY = 'ha-flag-desktop-split-view';

interface FeatureFlagsContextValue {
  desktopSplitViewEnabled: boolean;
  setDesktopSplitViewEnabled: (value: boolean) => void;
  toggleDesktopSplitView: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [desktopSplitViewEnabled, setDesktopSplitViewEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_DESKTOP_SPLIT_VIEW_KEY) === '1';
  });

  const setDesktopSplitViewEnabled = useCallback((value: boolean) => {
    setDesktopSplitViewEnabledState(value);
    localStorage.setItem(LS_DESKTOP_SPLIT_VIEW_KEY, value ? '1' : '0');
  }, []);

  const toggleDesktopSplitView = useCallback(() => {
    setDesktopSplitViewEnabled(!desktopSplitViewEnabled);
  }, [desktopSplitViewEnabled, setDesktopSplitViewEnabled]);

  return (
    <FeatureFlagsContext.Provider
      value={{
        desktopSplitViewEnabled,
        setDesktopSplitViewEnabled,
        toggleDesktopSplitView,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}
