'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav, TopBar } from '@/components/layout';
import { useHomeAssistant, useImmersiveMode } from '@/hooks';
import { useSearchContext } from '@/contexts';
import { ConnectionToast } from '@/components/ui/ConnectionToast';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { AssistantOverlay } from '@/components/ui/AssistantOverlay';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { Preloader } from '@/components/ui/Preloader';
import { AnimatePresence } from 'framer-motion';
import type { ConnectionStatus } from '@/components/ui/ConnectionToast';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { connecting, connected, error, configured, hydrated, saveCredentials } = useHomeAssistant();
  const { immersivePhase } = useImmersiveMode();
  const { toggleSearch } = useSearchContext();
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [showPreloader, setShowPreloader] = useState(true);
  const wasConnecting = useRef(false);

  // Track connection state changes and manage status toast visibility
  useEffect(() => {
    if (connecting) {
      setConnectionStatus('connecting');
      wasConnecting.current = true;
    } else if (error) {
      setConnectionStatus('error');
      wasConnecting.current = false;
    } else if (connected && wasConnecting.current) {
      setConnectionStatus('connected');
      wasConnecting.current = false;
      
      // Auto-hide "connected" status after 3 seconds
      const timer = setTimeout(() => {
        setConnectionStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!connecting && !error && !connected) {
      setConnectionStatus(null);
      wasConnecting.current = false;
    }
  }, [connecting, connected, error]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault();
            toggleSearch();
            break;
          case 'h':
            e.preventDefault();
            router.push('/');
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch, router]);

  // Reset preloader when user logs out so it shows again on next login
  useEffect(() => {
    if (!configured && hydrated) {
      setShowPreloader(true);
    }
  }, [configured, hydrated]);

  if (!hydrated) {
    return null;
  }

  if (!configured) {
    return <SetupScreen onSave={saveCredentials} error={error} connecting={connecting} />;
  }

  return (
    <div className="min-h-screen bg-surface-default" data-component="AppShell">
      {/* Preloader overlay — shown after login, fades out to reveal dashboard */}
      <AnimatePresence>
        {showPreloader && (
          <Preloader onFinish={() => setShowPreloader(false)} />
        )}
      </AnimatePresence>

      {/* Main app shell — fades in as preloader exits */}
      <div
        className={`h-screen flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[auto_1fr] lg:pt-edge lg:pl-edge transition-opacity duration-700 ${
          showPreloader ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Sidebar - Desktop only, spans top bar and content rows */}
        <div className={`hidden lg:block lg:row-span-2 transition-opacity duration-300 ease-out ${
          immersivePhase !== 'normal' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <Sidebar />
        </div>

        {/* TopBar - Desktop & Mobile persistent header */}
        <div className={`px-edge lg:pr-edge overflow-hidden flex-shrink-0 h-16 transition-opacity duration-300 ease-out ${
          immersivePhase !== 'normal' ? 'lg:opacity-0 lg:pointer-events-none' : 'opacity-100'
        }`}>
          <TopBar />
        </div>

        {/* Children content area */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-0">
          {children}
        </div>

        {/* Status bar row - Desktop only */}
        <StatusBar connectionStatus={connectionStatus} />
      </div>

      {/* Mobile navigation - hidden during preloader */}
      {!showPreloader && <MobileNav connectionStatus={connectionStatus} />}

      {/* Install app banner - mobile browsers only */}
      <InstallBanner />

      {/* Connection status toast */}
      <ConnectionToast status={connectionStatus} />

      {/* Global search overlay */}
      <SearchOverlay />

      {/* Assistant overlay */}
      <AssistantOverlay />
    </div>
  );
}
