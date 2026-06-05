'use client';

import { Suspense, useState, useEffect, useRef, ReactNode, CSSProperties, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav, TopBar, EditingToolbar } from '@/components/layout';
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
  const { immersiveMode, immersivePhase } = useImmersiveMode();
  const { contentStyle: immersiveContentStyle, contentTransitionClasses, isImmersiveFixed } = useDesktopImmersivePageLayout();
  const { toggleSearch } = useSearchContext();
  const { title, subtitle } = useHeader();
  const { isEditing, previewViewport } = useEditMode();
  const { items: sidebarItems } = useSidebarItems();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const splitFlagCollapsePendingRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [showPreloader, setShowPreloader] = useState(true);
  const [mobileNavHideProgress, setMobileNavHideProgress] = useState(0);
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

  const hideDesktopChrome = immersivePhase !== 'normal';
  const workspaceActive = desktopSplitViewEnabled && desktopWorkspaceStart !== null;
  const rootSplitRouteOptions = useMemo(
    () => buildSplitViewOptions(pathname, sidebarItems),
    [pathname, sidebarItems]
  );
  const mobileTopBarHideProgress = Math.max(0, Math.min(1, mobileNavHideProgress));
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
  }, [desktopSplitViewEnabled, pathname, router, workspaceActive]);

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
    };

    document.addEventListener('click', handleModifiedLinkClick, true);
    return () => document.removeEventListener('click', handleModifiedLinkClick, true);
  }, [desktopSplitViewEnabled, isEmbeddedView, pathname, workspaceActive]);

  if (!hydrated) {
    return null;
  }

  if (pathname.startsWith('/dev/')) {
    return <>{children}</>;
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
          className={`h-16 bg-transparent lg:bg-transparent px-edge lg:pr-edge overflow-hidden flex-shrink-0 relative z-10 pointer-events-auto ${desktopTopBarStateClass}`}
          style={mobileTopBarStyle}
        >
            {/* Mobile translucent backdrop — blurs app background, fades into content */}
          <div
            className="lg:hidden absolute inset-0 pointer-events-none backdrop-blur-md"
            style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--ha-color-surface-lower) 80%, transparent), color-mix(in srgb, var(--ha-color-surface-lower) 30%, transparent))' }}
            aria-hidden
          />
          <div className="relative z-[1] h-full">
            <TopBar />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-0">
          <div
            className="h-full relative transition-[max-width,margin] duration-300 ease-out"
            style={
              isEditing && previewViewport !== 'desktop'
                ? {
                    maxWidth: previewViewport === 'tablet' ? 768 : 390,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }
                : undefined
            }
          >
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
        </div>

        {/* Status bar row - Desktop only */}
        <StatusBar
          connectionStatus={connectionStatus}
          editModeFade={isEditing}
          onProfileToggle={() => router.push('/settings')}
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

      {/* Editing toolbar - replaces MobileNav on mobile, floats on desktop */}
      <EditingToolbar />

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
