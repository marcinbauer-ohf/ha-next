'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useIdleTimer } from '@/hooks';
import { ScreensaverClock } from '@/components/ui/ScreensaverClock';

const SCREENSAVER_TIMEOUT = 60000; // 1 minute of inactivity

interface ScreensaverContextType {
  isActive: boolean;
  activate: () => void;
  dismiss: () => void;
}

const ScreensaverContext = createContext<ScreensaverContextType | null>(null);

export function useScreensaver() {
  const context = useContext(ScreensaverContext);
  if (!context) {
    throw new Error('useScreensaver must be used within a ScreensaverProvider');
  }
  return context;
}

interface ScreensaverProviderProps {
  children: ReactNode;
}

export function ScreensaverProvider({ children }: ScreensaverProviderProps) {
  const [isActive, setIsActive] = useState(false);

  const { wake } = useIdleTimer({
    timeout: SCREENSAVER_TIMEOUT,
    onIdle: () => {
      setIsActive(true);
    },
  });

  const dismiss = useCallback(() => {
    setIsActive(false);
    wake();
  }, [wake]);

  const activate = useCallback(() => {
    setIsActive(true);
  }, []);

  // Keyboard shortcuts (moved from DashboardPage)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + S for screensaver
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isActive) {
          dismiss();
        } else {
          activate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, dismiss, activate]);

  return (
    <ScreensaverContext.Provider value={{ isActive, activate, dismiss }}>
      {children}
      <ScreensaverClock visible={isActive} onDismiss={dismiss} />
    </ScreensaverContext.Provider>
  );
}
