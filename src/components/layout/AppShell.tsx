'use client';

import { Suspense, useState, useEffect, useRef, useTransition, ReactNode, CSSProperties, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav, TopBar } from '@/components/layout';
import { Icon } from '@/components/ui/Icon';
import { mdiArrowLeft } from '@mdi/js';
import { ProfileContent } from '@/components/profile';
import { useFeatureFlags, useHomeAssistant, useImmersiveMode, useSidebarItems, useDesktopImmersivePageLayout } from '@/hooks';
import { useSearchContext, useHeader, useEditMode } from '@/contexts';
import { ConnectionToast } from '@/components/ui/ConnectionToast';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { AssistantOverlay } from '@/components/ui/AssistantOverlay';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { Preloader } from '@/components/ui/Preloader';
import { AnimatePresence } from 'framer-motion';
import type { ConnectionStatus } from '@/components/ui/ConnectionToast';
import {
  buildSplitViewOptions,
  DesktopSplitHotspots,
  DesktopSplitViewMenu,
  DesktopSplitWorkspace,
  type SplitSide,
  type SplitMenuAnchor,
} from './DesktopSplitWorkspace';

interface AppShellProps {
  children: ReactNode;
}

function isSplitEligiblePath(pathname: string) {
  return pathname === '/' || pathname.startsWith('/dashboard/') || pathname.startsWith('/panel/');
}

