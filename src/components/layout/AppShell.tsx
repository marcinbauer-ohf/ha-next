'use client';

import { Suspense, useState, useEffect, useRef, ReactNode, CSSProperties, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Sidebar, StatusBar, MobileNav, TopBar, EditingToolbar } from '@/components/layout';
import { useFeatureFlags, useHomeAssistant, useImmersiveMode, useSidebarItems, useSidebarExpanded, useDesktopImmersivePageLayout, useTheme, useStandaloneMode, useVacuumSimulator, useDashboardThumbnailCapture } from '@/hooks';
import { PulseWallpaper } from '@/components/layout/PulseWallpaper';
import { useSearchContext, useHeader, useEditMode, useToast, useAssistantContext, useDebugFlags } from '@/contexts';
import { mdiConnection, mdiCheckCircle, mdiAlertCircle, mdiCellphoneArrowDown, mdiRoundedCorner } from '@mdi/js';
import { friendlyConnectionError } from '@/lib/friendlyConnectionError';
import { SearchOverlay } from '@/components/ui/SearchOverlay';
import { AssistantOverlay } from '@/components/ui/AssistantOverlay';
import { HomeCenterOverlay } from '@/components/ui/HomeCenterOverlay';
import { KeyboardShortcutsDialog } from '@/components/ui/KeyboardShortcutsDialog';
import { HudFlash } from '@/components/ui/HudFlash';
import { canFireBareShortcut, matchShortcut, subscribeShortcutsHelp } from '@/lib/keyboardShortcuts';
import { initCardTuner, toggleCardTunerPanel } from '@/lib/cardTuner';
import { DeviceCardTunerPanel } from '@/components/ui/DeviceCardTunerPanel';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { Preloader } from '@/components/ui/Preloader';
import { OnboardingFlow } from '@/components/onboarding';
import { isOnboardingActive, useOnboardingGate } from '@/lib/onboarding';
import { emitSettingsReset } from '@/lib/settingsResetBus';
import { RouteTransition } from '@/components/layout/RouteTransition';
import { announceDiscovery, pickDiscoveries } from '@/lib/deviceDiscovery';
import { announceAutomationNotification, AUTOMATION_NOTIFICATIONS } from '@/lib/automationNotify';
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

/** Smooth-scroll the active route's dashboard scroll container back to the top.
    Routes are matched via RouteTransition's data-route-pathname wrapper so the
    crossfade's exiting copy of the previous route is never targeted. */
