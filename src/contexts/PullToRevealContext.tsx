'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export const ENABLE_PULL_TO_REVEAL = false;


interface PullToRevealContextType {
  isRevealed: boolean;
  isPulling: boolean;
  pullDistance: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setPulling: (pulling: boolean) => void;
  setPullDistance: (distance: number) => void;
  setRevealed: (revealed: boolean) => void;
}

const PullToRevealContext = createContext<PullToRevealContextType | null>(null);

export function PullToRevealProvider({ children }: { children: ReactNode }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const open = useCallback(() => {
    setIsPulling(false);
    setIsRevealed(true);
    setPullDistance(0);
  }, []);

  const close = useCallback(() => {
    setIsPulling(false);
    setIsRevealed(false);
    setPullDistance(0);
  }, []);

  const toggle = useCallback(() => {
    setIsPulling(false);
    setIsRevealed(prev => !prev);
    setPullDistance(0);
  }, []);

  return (
    <PullToRevealContext.Provider
      value={{
        isRevealed,
        isPulling,
        pullDistance,
        open,
        close,
        toggle,
        setPulling: setIsPulling,
        setPullDistance,
        setRevealed: setIsRevealed,
      }}
    >
      {children}
    </PullToRevealContext.Provider>
  );
}

export function usePullToRevealContext() {
  const context = useContext(PullToRevealContext);
  if (!context) {
    throw new Error('usePullToRevealContext must be used within a PullToRevealProvider');
  }
  return context;
}