export function AppShell({ children }: AppShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-lower">{children}</div>}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const { connecting, connected, error, configured, hydrated, saveCredentials, enableDemoMode } = useHomeAssistant();
  const { desktopSplitViewEnabled } = useFeatureFlags();
  const { immersiveMode, immersivePhase, toggleImmersiveMode } = useImmersiveMode();
  const { contentStyle: immersiveContentStyle, contentTransitionClasses, isImmersiveFixed } = useDesktopImmersivePageLayout();
  const { toggleSearch } = useSearchContext();
  const { title, subtitle, setHeader } = useHeader();
  const { isEditing } = useEditMode();
  const { items: sidebarItems } = useSidebarItems();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathnameRef = useRef(pathname);
  const profileNavigationTargetRef = useRef<string | null>(null);
  const pendingProfileOpenAfterImmersiveRef = useRef(false);
  const splitFlagCollapsePendingRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [showPreloader, setShowPreloader] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavHideProgress, setMobileNavHideProgress] = useState(0);
  const [profileNavigationPending, startProfileNavigation] = useTransition();
  const wasConnecting = useRef(false);
  const isEmbeddedView = searchParams.get('embed') === '1';
  const [desktopWorkspaceStart, setDesktopWorkspaceStart] = useState<{
    pathname: string;
    side: SplitSide;
    route: string;
    nonce: number;
  } | null>(null);
  const [rootSplitMenu, setRootSplitMenu] = useState<{
    side: SplitSide;
    anchor: SplitMenuAnchor | null;
  } | null>(null);
  const [workspaceNavigationRequest, setWorkspaceNavigationRequest] = useState<{
    href: string;
    nonce: number;
  } | null>(null);
  const [workspaceSplitRequest, setWorkspaceSplitRequest] = useState<{
    href: string;
    side?: SplitSide;
    nonce: number;
  } | null>(null);
  const [workspacePrimaryRoute, setWorkspacePrimaryRoute] = useState<string | null>(null);
  const scheduleConnectionStatus = useCallback((nextStatus: ConnectionStatus) => {
    queueMicrotask(() => {
      setConnectionStatus(nextStatus);
    });
  }, []);
  const resetPreloader = useCallback(() => {
    queueMicrotask(() => {
      setShowPreloader(true);
    });
  }, []);

  useEffect(() => {
    if (!isEmbeddedView || typeof window === 'undefined' || window.parent === window) return;

    window.parent.postMessage(
      {
        type: 'ha-next-embedded-route',
        pathname,
        title,
        subtitle,
      },
      window.location.origin
    );
  }, [isEmbeddedView, pathname, subtitle, title]);

  const handleMobileNavAutoHiddenChange = useCallback((progress: number) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const snapped = clamped >= 0.98 ? 1 : clamped <= 0.02 ? 0 : clamped;
    setMobileNavHideProgress((prev) => {
      return Math.abs(prev - snapped) < 0.001 ? prev : snapped;
    });
  }, []);

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
    // Suppress transient connecting/connected toasts during boot/preloader.
    // We still track "wasConnecting" so post-boot reconnects behave as before.
    if (showPreloader && !error) {
      scheduleConnectionStatus(null);
      wasConnecting.current = connecting;
      return;
    }

    if (connecting) {
      scheduleConnectionStatus('connecting');
      wasConnecting.current = true;
    } else if (error) {
      scheduleConnectionStatus('error');
      wasConnecting.current = false;
    } else if (connected && wasConnecting.current) {
      scheduleConnectionStatus('connected');
      wasConnecting.current = false;
      
      // Auto-hide "connected" status after 3 seconds
      const timer = setTimeout(() => {
        setConnectionStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!connecting && !error && !connected) {
      scheduleConnectionStatus(null);
      wasConnecting.current = false;
    }
  }, [connecting, connected, error, scheduleConnectionStatus, showPreloader]);

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
      resetPreloader();
    }
  }, [configured, hydrated, resetPreloader]);

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

  const hideDesktopChrome = immersivePhase !== 'normal';
  const workspaceActive = desktopSplitViewEnabled && desktopWorkspaceStart !== null && !profileOpen;
  const rootSplitRouteOptions = useMemo(
    () => buildSplitViewOptions(pathname, sidebarItems),
    [pathname, sidebarItems]
  );
  const mobileTopBarHideProgress = Math.max(0, Math.min(1, mobileNavHideProgress));
  const mobileTopBarPointerEventsClass = mobileTopBarHideProgress >= 0.995
    ? 'pointer-events-none'
    : 'pointer-events-auto';
  const mobileHiddenPaddingProgress = immersiveMode ? 0 : mobileTopBarHideProgress;
  const desktopTopBarStateClass = hideDesktopChrome
    ? 'lg:opacity-0 lg:pointer-events-none'
    : 'lg:opacity-100 lg:pointer-events-auto';
  const mobileTopBarStyle = useMemo(() => ({
    '--mobile-topbar-opacity': `${1 - mobileTopBarHideProgress}`,
    '--mobile-topbar-translate': `${-4 * mobileTopBarHideProgress}px`,
    '--mobile-topbar-margin': `${-64 * mobileTopBarHideProgress}px`,
  } as CSSProperties), [mobileTopBarHideProgress]);
  const layoutStyle = useMemo(() => ({
    '--mobile-ui-hidden-padding': `${mobileHiddenPaddingProgress}`,
  } as CSSProperties), [mobileHiddenPaddingProgress]);

  const handleWorkspaceSplitStart = useCallback((side: SplitSide, anchor: SplitMenuAnchor) => {
    if (!desktopSplitViewEnabled) return;
    setRootSplitMenu({ side, anchor });
  }, [desktopSplitViewEnabled]);

  const handleRootSplitSelect = useCallback((route: string) => {
    if (!desktopSplitViewEnabled || !rootSplitMenu) return;

    setWorkspacePrimaryRoute(pathname);
    setDesktopWorkspaceStart({
      pathname,
      side: rootSplitMenu.side,
      route,
      nonce: Date.now(),
    });
    setRootSplitMenu(null);
  }, [desktopSplitViewEnabled, pathname, rootSplitMenu]);

  useEffect(() => {
    if (desktopSplitViewEnabled) {
      splitFlagCollapsePendingRef.current = false;
      return;
    }

    const hasSplitUiState = Boolean(
      desktopWorkspaceStart ||
      rootSplitMenu ||
      workspaceNavigationRequest ||
      workspaceSplitRequest
    );

    if (!hasSplitUiState || splitFlagCollapsePendingRef.current) return;

    splitFlagCollapsePendingRef.current = true;
    const nextRoute = workspacePrimaryRoute ?? desktopWorkspaceStart?.pathname ?? pathname;

    queueMicrotask(() => {
      setDesktopWorkspaceStart(null);
      setWorkspaceNavigationRequest(null);
      setWorkspaceSplitRequest(null);
      setRootSplitMenu(null);
      setWorkspacePrimaryRoute(null);

      if (desktopWorkspaceStart && nextRoute && nextRoute !== pathname) {
        router.replace(nextRoute);
      }

      splitFlagCollapsePendingRef.current = false;
    });
  }, [
    desktopSplitViewEnabled,
    desktopWorkspaceStart,
    pathname,
    rootSplitMenu,
    router,
    workspaceNavigationRequest,
    workspaceSplitRequest,
    workspacePrimaryRoute,
  ]);

  const handleWorkspaceExit = useCallback((nextPathname: string) => {
    setDesktopWorkspaceStart(null);
    setWorkspaceNavigationRequest(null);
    setWorkspaceSplitRequest(null);
    setRootSplitMenu(null);
    setWorkspacePrimaryRoute(null);

    if (nextPathname && nextPathname !== pathname) {
      router.push(nextPathname);
    }
  }, [pathname, router]);

  const sidebarNavigate = useCallback((href: string, options?: { openInSplit?: boolean }) => {
    const openInSplit = desktopSplitViewEnabled && options?.openInSplit === true;

    if (openInSplit) {
      if (workspaceActive) {
        setWorkspaceSplitRequest({
          href,
          side: 'right',
          nonce: Date.now(),
        });
        return;
      }

      setDesktopWorkspaceStart({
        pathname,
        side: 'right',
        route: href,
        nonce: Date.now(),
      });
      setWorkspacePrimaryRoute(pathname);
      if (profileOpen) {
        profileNavigationTargetRef.current = null;
        pendingProfileOpenAfterImmersiveRef.current = false;
        setProfileOpen(false);
      }
      return;
    }

    if (profileOpen) {
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
      return;
    }

    if (workspaceActive) {
      setWorkspaceNavigationRequest({
        href,
        nonce: Date.now(),
      });
      return;
    }

    router.push(href);
  }, [desktopSplitViewEnabled, pathname, profileOpen, router, workspaceActive]);

  useEffect(() => {
    if (!desktopSplitViewEnabled) return;
    if (typeof window === 'undefined') return;

    const handleModifiedLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return;
      if (event.altKey || event.shiftKey) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (!isSplitEligiblePath(url.pathname)) return;

      event.preventDefault();
      event.stopPropagation();

      const href = `${url.pathname}${url.search}${url.hash}`;

      if (isEmbeddedView && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'ha-next-open-split-route',
            href,
          },
          window.location.origin
        );
        return;
      }

      if (workspaceActive) {
        setWorkspaceSplitRequest({
          href,
          side: 'right',
          nonce: Date.now(),
        });
        return;
      }

      setDesktopWorkspaceStart({
        pathname,
        side: 'right',
        route: href,
        nonce: Date.now(),
      });
      setWorkspacePrimaryRoute(pathname);
      setRootSplitMenu(null);
      if (profileOpen) {
        profileNavigationTargetRef.current = null;
        pendingProfileOpenAfterImmersiveRef.current = false;
        setProfileOpen(false);
      }
    };

    document.addEventListener('click', handleModifiedLinkClick, true);
    return () => document.removeEventListener('click', handleModifiedLinkClick, true);
  }, [desktopSplitViewEnabled, isEmbeddedView, pathname, profileOpen, workspaceActive]);

  if (!hydrated) {
    return null;
  }

  if (!configured) {
    return <SetupScreen onSave={saveCredentials} onUseDemo={enableDemoMode} error={error} connecting={connecting} />;
  }

  if (isEmbeddedView) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div className="min-h-[100svh] lg:min-h-screen bg-surface-default" data-component="AppShell">
      {/* Preloader overlay — shown after login, fades out to reveal dashboard */}
      <AnimatePresence>
        {showPreloader && (
          <Preloader onFinish={() => setShowPreloader(false)} />
        )}
      </AnimatePresence>

      {/* Main app shell — fades in as preloader exits */}
      <div
        className={`h-[100svh] lg:h-screen flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[auto_1fr] lg:pt-edge lg:pl-edge transition-opacity duration-700 ${
          showPreloader ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={layoutStyle}
      >
        {/* Sidebar - Desktop only, spans top bar and content rows */}
        <div className={`hidden lg:block lg:row-span-2 relative z-10 transition-opacity duration-300 ease-out ${
          hideDesktopChrome ? 'opacity-0 pointer-events-none' : isEditing ? 'opacity-30 pointer-events-none' : 'opacity-100'
        }`}>
          <Sidebar onNavigate={sidebarNavigate} splitNavigationEnabled={desktopSplitViewEnabled} />
        </div>

        {/* TopBar - Desktop & Mobile persistent header */}
        <div
          data-component="MobileTopBar"
          className={`h-16 lg:bg-transparent px-edge lg:pr-edge overflow-hidden flex-shrink-0 relative z-10 opacity-[var(--mobile-topbar-opacity)] translate-y-[var(--mobile-topbar-translate)] mb-[var(--mobile-topbar-margin)] transition-[opacity,transform,margin-bottom] duration-120 ease-out lg:translate-y-0 lg:mb-0 lg:duration-300 ${mobileTopBarPointerEventsClass} ${desktopTopBarStateClass}`}
          style={mobileTopBarStyle}
        >
          <TopBar />
        </div>

        {/* Content area — profile replaces dashboard when open */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-0">
          {/* Dashboard children — unmounted while profile is open so their
              setHeader effects don't compete with the Profile title */}
          {!profileOpen && (
            <div className="h-full relative">
              {workspaceActive && desktopWorkspaceStart ? (
                <DesktopSplitWorkspace
                  key={`${desktopWorkspaceStart.pathname}-${desktopWorkspaceStart.side}-${desktopWorkspaceStart.route}-${desktopWorkspaceStart.nonce}`}
                  initialPathname={desktopWorkspaceStart.pathname}
                  initialSplit={{
                    side: desktopWorkspaceStart.side,
                    route: desktopWorkspaceStart.route,
                  }}
                  routeOptions={rootSplitRouteOptions}
                  navigationRequest={workspaceNavigationRequest}
                  splitRequest={workspaceSplitRequest}
                  onPrimaryRouteChange={setWorkspacePrimaryRoute}
                  onExit={handleWorkspaceExit}
                />
              ) : (
                <>
                  {children}
                  {desktopSplitViewEnabled && <DesktopSplitHotspots onSplit={handleWorkspaceSplitStart} />}
                  {desktopSplitViewEnabled && rootSplitMenu && (
                    <DesktopSplitViewMenu
                      side={rootSplitMenu.side}
                      anchor={rootSplitMenu.anchor}
                      options={rootSplitRouteOptions}
                      onSelect={handleRootSplitSelect}
                      onClose={() => setRootSplitMenu(null)}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Profile view — same container/padding as other dashboard pages */}
          {profileOpen && (
            <div
              className={`${isImmersiveFixed ? '' : 'h-full flex flex-col px-edge pt-1 pb-0 pr-edge'} ${contentTransitionClasses}`}
              style={isImmersiveFixed ? immersiveContentStyle : undefined}
            >
              <div className={`${isImmersiveFixed ? 'h-full' : 'flex-1 min-h-0'} bg-surface-lower rounded-ha-3xl overflow-hidden relative`}>
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
                      <ProfileContent onClose={() => setProfileOpen(false)} />
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
          editModeFade={isEditing}
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
          onNavAutoHiddenChange={handleMobileNavAutoHiddenChange}
          editModeFade={isEditing}
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