function scrollActiveRouteToTop(pathname: string): boolean {
  if (typeof document === 'undefined') return false;
  const routeContainers = Array.from(document.querySelectorAll<HTMLElement>('[data-route-pathname]'));
  const activeRouteContainer = routeContainers.find(
    (container) => container.dataset.routePathname === pathname
  );
  const scrollable = activeRouteContainer?.querySelector<HTMLElement>('[data-scrollable="dashboard"]');
  if (!scrollable) return false;
  scrollable.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-lower">{children}</div>}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const { connecting, connected, error, configured, hydrated, demoMode, saveCredentials, enableDemoMode } = useHomeAssistant();
  const { desktopSplitViewEnabled } = useFeatureFlags();
  const { background, squircle } = useTheme();
  const pulseWallpaper = background === 'pulse';
  const { immersiveMode, immersivePhase } = useImmersiveMode();
  const { contentStyle: immersiveContentStyle, contentTransitionClasses, isImmersiveFixed } = useDesktopImmersivePageLayout();
  const { toggleSearch, openSearch } = useSearchContext();
  const { toggleAssistant } = useAssistantContext();
  const { toggleDebugBadges } = useDebugFlags();
  const { title, subtitle } = useHeader();
  const { isEditing, toggleEditMode, previewViewport, previewOrientation } = useEditMode();
  const { isToastVisible, showToast, dismissToast } = useToast();
  const { items: sidebarItems } = useSidebarItems();
  const { expanded: sidebarExpanded, toggle: toggleSidebar } = useSidebarExpanded();
  // Self-driving demo robot vacuum — randomly starts/finishes cleaning cycles so
  // the activity surface has live coming-and-going content (demo mode only).
  useVacuumSimulator();
  // Snapshot the current view (on edit-exit / first visit) for the sidebar
  // hover preview.
  useDashboardThumbnailCapture();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const splitFlagCollapsePendingRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  // First-run onboarding covers the shell; while it's up the boot preloader is
  // redundant (both are opaque), so it never mounts and the shell settles
  // behind the flow — finishing onboarding fades straight into a ready
  // dashboard. Read lazily: on the server the gate is always false, but the
  // shell renders nothing until `hydrated`, so the states never hit the DOM.
  const onboardingActive = useOnboardingGate();
  const [showPreloader, setShowPreloader] = useState(() => !isOnboardingActive());
  // Connection form reachable from the error toast, so a failed connect can be
  // fixed where it's reported instead of hunting through settings.
  const [setupOpen, setSetupOpen] = useState(false);
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
    // Onboarding suppresses everything — its connect step reports errors inline.
    if (onboardingActive || (showPreloader && !error)) {
      scheduleConnectionStatus(null);
      wasConnecting.current = connecting;
      return;
    }

    if (connecting) {
      scheduleConnectionStatus('connecting');
      wasConnecting.current = true;
    } else if (error && !demoMode) {
      // A stale error from an abandoned connect attempt must never interrupt
      // the demo home — there is no connection to be broken there.
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
  }, [connecting, connected, error, demoMode, scheduleConnectionStatus, showPreloader, onboardingActive]);

  // Surface connection status through the shared toast component. Each status
  // change replaces the previous connection toast instead of stacking on it.
  const connectionToastId = useRef<number | null>(null);
  const connectionToastKey = useRef<string | null>(null);
  useEffect(() => {
    // Nothing new to say → leave the live toast alone. Without this, any
    // re-render carrying the same status tears the card down and builds an
    // identical one, which reads as a stream of fresh notifications for one
    // unchanged problem.
    const key = connectionStatus && `${connectionStatus}|${error ?? ''}`;
    if (key === connectionToastKey.current) return;
    connectionToastKey.current = key ?? null;

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
        subtitle: friendlyConnectionError(error),
        duration: null,
        // The address or key is the usual culprit, so hand over the form that
        // edits them rather than a reload that repeats the same failure.
        action: { label: 'Connection settings', onClick: () => setSetupOpen(true) },
        statusSection: 'connectivity',
      });
    }
  }, [connectionStatus, error, showToast, dismissToast]);

  // Mobile browsers (not standalone/PWA): suggest installing to the home
  // screen via a persistent toast. Dismissing it (✕) is remembered.
  const { isStandalone, hydrated: standaloneHydrated } = useStandaloneMode();
  const installPromptShown = useRef(false);
  useEffect(() => {
    if (showPreloader || onboardingActive || !standaloneHydrated || isStandalone || installPromptShown.current) return;
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
  }, [showPreloader, onboardingActive, standaloneHydrated, isStandalone, showToast]);

  // Demo: surface a simulated "new device detected" toast once, 5s after the app
  // is ready — fires on whatever view you're on (dashboard, settings, automation
  // editor, …), not just the dashboard. Placeholder until wired to real HA
  // discovery events; use the command palette ("Simulate device discovery") for
  // more on demand.
  const discoveryShown = useRef(false);
  useEffect(() => {
    if (showPreloader || onboardingActive || discoveryShown.current) return;
    const timer = setTimeout(() => {
      discoveryShown.current = true;
      announceDiscovery(showToast, pickDiscoveries(1)[0]);
    }, 5000);
    return () => clearTimeout(timer);
  }, [showPreloader, onboardingActive, showToast]);

  // Demo: surface a simulated automation notification (front door left
  // unlocked) once, ~12s after the app is ready — offset from the discovery
  // toast above so the two don't collide. Shows for *every* user, admin or not:
  // home-automation notices reach non-admins too and land in their
  // settings → Notifications list. Placeholder until wired to real HA
  // notify.* / persistent_notification events.
  const automationNotifyShown = useRef(false);
  useEffect(() => {
    if (showPreloader || onboardingActive || automationNotifyShown.current) return;
    const timer = setTimeout(() => {
      automationNotifyShown.current = true;
      announceAutomationNotification(showToast, AUTOMATION_NOTIFICATIONS[0]);
    }, 12000);
    return () => clearTimeout(timer);
  }, [showPreloader, onboardingActive, showToast]);

  // Dismiss any open toast when entering edit mode
  useEffect(() => {
    if (isEditing) {
      connectionToastId.current = null;
      dismissToast();
    }
  }, [isEditing, dismissToast]);

  // Keyboard shortcuts help dialog — opened by ? below, the command palette
  // entry, and the settings reference card (via the module-level bus).
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  useEffect(() => subscribeShortcutsHelp(() => setShortcutsHelpOpen(true)), []);

  // Re-apply persisted card-tuner tweaks (CSS vars on <html>) on load, so a
  // tuned card layout survives reloads even while the panel stays closed.
  useEffect(() => initCardTuner(), []);

  // Squircle corners are a subtle change, so confirm every toggle (keyboard,
  // debug switch, or command palette all flip the same flag) with a toast.
  // Track the previous value rather than a mount flag so a spurious toast never
  // fires on load — including under Strict Mode's double-invoked effects.
  const prevSquircle = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevSquircle.current === null || prevSquircle.current === squircle) {
      prevSquircle.current = squircle;
      return;
    }
    prevSquircle.current = squircle;
    showToast({
      title: `Squircle corners ${squircle ? 'on' : 'off'}`,
      subtitle: squircle ? 'Rounded corners use iOS-style smoothing.' : 'Rounded corners use plain circular arcs.',
      icon: mdiRoundedCorner,
    });
  }, [squircle, showToast]);

  // Global keyboard shortcuts — the registry in src/lib/keyboardShortcuts.ts
  // is the display companion to this handler; keep the two in sync.
  useEffect(() => {
    const isDashboardPath = pathname === '/' ||
      (pathname.startsWith('/dashboard/') && pathname !== '/dashboard/energy');

    const handleKeyDown = (e: KeyboardEvent) => {
      // During first-run onboarding the shell isn't interactive yet.
      if (onboardingActive) return;
      // ⌘⇧X — device card tuner panel (developer tool, registry: debug.card-tuner).
      // Not ⌘⇧C: that's the browser's inspect-element chord and can't be preempted.
      if (matchShortcut(e, 'debug.card-tuner')) {
        e.preventDefault();
        toggleCardTunerPanel();
        return;
      }
      // Modifier chords work even while typing — they can't collide with text.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault();
            toggleSearch();
            break;
          case 'h':
            e.preventDefault();
            router.push('/');
            break;
          case 'b':
            e.preventDefault();
            toggleSidebar();
            break;
        }
        return;
      }

      // Single-key shortcuts: skip text fields, open dialogs, and key repeats.
      if (!canFireBareShortcut(e)) return;
      if (matchShortcut(e, 'global.help')) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }
      // Debug toggles — safe (non-destructive) and useful mid-edit, so they run
      // before the edit-mode gate below. Destructive resets stay palette-only.
      if (matchShortcut(e, 'debug.badges')) {
        e.preventDefault();
        toggleDebugBadges();
        return;
      }
      if (matchShortcut(e, 'dashboard.edit') && isDashboardPath) {
        e.preventDefault();
        toggleEditMode();
        return;
      }
      if (isEditing) return; // stay put while arranging the dashboard
      if (matchShortcut(e, 'global.search')) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (matchShortcut(e, 'global.assistant')) {
        e.preventDefault();
        toggleAssistant();
        return;
      }
      if (matchShortcut(e, 'global.home')) {
        e.preventDefault();
        router.push('/');
        return;
      }
      if (matchShortcut(e, 'global.settings')) {
        e.preventDefault();
        // Mirror the StatusBar avatar: re-invoking from /settings resets the
        // workspace to its default section instead of a no-op navigation.
        if (pathname === '/settings') emitSettingsReset();
        else router.push('/settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch, openSearch, toggleAssistant, toggleEditMode, toggleDebugBadges, toggleSidebar, isEditing, pathname, router, onboardingActive]);

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

    // Re-clicking the already-active rail item: scroll that view back to the
    // top instead of re-pushing the same route.
    if (href === pathname && scrollActiveRouteToTop(pathname)) return;

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

  if (pathname.startsWith('/dev/') || pathname.startsWith('/spin')) {
    return <>{children}</>;
  }

  if (!configured) {
    return <SetupScreen onSave={saveCredentials} onUseDemo={enableDemoMode} error={error} connecting={connecting} />;
  }

  if (isEmbeddedView) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div
      className={`${isStandalone ? 'min-h-screen' : 'min-h-[100dvh]'} lg:min-h-screen bg-surface-default ${showPreloader ? '' : 'ha-app-booted'}`}
      data-component="AppShell"
    >
      {/* Pulse wallpaper — animated ring background painted behind the whole
          shell, rippling on live device toggles. */}
      {pulseWallpaper && <PulseWallpaper />}

      {/* Preloader overlay — shown after login, fades out to reveal dashboard */}
      <AnimatePresence>
        {showPreloader && (
          <Preloader onFinish={() => setShowPreloader(false)} />
        )}
      </AnimatePresence>

      {/* First-run onboarding — covers the shell; completing it plays the
          flow's exit fade and reveals the dashboard already running below. */}
      <AnimatePresence>
        {onboardingActive && <OnboardingFlow key="first-run-onboarding" />}
      </AnimatePresence>

      {/* Main app shell — fades in as preloader exits. While onboarding covers
          it the whole subtree is inert so Tab can't wander into invisible UI. */}
      <div
        inert={onboardingActive || undefined}
        className={`relative ${isStandalone ? 'h-screen' : 'h-[100dvh]'} lg:h-screen flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[auto_1fr] lg:pt-[calc(var(--ha-edge-padding)+env(safe-area-inset-top,0px))] lg:pl-edge transition-opacity duration-700 ${
          showPreloader ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={layoutStyle}
      >
        {/* Sidebar - Desktop only, spans top bar and content rows. The rail
            itself animates between icon-only and expanded (labels) widths;
            the auto grid column follows it. */}
        <div className={`hidden lg:block lg:row-span-2 relative z-10 transition-opacity duration-300 ease-out ${
          hideDesktopChrome ? 'opacity-0 pointer-events-none' : isEditing ? 'opacity-30 pointer-events-none' : 'opacity-100'
        }`}>
          <Sidebar
            onNavigate={sidebarNavigate}
            splitNavigationEnabled={desktopSplitViewEnabled}
            expanded={sidebarExpanded}
            onToggleExpanded={toggleSidebar}
          />
        </div>

        {/* TopBar - Desktop & Mobile persistent header */}
        <div
          data-component="MobileTopBar"
          className={`h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] lg:h-16 lg:pt-0 bg-transparent lg:bg-transparent px-edge lg:pr-edge overflow-visible lg:overflow-hidden flex-shrink-0 absolute top-0 inset-x-0 z-30 lg:relative lg:top-auto lg:z-10 pointer-events-auto ${desktopTopBarStateClass}`}
          style={mobileTopBarStyle}
        >
            {/* Mobile backdrop — solid behind the bar, then a short fade under
                it. The old single gradient started dissolving at 45% of the
                bar's own height, so cards passing under the title read as a
                haze across the top of the screen rather than as content
                sliding cleanly beneath a header. */}
          <div className="lg:hidden absolute inset-0 pointer-events-none bg-surface-default" aria-hidden />
          <div
            className="lg:hidden absolute top-full inset-x-0 h-6 pointer-events-none bg-gradient-to-b from-surface-default to-transparent"
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

      {/* One-shot boot glow for the desktop search bar — the toast/edit glow
          language (radial tint rising from an edge), anchored to the very top
          edge of the screen so it reads as a light source behind the centered
          field. Fixed at shell root to escape the content area's overflow
          clip; z-[9] keeps it above page content (z-0) but under the top bar
          chrome (z-10). */}
      {/* Full-width so the radial gradient fades to transparent within the box
          on both sides (a fixed-width box clipped the horizontal spread). The
          gradient itself is offset to sit under the field — see the CSS. */}
      <div
        aria-hidden
        className="ha-search-boot-glow hidden lg:block fixed top-0 inset-x-0 h-48 pointer-events-none z-[9]"
      />

      {/* Mobile navigation - hidden during preloader and first-run onboarding */}
      {!showPreloader && !onboardingActive && (
        <MobileNav
          connectionStatus={connectionStatus}
          onNavAutoHiddenChange={handleMobileNavAutoHiddenChange}
          editModeFade={isEditing}
          freezeAutoHide={isToastVisible}
          disableAutoHide
        />
      )}

      {/* Editing toolbar - replaces MobileNav on mobile, floats on desktop */}
      <EditingToolbar />

      {/* Global search overlay */}
      <SearchOverlay />

      {/* Assistant overlay */}
      <AssistantOverlay />

      {/* Home Center bento overlay */}
      <HomeCenterOverlay />

      {/* Connection form, opened from the connection-error toast. */}
      <SetupScreen
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onSave={async (url, token) => {
          try {
            await saveCredentials(url, token);
            setSetupOpen(false);
          } catch {
            /* the form shows the friendly error inline */
          }
        }}
        onUseDemo={() => {
          enableDemoMode();
          setSetupOpen(false);
        }}
        error={error}
        connecting={connecting}
      />

      {/* Keyboard shortcuts cheat-sheet (?) */}
      <KeyboardShortcutsDialog open={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />

      {/* Center-screen HUD flash — brief shortcut confirmation */}
      <HudFlash />

      {/* Floating device-card tuner (⌘⇧X / command palette / developer flags) */}
      <DeviceCardTunerPanel />
    </div>
  );
}
