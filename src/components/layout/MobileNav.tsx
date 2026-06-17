'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  TouchSensor,
  MouseSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../ui/Icon';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SearchField } from '../ui/SearchField';
import { Avatar } from '../ui/Avatar';
import { HALogo } from '../ui/HALogo';
import { MdiIcon } from '../ui/MdiIcon';
import { CircularProgress } from '../ui/CircularProgress';
import { useHomeAssistant, useHomeAssistantSelector, useSidebarItems, useLongPress, useHomeCenterPrefs } from '@/hooks';
import { HomeCenterPillIndicators, HomeCenterStatusSections, OpenHomeCenterButton } from '../sections/HomeCenterStatus';
import { SettingsNavPanel } from '@/components/profile';
import { isSettingsSlug, type SettingsSlug } from '@/components/profile/settingsNavigation';
import { usePullToRevealContext, useSearchContext, useSidebarArrange, arrangeItems, useCloseOnScreensaver, useMobileToolbar, type SidebarItem } from '@/contexts';
import { resolveEntityPictureUrl } from '@/lib/utils';
import { subscribeStatusPulse } from '@/lib/statusPulseBus';
import { haptic } from '@/lib/haptics';
import {
  areActivityDataEqual,
  areEntitySearchMatchesEqual,
  selectActivityData,
  selectMatchingEntities,
} from '@/lib/homeassistant/selectors';
import {
  mdiArrowLeft,
  mdiMagnify,
  mdiUpdate,
  mdiPlay,
  mdiTimerOutline,
  mdiPause,
  mdiChevronRight,
  mdiMicrophone,
  mdiDevices,
  mdiClose,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiDoorbellVideo,
  mdiSend,
  mdiPrinter3d,
  mdiViewDashboardOutline,
  mdiMenu,
  mdiCheck,
} from '@mdi/js';

function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

const appPalettes = [
  { text: 'text-ha-blue' },
  { text: 'text-red-600' },
  { text: 'text-green-600' },
  { text: 'text-yellow-600' },
];

const activityWidgetTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

function getAppPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return appPalettes[Math.abs(hash) % appPalettes.length];
}

function arrangeWobble(arranging: boolean, pinned: boolean, isDragging: boolean, index: number) {
  if (!arranging || pinned) return '';
  if (isDragging) return 'ha-jiggle-frozen';
  return index % 2 === 0 ? 'ha-jiggle' : 'ha-jiggle-alt';
}

function ArrangeDeleteBadge({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      }}
      className="ha-arrange-badge absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md shadow-black/30 ring-2 ring-surface-default"
    >
      <Icon path={mdiClose} size={14} />
    </button>
  );
}

interface MobileArrangeCardProps {
  item: SidebarItem;
  isActive: boolean;
  arranging: boolean;
  pinned?: boolean;
  index: number;
  onClose: () => void;
  onEnterArrange: () => void;
  onRequestDelete: (item: SidebarItem) => void;
}

