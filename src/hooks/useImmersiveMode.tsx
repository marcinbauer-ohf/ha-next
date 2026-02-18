'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type ImmersivePhase = 'normal' | 'preparing' | 'expanded' | 'collapsing';

interface ImmersiveModeContextType {
  immersiveMode: boolean;
  setImmersiveMode: (value: boolean) => void;
  toggleImmersiveMode: (e?: React.MouseEvent | KeyboardEvent) => void;
  immersivePhase: ImmersivePhase;
}

const ImmersiveModeContext = createContext<ImmersiveModeContextType | null>(null);

export function ImmersiveModeProvider({ children }: { children: ReactNode }) {
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Animation phases:
  // normal → preparing (fixed + compensating padding, no visual change)
  // preparing → expanded (padding animates to edge values, dashboard fills area)
  // expanded → collapsing (padding animates back to compensating)
  // collapsing → normal (back to grid flow, chrome fades in)
  const [immersivePhase, setImmersivePhase] = useState<ImmersivePhase>('normal');

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let id1: number;
    let timeoutId: NodeJS.Timeout;

    if (!isDesktop) {
      return;
    }

    if (immersiveMode) {
      // Start preparing immediately
      id1 = requestAnimationFrame(() => {
        setImmersivePhase('preparing');
        // Add a small delay to ensure the browser paints the preparing state
        // before transitioning to expanded. rAF nesting sometimes fails on clicks.
        timeoutId = setTimeout(() => {
          setImmersivePhase('expanded');
        }, 50);
      });
    } else {
      // Allow render cycle to complete before starting collapse animation
      id1 = requestAnimationFrame(() => {
        setImmersivePhase(prev =>
          prev === 'expanded' || prev === 'preparing' ? 'collapsing' : prev
        );
      });
      
      timeoutId = setTimeout(() => {
        setImmersivePhase('normal');
      }, 300);
    }

    return () => {
      if (id1) cancelAnimationFrame(id1);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [immersiveMode, isDesktop]);

  const toggleImmersiveMode = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) {
        e.preventDefault();
        e.stopPropagation();
    }
    setImmersiveMode(prev => !prev);
  }, []);

  const effectiveImmersivePhase: ImmersivePhase = isDesktop ? immersivePhase : 'normal';

  return (
    <ImmersiveModeContext.Provider value={{ immersiveMode, setImmersiveMode, toggleImmersiveMode, immersivePhase: effectiveImmersivePhase }}>
      {children}
    </ImmersiveModeContext.Provider>
  );
}

export function useImmersiveMode() {
  const context = useContext(ImmersiveModeContext);
  if (!context) {
    throw new Error('useImmersiveMode must be used within an ImmersiveModeProvider');
  }
  return context;
}
