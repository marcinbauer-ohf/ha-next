'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useIdleTimer } from '@/hooks';
import { ScreensaverClock } from '@/components/ui/ScreensaverClock';
import { useOnboardingGate } from '@/lib/onboarding';

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

/**
 * Just the flag, and resilient outside the provider — for surfaces that only
 * need to know the screensaver is up, not to react to it.
 */
export function useScreensaverActive() {
  return useContext(ScreensaverContext)?.isActive ?? false;
}

/**
 * Dismiss an overlay when the screensaver kicks in. Call this inside any
 * modal/surface component (passing its own open state + close handler) so the
 * screensaver clears whatever sits over the main UI. Wiring it into the leaf
 * overlay components covers every usage without touching their parents.
 *
 * Resilient to running outside the provider (tests/storybook) — it just no-ops.
 */
export function useCloseOnScreensaver(open: boolean, onClose: () => void) {
  const isActive = useContext(ScreensaverContext)?.isActive ?? false;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (isActive && open) closeRef.current();
  }, [isActive, open]);
}

interface ScreensaverProviderProps {
  children: ReactNode;
}

export function ScreensaverProvider({ children }: ScreensaverProviderProps) {
  const [isActive, setIsActive] = useState(false);
  // First-run onboarding owns the screen — idling there must not summon the
  // clock. useIdleTimer reads the latest onIdle each render, so the plain
  // closure below always sees the current gate value.
  const onboardingActive = useOnboardingGate();
  // Prototype spinoffs under /dev/ own the whole screen and aren't part of the
  // screensaver's project — idling (or ⌘⇧S) there must not summon the clock.
  const pathname = usePathname();
  const suppressed = onboardingActive || pathname.startsWith('/dev/');

  const { wake } = useIdleTimer({
    timeout: SCREENSAVER_TIMEOUT,
    onIdle: () => {
      if (suppressed) return;
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
        if (suppressed) return;
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
  }, [isActive, dismiss, activate, suppressed]);

  return (
    <ScreensaverContext.Provider value={{ isActive, activate, dismiss }}>
      {children}
      <ScreensaverClock visible={isActive} onDismiss={dismiss} />
    </ScreensaverContext.Provider>
  );
}
