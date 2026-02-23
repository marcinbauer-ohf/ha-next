'use client';

import { useState, useEffect, useRef, useTransition, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav, TopBar } from '@/components/layout';
import { Icon } from '@/components/ui/Icon';
import { mdiArrowLeft } from '@mdi/js';
import { ProfileContent } from '@/components/profile';
import { useHomeAssistant, useImmersiveMode } from '@/hooks';
import { useSearchContext, useHeader } from '@/contexts';
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
  const { immersiveMode, immersivePhase, toggleImmersiveMode } = useImmersiveMode();
  const { toggleSearch } = useSearchContext();
  const { setHeader } = useHeader();
  const router = useRouter();
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const profileNavigationTargetRef = useRef<string | null>(null);
  const pendingProfileOpenAfterImmersiveRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [showPreloader, setShowPreloader] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavAutoHidden, setMobileNavAutoHidden] = useState(false);
  const [profileNavigationPending, startProfileNavigation] = useTransition();
  const wasConnecting = useRef(false);

  // When navigating from profile via sidebar, keep profile visible as a "curtain"
  // until the route transition has finished to avoid flashing stale content.
  useEffect(() => {
    if (!profileOpen) {
      prevPathnameRef.current = pathname;
      return;
    }

    const pathnameChanged = pathname !== prevPathnameRef.current;
    const profileNavigationTarget = profileNavigationTargetRef.current;

    if (profileNavigationTarget) {
      if (pathname === profileNavigationTarget && !profileNavigationPending) {
        queueMicrotask(() => {
          pendingProfileOpenAfterImmersiveRef.current = false;
          setProfileOpen(false);
        });
        profileNavigationTargetRef.current = null;
      }
    } else if (pathnameChanged) {
      queueMicrotask(() => {
        pendingProfileOpenAfterImmersiveRef.current = false;
        setProfileOpen(false);
      });
    }

    prevPathnameRef.current = pathname;
  }, [pathname, profileOpen, profileNavigationPending]);

  // If profile is requested while immersive is on, wait for the collapse
  // transition to complete before opening profile for a smoother handoff.
  useEffect(() => {
    if (!pendingProfileOpenAfterImmersiveRef.current) return;
    if (immersiveMode || immersivePhase !== 'normal') return;

    queueMicrotask(() => {
      setProfileOpen(true);
      pendingProfileOpenAfterImmersiveRef.current = false;
    });
  }, [immersiveMode, immersivePhase]);

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

  // Drive the TopBar header when profile panel is open.
  // Children are fully unmounted while profile is open so their setHeader
  // effects won't compete; when they remount they restore their own title.
  useEffect(() => {
    if (profileOpen) {
      setHeader({
        title: 'Profile',
        subtitle: ' ', // non-empty so the back arrow renders, but visually blank
        onBack: () => {
          profileNavigationTargetRef.current = null;
          pendingProfileOpenAfterImmersiveRef.current = false;
          setProfileOpen(false);
        },
      });
    }
    // No reset on close — the remounting page sets its own header
  }, [profileOpen, setHeader]);

  if (!hydrated) {
    return null;
  }

  if (!configured) {
    return <SetupScreen onSave={saveCredentials} error={error} connecting={connecting} />;
  }

  const hideDesktopChrome = immersivePhase !== 'normal' && !profileOpen;
  const hideMobileTopBar = mobileNavAutoHidden;

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
        <div className={`hidden lg:block lg:row-span-2 relative z-10 transition-opacity duration-300 ease-out ${
          hideDesktopChrome ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <Sidebar
            onNavigate={profileOpen ? (href: string) => {
              if (href === pathname) {
                profileNavigationTargetRef.current = null;
                pendingProfileOpenAfterImmersiveRef.current = false;
                setProfileOpen(false);
                return;
              }
              profileNavigationTargetRef.current = href;
              startProfileNavigation(() => {
                router.push(href);
              });
            } : undefined}
          />
        </div>

        {/* TopBar - Desktop & Mobile persistent header */}
        <div
          data-component="MobileTopBar"
          className={`lg:bg-transparent px-edge lg:pr-edge overflow-hidden flex-shrink-0 relative z-10 origin-top transition-[max-height,opacity] duration-200 lg:duration-300 ease-out ${
            hideMobileTopBar
              ? 'max-h-0 opacity-0 pointer-events-none lg:max-h-16 lg:opacity-100 lg:pointer-events-auto'
              : 'max-h-16 opacity-100'
          } ${
            hideDesktopChrome ? 'lg:opacity-0 lg:pointer-events-none' : 'lg:opacity-100 lg:pointer-events-auto'
          }`}
        >
          <div className="h-16">
            <TopBar />
          </div>
        </div>

        {/* Content area — profile replaces dashboard when open */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-0">
          {/* Dashboard children — unmounted while profile is open so their
              setHeader effects don't compete with the Profile title */}
          {!profileOpen && (
            <div className="h-full">
              {children}
            </div>
          )}

          {/* Profile view — same container/padding as other dashboard pages */}
          {profileOpen && (
            <div className="h-full flex flex-col px-edge pt-1 pb-0 pr-edge">
              <div className="flex-1 min-h-0 bg-surface-lower rounded-ha-3xl overflow-hidden relative">
                {/* Back arrow in left padding - full height hit area, desktop only */}
                <button
                  onClick={() => {
                    profileNavigationTargetRef.current = null;
                    pendingProfileOpenAfterImmersiveRef.current = false;
                    setProfileOpen(false);
                  }}
                  className="hidden lg:flex group absolute inset-y-0 left-0 w-14 z-10 items-center justify-center transition-all duration-300"
                >
                  <div className="absolute inset-0 rounded-l-ha-3xl bg-gradient-to-r from-transparent to-transparent group-hover:from-ha-blue/[0.06] group-hover:to-transparent transition-all duration-500 delay-0 group-hover:delay-150" />
                  <Icon
                    path={mdiArrowLeft}
                    size={16}
                    className="relative opacity-15 group-hover:opacity-100 group-hover:text-ha-blue group-hover:-translate-x-0.5 transition-all duration-500 delay-0 group-hover:delay-150 text-text-primary"
                  />
                </button>

                <div className="h-full overflow-y-auto scrollbar-hide">
                  <div className="px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5">
                    <div className="max-w-[860px] mx-auto lg:px-ha-8 w-full">
                      <ProfileContent />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status bar row - Desktop only */}
        <StatusBar
          connectionStatus={connectionStatus}
          profileOpen={profileOpen}
          onProfileToggle={() => {
            profileNavigationTargetRef.current = null;
            if (profileOpen) {
              pendingProfileOpenAfterImmersiveRef.current = false;
              setProfileOpen(false);
              return;
            }
            if (immersiveMode) {
              pendingProfileOpenAfterImmersiveRef.current = true;
              toggleImmersiveMode();
              return;
            }
            pendingProfileOpenAfterImmersiveRef.current = false;
            setProfileOpen(true);
          }}
        />
      </div>

      {/* Mobile navigation - hidden during preloader */}
      {!showPreloader && (
        <MobileNav
          connectionStatus={connectionStatus}
          onNavAutoHiddenChange={setMobileNavAutoHidden}
        />
      )}

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
