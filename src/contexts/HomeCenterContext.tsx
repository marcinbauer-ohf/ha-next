'use client';

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface HomeCenterContextType {
  homeCenterOpen: boolean;
  openHomeCenter: () => void;
  closeHomeCenter: () => void;
  toggleHomeCenter: () => void;
}

const HomeCenterContext = createContext<HomeCenterContextType | null>(null);

export function HomeCenterProvider({ children }: { children: ReactNode }) {
  const [homeCenterOpen, setHomeCenterOpen] = useState(false);

  const openHomeCenter = useCallback(() => setHomeCenterOpen(true), []);
  const closeHomeCenter = useCallback(() => setHomeCenterOpen(false), []);
  const toggleHomeCenter = useCallback(() => setHomeCenterOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({ homeCenterOpen, openHomeCenter, closeHomeCenter, toggleHomeCenter }),
    [homeCenterOpen, openHomeCenter, closeHomeCenter, toggleHomeCenter],
  );

  return <HomeCenterContext.Provider value={value}>{children}</HomeCenterContext.Provider>;
}

export function useHomeCenterContext() {
  const context = useContext(HomeCenterContext);
  if (!context) {
    throw new Error('useHomeCenterContext must be used within a HomeCenterProvider');
  }
  return context;
}
