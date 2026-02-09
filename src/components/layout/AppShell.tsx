'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav } from '@/components/layout';
import { useHomeAssistant, useImmersiveMode } from '@/hooks';
import { useSearchContext } from '@/contexts';
import { ConnectionToast } from '@/components/ui/ConnectionToast';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { AssistantOverlay } from '@/components/ui/AssistantOverlay';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { InstallBanner } from '@/components/ui/InstallBanner';
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
  const [wasConnecting, setWasConnecting] = useState(false);

  // Track connection state changes
  useEffect(() => {
    if (connecting) {
      setConnectionStatus('connecting');
      setWasConnecting(true);
    } else if (error) {
      setConnectionStatus('error');
    } else if (connected && wasConnecting) {
      setConnectionStatus('connected');
      setWasConnecting(false);
    } else if (!connecting && !error && !connected) {
      setConnectionStatus(null);
    }
  }, [connecting, connected, error, wasConnecting]);

  // Auto-hide "connected" status after 3 seconds
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const timer = setTimeout(() => {
        setConnectionStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus]);

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

  if (!hydrated) {
    return null;
  }

  if (!configured) {
    return <SetupScreen onSave={saveCredentials} error={error} connecting={connecting} />;
  }

  return (
    <div className="min-h-screen bg-surface-default">
      <div className="h-screen flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[auto_1fr] lg:pt-edge lg:pl-edge">
        {/* Sidebar - Desktop only, spans top bar and content rows */}
        <div className={`hidden lg:block lg:row-span-2 transition-opacity duration-300 ease-out ${
          immersivePhase !== 'normal' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <Sidebar />
        </div>

        {/* Children includes TopBar and content from page */}
        {children}

        {/* Status bar row - Desktop only */}
        <StatusBar connectionStatus={connectionStatus} />
      </div>

      {/* Mobile navigation - Outside grid for proper fixed positioning */}
      <MobileNav connectionStatus={connectionStatus} />

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
