'use client';

import { Suspense, useState, useEffect, useRef, ReactNode, CSSProperties, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav, TopBar, EditingToolbar } from '@/components/layout';
import { useFeatureFlags, useHomeAssistant, useImmersiveMode, useSidebarItems, useDesktopImmersivePageLayout, useTheme, useStandaloneMode } from '@/hooks';
import { PulseWallpaper } from '@/components/layout/PulseWallpaper';
import { useSearchContext, useHeader, useEditMode, useToast } from '@/contexts';
import { mdiConnection, mdiCheckCircle, mdiAlertCircle, mdiCellphoneArrowDown } from '@mdi/js';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { AssistantOverlay } from '@/components/ui/AssistantOverlay';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { Preloader } from '@/components/ui/Preloader';
import { emitSettingsReset } from '@/lib/settingsResetBus';
import { RouteTransition } from '@/components/layout/RouteTransition';
import { announceDiscovery, pickDiscoveries } from '@/lib/deviceDiscovery';
import { AnimatePresence, motion } from 'framer-motion';
type ConnectionStatus = 'connecting' | 'connected' | 'error' | null;
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
  const { background } = useTheme();
  const pulseWallpaper = background === 'pulse';
  const { immersiveMode, immersivePhase } = useImmersiveMode();
  const { contentStyle: immersiveContentStyle, contentTransitionClasses, isImmersiveFixed } = useDesktopImmersivePageLayout();
  const { toggleSearch } = useSearchContext();
  const { title, subtitle } = useHeader();
  const { isEditing, previewViewport, previewOrientation } = useEditMode();
  const { isToastVisible, showToast, dismissToast } = useToast();
  const { items: sidebarItems } = useSidebarItems();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const splitFlagCollapsePendingRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [showPreloader, setShowPreloader] = useState(true);
  const [mobileNavHideProgress, setMobileNavHideProgress] = useState(0);
  const [isLgScreen, setIsLgScreen] = useState(false);
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

  // Surface connection status through the shared toast component. Each status
  // change replaces the previous connection toast instead of stacking on it.
  const connectionToastId = useRef<number | null>(null);
  useEffect(() => {
    if (connectionToastId.current != null) {
      dismissToast(connectionToastId.current);
      connectionToastId.current = null;
    }
    if (connectionStatus === 'connecting') {
      connectionToastId.current = showToast({
        icon: mdiConnection,
        iconColor: 'text-ha-blue',
        title: 'Connecting to Home Assistant…',
        duration: null,
        statusSection: 'connectivity',
      });
    } else if (connectionStatus === 'connected') {
      connectionToastId.current = showToast({
        icon: mdiCheckCircle,
        iconColor: 'text-green-500',
        title: 'Connected',
        duration: 3000,
        statusSection: 'connectivity',
      });
    } else if (connectionStatus === 'error') {
      connectionToastId.current = showToast({
        icon: mdiAlertCircle,
        iconColor: 'text-red-500',
        title: 'Connection error',
        subtitle: typeof error === 'string' ? error : undefined,
        duration: null,
        action: { label: 'Reload', onClick: () => window.location.reload() },
        statusSection: 'connectivity',
      });
    }
  }, [connectionStatus, error, showToast, dismissToast]);

  // Mobile browsers (not standalone/PWA): suggest installing to the home
  // screen via a persistent toast. Dismissing it (✕) is remembered.
  const { isStandalone, hydrated: standaloneHydrated } = useStandaloneMode();
  const installPromptShown = useRef(false);
  useEffect(() => {
    if (showPreloader || !standaloneHydrated || isStandalone || installPromptShown.current) return;
    if (localStorage.getItem('ha_install_banner_dismissed') === 'true') return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    const timer = setTimeout(() => {
      installPromptShown.current = true;
      showToast({
        icon: mdiCellphoneArrowDown,
        title: 'Add to homescreen',
        subtitle: 'Share → Add to Home Screen for the full experience',
        duration: null,
        onClose: () => localStorage.setItem('ha_install_banner_dismissed', 'true'),
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [showPreloader, standaloneHydrated, isStandalone, showToast]);

  // Demo: surface a simulated "new device detected" toast once, 5s after the app
  // is ready — fires on whatever view you're on (dashboard, settings, automation
  // editor, …), not just the dashboard. Placeholder until wired to real HA
  // discovery events; use the command palette ("Simulate device discovery") for
  // more on demand.
  const discoveryShown = useRef(false);
  useEffect(() => {
    if (showPreloader || discoveryShown.current) return;
    const timer = setTimeout(() => {
      discoveryShown.current = true;
      announceDiscovery(showToast, pickDiscoveries(1)[0]);
    }, 5000);
    return () => clearTimeout(timer);
  }, [showPreloader, showToast]);

  // Dismiss any open toast when entering edit mode
  useEffect(() => {
    if (isEditing) {
      connectionToastId.current = null;
      dismissToast();
    }
  }, [isEditing, dismissToast]);

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
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLgScreen(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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
    <div className="min-h-[100dvh] lg:min-h-screen bg-surface-default" data-component="AppShell">
      {/* Pulse wallpaper — animated ring background painted behind the whole
          shell, rippling on live device toggles. */}
      {pulseWallpaper && <PulseWallpaper />}

      {/* Preloader overlay — shown after login, fades out to reveal dashboard */}
      <AnimatePresence>
        {showPreloader && (
          <Preloader onFinish={() => setShowPreloader(false)} />
        )}
      </AnimatePresence>

      {/* Main app shell — fades in as preloader exits */}
      <div
        className={`relative h-[100dvh] lg:h-screen flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[auto_1fr] lg:pt-edge lg:pl-edge transition-opacity duration-700 ${
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
          className={`h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] lg:h-16 lg:pt-0 bg-transparent lg:bg-transparent px-edge lg:pr-edge overflow-visible lg:overflow-hidden flex-shrink-0 absolute top-0 inset-x-0 z-30 lg:relative lg:top-auto lg:z-10 pointer-events-auto ${desktopTopBarStateClass}`}
          style={mobileTopBarStyle}
        >
            {/* Mobile backdrop — the bar's own gradient fades the content out:
                solid surface tint at the top dissolving to transparent below,
                extending past the bar so the readable backing spans lower with
                no hard line between the bar and the surface. */}
          <div
            className="lg:hidden absolute top-0 inset-x-0 h-[125%] pointer-events-none bg-gradient-to-b from-surface-default from-45% via-surface-default/65 via-80% to-transparent"
            aria-hidden
          />
          <div className="relative z-[1] h-full">
            <TopBar />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-0" id="dashboard-content-area">
          <div
            className="h-full relative transition-[max-width,margin] duration-300 ease-out"
            style={
              isLgScreen && isEditing && previewViewport !== 'desktop'
                ? {
                    // iPad / iPhone CSS widths per orientation
                    maxWidth: previewViewport === 'tablet'
                      ? (previewOrientation === 'landscape' ? 1024 : 768)
                      : (previewOrientation === 'landscape' ? 844 : 390),
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
                <RouteTransition>{children}</RouteTransition>
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

            {/* Device fold guide — in edit mode while previewing a phone/tablet
                on a large screen, the content column is clamped to the device's
                CSS width but keeps the full window height. Draw a dashed line at
                the device's screen height (the dimension perpendicular to the
                clamped width) so it's clear where content drops below the fold
                on that device. Stays fixed in the frame while content scrolls. */}
            {isLgScreen && isEditing && previewViewport !== 'desktop' && (
              <div
                aria-hidden
                className="absolute inset-x-0 z-[60] flex items-center gap-2 px-2 pointer-events-none"
                style={{
                  top: previewViewport === 'tablet'
                    ? (previewOrientation === 'landscape' ? 768 : 1024)
                    : (previewOrientation === 'landscape' ? 390 : 844),
                }}
              >
                <div className="flex-1 border-t-2 border-dashed border-orange-500/80" />
                <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white whitespace-nowrap">
                  Screen edge
                </span>
                <div className="flex-1 border-t-2 border-dashed border-orange-500/80" />
              </div>
            )}
          </div>

          {/* Edit-mode glow — radial dark rising from the bottom center. Inset to the
              grey panel's edges + rounded bottom corners (.dashboard-bottom-glow) so it
              stays inside the surface instead of spilling into the side gutters. */}
          <AnimatePresence>
            {isEditing && (
              <motion.div
                aria-hidden
                className="dashboard-bottom-glow absolute bottom-0 pointer-events-none"
                style={{
                  height: '40vh',
                  zIndex: 61,
                  // Match the connected-toast glow's weight (ToastContext bottom-center
                  // glow): same geometry, same low opacity falloff — just a dark tint.
                  background:
                    'radial-gradient(ellipse 80% 70% at 50% 100%, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.05) 55%, transparent 75%)',
                  transformOrigin: '50% 100%',
                }}
                initial={{ scale: 0.15, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                // Exit: quick opacity fade in place (no shrink) so it clears with the
                // 300ms chrome fade instead of lingering/retracting after it.
                exit={{ opacity: 0, transition: { duration: 0.25, ease: 'easeOut' } }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>

          {/* Portal root — overlays portaled into here are clipped (overflow-hidden)
              to the dashboard <main> bounds so the corner toast's glow can't bleed out. */}
          <div id="toast-glow-root" className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 62 }} />
        </div>

        {/* Status bar row - Desktop only */}
        <StatusBar
          connectionStatus={connectionStatus}
          editModeFade={isEditing}
          onProfileToggle={() => {
            // Already on the two-column workspace → the URL won't change, so
            // reset its active section back to Home Center via the bus. From a
            // deep /settings/<slug> route (or anywhere else) a plain push lands
            // on the workspace root, which defaults to Home Center on its own.
            if (pathname === '/settings') emitSettingsReset();
            else router.push('/settings');
          }}
        />
      </div>

      {/* Mobile navigation - hidden during preloader */}
      {!showPreloader && (
        <MobileNav
          connectionStatus={connectionStatus}
          onNavAutoHiddenChange={handleMobileNavAutoHiddenChange}
          editModeFade={isEditing}
          freezeAutoHide={isToastVisible}
        />
      )}

      {/* Editing toolbar - replaces MobileNav on mobile, floats on desktop */}
      <EditingToolbar />

      {/* Global search overlay */}
      <SearchOverlay />

      {/* Assistant overlay */}
      <AssistantOverlay />
    </div>
  );
}