function MobileDashboardCard({
  item,
  isActive,
  arranging,
  pinned = false,
  index,
  onClose,
  onEnterArrange,
  onRequestDelete,
}: MobileArrangeCardProps) {
  const longPress = useLongPress(onEnterArrange);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !arranging || pinned,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 60 : undefined,
    touchAction: arranging && !pinned ? 'none' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className={arrangeWobble(arranging, pinned, isDragging, index)}>
        <Link
          prefetch={false}
          href={item.urlPath}
          {...(arranging && !pinned ? { ...attributes, ...listeners } : {})}
          {...(!arranging ? longPress.handlers : {})}
          onClick={(e) => {
            if (longPress.consume()) {
              e.preventDefault();
              return;
            }
            if (arranging) {
              e.preventDefault();
              return;
            }
            onClose();
          }}
          className={`-m-1 rounded-ha-xl p-1 flex flex-col group transition-colors select-none ${
            isActive ? 'bg-surface-low/80' : 'hover:bg-surface-low/40'
          }`}
        >
          <div
            className={`w-full aspect-[3/4] rounded-ha-xl overflow-hidden transition-all ${
              isActive ? 'bg-fill-primary-normal ring-2 ring-ha-blue/35' : 'bg-surface-lower'
            }`}
          >
            <div className="p-ha-2 space-y-ha-1">
              <div className={`h-2 rounded-full w-full ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
              <div className={`h-2 rounded-full w-3/4 ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
              <div className={`h-3 rounded-ha-lg w-full mt-ha-2 ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
              <div className={`h-3 rounded-ha-lg w-full ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
            </div>
          </div>
          <div className="flex items-center gap-ha-1 mt-ha-1">
            {item.icon ? (
              <MdiIcon
                icon={item.icon}
                size={24}
                className={`flex-shrink-0 ${isActive ? 'text-ha-blue' : 'text-text-secondary'}`}
              />
            ) : (
              <HALogo size={24} />
            )}
            <span className={`text-[13px] truncate ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
              {item.title}
            </span>
          </div>
        </Link>
      </div>
      {arranging && !pinned && <ArrangeDeleteBadge label={item.title} onDelete={() => onRequestDelete(item)} />}
    </div>
  );
}

function MobileAppTile({
  item,
  isActive,
  arranging,
  index,
  onClose,
  onEnterArrange,
  onRequestDelete,
}: MobileArrangeCardProps) {
  const longPress = useLongPress(onEnterArrange);
  const palette = getAppPalette(item.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !arranging,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 60 : undefined,
    touchAction: arranging ? 'none' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className={arrangeWobble(arranging, false, isDragging, index)}>
        <Link
          prefetch={false}
          href={item.urlPath}
          {...(arranging ? { ...attributes, ...listeners } : {})}
          {...(!arranging ? longPress.handlers : {})}
          onClick={(e) => {
            if (longPress.consume()) {
              e.preventDefault();
              return;
            }
            if (arranging) {
              e.preventDefault();
              return;
            }
            onClose();
          }}
          className="w-full rounded-ha-xl flex flex-col items-center gap-1 p-ha-1.5 min-w-0 select-none"
          title={item.title}
        >
          <div
            className={`w-12 h-12 rounded-ha-xl flex items-center justify-center transition-colors ha-app-icon-shell ${
              isActive ? 'bg-surface-mid ha-app-icon-shell-active' : 'bg-surface-low'
            }`}
          >
            <MdiIcon
              icon={item.icon || 'mdi:application'}
              size={24}
              className={`${palette.text} ha-app-icon-glyph`}
            />
          </div>
          <span
            className={`w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[13px] leading-tight font-medium ${
              isActive ? 'text-text-primary' : 'text-text-secondary'
            }`}
          >
            {item.title}
          </span>
        </Link>
      </div>
      {arranging && <ArrangeDeleteBadge label={item.title} onDelete={() => onRequestDelete(item)} />}
    </div>
  );
}

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;
type BottomSurfaceTab = 'dashboards' | 'search' | 'dashboard' | 'chat' | 'settings' | 'widget';
type WidgetSurfaceType = 'release' | 'media' | 'timer' | 'camera' | 'printer';

interface SearchResultItem {
  id: string;
  type: 'dashboard' | 'app' | 'entity';
  name: string;
  subtitle: string;
  icon?: string | null;
  href?: string;
}

interface MobileNavProps {
  disableAutoHide?: boolean;
  /** Hold the nav at its current shown/hidden state (e.g. while a toast is up). */
  freezeAutoHide?: boolean;
  connectionStatus?: ConnectionStatusType;
  onNavAutoHiddenChange?: (progress: number) => void;
  editModeFade?: boolean;
}

function getDashboardScrollableForPath(pathname: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const routeContainers = Array.from(document.querySelectorAll<HTMLElement>('[data-route-pathname]'));
  const activeRouteContainer = routeContainers.find(
    (container) => container.dataset.routePathname === pathname
  );

  if (!activeRouteContainer) return null;
  return activeRouteContainer.querySelector<HTMLElement>('[data-scrollable="dashboard"]');
}

function normalizePath(path: string): string {
  if (path === '/') return '/';
  return path.endsWith('/') ? path.replace(/\/+$/, '') : path;
}

function isNavItemActive(currentPath: string, itemPath: string): boolean {
  const normalizedCurrentPath = normalizePath(currentPath);
  const normalizedItemPath = normalizePath(itemPath);

  if (normalizedItemPath === '/') return normalizedCurrentPath === '/';
  return (
    normalizedCurrentPath === normalizedItemPath ||
    normalizedCurrentPath.startsWith(`${normalizedItemPath}/`)
  );
}

export function MobileNav({ disableAutoHide = false, freezeAutoHide = false, connectionStatus, onNavAutoHiddenChange, editModeFade }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { haUrl, callService } = useHomeAssistant();
  const { items } = useSidebarItems();
  const { isRevealed, close } = usePullToRevealContext();
  const { searchOpen, closeSearch } = useSearchContext();
  const { arranging, enterArrange, exitArrange, order, hiddenIds, hideItem, reorderVisible } =
    useSidebarArrange();
  const { toolbarActive } = useMobileToolbar();
  const [pendingDelete, setPendingDelete] = useState<SidebarItem | null>(null);
  const arrangeSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } })
  );
  // Assistant now handled via expandedWidgetId

  const [timerProgress, setTimerProgress] = useState<number>(0);
  const [scrollHideProgress, setScrollHideProgress] = useState(0);
  const [hideFromInactivity, setHideFromInactivity] = useState(false);
  const [showBottomEdgeGradient, setShowBottomEdgeGradient] = useState(false);
  const [showExpandedSurfaceTopGradient, setShowExpandedSurfaceTopGradient] = useState(false);
  const [showExpandedSurfaceBottomGradient, setShowExpandedSurfaceBottomGradient] = useState(false);
  const [showActivityListTopGradient, setShowActivityListTopGradient] = useState(false);
  const [showActivityListBottomGradient, setShowActivityListBottomGradient] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [isBottomSheetDragging, setIsBottomSheetDragging] = useState(false);
  const [bottomSheetDragProgress, setBottomSheetDragProgress] = useState(0);
  const [expandedSurfaceTab, setExpandedSurfaceTab] = useState<BottomSurfaceTab>('dashboards');
  const [expandedSearchQuery, setExpandedSearchQuery] = useState('');
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  const [expandedWidgetType, setExpandedWidgetType] = useState<WidgetSurfaceType | null>(null);
  // For multi-activity list picker
  const [activityListType, setActivityListType] = useState<'release' | 'media' | 'timer' | 'camera' | 'printer' | 'all' | null>(null);
  const [dismissedReleaseNotes, setDismissedReleaseNotes] = useState<Record<string, string>>({});
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const scrollHideProgressRef = useRef(0);
  const lastScrollTopRef = useRef<number | null>(null);
  const scrollSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const bottomSheetHandleRef = useRef<HTMLButtonElement | null>(null);
  const expandedSurfaceScrollRef = useRef<HTMLDivElement | null>(null);
  const activityListScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSheetTouchStartY = useRef<number | null>(null);
  const bottomSheetPullDistance = useRef(0);
  const bottomSheetDragProgressRef = useRef(0);
  const isDashboardsSurfaceVisible = statusExpanded && expandedSurfaceTab === 'dashboards';
  const isSearchSurfaceVisible = statusExpanded && expandedSurfaceTab === 'search';
  const isSettingsSurfaceVisible = statusExpanded && expandedSurfaceTab === 'settings';
  const isSettingsRoute = pathname === '/profile' || pathname === '/settings' || pathname.startsWith('/settings/');
  const isSearchActive = isSearchSurfaceVisible || searchOpen;
  const isSettingsActive = !isDashboardsSurfaceVisible && (isSettingsSurfaceVisible || (!isSearchActive && isSettingsRoute));
  const isDashboardsActive = isDashboardsSurfaceVisible || (!isSearchActive && !isSettingsActive);
  const pathSegments = pathname.split('/').filter(Boolean);
  const isDashboardSubView = pathSegments[0] === 'dashboard' && pathSegments.length > 1;
  const isRoomSubView = pathSegments[0] === 'room' && pathSegments.length > 1;
  // A settings detail (e.g. /settings/integrations, or the /profile item) — on
  // mobile these are pushed routes off the /settings master list, so they get
  // the same bottom back affordance as dashboards but return to /settings.
  const isSettingsSubView =
    (pathSegments[0] === 'settings' && pathSegments.length > 1) || pathname === '/profile';
  // Hidden for now — bottom-nav back affordance disabled per design pass.
  const showHomeBackButton = false && (isDashboardSubView || isRoomSubView || isSettingsSubView);
  const backHref = isSettingsSubView ? '/settings' : '/';
  const backLabel = isSettingsSubView ? 'Back to Settings' : 'Back to Home';
  // The settings sub-page the user is currently on, so the bottom-sheet settings
  // list can highlight it and scroll it into view when the navbar opens.
  const currentSettingsSlug = useMemo<SettingsSlug | null>(() => {
    if (pathname === '/profile') return 'profile';
    if (pathname.startsWith('/settings/')) {
      const slug = pathname.split('/')[2];
      return slug && isSettingsSlug(slug) ? slug : null;
    }
    return null;
  }, [pathname]);
  const isBottomSurfaceEngaged = statusExpanded || isBottomSheetDragging;
  const sheetOpenProgress = isBottomSheetDragging ? bottomSheetDragProgress : (statusExpanded ? 1 : 0);
  const isSheetVisible = sheetOpenProgress > 0.001;
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { visibleSections } = useHomeCenterPrefs();
  // Pulse the status pill when a toast nudges attention to the command center
  // (e.g. an unattended device-discovery toast), mirroring the desktop StatusBar.
  const [statusPulsing, setStatusPulsing] = useState(false);
  const statusPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeStatusPulse((section) => {
      // A section-less pulse is a generic attention nudge — always pulse.
      if (section && !visibleSections.includes(section)) return;
      if (statusPulseTimer.current) clearTimeout(statusPulseTimer.current);
      // Drop the class for a frame so back-to-back pulses restart the animation.
      setStatusPulsing(false);
      requestAnimationFrame(() => setStatusPulsing(true));
      statusPulseTimer.current = setTimeout(() => setStatusPulsing(false), 2000);
    });
    return () => {
      unsubscribe();
      if (statusPulseTimer.current) clearTimeout(statusPulseTimer.current);
    };
  }, [visibleSections]);
  const matchingEntities = useHomeAssistantSelector(
    (entities) => selectMatchingEntities(entities, expandedSearchQuery),
    areEntitySearchMatchesEqual
  );
  const effectiveHideProgress = disableAutoHide || isRevealed || isBottomSurfaceEngaged
    ? 0
    : hideFromInactivity
      ? 1
      : scrollHideProgress;
  const bottomRowVisibleRatio = 1 - effectiveHideProgress;
  const isBottomRowHidden = bottomRowVisibleRatio <= 0.02;
  const getEntityPictureUrl = useCallback(
    (picture?: string, fallback?: string) => resolveEntityPictureUrl(haUrl, picture) ?? fallback,
    [haUrl]
  );

  const setClampedHideProgress = useCallback((nextProgress: number) => {
    const clamped = Math.max(0, Math.min(1, nextProgress));
    scrollHideProgressRef.current = clamped;
    setScrollHideProgress((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped));
  }, []);

  const setBottomSheetDragProgressClamped = useCallback((nextProgress: number) => {
    const clamped = Math.max(0, Math.min(1, nextProgress));
    bottomSheetDragProgressRef.current = clamped;
    setBottomSheetDragProgress((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped));
  }, []);

  useEffect(() => {
    onNavAutoHiddenChange?.(effectiveHideProgress);
  }, [effectiveHideProgress, onNavAutoHiddenChange]);

  useEffect(() => {
    return () => {
      onNavAutoHiddenChange?.(0);
    };
  }, [onNavAutoHiddenChange]);

  // Scroll behavior
  useEffect(() => {
    let scrollable: HTMLElement | null = null;
    let attachRetryRaf: number | null = null;
    const clearScrollSnapTimer = () => {
      if (scrollSnapTimerRef.current) {
        clearTimeout(scrollSnapTimerRef.current);
        scrollSnapTimerRef.current = null;
      }
    };
    const resetScrollTracking = () => {
      lastScrollTopRef.current = null;
      clearScrollSnapTimer();
    };

    // Freeze: hold the current progress, ignore scroll while a toast is up.
    if (freezeAutoHide) {
      resetScrollTracking();
      return;
    }

    if (disableAutoHide || isRevealed || isBottomSurfaceEngaged) {
      resetScrollTracking();
      queueMicrotask(() => {
        setClampedHideProgress(0);
        setHideFromInactivity(false);
      });
      return;
    }

    const HIDE_PROGRESS_DISTANCE_PX = 48;
    const SHOW_PROGRESS_DISTANCE_PX = 32;
    const SCROLL_SNAP_DELAY_MS = 120;
    // Gap of inactivity that marks the next scroll event as a fresh gesture.
    const GESTURE_GAP_MS = 180;
    let lastScrollTime = 0;

    const clearInactivityHide = () => {
      setHideFromInactivity((hidden) => (hidden ? false : hidden));
    };

    const snapByMidpoint = () => {
      const visibleRatio = 1 - scrollHideProgressRef.current;
      setClampedHideProgress(visibleRatio > 0.5 ? 0 : 1);
    };

    const scheduleScrollSnap = () => {
      clearScrollSnapTimer();
      scrollSnapTimerRef.current = setTimeout(() => {
        scrollSnapTimerRef.current = null;
        snapByMidpoint();
      }, SCROLL_SNAP_DELAY_MS);
    };

    const handleScroll = () => {
      if (!scrollable) return;

      const now = Date.now();
      const isNewGesture = now - lastScrollTime > GESTURE_GAP_MS;
      lastScrollTime = now;

      const nextScrollTop = scrollable.scrollTop;
      const prevScrollTop = lastScrollTopRef.current ?? nextScrollTop;
      lastScrollTopRef.current = nextScrollTop;

      clearInactivityHide();

      if (nextScrollTop <= 2) {
        clearScrollSnapTimer();
        setClampedHideProgress(0);
        return;
      }

      // Starting a fresh scroll gesture while the nav is hidden reveals it,
      // regardless of direction. Continued scrolling then drives hide/show by delta.
      if (isNewGesture && scrollHideProgressRef.current > 0.02) {
        setClampedHideProgress(0);
        scheduleScrollSnap();
        return;
      }

      const deltaY = nextScrollTop - prevScrollTop;
      if (Math.abs(deltaY) >= 0.5) {
        const progressDelta =
          deltaY < 0
            ? deltaY / SHOW_PROGRESS_DISTANCE_PX
            : deltaY / HIDE_PROGRESS_DISTANCE_PX;
        setClampedHideProgress(scrollHideProgressRef.current + progressDelta);
      }

      scheduleScrollSnap();
    };

    const attach = () => {
      const nextScrollable = getDashboardScrollableForPath(pathname);
      if (!nextScrollable) return false;
      scrollable = nextScrollable;
      resetScrollTracking();
      lastScrollTopRef.current = scrollable.scrollTop;
      scrollable.addEventListener('scroll', handleScroll, { passive: true });
      return true;
    };

    let attempts = 0;
    const maxAttempts = 45;
    const tryAttach = () => {
      if (attach()) return;
      attempts += 1;
      if (attempts <= maxAttempts) {
        attachRetryRaf = requestAnimationFrame(tryAttach);
      }
    };

    tryAttach();

    return () => {
      if (attachRetryRaf !== null) cancelAnimationFrame(attachRetryRaf);
      if (scrollable) {
        scrollable.removeEventListener('scroll', handleScroll);
      }
      resetScrollTracking();
    };
  }, [disableAutoHide, freezeAutoHide, isBottomSurfaceEngaged, isRevealed, pathname, setClampedHideProgress]);

  // Inactivity detection for hiding bottom row after 10s
  useEffect(() => {
    // Freeze: don't start the inactivity timer or alter state while a toast is up.
    if (freezeAutoHide) return;

    if (disableAutoHide || isRevealed || isBottomSurfaceEngaged) {
      queueMicrotask(() => {
        setHideFromInactivity(false);
      });
      return;
    }

    let scrollable: HTMLElement | null = null;
    let attachRetryRaf: number | null = null;

    const resetInactivityTimer = () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }

      setHideFromInactivity((hidden) => (hidden ? false : hidden));

      inactivityTimer.current = setTimeout(() => {
        if (!isRevealed && !isBottomSurfaceEngaged) {
          setHideFromInactivity(true);
          setClampedHideProgress(1);
        }
      }, 10000); // 10 seconds
    };

    // Start the timer initially
    resetInactivityTimer();

    // Reset on user interactions
    const events = ['touchstart', 'touchmove'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    // Attach scroll listener once the active route's scrollable area is mounted.
    const attachScrollable = () => {
      const nextScrollable = getDashboardScrollableForPath(pathname);
      if (!nextScrollable) return false;
      scrollable = nextScrollable;
      scrollable.addEventListener('scroll', resetInactivityTimer, { passive: true });
      return true;
    };

    let attempts = 0;
    const maxAttempts = 45;
    const tryAttach = () => {
      if (attachScrollable()) return;
      attempts += 1;
      if (attempts <= maxAttempts) {
        attachRetryRaf = requestAnimationFrame(tryAttach);
      }
    };

    tryAttach();

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      if (attachRetryRaf !== null) {
        cancelAnimationFrame(attachRetryRaf);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
      if (scrollable) {
        scrollable.removeEventListener('scroll', resetInactivityTimer);
      }
    };
  }, [disableAutoHide, freezeAutoHide, isBottomSurfaceEngaged, isRevealed, pathname, setClampedHideProgress]);

  // Publish the nav's rendered height so the corner toast can sit just above it.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty('--mobile-nav-height', `${el.offsetHeight}px`);
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(apply);
      ro.observe(el);
    }
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--mobile-nav-height');
    };
  }, []);

  // Bottom-edge gradient: shown only when dashboard content continues below the fold
  useEffect(() => {
    let scrollable: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let attachRetryRaf: number | null = null;
    let initialCheckRaf: number | null = null;
    const threshold = 10;

    const updateBottomEdgeGradient = () => {
      if (isRevealed || !scrollable) {
        setShowBottomEdgeGradient(false);
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      const hasOverflow = scrollHeight > clientHeight + threshold;
      const hasMoreBelow = scrollTop + clientHeight < scrollHeight - threshold;
      setShowBottomEdgeGradient(hasOverflow && hasMoreBelow);
    };

    const handleScroll = () => updateBottomEdgeGradient();
    const handleResize = () => updateBottomEdgeGradient();

    const attach = () => {
      const nextScrollable = getDashboardScrollableForPath(pathname);
      if (!nextScrollable) return false;

      scrollable = nextScrollable;
      scrollable.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => updateBottomEdgeGradient());
        resizeObserver.observe(scrollable);
        const contentRoot = scrollable.firstElementChild;
        if (contentRoot) {
          resizeObserver.observe(contentRoot);
        }
      }

      initialCheckRaf = requestAnimationFrame(updateBottomEdgeGradient);
      return true;
    };

    let attempts = 0;
    const maxAttempts = 30;

    const tryAttach = () => {
      if (attach()) return;
      attempts += 1;
      if (attempts <= maxAttempts) {
        attachRetryRaf = requestAnimationFrame(tryAttach);
      } else {
        setShowBottomEdgeGradient(false);
      }
    };

    tryAttach();

    return () => {
      if (attachRetryRaf !== null) cancelAnimationFrame(attachRetryRaf);
      if (initialCheckRaf !== null) cancelAnimationFrame(initialCheckRaf);
      window.removeEventListener('resize', handleResize);
      if (scrollable) scrollable.removeEventListener('scroll', handleScroll);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [pathname, isRevealed]);

  // Expanded bottom-nav content gradients: show fades when content overflows.
  useEffect(() => {
    if (!statusExpanded) {
      queueMicrotask(() => {
        setShowExpandedSurfaceTopGradient(false);
        setShowExpandedSurfaceBottomGradient(false);
      });
      return;
    }

    const scrollElement = expandedSurfaceScrollRef.current;
    if (!scrollElement) return;

    let resizeObserver: ResizeObserver | null = null;
    let initialCheckRaf: number | null = null;
    const threshold = 10;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const hasOverflow = scrollHeight > clientHeight + threshold;

      setShowExpandedSurfaceTopGradient(scrollTop > threshold);
      setShowExpandedSurfaceBottomGradient(
        hasOverflow && scrollTop + clientHeight < scrollHeight - threshold
      );
    };

    scrollElement.addEventListener('scroll', updateGradients, { passive: true });
    window.addEventListener('resize', updateGradients);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateGradients());
      resizeObserver.observe(scrollElement);

      const contentRoot = scrollElement.firstElementChild;
      if (contentRoot) {
        resizeObserver.observe(contentRoot);
      }
    }

    initialCheckRaf = requestAnimationFrame(updateGradients);

    return () => {
      if (initialCheckRaf !== null) cancelAnimationFrame(initialCheckRaf);
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [statusExpanded, expandedSurfaceTab]);

  // Activity list sheet gradients for overflowed lists.
  useEffect(() => {
    if (!activityListType) {
      queueMicrotask(() => {
        setShowActivityListTopGradient(false);
        setShowActivityListBottomGradient(false);
      });
      return;
    }

    const scrollElement = activityListScrollRef.current;
    if (!scrollElement) return;

    let resizeObserver: ResizeObserver | null = null;
    let initialCheckRaf: number | null = null;
    const threshold = 10;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const hasOverflow = scrollHeight > clientHeight + threshold;

      setShowActivityListTopGradient(scrollTop > threshold);
      setShowActivityListBottomGradient(
        hasOverflow && scrollTop + clientHeight < scrollHeight - threshold
      );
    };

    scrollElement.addEventListener('scroll', updateGradients, { passive: true });
    window.addEventListener('resize', updateGradients);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateGradients());
      resizeObserver.observe(scrollElement);

      const contentRoot = scrollElement.firstElementChild;
      if (contentRoot) {
        resizeObserver.observe(contentRoot);
      }
    }

    initialCheckRaf = requestAnimationFrame(updateGradients);

    return () => {
      if (initialCheckRaf !== null) cancelAnimationFrame(initialCheckRaf);
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [activityListType]);

  const closeExpandedSurface = useCallback(() => {
    setIsBottomSheetDragging(false);
    setBottomSheetDragProgress(0);
    bottomSheetDragProgressRef.current = 0;
    bottomSheetTouchStartY.current = null;
    bottomSheetPullDistance.current = 0;
    setStatusExpanded(false);
    setExpandedWidgetId(null);
    setExpandedWidgetType(null);
    exitArrange();
    setExpandedSurfaceTab((tab) => {
      if (tab === 'widget') return 'dashboards';
      if (tab === 'search' || tab === 'settings') return 'dashboard';
      return tab;
    });
  }, [exitArrange]);

  // Screensaver clears the expanded bottom sheet like any other surface.
  useCloseOnScreensaver(statusExpanded, closeExpandedSurface);

  // Close the bottom sheet before navigating (shared Home Center sections).
  const navigateFromSurface = useCallback((path: string) => {
    closeExpandedSurface();
    router.push(path);
  }, [closeExpandedSurface, router]);

  const openExpandedSurface = useCallback(
    (tab: BottomSurfaceTab) => {
      if (statusExpanded && expandedSurfaceTab === tab) {
        closeExpandedSurface();
        return;
      }
      setIsBottomSheetDragging(false);
      setBottomSheetDragProgress(0);
      bottomSheetDragProgressRef.current = 0;
      if (isRevealed) close();
      if (searchOpen) closeSearch();
      setActivityListType(null);
      if (tab !== 'widget') {
        setExpandedWidgetId(null);
        setExpandedWidgetType(null);
      }
      setExpandedSurfaceTab(tab);
      if (tab === 'search') setExpandedSearchQuery('');
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        // Settings scrolls to the active sub-page instead of resetting to top.
        if (tab === 'settings' && currentSettingsSlug) return;
        if (expandedSurfaceScrollRef.current) {
          expandedSurfaceScrollRef.current.scrollTop = 0;
        }
      });
    },
    [close, closeExpandedSurface, closeSearch, currentSettingsSlug, expandedSurfaceTab, isRevealed, searchOpen, statusExpanded]
  );

  const openWidgetSurface = useCallback(
    (type: WidgetSurfaceType, entityId: string) => {
      setIsBottomSheetDragging(false);
      setBottomSheetDragProgress(0);
      bottomSheetDragProgressRef.current = 0;
      if (isRevealed) close();
      if (searchOpen) closeSearch();
      setActivityListType(null);
      setExpandedWidgetType(type);
      setExpandedWidgetId(entityId);

      if (type === 'release') setSelectedReleaseId(entityId);
      else if (type === 'media') setSelectedMediaId(entityId);
      else if (type === 'timer') setSelectedTimerId(entityId);
      else if (type === 'camera') setSelectedCameraId(entityId);
      else setSelectedPrinterId(entityId);

      setExpandedSurfaceTab('widget');
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        if (expandedSurfaceScrollRef.current) {
          expandedSurfaceScrollRef.current.scrollTop = 0;
        }
      });
    },
    [close, closeSearch, isRevealed, searchOpen]
  );

  const toggleWidgetSurface = useCallback(
    (type: WidgetSurfaceType, entityId: string) => {
      const isAlreadyOpen =
        statusExpanded &&
        expandedSurfaceTab === 'widget' &&
        expandedWidgetType === type &&
        expandedWidgetId === entityId;

      if (isAlreadyOpen) {
        closeExpandedSurface();
        return;
      }

      openWidgetSurface(type, entityId);
    },
    [
      closeExpandedSurface,
      expandedSurfaceTab,
      expandedWidgetId,
      expandedWidgetType,
      openWidgetSurface,
      statusExpanded,
    ]
  );

  // Shared drag handle behavior:
  // collapsed -> drag up to open, expanded -> drag down to close.
  useEffect(() => {
    const handle = bottomSheetHandleRef.current;
    if (!handle) return;

    const getDragRangePx = () => {
      if (typeof window === 'undefined') return 280;
      return Math.max(180, Math.min(380, window.innerHeight * 0.35));
    };

    const reset = () => {
      bottomSheetTouchStartY.current = null;
      bottomSheetPullDistance.current = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      bottomSheetTouchStartY.current = touch.clientY;
      bottomSheetPullDistance.current = 0;
      setIsBottomSheetDragging(true);
      setBottomSheetDragProgressClamped(statusExpanded ? 1 : 0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (bottomSheetTouchStartY.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const currentY = touch.clientY;
      const deltaY = currentY - bottomSheetTouchStartY.current;
      const dragRange = getDragRangePx();

      if (statusExpanded) {
        const downwardPull = Math.max(0, deltaY);
        bottomSheetPullDistance.current = downwardPull;
        setBottomSheetDragProgressClamped(1 - downwardPull / dragRange);
        if (downwardPull > 0) {
          if (e.cancelable) e.preventDefault();
        }
      } else {
        const upwardPull = Math.max(0, -deltaY);
        bottomSheetPullDistance.current = upwardPull;
        setBottomSheetDragProgressClamped(upwardPull / dragRange);
        if (upwardPull > 0) {
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    const onTouchEnd = () => {
      if (bottomSheetTouchStartY.current === null) return;
      const nextOpen = statusExpanded
        ? bottomSheetDragProgressRef.current > 0.5
        : bottomSheetDragProgressRef.current >= 0.35;

      if (nextOpen) {
        if (!statusExpanded) {
          openExpandedSurface(expandedSurfaceTab);
        }
      } else {
        closeExpandedSurface();
      }
      reset();
      requestAnimationFrame(() => {
        setIsBottomSheetDragging(false);
        setBottomSheetDragProgressClamped(0);
      });
    };

    const onTouchCancel = () => {
      reset();
      setIsBottomSheetDragging(false);
      setBottomSheetDragProgressClamped(0);
    };

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    handle.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove', onTouchMove);
      handle.removeEventListener('touchend', onTouchEnd);
      handle.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [
    closeExpandedSurface,
    expandedSurfaceTab,
    openExpandedSurface,
    setBottomSheetDragProgressClamped,
    statusExpanded,
  ]);



  const userAvatar = useMemo(() => {
    if (activityData.user) {
      return {
        picture: resolveEntityPictureUrl(haUrl, activityData.user.picture),
        initials: activityData.user.initials,
      };
    }
    return { picture: undefined, initials: 'U' };
  }, [activityData.user, haUrl]);

  const allActiveReleaseNotes = activityData.activeReleaseNotes;

  const visibleReleaseNotes = useMemo(
    () => allActiveReleaseNotes.filter((note) => dismissedReleaseNotes[note.entityId] !== note.updatedAt),
    [allActiveReleaseNotes, dismissedReleaseNotes]
  );

  // Get active release note (selected or first)
  const activeRelease = useMemo(() => {
    if (visibleReleaseNotes.length === 0) return null;
    const found = selectedReleaseId ? visibleReleaseNotes.find((note) => note.entityId === selectedReleaseId) : null;
    return found || visibleReleaseNotes[0];
  }, [selectedReleaseId, visibleReleaseNotes]);

  const allActiveMedia = activityData.activePlayers;

  // Get active media player with image (selected or first)
  const activeMedia = useMemo(() => {
    if (allActiveMedia.length === 0) return null;
    const found = selectedMediaId ? allActiveMedia.find(m => m.entityId === selectedMediaId) : null;
    return found || allActiveMedia[0];
  }, [allActiveMedia, selectedMediaId]);

  // Count active media players
  const activeMediaCount = allActiveMedia.length;

  const allActiveTimers = useMemo(() => activityData.activeTimers.map((timer) => ({
    ...timer,
    isPaused: timer.state === 'paused',
  })), [activityData.activeTimers]);

  // Get active timer (selected or first)
  const activeTimer = useMemo(() => {
    if (allActiveTimers.length === 0) return null;
    const found = selectedTimerId ? allActiveTimers.find(t => t.entityId === selectedTimerId) : null;
    return found || allActiveTimers[0];
  }, [allActiveTimers, selectedTimerId]);

  const allActiveCameras = activityData.activeCameras;

  // Get active camera (selected or first)
  const activeCamera = useMemo(() => {
    if (allActiveCameras.length === 0) return null;
    const found = selectedCameraId ? allActiveCameras.find(c => c.entityId === selectedCameraId) : null;
    return found || allActiveCameras[0];
  }, [allActiveCameras, selectedCameraId]);

  const allActivePrinters = activityData.activePrinters;

  // Get active printer (selected or first)
  const activePrinter = useMemo(() => {
    if (allActivePrinters.length === 0) return null;
    const found = selectedPrinterId ? allActivePrinters.find(p => p.entityId === selectedPrinterId) : null;
    return found || allActivePrinters[0];
  }, [allActivePrinters, selectedPrinterId]);

  // Derive visibility
  const showReleaseWidget = !!activeRelease;
  const showMediaWidget = !!activeMedia;
  const showTimerWidget = !!activeTimer;
  const showCameraWidget = !!activeCamera;
  const showPrinterWidget = !!activePrinter;

  // Live activities are capped in the mobile navbar. Types past the cap collapse
  // into a "+N" overflow pill that opens the combined Active Now sheet. Order here
  // mirrors the render order below so the first-N kept are the ones shown.
  const MAX_VISIBLE_ACTIVITIES = 2;
  const activeWidgetTypes = useMemo<WidgetSurfaceType[]>(
    () =>
      (
        [
          showReleaseWidget ? 'release' : null,
          showCameraWidget ? 'camera' : null,
          showPrinterWidget ? 'printer' : null,
          showMediaWidget ? 'media' : null,
          showTimerWidget ? 'timer' : null,
        ] as Array<WidgetSurfaceType | null>
      ).filter((t): t is WidgetSurfaceType => t !== null),
    [showReleaseWidget, showCameraWidget, showPrinterWidget, showMediaWidget, showTimerWidget]
  );
  const visibleActivityTypes = activeWidgetTypes.slice(0, MAX_VISIBLE_ACTIVITIES);
  const activityOverflowCount = activeWidgetTypes.length - visibleActivityTypes.length;
  const hasActivityOverflow = activityOverflowCount > 0;

  // Handle media widget fade in/out
  // Visibility handles by render logic above

  // Handle timer widget fade in/out
  // Visibility handles by render logic above

  // Handle camera widget fade in/out
  // Visibility handles by render logic above

  // Handle printer widget fade in/out
  // Visibility handles by render logic above

  // Update timer progress every second
  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    const updateProgress = () => {
      if (activeTimer.state === 'active' && activeTimer.finishesAt) {
        const finishTime = new Date(activeTimer.finishesAt).getTime();
        const now = Date.now();
        const remainingSec = Math.max(0, Math.floor((finishTime - now) / 1000));
        const progress = activeTimer.durationSec > 0 ? remainingSec / activeTimer.durationSec : 0;
        setTimerProgress(progress);
      } else {
        const remainingSec = parseTime(activeTimer.remaining);
        const progress = activeTimer.durationSec > 0 ? remainingSec / activeTimer.durationSec : 0;
        setTimerProgress(progress);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [activeTimer, activeTimer?.finishesAt, activeTimer?.state, activeTimer?.durationSec, activeTimer?.remaining]);

  // Active counts derived from all-active arrays
  const activeReleaseCount = visibleReleaseNotes.length;
  const activeTimerCount = allActiveTimers.length;
  const activeCameraCount = allActiveCameras.length;
  const activePrinterCount = allActivePrinters.length;
  const displayedTimerProgress = activeTimer ? timerProgress : 0;
  
  // Home is pinned first in its own cell; the rest carry the session arrange
  // order + soft-hides. Soft-hidden items also drop out of search.
  const homeItem = useMemo(() => items.find((item) => item && item.urlPath === '/'), [items]);
  const dashboards = useMemo(
    () => arrangeItems(items.filter((item) => item && !item.isApp && item.urlPath !== '/'), order, hiddenIds),
    [items, order, hiddenIds]
  );
  const apps = useMemo(
    () => arrangeItems(items.filter((item) => item && item.isApp), order, hiddenIds),
    [items, order, hiddenIds]
  );
  const searchDashboards = useMemo(
    () => (homeItem ? [homeItem, ...dashboards] : dashboards),
    [homeItem, dashboards]
  );

  const allVisibleArrangeIds = useMemo(
    () => [...dashboards, ...apps].map((item) => item.id),
    [dashboards, apps]
  );
  const dashboardIds = useMemo(() => dashboards.map((item) => item.id), [dashboards]);
  const appIds = useMemo(() => apps.map((item) => item.id), [apps]);

  const handleDashboardDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = dashboardIds.indexOf(active.id as string);
      const newIndex = dashboardIds.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      haptic('impact');
      reorderVisible(allVisibleArrangeIds, dashboardIds, arrayMove(dashboardIds, oldIndex, newIndex));
    },
    [dashboardIds, allVisibleArrangeIds, reorderVisible]
  );

  const handleAppDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = appIds.indexOf(active.id as string);
      const newIndex = appIds.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      haptic('impact');
      reorderVisible(allVisibleArrangeIds, appIds, arrayMove(appIds, oldIndex, newIndex));
    },
    [appIds, allVisibleArrangeIds, reorderVisible]
  );

  const dashboardSearchResults = useMemo<SearchResultItem[]>(() => {
    if (!expandedSearchQuery.trim()) return [];
    const query = expandedSearchQuery.trim().toLowerCase();

    const matchingDashboards = searchDashboards
      .filter(item => item.title.toLowerCase().includes(query))
      .map(item => ({
        id: item.id,
        type: 'dashboard' as const,
        name: item.title,
        subtitle: 'Dashboard',
        icon: item.icon,
        href: item.urlPath,
      }));

    const matchingApps = apps
      .filter(item => item.title.toLowerCase().includes(query))
      .map(item => ({
        id: item.id,
        type: 'app' as const,
        name: item.title,
        subtitle: 'Application',
        icon: item.icon,
        href: item.urlPath,
      }));

    const matchingEntityResults = matchingEntities.map((entity) => ({
      id: entity.id,
      type: 'entity' as const,
      name: entity.name,
      subtitle: `${entity.id} · ${entity.state}`,
    }));

    return [...matchingDashboards, ...matchingApps, ...matchingEntityResults];
  }, [apps, searchDashboards, expandedSearchQuery, matchingEntities]);

  const dashboardSearchSuggestions = useMemo<SearchResultItem[]>(() => {
    return [
      ...searchDashboards.slice(0, 4).map(item => ({
        id: `dashboard-${item.id}`,
        type: 'dashboard' as const,
        name: item.title,
        subtitle: 'Dashboard',
        icon: item.icon,
        href: item.urlPath,
      })),
      ...apps.slice(0, 4).map(item => ({
        id: `app-${item.id}`,
        type: 'app' as const,
        name: item.title,
        subtitle: 'Application',
        icon: item.icon,
        href: item.urlPath,
      })),
    ];
  }, [apps, searchDashboards]);


  const expandedSearchItems = expandedSearchQuery.trim()
    ? dashboardSearchResults
    : dashboardSearchSuggestions;
  const showSearchEmptyState = expandedSearchQuery.trim().length > 0 && expandedSearchItems.length === 0;

  const renderExpandedSurfaceContent = () => {
    if (expandedSurfaceTab === 'dashboards') {
      return (
        <div className="space-y-ha-4">
          <div>
            <div className="flex items-center justify-between mb-ha-3">
              <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider">Dashboards</div>
              {arranging && (
                <button
                  type="button"
                  onClick={exitArrange}
                  className="flex items-center gap-1 h-7 pl-ha-2 pr-ha-3 rounded-full bg-ha-blue text-white text-[11px] font-bold uppercase tracking-wider active:scale-95 transition-transform"
                >
                  <Icon path={mdiCheck} size={14} />
                  Done
                </button>
              )}
            </div>
            <DndContext
              sensors={arrangeSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDashboardDragEnd}
            >
              <div className="grid grid-cols-3 gap-ha-3">
                {homeItem && (
                  <MobileDashboardCard
                    item={homeItem}
                    index={-1}
                    isActive={isNavItemActive(pathname, homeItem.urlPath)}
                    arranging={arranging}
                    pinned
                    onClose={closeExpandedSurface}
                    onEnterArrange={enterArrange}
                    onRequestDelete={setPendingDelete}
                  />
                )}
                <SortableContext items={dashboardIds} strategy={rectSortingStrategy}>
                  {dashboards.map((dashboard, index) => (
                    <MobileDashboardCard
                      key={dashboard.id}
                      item={dashboard}
                      index={index}
                      isActive={isNavItemActive(pathname, dashboard.urlPath)}
                      arranging={arranging}
                      onClose={closeExpandedSurface}
                      onEnterArrange={enterArrange}
                      onRequestDelete={setPendingDelete}
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          </div>

          <div className="h-px bg-border-default" />

          <div>
            <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-ha-2">Applications</div>
            <DndContext
              sensors={arrangeSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleAppDragEnd}
            >
              <SortableContext items={appIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-5 gap-x-ha-2 gap-y-ha-1.5">
                  {apps.map((app, index) => (
                    <MobileAppTile
                      key={app.id}
                      item={app}
                      index={index}
                      isActive={isNavItemActive(pathname, app.urlPath)}
                      arranging={arranging}
                      onClose={closeExpandedSurface}
                      onEnterArrange={enterArrange}
                      onRequestDelete={setPendingDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      );
    }

    if (expandedSurfaceTab === 'search') {
      return (
        <div className="space-y-ha-5 pb-ha-2">
          <div className="flex items-center gap-ha-3">
            <SearchField
              value={expandedSearchQuery}
              onChange={setExpandedSearchQuery}
              placeholder="Search dashboards, apps, entities..."
              className="flex-1"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={closeExpandedSurface}
              className="w-11 h-11 rounded-ha-xl border border-surface-low/80 bg-surface-low flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-mid/40 transition-colors"
            >
              <Icon path={mdiClose} size={20} />
            </button>
          </div>

          {!showSearchEmptyState && (
            <div className="space-y-ha-2">
              <p className="text-[13px] font-bold text-text-tertiary uppercase tracking-wider px-ha-2">
                {expandedSearchQuery.trim() ? 'Results' : 'Suggestions'}
              </p>
              <div className="bg-surface-low rounded-ha-2xl border border-surface-low/80 overflow-hidden">
                {expandedSearchItems.map(result => {
                  const content = (
                    <>
                      <div className={`w-10 h-10 rounded-ha-xl flex items-center justify-center flex-shrink-0 bg-surface-mid text-text-secondary transition-colors ${result.href ? 'group-hover:bg-surface-lower group-hover:text-text-primary' : ''}`}>
                        {result.type === 'entity' ? (
                          <Icon path={mdiDevices} size={20} />
                        ) : result.icon ? (
                          <MdiIcon icon={result.icon} size={20} className="text-ha-blue" />
                        ) : (
                          <HALogo size={18} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-text-primary leading-tight truncate">{result.name}</p>
                        <p className="text-sm text-text-secondary truncate mt-0.5">{result.subtitle}</p>
                      </div>
                      {result.href && <Icon path={mdiChevronRight} size={22} className="text-text-disabled" />}
                    </>
                  );

                  if (result.href) {
                    return (
                      <Link prefetch={false}
                        key={result.id}
                        href={result.href}
                        onClick={closeExpandedSurface}
                        className="w-full flex items-center gap-ha-4 px-ha-4 py-ha-4 text-left transition-colors group min-h-[64px] border-b border-surface-low/40 last:border-0 hover:bg-surface-mid/50 active:bg-surface-mid"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={result.id}
                      className="w-full flex items-center gap-ha-4 px-ha-4 py-ha-4 min-h-[64px] border-b border-surface-low/40 last:border-0"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showSearchEmptyState && (
            <div className="bg-surface-low rounded-ha-2xl border border-surface-low/80 text-center py-10 px-ha-4">
              <Icon path={mdiMagnify} size={36} className="text-text-tertiary mx-auto mb-ha-2" />
              <p className="text-sm text-text-secondary">No results for &ldquo;{expandedSearchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      );
    }

    if (expandedSurfaceTab === 'widget') {
      if (expandedWidgetType === 'release' && activeRelease) {
        return (
          <div className="space-y-ha-4 pb-ha-2">
            <div className="bg-surface-low rounded-ha-xl border border-green-500/20 p-ha-4">
              <div className="text-[13px] font-bold text-green-600 uppercase tracking-widest mb-ha-3">What&apos;s New</div>
              <div className="rounded-ha-xl bg-green-500/10 border border-green-500/20 p-ha-3 mb-ha-4">
                <p className="text-[13px] font-bold text-green-600 uppercase tracking-widest mb-1">{activeRelease.version}</p>
                <h4 className="text-sm font-bold text-text-primary mb-1">{activeRelease.name}</h4>
                <p className="text-xs text-text-secondary">{activeRelease.summary}</p>
              </div>
              <div className="space-y-ha-2 mb-ha-4">
                {(activeRelease.notes.length > 0 ? activeRelease.notes : ['No release notes available.']).map((note, index) => (
                  <div key={`${activeRelease.entityId}-note-${index}`} className="flex gap-ha-2 text-xs text-text-secondary">
                    <span className="text-green-600 font-bold">{index + 1}.</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const remaining = visibleReleaseNotes.filter((note) => note.entityId !== activeRelease.entityId);
                  setDismissedReleaseNotes((prev) => {
                    if (prev[activeRelease.entityId] === activeRelease.updatedAt) return prev;
                    return { ...prev, [activeRelease.entityId]: activeRelease.updatedAt };
                  });

                  if (remaining.length > 0) {
                    setSelectedReleaseId(remaining[0].entityId);
                    setExpandedWidgetId(remaining[0].entityId);
                    return;
                  }

                  setSelectedReleaseId(null);
                  closeExpandedSurface();
                }}
                className="w-full h-11 rounded-ha-xl bg-green-600 text-white text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform"
              >
                Dismiss Notes
              </button>
            </div>
          </div>
        );
      }

      if (expandedWidgetType === 'camera' && activeCamera) {
        return (
          <div className="space-y-ha-4 pb-ha-2">
            <div className="bg-surface-low rounded-ha-xl border border-surface-mid overflow-hidden">
              <div className="bg-surface-mid/60 p-ha-3 flex items-center gap-2 border-b border-surface-low">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[13px] font-bold text-text-primary uppercase tracking-widest">Live Feed</span>
              </div>
              <div className="w-full aspect-video bg-black relative">
                <img src={getEntityPictureUrl(activeCamera.entityPicture, '/camera_doorbell.png')} alt={activeCamera.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-ha-4">
                <h4 className="text-sm font-bold text-text-primary mb-1">{activeCamera.name}</h4>
                <p className="text-xs text-red-500 font-bold uppercase tracking-tight mb-4">{activeCamera.event}</p>
                <button className="w-full h-12 rounded-ha-xl bg-ha-blue text-white text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                  <Icon path={mdiMicrophone} size={18} />
                  Talk to Doors
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (expandedWidgetType === 'printer' && activePrinter) {
        return (
          <div className="space-y-ha-4 pb-ha-2">
            <div className="bg-surface-low rounded-ha-xl border border-surface-mid p-ha-4">
              <div className="text-[13px] font-bold text-ha-blue uppercase tracking-widest mb-ha-3">3D Printing</div>
              <div className="w-full aspect-square rounded-ha-xl overflow-hidden mb-ha-4 border border-surface-mid">
                <img src={getEntityPictureUrl(activePrinter.entityPicture, '/printer_3d.png')} alt={activePrinter.name} className="w-full h-full object-cover" />
              </div>
              <div className="mb-ha-4">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-bold text-text-primary truncate">{activePrinter.fileName}</span>
                  <span className="text-xs font-mono font-bold text-ha-blue">{activePrinter.progress}%</span>
                </div>
                <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-mid/60">
                  <div className="bg-ha-blue h-full transition-all duration-500" style={{ width: `${activePrinter.progress}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between p-ha-3 bg-surface-mid/60 rounded-ha-xl">
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-text-disabled uppercase">Time Left</span>
                  <span className="text-sm font-mono font-bold text-text-primary">{activePrinter.remainingTime}</span>
                </div>
                <button className="h-10 px-4 bg-red-500/10 text-red-500 rounded-ha-lg font-bold text-xs uppercase transition-colors hover:bg-red-500 hover:text-white">
                  Stop
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (expandedWidgetType === 'media' && activeMedia) {
        return (
          <div className="space-y-ha-4 pb-ha-2">
            <div className="bg-surface-low rounded-ha-xl border border-surface-mid p-ha-4">
              <div className="text-[13px] font-bold text-ha-blue uppercase tracking-widest mb-ha-3">Now Playing</div>
              <div className="w-full aspect-square rounded-ha-xl overflow-hidden mb-ha-5 border border-surface-mid">
                <img
                  src={getEntityPictureUrl(activeMedia.entityPicture)}
                  alt={activeMedia.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-full flex items-center justify-center gap-ha-6 mb-ha-2">
                <Icon path={mdiSkipPrevious} size={28} className="text-text-primary" />
                <button
                  className="w-14 h-14 rounded-full bg-ha-blue text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  onClick={() =>
                    callService({
                      domain: 'media_player',
                      service: activeMedia.state === 'playing' ? 'media_pause' : 'media_play',
                      target: { entity_id: activeMedia.entityId },
                    })
                  }
                >
                  <Icon path={activeMedia.state === 'playing' ? mdiPause : mdiPlay} size={32} />
                </button>
                <Icon path={mdiSkipNext} size={28} className="text-text-primary" />
              </div>
            </div>
          </div>
        );
      }

      if (expandedWidgetType === 'timer' && activeTimer) {
        return (
          <div className="space-y-ha-4 pb-ha-2">
            <div className="bg-surface-low rounded-ha-xl border border-surface-mid p-ha-4 flex flex-col items-center">
              <div className="text-[13px] font-bold text-ha-blue uppercase tracking-widest mb-ha-3 self-start">Timer</div>
              <div className="relative mb-ha-5">
                <CircularProgress
                  progress={displayedTimerProgress}
                  size={140}
                  strokeWidth={6}
                  className={activeTimer.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                  trackClassName={activeTimer.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-mono text-text-primary tracking-tighter">
                    {activeTimer.remaining}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-ha-3 w-full">
                <button className="h-11 rounded-ha-xl bg-surface-mid text-text-secondary font-bold text-xs uppercase tracking-wider">Cancel</button>
                <button className={`h-11 rounded-ha-xl font-bold text-xs uppercase tracking-wider text-white ${activeTimer.isPaused ? 'bg-ha-blue' : 'bg-yellow-500'}`}>
                  {activeTimer.isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="text-center py-10">
          <Icon path={mdiViewDashboardOutline} size={36} className="text-text-tertiary mx-auto mb-ha-2" />
          <p className="text-sm text-text-secondary">No active widget selected.</p>
        </div>
      );
    }

    if (expandedSurfaceTab === 'chat') {
      return (
        <div className="flex flex-col h-full min-h-[50vh]">
           <div className="flex flex-col gap-ha-4 justify-center items-center text-center px-ha-4 flex-1">
              <div className="w-16 h-16 bg-ha-blue/10 rounded-full flex items-center justify-center mb-ha-2">
                 <Icon path={mdiMicrophone} size={32} className="text-ha-blue" />
              </div>
              <div>
                <h4 className="text-base font-bold text-text-primary mb-1">How can I help you?</h4>
                <p className="text-xs text-text-secondary">Try &quot;Turn off the kitchen lights&quot; or &quot;Show me the front door&quot;</p>
              </div>
           </div>

           <div className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill p-ha-1 mt-auto flex-shrink-0">
              <input type="text" placeholder="Type or speak..." className="flex-1 px-ha-4 text-sm text-text-primary bg-transparent outline-none focus:ring-0" />
              <button className="w-10 h-10 rounded-full bg-ha-blue flex items-center justify-center text-white shadow-md active:scale-95 transition-transform flex-shrink-0">
                <Icon path={mdiSend} size={18} />
              </button>
           </div>
        </div>
      );
    }

    if (expandedSurfaceTab === 'settings') {
      return (
        <div className="pb-8">
          <SettingsNavPanel
            activeSlug={currentSettingsSlug}
            autoScrollActiveIntoView
            bg="surface-default"
            onSelect={(slug) => {
              closeExpandedSurface();
              router.push(`/settings/${slug}`);
            }}
          />
        </div>
      );
    }

    // Home Center status surface — same shared sections as the desktop
    // StatusBar pop-up so both stay aligned (order/visibility follow prefs).
    return (
      <div className="space-y-ha-3 pb-8">
        <HomeCenterStatusSections onNavigate={navigateFromSurface} />
        <OpenHomeCenterButton onNavigate={navigateFromSurface} />
      </div>
    );
  };

  return (
    <>
    <nav
      ref={navRef}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-50 ${editModeFade || toolbarActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ paddingBottom: 'calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))' }}
      data-component="MobileNav"
      data-connection-status={connectionStatus ?? 'unknown'}
      onMouseEnter={() => {
        setClampedHideProgress(0);
        setHideFromInactivity(false);
      }}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[calc(9rem+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/45 via-black/18 to-transparent transition-opacity duration-300 ${
          showBottomEdgeGradient ? 'opacity-80' : 'opacity-55'
        }`}
      />
      <button
        type="button"
        aria-label="Close expanded panel"
        onClick={closeExpandedSurface}
        className={`fixed inset-0 backdrop-blur-[1px] transition-opacity duration-300 ${
          isSheetVisible ? 'z-0' : '-z-10'
        } ${
          statusExpanded && !isBottomSheetDragging ? '' : 'pointer-events-none'
        } bg-black/50`}
        style={{ opacity: isSheetVisible ? 1 : 0 }}
      />
      <div className="relative z-10 px-edge">
        <div className="mobile-nav-pill relative rounded-ha-3xl bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="relative rounded-[23px] bg-surface-default/95 backdrop-blur-md">
            <div className="flex flex-col px-edge pt-ha-1 pb-ha-4">
              <div className="flex justify-center py-0 mb-0 shrink-0">
                {/* Generous, mostly-invisible grab zone so a swipe that starts
                    anywhere near the pill's top edge reliably opens/closes the
                    sheet — the visible pill bar itself is only 28×4px. */}
                <button
                  ref={bottomSheetHandleRef}
                  type="button"
                  aria-label={sheetOpenProgress > 0.5 ? 'Collapse bottom panel' : 'Expand bottom panel'}
                  onClick={() => (statusExpanded ? closeExpandedSurface() : openExpandedSurface(expandedSurfaceTab))}
                  className="-my-ha-2 h-9 w-32 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none"
                >
                  <span className="w-7 h-1 rounded-full bg-text-secondary/30" />
                </button>
              </div>
              <div
                className={`overflow-hidden flex flex-col ${isSheetVisible ? 'mb-ha-1' : 'mb-0 pointer-events-none'}`}
                style={{
                  height: `calc(${sheetOpenProgress} * (100svh - 15rem))`,
                  opacity: Math.max(0, Math.min(1, sheetOpenProgress * 1.5)),
                  transition: isBottomSheetDragging
                    ? 'none'
                    : 'height 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                <div className="relative flex-1 min-h-0">
                  <div
                    className={`pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-surface-default via-surface-default/60 to-transparent z-20 transition-opacity duration-200 ${
                      showExpandedSurfaceTopGradient ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <div
                    className={`pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface-default via-surface-default/60 to-transparent z-20 transition-opacity duration-200 ${
                      showExpandedSurfaceBottomGradient ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <div
                    ref={expandedSurfaceScrollRef}
                    className="relative h-full overflow-y-auto px-ha-1 pt-ha-3 pb-ha-5"
                  >
                    {renderExpandedSurfaceContent()}
                  </div>
                </div>
              </div>
        {/* Top row: Ask your home + Media + Timer + Status */}
        <div className="flex items-center gap-ha-2 shrink-0">
          {showHomeBackButton && (
            <Link prefetch={false}
              href={backHref}
              aria-label={backLabel}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ha-blue/15 text-ha-blue ring-1 ring-ha-blue/30 shadow-[0_8px_16px_-12px_rgba(3,169,244,0.9)] active:scale-95 transition-transform"
            >
              <Icon path={mdiArrowLeft} size={20} />
            </Link>
          )}
          {/* Ask your home */}
          <div className="flex-1 min-w-0 h-10 relative">
            <button
              onClick={() => openExpandedSurface('chat')}
              className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill px-ha-3 h-full w-full active:scale-95 transition-transform"
            >
              <span className="text-sm text-text-disabled truncate flex-1 text-left">
                Ask <span className="text-text-tertiary/60 capitalize">{
                  pathname === '/' ? 'Home' :
                  pathname.startsWith('/dashboard/') ? pathname.split('/')[2] :
                  pathname.startsWith('/panel/') ? pathname.split('/')[2] :
                  'Home'
                }</span>...
              </span>
              <Icon path={mdiMicrophone} size={18} className="text-text-secondary" />
            </button>
          </div>

          {/* Release + Media + Timer + Camera + Printer widgets container */}
          {(showReleaseWidget || showMediaWidget || showTimerWidget || showCameraWidget || showPrinterWidget) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <AnimatePresence initial={false} mode="popLayout">
              {/* Release notes - always first */}
              {visibleActivityTypes.includes('release') && (
                <motion.div
                  key="release-widget"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className="relative"
                >
                  <motion.button
                    layoutId={activeRelease?.entityId}
                    onClick={() => {
                      if (activeReleaseCount > 1) {
                        setActivityListType('release');
                      } else if (activeRelease?.entityId) {
                        toggleWidgetSurface('release', activeRelease.entityId);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all bg-surface-low border ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'release' &&
                      expandedWidgetId === activeRelease?.entityId
                        ? 'border-green-600 ring-2 ring-green-600/25'
                        : 'border-transparent'
                    }`}
                  >
                    <Icon path={mdiUpdate} size={16} className="text-green-600" />
                    {activeReleaseCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeReleaseCount}
                      </span>
                    )}
                    {activeReleaseCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                        <Icon path={mdiUpdate} size={10} className="text-green-600" />
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Camera - show when alert */}
              {visibleActivityTypes.includes('camera') && (
                <motion.div
                  key="camera-widget"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className="relative"
                >
                  <motion.button 
                    layoutId={activeCamera?.entityId}
                    onClick={() => {
                      if (activeCameraCount > 1) {
                        setActivityListType('camera');
                      } else {
                        if (activeCamera?.entityId) toggleWidgetSurface('camera', activeCamera.entityId);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all bg-red-500/10 border ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'camera' &&
                      expandedWidgetId === activeCamera?.entityId
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : 'border-red-500/20'
                    }`}
                  >
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      <img
                        src={getEntityPictureUrl(activeCamera?.entityPicture, '/camera_doorbell.png')}
                        alt=""
                        className="w-full h-full object-cover animate-pulse"
                      />
                    </div>
                    {/* Count badge - always on top */}
                    {activeCameraCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeCameraCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    {activeCameraCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5 shadow-sm z-10 border border-surface-default">
                        <Icon path={mdiDoorbellVideo} size={10} className="text-white" />
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Printer - show when active */}
              {visibleActivityTypes.includes('printer') && (
                <motion.div
                  key="printer-widget"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className="relative"
                >
                  <motion.button 
                    layoutId={activePrinter?.entityId}
                    onClick={() => {
                      if (activePrinterCount > 1) {
                        setActivityListType('printer');
                      } else {
                        if (activePrinter?.entityId) toggleWidgetSurface('printer', activePrinter.entityId);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all bg-surface-low ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'printer' &&
                      expandedWidgetId === activePrinter?.entityId
                        ? 'ha-selected'
                        : ''
                    }`}
                  >
                    <CircularProgress
                      progress={(activePrinter?.progress || 0) / 100}
                      size={32}
                      strokeWidth={2.5}
                      className="text-ha-blue"
                      trackClassName="text-fill-primary-quiet"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                        <img src={getEntityPictureUrl(activePrinter?.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                      </div>
                    </CircularProgress>
                    {/* Count badge - always on top */}
                    {activePrinterCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activePrinterCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                      <Icon path={mdiPrinter3d} size={10} className="text-ha-blue" />
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {/* Media player - only show when playing/paused */}
              {visibleActivityTypes.includes('media') && (
                <motion.div
                  key="media-widget"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className="relative"
                >
                  <motion.button 
                    layoutId={activeMedia?.entityId}
                    onClick={() => {
                      if (activeMediaCount > 1) {
                        setActivityListType('media');
                      } else {
                        if (activeMedia?.entityId) toggleWidgetSurface('media', activeMedia.entityId);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 bg-surface-low transition-all ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'media' &&
                      expandedWidgetId === activeMedia?.entityId
                        ? 'ha-selected'
                        : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                      {activeMedia?.entityPicture ? (
                        <img src={getEntityPictureUrl(activeMedia.entityPicture)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icon path={mdiPlay} size={18} className="text-ha-blue" />
                      )}
                    </div>
                    {/* Count badge - always on top */}
                    {activeMediaCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeMediaCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                      <Icon
                        path={activeMedia?.state === 'playing' ? mdiPlay : mdiPause}
                        size={10}
                        className={activeMedia?.state === 'playing' ? 'text-ha-blue' : 'text-yellow-600'}
                      />
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {/* Timer - only show when active */}
              {visibleActivityTypes.includes('timer') && (
                <motion.div
                  key="timer-widget"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className="relative"
                >
                  <motion.button 
                    layoutId={activeTimer?.entityId}
                    onClick={() => {
                      if (activeTimerCount > 1) {
                        setActivityListType('timer');
                      } else {
                        if (activeTimer?.entityId) toggleWidgetSurface('timer', activeTimer.entityId);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all bg-surface-low ${
                    statusExpanded &&
                    expandedSurfaceTab === 'widget' &&
                    expandedWidgetType === 'timer' &&
                    expandedWidgetId === activeTimer?.entityId
                      ? 'ha-selected'
                      : ''
                  }`}>
                    <CircularProgress
                      progress={displayedTimerProgress}
                      size={32}
                      strokeWidth={2.5}
                      className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                      trackClassName={activeTimer?.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                    >
                      <Icon
                        path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                        size={14}
                        className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                      />
                    </CircularProgress>
                    {/* Count badge - always on top */}
                    {activeTimerCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center ring-1 ring-surface-default">
                        {activeTimerCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                      <Icon
                        path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                        size={10}
                        className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                      />
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {/* Overflow: types past the cap collapse into a "+N" pill → Active Now sheet */}
              {hasActivityOverflow && (
                <motion.div
                  key="activity-overflow"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => setActivityListType('all')}
                    aria-label={`Show ${activityOverflowCount} more ${activityOverflowCount === 1 ? 'activity' : 'activities'}`}
                    className="flex items-center justify-center rounded-full w-10 h-10 bg-surface-low border border-surface-lower text-text-secondary text-sm font-bold active:scale-95 transition-transform"
                  >
                    +{activityOverflowCount}
                  </button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )}

          {/* Status pill: icons - pushed to the right.
              Indicators follow Home Center prefs, same as the desktop pill. */}
          {(() => {
            const activeWidgetsCount = (showReleaseWidget ? 1 : 0) + (showMediaWidget ? 1 : 0) + (showTimerWidget ? 1 : 0) + (showCameraWidget ? 1 : 0) + (showPrinterWidget ? 1 : 0);
            // Always show at least two status icons; widen to 4 when no activities
            // are competing for navbar width.
            const maxIcons = activeWidgetsCount >= 1 ? 2 : 4;
            const hasMore = visibleSections.length > maxIcons;

            return (
              <button
                onClick={() => navigateFromSurface('/settings/home-center')}
                className={`flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-10 flex-shrink-0 ml-auto active:scale-95 transition-transform duration-300 ${statusPulsing ? 'ha-status-pulse' : ''}`}
              >
                <HomeCenterPillIndicators size={18} max={maxIcons} withTooltips={false} />

                {/* Chevron if more icons */}
                {hasMore && (
                  <Icon
                    path={mdiChevronRight}
                    size={18}
                    className="text-text-secondary"
                  />
                )}

              </button>
            );
          })()}
        </div>

        {/* Bottom row: Navigation pill */}
        <div
          className="overflow-hidden transition-[max-height,margin-top,opacity,transform] duration-120 ease-out shrink-0"
          style={{
            maxHeight: `${56 * bottomRowVisibleRatio}px`,
            marginTop: `${12 * bottomRowVisibleRatio}px`,
            opacity: bottomRowVisibleRatio,
            transform: `translateY(${8 * effectiveHideProgress}px)`,
            pointerEvents: isBottomRowHidden ? 'none' : 'auto',
          }}
        >
          <div className="mobile-nav-tabs flex items-center justify-around bg-surface-low rounded-ha-2xl px-ha-4 h-14">
            <button
              type="button"
              onClick={() => openExpandedSurface('dashboards')}
              className={`relative h-full px-ha-2 flex items-center justify-center text-text-secondary transition-colors ${
                isDashboardsActive ? 'text-text-primary' : 'hover:text-text-primary'
              }`}
            >
              <svg width="26" height="24" viewBox="0 0 20 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C18.2091 0 20 1.79086 20 4V14C20 16.2091 18.2091 18 16 18H4C1.79086 18 1.61066e-08 16.2091 0 14V4C0 1.79086 1.79086 6.44256e-08 4 0H16ZM4 11.5859C2.89546 11.5859 2.00004 12.4814 2 13.5859V14C2.00011 15.1045 2.8955 16 4 16H10V13.5859C9.99996 12.4814 9.10454 11.5859 8 11.5859H4ZM12 16H16C17.1046 16 18 15.1046 18 14V4C18 2.89543 17.1046 2 16 2H12V16ZM6.70703 2.29297C6.31652 1.9025 5.68348 1.9025 5.29297 2.29297L2.29297 5.29297C2.10552 5.48048 2.00002 5.73486 2 6V8.58594C2.0002 9.13805 2.44784 9.58594 3 9.58594H9C9.55216 9.58594 9.9998 9.13805 10 8.58594V6C9.99998 5.73486 9.89448 5.48048 9.70703 5.29297L6.70703 2.29297Z"/>
              </svg>
              <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-ha-blue transition-opacity ${
                isDashboardsActive ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
            <button
              type="button"
              onClick={() => openExpandedSurface('search')}
              className={`relative h-full px-ha-2 flex items-center justify-center transition-colors ${
                isSearchActive ? 'text-ha-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon path={mdiMagnify} size={28} />
              <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-ha-blue transition-opacity ${
                isSearchActive ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
            <button
              type="button"
              onClick={() => navigateFromSurface('/settings')}
              className={`relative h-full pl-ha-4 pr-ha-2 flex items-center justify-center transition-opacity ${
                isSettingsActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon path={mdiMenu} size={28} className="absolute -left-3 text-text-secondary z-0" />
                <div className="relative z-10 rounded-full ring-[3px] ring-surface-low bg-surface-low">
                  <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="sm" />
                </div>
              </div>
              <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-ha-blue transition-opacity ${
                isSettingsActive ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
          </div>
        </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity List Bottom Sheet — single-type picker, or the combined "Active Now"
          list opened from the navbar overflow pill. */}
      {activityListType && (() => {
        type SheetItem = { type: WidgetSurfaceType; entityId: string; name: string; subtitle: string };
        const releaseItems: SheetItem[] = visibleReleaseNotes.map((n) => ({ type: 'release', entityId: n.entityId, name: n.name, subtitle: n.version }));
        const cameraItems: SheetItem[] = allActiveCameras.map((c) => ({ type: 'camera', entityId: c.entityId, name: c.name, subtitle: c.event ?? '' }));
        const printerItems: SheetItem[] = allActivePrinters.map((p) => ({ type: 'printer', entityId: p.entityId, name: p.name, subtitle: `${p.progress}% complete` }));
        const mediaItems: SheetItem[] = allActiveMedia.map((m) => ({ type: 'media', entityId: m.entityId, name: m.name, subtitle: m.state }));
        const timerItems: SheetItem[] = allActiveTimers.map((t) => ({ type: 'timer', entityId: t.entityId, name: t.name, subtitle: t.remaining }));
        const byType: Record<WidgetSurfaceType, SheetItem[]> = {
          release: releaseItems, camera: cameraItems, printer: printerItems, media: mediaItems, timer: timerItems,
        };
        const items: SheetItem[] = activityListType === 'all'
          ? [...releaseItems, ...cameraItems, ...printerItems, ...mediaItems, ...timerItems]
          : byType[activityListType];
        const selectedIdFor = (type: WidgetSurfaceType) =>
          type === 'release' ? selectedReleaseId
          : type === 'media' ? selectedMediaId
          : type === 'timer' ? selectedTimerId
          : type === 'camera' ? selectedCameraId
          : selectedPrinterId;
        const ACTIVITY_META: Record<WidgetSurfaceType, { icon: string; iconBg: string; iconColor: string }> = {
          release: { icon: mdiUpdate, iconBg: 'bg-green-500/10', iconColor: 'text-green-600' },
          camera: { icon: mdiDoorbellVideo, iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
          printer: { icon: mdiPrinter3d, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          media: { icon: mdiPlay, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          timer: { icon: mdiTimerOutline, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
        };
        const title = activityListType === 'all' ? 'Active Now'
          : activityListType === 'release' ? "What's New"
          : activityListType === 'media' ? 'Active Media Players'
          : activityListType === 'timer' ? 'Active Timers'
          : activityListType === 'camera' ? 'Active Cameras'
          : 'Active Printers';
        return (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setActivityListType(null)}
            />
            {/* Sheet */}
            <div className="relative bg-surface-default w-full rounded-t-ha-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[70vh]">
              {/* Handle */}
              <div className="flex justify-center pt-ha-3 pb-ha-1 flex-shrink-0" onClick={() => setActivityListType(null)}>
                <div className="w-10 h-1.5 rounded-full bg-surface-low/60" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-ha-4 py-ha-3 border-b border-surface-low flex-shrink-0">
                <h3 className="font-semibold text-text-primary">{title}</h3>
                <button
                  onClick={() => setActivityListType(null)}
                  className="p-1 hover:bg-surface-mid rounded-full text-text-secondary transition-colors"
                >
                  <Icon path={mdiClose} size={24} />
                </button>
              </div>
              {/* List */}
              <div className="relative flex-1 min-h-0">
                <div
                  className={`pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-surface-default via-surface-default/60 to-transparent z-20 transition-opacity duration-200 ${
                    showActivityListTopGradient ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div
                  className={`pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface-default via-surface-default/60 to-transparent z-20 transition-opacity duration-200 ${
                    showActivityListBottomGradient ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div
                  ref={activityListScrollRef}
                  className="relative h-full overflow-y-auto p-ha-4 space-y-ha-2 pb-8"
                >
                  {items.map((item) => {
                    const meta = ACTIVITY_META[item.type];
                    const isSelected = selectedIdFor(item.type) === item.entityId;
                    return (
                      <button
                        key={`${item.type}-${item.entityId}`}
                        onClick={() => {
                          openWidgetSurface(item.type, item.entityId);
                        }}
                        className={`w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl border transition-all text-left ${
                          isSelected
                            ? item.type === 'release'
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-fill-primary-normal border-ha-blue/30'
                            : 'bg-surface-low border-surface-lower hover:bg-surface-mid'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                          <Icon path={meta.icon} size={18} className={meta.iconColor} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-semibold text-text-primary truncate">{item.name}</span>
                          <span className="text-xs text-text-secondary truncate">{item.subtitle}</span>
                        </div>
                        <Icon path={mdiChevronRight} size={18} className="text-text-disabled flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </nav>

    <ConfirmDialog
      open={!!pendingDelete}
      title={pendingDelete ? `Remove ${pendingDelete.title}?` : ''}
      message="This only hides it here for now — your Home Assistant configuration isn't changed."
      confirmLabel="Remove"
      cancelLabel="Keep"
      destructive
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => {
        if (pendingDelete) hideItem(pendingDelete.id);
        setPendingDelete(null);
      }}
    />
    </>
  );
}
