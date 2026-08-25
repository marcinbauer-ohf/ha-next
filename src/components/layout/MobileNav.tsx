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
import { IconButton } from '../ui/IconButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SearchField } from '../ui/SearchField';
import { SettingsGlyph } from '../ui/SettingsGlyph';
import { HALogo } from '../ui/HALogo';
import { MdiIcon } from '../ui/MdiIcon';
import { AppStatusBadge, appStatusDimmed } from '../ui/AppStatusBadge';
import { CircularProgress } from '../ui/CircularProgress';
import { clsx } from 'clsx';
import { useHomeAssistant, useHomeAssistantSelector, useSidebarItems, useLongPress, useHomeCenterPrefs, useRunShortcut } from '@/hooks';
import { removeShortcut } from '@/lib/sidebarShortcuts';
import { ShortcutPicker } from '../ui/ShortcutPicker';
import { EditItemsButton } from '../ui/EditItemsButton';
import { useActivities } from '@/hooks/useActivities';
import { dismissActivity } from '@/lib/activities/dismissals';
import { endedDismissKey } from '@/lib/activities/ledger';
import type { ActivityStatus } from '@/lib/activities/types';
import { HomeCenterPillIndicators, HomeCenterStatusSections, HomeModeCard, OpenHomeCenterButton } from '../sections/HomeCenterStatus';
import { HomeCenterBento } from '../ui/HomeCenterOverlay';
import { SheetHeader } from '../cards/dialogKit';
import { SettingsNavPanel } from '@/components/profile';
import { isSettingsSlug, type SettingsSlug } from '@/components/profile/settingsNavigation';
import { usePullToRevealContext, useSearchContext, useAssistantContext, useHomeCenterContext, useSidebarArrange, arrangeItems, useCloseOnScreensaver, useMobileToolbar, useDebugFlags, type SidebarItem } from '@/contexts';
import { resolveEntityPictureUrl } from '@/lib/utils';
import { HOME_CENTER_ICON } from '@/lib/homeCenter';
import { subscribeStatusPulse } from '@/lib/statusPulseBus';
import { isNavAutoHideFrozen, subscribeNavAutoHideFrozen } from '@/lib/navAutoHideBus';
import { setMobileNavOpen } from '@/lib/mobileNavOpenBus';
import { haptic } from '@/lib/haptics';
import { SheetGrabber } from '../ui/SheetGrabber';
import { Button } from '../ui';
import { SectionLabel } from '../ui/SectionLabel';
import {
  areEntitySearchMatchesEqual,
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
  mdiChevronUp,
  mdiMicrophone,
  mdiDevices,
  mdiClose,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiDoorbellVideo,
  mdiCreation,
  mdiPrinter3d,
  mdiViewDashboardOutline,
  mdiStarFourPoints,
  mdiMinus,
  mdiPlus,
  mdiCheck,
  mdiCheckCircle,
  mdiRobotVacuum,
  mdiBatteryHigh,
  mdiCloudUpload,
  mdiShieldAlert,
} from '@mdi/js';

function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// Screen height left above the open pull-up sheet. Also the 1:1 drag range, so
// keep the sheet height and getDragRangePx() reading the same number.
const SHEET_TOP_INSET_REM = 20;

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
      className="ha-arrange-badge absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center shadow-md shadow-black/30 ring-2 ring-surface-default"
    >
      <Icon path={mdiMinus} size={13} exact />
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
  /** Action/link shortcuts run on tap instead of navigating. */
  onRunShortcut?: (item: SidebarItem) => void;
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
  onRunShortcut,
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

  // Apps and shortcuts share the dashboard card cell but fill the preview
  // area with a centered icon tile instead of the layout mock; shortcuts get
  // a spark badge so they read as "yours" at a glance.
  const isIconCell = !!item.isApp || !!item.isShortcut;
  const palette = item.isApp ? getAppPalette(item.id) : null;

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
            if (item.shortcut && item.shortcut.kind !== 'view') {
              e.preventDefault();
              onRunShortcut?.(item);
              onClose();
              return;
            }
            onClose();
          }}
          // Long-press enters arrange mode — never the browser's link menu.
          // ha-no-callout kills the iOS Safari preview sheet; preventDefault
          // covers Android's long-press context menu.
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
          className={`ha-no-callout -m-1 rounded-ha-xl p-1 flex flex-col group transition-colors select-none ${
            isActive ? 'bg-surface-low/80' : 'hover:bg-surface-low/40'
          }`}
        >
          <div
            className={`w-full aspect-[3/4] rounded-ha-xl overflow-hidden transition-all ${
              isActive ? 'bg-fill-primary-normal ring-2 ring-ha-blue/35' : 'bg-surface-lower'
            } ${isIconCell ? 'flex items-center justify-center' : ''}`}
          >
            {isIconCell ? (
              <div
                className={`relative w-14 h-14 rounded-ha-xl flex items-center justify-center transition-colors ${
                  item.isApp ? 'ha-app-icon-shell' : ''
                } ${isActive ? `bg-surface-mid ${item.isApp ? 'ha-app-icon-shell-active' : ''}` : 'bg-surface-low'}`}
              >
                <MdiIcon
                  icon={item.icon || (item.isApp ? 'mdi:application' : 'mdi:arrow-top-right')}
                  size={28}
                  className={clsx(
                    item.isApp && palette
                      ? `${palette.text} ha-app-icon-glyph`
                      : isActive
                        ? 'text-ha-blue'
                        : 'text-text-secondary',
                    appStatusDimmed(item.appStatus) && 'opacity-40 saturate-0'
                  )}
                />
                {item.appStatus && (
                  <AppStatusBadge status={item.appStatus} ringClass="ring-surface-lower" />
                )}
                {/* Turned-down corner, same fold as the sidebar rail's. */}
                {item.isShortcut && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-ha-xl"
                  >
                    <span
                      className="absolute top-0 right-0 h-[18px] w-[18px] bg-gradient-to-bl from-text-tertiary/40 via-text-tertiary/15 to-transparent"
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                    />
                  </span>
                )}
              </div>
            ) : (
              <div className="p-ha-2 space-y-ha-1">
                <div className={`h-2 rounded-full w-full ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
                <div className={`h-2 rounded-full w-3/4 ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
                <div className={`h-3 rounded-ha-lg w-full mt-ha-2 ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
                <div className={`h-3 rounded-ha-lg w-full ${isActive ? 'bg-ha-blue/25' : 'bg-surface-low'}`} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-ha-1 mt-ha-1">
            {isIconCell ? null : item.icon ? (
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

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;
type BottomSurfaceTab = 'dashboards' | 'search' | 'homecenter' | 'dashboard' | 'settings' | 'widget';
type WidgetSurfaceType = 'release' | 'media' | 'timer' | 'camera' | 'printer' | 'vacuum' | 'update' | 'backup' | 'alarm';

interface SearchResultItem {
  id: string;
  type: 'dashboard' | 'app' | 'entity';
  name: string;
  subtitle: string;
  icon?: string | null;
  href?: string;
}

interface MobileNavProps {
  /** Hold the nav at its current shown/hidden state (e.g. while a toast is up). */
  freezeAutoHide?: boolean;
  connectionStatus?: ConnectionStatusType;
  onNavAutoHiddenChange?: (progress: number) => void;
  editModeFade?: boolean;
  /** Leave settings when the settings item is tapped from inside it. */
  onSettingsToggle?: () => void;
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

export function MobileNav({ freezeAutoHide = false, connectionStatus, onNavAutoHiddenChange, editModeFade, onSettingsToggle }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { haUrl, callService } = useHomeAssistant();
  const { items } = useSidebarItems();
  const { isRevealed, close } = usePullToRevealContext();
  const { searchOpen, closeSearch } = useSearchContext();
  const { openAssistant } = useAssistantContext();
  const { openHomeCenter } = useHomeCenterContext();
  const { hideHomeCenterEnabled, mobileNavAutoHideEnabled } = useDebugFlags();
  // Scroll/idle auto-hide is off unless the prototype flag turns it on.
  const disableAutoHide = !mobileNavAutoHideEnabled;
  const { arranging, enterArrange, exitArrange, order, hiddenIds, hideItem, restoreItem, reorderVisible } =
    useSidebarArrange();
  const { toolbarActive } = useMobileToolbar();
  const [pendingDelete, setPendingDelete] = useState<SidebarItem | null>(null);
  const [shortcutPickerOpen, setShortcutPickerOpen] = useState(false);
  const runShortcut = useRunShortcut();

  // Shortcuts delete instantly — trivial to recreate from the picker, so no
  // confirmation. Dashboards and apps keep the confirm dialog.
  const requestDelete = useCallback((item: SidebarItem) => {
    if (item.isShortcut) {
      haptic('impact');
      removeShortcut(item.id);
      return;
    }
    setPendingDelete(item);
  }, []);
  const arrangeSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } })
  );
  // Assistant now handled via expandedWidgetId

  const [timerProgress, setTimerProgress] = useState<number>(0);
  // Binary, not a fraction: the bar is either out or tucked away, and CSS eases
  // between the two. Tracking scroll fractionally re-rendered this whole
  // component on every scroll event, which is what made it chop.
  const [scrollHidden, setScrollHidden] = useState(false);
  const [hideFromInactivity, setHideFromInactivity] = useState(false);
  // Held by transient interactions (e.g. scrubbing the scroll-index rail) that
  // scroll the dashboard programmatically — see navAutoHideBus.
  const [navFrozenExternally, setNavFrozenExternally] = useState(false);
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
  const [activityListType, setActivityListType] = useState<WidgetSurfaceType | 'all' | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [selectedVacuumId, setSelectedVacuumId] = useState<string | null>(null);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const bottomSheetHandleRef = useRef<HTMLButtonElement | null>(null);
  const navPillRef = useRef<HTMLDivElement | null>(null);
  const expandedSurfaceScrollRef = useRef<HTMLDivElement | null>(null);
  const activityListScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSheetTouchStartY = useRef<number | null>(null);
  const bottomSheetPullDistance = useRef(0);
  const bottomSheetDragProgressRef = useRef(0);
  const isDashboardsSurfaceVisible = statusExpanded && expandedSurfaceTab === 'dashboards';
  const isSearchSurfaceVisible = statusExpanded && expandedSurfaceTab === 'search';
  const isHomeCenterSurfaceVisible = statusExpanded && expandedSurfaceTab === 'homecenter';
  const isSettingsSurfaceVisible = statusExpanded && expandedSurfaceTab === 'settings';
  const isSettingsRoute = pathname === '/profile' || pathname === '/settings' || pathname.startsWith('/settings/');
  const isSearchActive = isSearchSurfaceVisible || searchOpen;
  const isSettingsActive = !isDashboardsSurfaceVisible && !isHomeCenterSurfaceVisible && (isSettingsSurfaceVisible || (!isSearchActive && isSettingsRoute));
  const isDashboardsActive = isDashboardsSurfaceVisible || (!isSearchActive && !isSettingsActive && !isHomeCenterSurfaceVisible);
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
  // Collapse the activity + Home Center row away when it's redundant clutter:
  // (1) while the pull-up sheet is open on a navigation surface, and (2) on the
  // settings routes (Settings, its sub-pages incl. Home Center, and Profile),
  // where the same status lives on the page itself. Keep it for the 'widget' tab
  // so the tapped pill's shared-element transition into the sheet still plays.
  const baseTopRowVisibleRatio =
    expandedSurfaceTab === 'widget' ? 1 : isSettingsRoute ? 0 : 1 - sheetOpenProgress;
  // The grabber only exists to drag the sheet closed, so it appears with the
  // sheet. Closed, the whole bar is still the drag-up target (see the pill's
  // touch handlers) and the dashboards tab opens it on tap.
  const hideHandle = !isSheetVisible;
  // Broadcast the open state so surfaces floating above the scrim (corner toast,
  // dashboard filter FAB) can fade out while the sheet is up, and back in after.
  useEffect(() => {
    setMobileNavOpen(isSheetVisible);
  }, [isSheetVisible]);
  useEffect(() => () => setMobileNavOpen(false), []);
  const { data: activityData, activities } = useActivities();
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
  // Memoized so the selector's snapshot-identity cache holds between renders;
  // an inline closure would re-scan every entity on each nav render.
  const selectSearchMatches = useCallback(
    (entities: Parameters<typeof selectMatchingEntities>[0]) =>
      selectMatchingEntities(entities, expandedSearchQuery),
    [expandedSearchQuery]
  );
  const matchingEntities = useHomeAssistantSelector(selectSearchMatches, areEntitySearchMatchesEqual);
  const effectiveHideProgress = disableAutoHide || isRevealed || isBottomSurfaceEngaged
    ? 0
    : hideFromInactivity || scrollHidden
      ? 1
      : 0;
  const bottomRowVisibleRatio = 1 - effectiveHideProgress;
  const isBottomRowHidden = effectiveHideProgress === 1;
  const getEntityPictureUrl = useCallback(
    (picture?: string, fallback?: string) => resolveEntityPictureUrl(haUrl, picture) ?? fallback,
    [haUrl]
  );

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

  // Track the external freeze flag (scroll-index rail scrubbing, etc.).
  // rAF-wrapped initial sync so the compiler lint doesn't see a synchronous
  // setState-in-effect.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setNavFrozenExternally(isNavAutoHideFrozen()));
    const unsubscribe = subscribeNavAutoHideFrozen(setNavFrozenExternally);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, []);

  // Hold the nav at its current state while a toast is up OR an external
  // interaction (rail scrub) is driving programmatic scrolls.
  const freezeAuto = freezeAutoHide || navFrozenExternally;

  // Scroll behavior — same accumulate-travel-per-direction reflex the summary
  // chips use (see MobileSummaryRow), so the two hide and come back together.
  // State only flips when it crosses a threshold, so a scroll gesture costs at
  // most two renders instead of one per event.
  useEffect(() => {
    let scrollable: HTMLElement | null = null;
    let attachRetryRaf: number | null = null;

    // Freeze: hold the current state, ignore scroll while a toast is up or the
    // rail is scrubbing.
    if (freezeAuto) return;

    if (disableAutoHide || isRevealed || isBottomSurfaceEngaged) {
      queueMicrotask(() => {
        setScrollHidden(false);
        setHideFromInactivity(false);
      });
      return;
    }

    // Accumulated travel in one direction before the bar commits to a move.
    const HIDE_TRAVEL_PX = 24;
    const SHOW_TRAVEL_PX = 16;
    let last = 0;
    let travel = 0;

    const handleScroll = () => {
      if (!scrollable) return;
      // A scroll event can fire after a scrub starts but before the freeze
      // re-runs this effect — bail on the live flag so no jump leaks through.
      if (isNavAutoHideFrozen()) return;

      const top = scrollable.scrollTop;
      const delta = top - last;
      last = top;

      setHideFromInactivity((hidden) => (hidden ? false : hidden));

      if (top <= 2) {
        travel = 0;
        setScrollHidden(false);
        return;
      }

      // Reset the tally when the direction flips, so a jittery finger can't
      // creep its way over a threshold.
      travel = (travel > 0) === (delta > 0) ? travel + delta : delta;
      if (travel >= HIDE_TRAVEL_PX) setScrollHidden(true);
      else if (travel <= -SHOW_TRAVEL_PX) setScrollHidden(false);
    };

    const attach = () => {
      const nextScrollable = getDashboardScrollableForPath(pathname);
      if (!nextScrollable) return false;
      scrollable = nextScrollable;
      last = scrollable.scrollTop;
      travel = 0;
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
    };
  }, [disableAutoHide, freezeAuto, isBottomSurfaceEngaged, isRevealed, pathname]);

  // Inactivity detection for hiding bottom row after 10s
  useEffect(() => {
    // Freeze: don't start the inactivity timer or alter state while a toast is
    // up or the rail is scrubbing.
    if (freezeAuto) return;

    if (disableAutoHide || isRevealed || isBottomSurfaceEngaged) {
      queueMicrotask(() => {
        setHideFromInactivity(false);
      });
      return;
    }

    let scrollable: HTMLElement | null = null;
    let attachRetryRaf: number | null = null;

    const resetInactivityTimer = () => {
      // Don't reveal / restart the timer off scrub-driven touch + scroll events.
      if (isNavAutoHideFrozen()) return;
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }

      setHideFromInactivity((hidden) => (hidden ? false : hidden));

      inactivityTimer.current = setTimeout(() => {
        if (!isRevealed && !isBottomSurfaceEngaged) {
          setHideFromInactivity(true);
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
  }, [disableAutoHide, freezeAuto, isBottomSurfaceEngaged, isRevealed, pathname]);

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

  // Tapping the settings entry while already on the settings root scrolls that
  // page back to the top (a no-op push wouldn't). From anywhere else it just
  // navigates there.
  // Tapping settings from inside settings leaves it again — same toggle the
  // desktop avatar and the S shortcut do.
  const handleSettingsTap = useCallback(() => {
    if (pathname.startsWith('/settings')) {
      closeExpandedSurface();
      onSettingsToggle?.();
      return;
    }
    navigateFromSurface('/settings');
  }, [pathname, closeExpandedSurface, navigateFromSurface, onSettingsToggle]);

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

  // The dashboards tab goes home first — browsing the other dashboards and apps
  // is the second tap (and the drag handle right above it, which opens the same
  // surface). Mirrors handleSettingsTap: tap again on the destination = "more".
  const handleDashboardsTap = useCallback(() => {
    if (pathname === '/') {
      openExpandedSurface('dashboards');
      return;
    }
    navigateFromSurface('/');
  }, [pathname, openExpandedSurface, navigateFromSurface]);

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
      else if (type === 'printer') setSelectedPrinterId(entityId);
      else if (type === 'update') setSelectedUpdateId(entityId);
      else if (type === 'backup') setSelectedBackupId(entityId);
      else if (type === 'alarm') setSelectedAlarmId(entityId);
      else setSelectedVacuumId(entityId);

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

  // Sheet drag behavior, attached to the whole nav pill:
  // collapsed -> drag up from anywhere on the bar to open,
  // expanded -> drag down on the handle to close (the sheet content
  // underneath has to keep scrolling normally).
  useEffect(() => {
    const pill = navPillRef.current;
    if (!pill) return;

    const getDragRangePx = () => {
      if (typeof window === 'undefined') return 280;
      // Match the sheet's open height so a px of finger travel moves the sheet
      // a px — the handle tracks the finger 1:1 instead of racing ahead of it.
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return Math.max(120, window.innerHeight - SHEET_TOP_INSET_REM * rem);
    };

    // A finger must clear this before the gesture counts as a drag instead of a
    // tap. Below it we leave the synthesized click intact so the handle's
    // onClick toggle fires — taps no longer depend on a perfectly still finger.
    const TAP_SLOP_PX = 10;
    // Absolute finger travel (in the open/close direction) that commits the
    // sheet. Decoupled from the 1:1 visual range so a normal swipe is enough —
    // the old fractional threshold needed ~200px of travel to open.
    const COMMIT_DISTANCE_PX = 72;
    let gestureMoved = false;

    const reset = () => {
      bottomSheetTouchStartY.current = null;
      bottomSheetPullDistance.current = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      // While the sheet is up, only the handle drags it closed.
      if (
        statusExpanded &&
        !(e.target instanceof Node && bottomSheetHandleRef.current?.contains(e.target))
      ) {
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      bottomSheetTouchStartY.current = touch.clientY;
      bottomSheetPullDistance.current = 0;
      gestureMoved = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (bottomSheetTouchStartY.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - bottomSheetTouchStartY.current;

      // Stay a tap until the finger clears the slop: don't move the sheet and
      // don't preventDefault, so the browser still fires the click that drives
      // the onClick toggle.
      if (!gestureMoved) {
        if (Math.abs(deltaY) <= TAP_SLOP_PX) return;
        gestureMoved = true;
        setIsBottomSheetDragging(true);
        setBottomSheetDragProgressClamped(statusExpanded ? 1 : 0);
      }

      const dragRange = getDragRangePx();
      if (statusExpanded) {
        const downwardPull = Math.max(0, deltaY);
        bottomSheetPullDistance.current = downwardPull;
        setBottomSheetDragProgressClamped(1 - downwardPull / dragRange);
      } else {
        const upwardPull = Math.max(0, -deltaY);
        bottomSheetPullDistance.current = upwardPull;
        setBottomSheetDragProgressClamped(upwardPull / dragRange);
      }

      // A real drag swallows the synthesized click so it can't double-toggle.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (bottomSheetTouchStartY.current === null) return;
      const moved = gestureMoved;
      const pull = bottomSheetPullDistance.current;
      reset();
      gestureMoved = false;

      // Tap: leave it to the handle's onClick toggle.
      if (!moved) return;

      if (pull >= COMMIT_DISTANCE_PX) {
        if (statusExpanded) closeExpandedSurface();
        else openExpandedSurface(expandedSurfaceTab);
      }
      requestAnimationFrame(() => {
        setIsBottomSheetDragging(false);
        setBottomSheetDragProgressClamped(0);
      });
    };

    const onTouchCancel = () => {
      reset();
      gestureMoved = false;
      setIsBottomSheetDragging(false);
      setBottomSheetDragProgressClamped(0);
    };

    pill.addEventListener('touchstart', onTouchStart, { passive: true });
    pill.addEventListener('touchmove', onTouchMove, { passive: false });
    pill.addEventListener('touchend', onTouchEnd, { passive: true });
    pill.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      pill.removeEventListener('touchstart', onTouchStart);
      pill.removeEventListener('touchmove', onTouchMove);
      pill.removeEventListener('touchend', onTouchEnd);
      pill.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [
    closeExpandedSurface,
    expandedSurfaceTab,
    openExpandedSurface,
    setBottomSheetDragProgressClamped,
    statusExpanded,
  ]);



  // Per-type lists come from the activity ledger: relevance-sorted, ended
  // items lingering in their final state, persisted dismissals filtered out —
  // identical to what the desktop status bar shows.
  const visibleReleaseNotes = useMemo(
    () => activities.releaseNotes.map(({ summary, status }) => ({ ...summary, status })),
    [activities.releaseNotes]
  );

  // Get active release note (selected or first)
  const activeRelease = useMemo(() => {
    if (visibleReleaseNotes.length === 0) return null;
    const found = selectedReleaseId ? visibleReleaseNotes.find((note) => note.entityId === selectedReleaseId) : null;
    return found || visibleReleaseNotes[0];
  }, [selectedReleaseId, visibleReleaseNotes]);

  const allActiveMedia = useMemo(
    () => activities.players.map(({ summary, status }) => ({ ...summary, status })),
    [activities.players]
  );

  // Get active media player with image (selected or first)
  const activeMedia = useMemo(() => {
    if (allActiveMedia.length === 0) return null;
    const found = selectedMediaId ? allActiveMedia.find(m => m.entityId === selectedMediaId) : null;
    return found || allActiveMedia[0];
  }, [allActiveMedia, selectedMediaId]);

  // Count active media players
  const activeMediaCount = allActiveMedia.length;

  const allActiveTimers = useMemo(() => activities.timers.map(({ summary, status }) => ({
    ...summary,
    isPaused: summary.state === 'paused',
    status,
  })), [activities.timers]);

  // Get active timer (selected or first)
  const activeTimer = useMemo(() => {
    if (allActiveTimers.length === 0) return null;
    const found = selectedTimerId ? allActiveTimers.find(t => t.entityId === selectedTimerId) : null;
    return found || allActiveTimers[0];
  }, [allActiveTimers, selectedTimerId]);

  const allActiveCameras = useMemo(
    () => activities.cameras.map(({ summary, status }) => ({ ...summary, status })),
    [activities.cameras]
  );

  // Get active camera (selected or first)
  const activeCamera = useMemo(() => {
    if (allActiveCameras.length === 0) return null;
    const found = selectedCameraId ? allActiveCameras.find(c => c.entityId === selectedCameraId) : null;
    return found || allActiveCameras[0];
  }, [allActiveCameras, selectedCameraId]);

  const allActivePrinters = useMemo(
    () => activities.printers.map(({ summary, status }) => ({ ...summary, status })),
    [activities.printers]
  );

  // Get active printer (selected or first)
  const activePrinter = useMemo(() => {
    if (allActivePrinters.length === 0) return null;
    const found = selectedPrinterId ? allActivePrinters.find(p => p.entityId === selectedPrinterId) : null;
    return found || allActivePrinters[0];
  }, [allActivePrinters, selectedPrinterId]);

  const allActiveVacuums = useMemo(
    () => activities.vacuums.map(({ summary, status }) => ({ ...summary, status })),
    [activities.vacuums]
  );

  // Get active vacuum (selected or first)
  const activeVacuum = useMemo(() => {
    if (allActiveVacuums.length === 0) return null;
    const found = selectedVacuumId ? allActiveVacuums.find(v => v.entityId === selectedVacuumId) : null;
    return found || allActiveVacuums[0];
  }, [allActiveVacuums, selectedVacuumId]);

  // Derive visibility
  const showReleaseWidget = !!activeRelease;
  const showMediaWidget = !!activeMedia;
  const showTimerWidget = !!activeTimer;
  const showCameraWidget = !!activeCamera;
  const showPrinterWidget = !!activePrinter;
  const showVacuumWidget = !!activeVacuum;

  // Live activities are capped in the mobile navbar. Types past the cap collapse
  // into a "+N" overflow pill that opens the combined Active Now sheet. The
  // ledger's relevance order decides which types make the cut, so the mobile
  // row and the desktop dock always agree on what matters most.
  // Two, since the always-visible Ask pill shares the row's width.
  const MAX_VISIBLE_ACTIVITIES = 2;
  const activeWidgetTypes = activities.typeOrder;
  const visibleActivityTypes = activeWidgetTypes.slice(0, MAX_VISIBLE_ACTIVITIES);
  const activityOverflowCount = activeWidgetTypes.length - visibleActivityTypes.length;
  const hasActivityOverflow = activityOverflowCount > 0;

  // The Ask + Home Center widgets moved into the bottom tab bar (experiment), so
  // the top row now only carries live activity glances. Collapse it entirely when
  // nothing is live so it doesn't reserve an empty strip above the tabs.
  const hasTopRowContent =
    showReleaseWidget || showMediaWidget || showTimerWidget || showCameraWidget ||
    showPrinterWidget || showVacuumWidget || hasActivityOverflow;
  const topRowVisibleRatio = hasTopRowContent ? baseTopRowVisibleRatio : 0;
  const isTopRowHidden = topRowVisibleRatio <= 0.02;

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
  const activeVacuumCount = allActiveVacuums.length;
  const displayedTimerProgress = activeTimer ? timerProgress : 0;

  // Home is pinned first in its own cell; the rest carry the session arrange
  // order + soft-hides. Soft-hidden items also drop out of search.
  const homeItem = useMemo(() => items.find((item) => item && item.urlPath === '/'), [items]);
  const dashboards = useMemo(
    () => arrangeItems(items.filter((item) => item && !item.isApp && !item.isShortcut && item.urlPath !== '/'), order, hiddenIds),
    [items, order, hiddenIds]
  );
  const apps = useMemo(
    () => arrangeItems(items.filter((item) => item && item.isApp), order, hiddenIds),
    [items, order, hiddenIds]
  );
  // One mixed, freely-reorderable grid — same list the desktop rail renders.
  // Default order ranks dashboards → apps → shortcuts (new shortcuts appear
  // at the end, next to the "add" cell) before the shared arrange order
  // applies.
  const gridItems = useMemo(() => {
    const rank = (it: SidebarItem) => (it.isShortcut ? 2 : it.isApp ? 1 : 0);
    return arrangeItems(
      items
        .filter((item): item is SidebarItem => !!item && item.urlPath !== '/')
        .sort((a, b) => rank(a) - rank(b)),
      order,
      hiddenIds
    );
  }, [items, order, hiddenIds]);
  const searchDashboards = useMemo(
    () => (homeItem ? [homeItem, ...dashboards] : dashboards),
    [homeItem, dashboards]
  );

  const gridIds = useMemo(() => gridItems.map((item) => item.id), [gridItems]);
  // Hidden items resurface (dimmed, restorable) while arranging — HA-style
  // visibility toggles rather than one-way removal.
  const hiddenGridItems = useMemo(
    () => items.filter((item): item is SidebarItem => !!item && hiddenIds.has(item.id)),
    [items, hiddenIds]
  );

  const handleGridDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = gridIds.indexOf(active.id as string);
      const newIndex = gridIds.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      haptic('impact');
      reorderVisible(gridIds, gridIds, arrayMove(gridIds, oldIndex, newIndex));
    },
    [gridIds, reorderVisible]
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
      // Friendly state only — raw entity ids are too technical for search results.
      subtitle: entity.state ? entity.state.charAt(0).toUpperCase() + entity.state.slice(1) : 'Device',
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
        <div>
          {/* One mixed grid — dashboards, shortcuts, and apps reorder freely,
              mirroring the desktop rail. */}
          <DndContext
            sensors={arrangeSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleGridDragEnd}
          >
            <div className="grid grid-cols-3 gap-ha-3">
              {/* Home stays visible while arranging — pinned (no jiggle, no
                  badge, not sortable) so the grid order matches non-arrange
                  mode and dragging can't displace slot one. */}
              {homeItem && (
                <MobileDashboardCard
                  item={homeItem}
                  index={-1}
                  isActive={isNavItemActive(pathname, homeItem.urlPath)}
                  arranging={arranging}
                  pinned
                  onClose={closeExpandedSurface}
                  onEnterArrange={enterArrange}
                  onRequestDelete={requestDelete}
                />
              )}
              <SortableContext items={gridIds} strategy={rectSortingStrategy}>
                {gridItems.map((gridItem, index) => (
                  <MobileDashboardCard
                    key={gridItem.id}
                    item={gridItem}
                    index={index}
                    isActive={isNavItemActive(pathname, gridItem.urlPath)}
                    arranging={arranging}
                    onClose={closeExpandedSurface}
                    onEnterArrange={enterArrange}
                    onRequestDelete={requestDelete}
                    onRunShortcut={(it) => it.shortcut && runShortcut(it.shortcut)}
                  />
                ))}
              </SortableContext>
              {/* Ghost cell — "add a shortcut", shown while editing only
                  (long-press any tile to get here), matching the desktop
                  arrange-mode "+" tile. */}
              {arranging && (
                <button
                  type="button"
                  onClick={() => setShortcutPickerOpen(true)}
                  aria-label="Add shortcut"
                  className="-m-1 rounded-ha-xl p-1 flex flex-col select-none"
                >
                  <div className="w-full aspect-[3/4] rounded-ha-xl border border-dashed border-text-tertiary/40 text-text-tertiary flex items-center justify-center">
                    <Icon path={mdiPlus} size={26} />
                  </div>
                  <span className="text-[13px] text-text-tertiary mt-ha-1 text-left">Add shortcut</span>
                </button>
              )}
              {/* Hidden items — dimmed with a restore "+", so hiding is a
                  toggle (HA-style), never a dead end. */}
              {arranging &&
                hiddenGridItems.map((hiddenItem) => (
                  <div key={hiddenItem.id} className="relative">
                    <div className="-m-1 rounded-ha-xl p-1 flex flex-col select-none opacity-40">
                      <div className="w-full aspect-[3/4] rounded-ha-xl bg-surface-lower flex items-center justify-center">
                        <MdiIcon
                          icon={hiddenItem.icon || (hiddenItem.isApp ? 'mdi:application' : 'mdi:view-dashboard')}
                          size={28}
                          className="text-text-secondary"
                        />
                      </div>
                      <div className="flex items-center gap-ha-1 mt-ha-1">
                        <span className="text-[13px] truncate text-text-secondary">{hiddenItem.title}</span>
                      </div>
                    </div>
                    <IconButton
                      icon={mdiPlus}
                      label={`Show ${hiddenItem.title}`}
                      size="sm"
                      exact
                      onClick={() => {
                        haptic('impact');
                        restoreItem(hiddenItem.id);
                      }}
                    />
                  </div>
                ))}
            </div>
          </DndContext>
          {/* Bottom slot — Edit normally, Done while arranging. Same
              full-width bottom placement as the desktop rail, thumb-reachable. */}
          <div className="mt-ha-4">
            {arranging ? (
              <Button variant="primary" icon={mdiCheck} onClick={exitArrange} block>
                Done
              </Button>
            ) : (
              <EditItemsButton variant="bar" onClick={enterArrange} />
            )}
          </div>
        </div>
      );
    }

    if (expandedSurfaceTab === 'search') {
      return (
        <div className="space-y-ha-5 pb-ha-2">
          {/* Merged assistant entry — with a query it hands the question over,
              empty it's the plain "ask anything" entry point. */}
          <button
            type="button"
            onClick={() => {
              const query = expandedSearchQuery.trim();
              closeExpandedSurface();
              openAssistant(query || undefined);
            }}
            className="w-full flex items-center gap-ha-4 px-ha-4 py-ha-3 rounded-ha-2xl bg-ha-blue/10 border border-ha-blue/20 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-ha-xl bg-ha-blue/15 flex items-center justify-center flex-shrink-0">
              <Icon path={mdiCreation} size={20} className="text-ha-blue" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-text-primary leading-tight truncate">
                {expandedSearchQuery.trim() ? `Ask Home — “${expandedSearchQuery.trim()}”` : 'Ask Home anything…'}
              </p>
              <p className="text-sm text-text-secondary truncate mt-0.5">
                {expandedSearchQuery.trim() ? 'Hand this question to your assistant' : 'Questions and commands, by voice or text'}
              </p>
            </div>
            <Icon path={mdiChevronRight} size={22} className="text-ha-blue/60" />
          </button>

          {!showSearchEmptyState && (
            <div className="space-y-ha-2">
              <SectionLabel inset>
                {expandedSearchQuery.trim() ? 'Results' : 'Suggestions'}
              </SectionLabel>
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
              <Button
                onClick={() => {
                  const remaining = visibleReleaseNotes.filter((note) => note.entityId !== activeRelease.entityId);
                  // Persisted + shared with the desktop dock; never reposts
                  // for this updatedAt.
                  dismissActivity(activeRelease.entityId, activeRelease.updatedAt);

                  if (remaining.length > 0) {
                    setSelectedReleaseId(remaining[0].entityId);
                    setExpandedWidgetId(remaining[0].entityId);
                    return;
                  }

                  setSelectedReleaseId(null);
                  closeExpandedSurface();
                }}
                variant="primary"
                block
              >
                Dismiss notes
              </Button>
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
                <Button variant="primary" icon={mdiMicrophone} block>
                  Talk to Doors
                </Button>
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
                <Button variant="danger" size="sm">Stop</Button>
              </div>
            </div>
          </div>
        );
      }

      if (expandedWidgetType === 'vacuum' && activeVacuum) {
        const status = activeVacuum.state === 'returning' ? 'Returning to Dock' : 'Cleaning';
        return (
          <div className="space-y-ha-4 pb-ha-2">
            <div className="bg-surface-low rounded-ha-xl border border-surface-mid p-ha-4">
              <div className="text-[13px] font-bold text-ha-blue uppercase tracking-widest mb-ha-3">{status}</div>
              <div className="w-full aspect-square rounded-ha-xl overflow-hidden mb-ha-4 border border-surface-mid relative">
                <img src={getEntityPictureUrl(activeVacuum.entityPicture, '/devices/robot_vacuum.png')} alt={activeVacuum.name} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-black/60 rounded-ha-lg px-2 py-1 flex items-center gap-2 border border-white/10">
                  <Icon path={mdiRobotVacuum} size={14} className="text-ha-blue" />
                  <span className="text-[13px] font-bold text-white">{activeVacuum.area || 'Whole home'}</span>
                </div>
              </div>
              <div className="mb-ha-4">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-bold text-text-primary truncate">{activeVacuum.name}</span>
                  <span className="text-xs font-mono font-bold text-ha-blue">{activeVacuum.progress}%</span>
                </div>
                <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-mid/60">
                  <div className="bg-ha-blue h-full transition-all duration-500" style={{ width: `${activeVacuum.progress}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-ha-3 mb-ha-4">
                <div className="flex flex-col items-center gap-1 p-ha-3 bg-surface-mid/60 rounded-ha-xl">
                  <Icon path={mdiBatteryHigh} size={18} className="text-green-500" />
                  <span className="text-[13px] font-bold text-text-disabled uppercase">Battery</span>
                  <span className="text-sm font-mono font-bold text-text-primary">{activeVacuum.battery ?? '—'}%</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-ha-3 bg-surface-mid/60 rounded-ha-xl">
                  <Icon path={mdiRobotVacuum} size={18} className="text-ha-blue" />
                  <span className="text-[13px] font-bold text-text-disabled uppercase">Mode</span>
                  <span className="text-sm font-bold text-text-primary">{activeVacuum.fanSpeed || 'Auto'}</span>
                </div>
              </div>
              <Button variant="danger" block>
                Stop &amp; Dock
              </Button>
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
                  className="w-14 h-14 rounded-full bg-ha-blue text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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
                  progress={activeTimer.status.phase === 'ended' ? 1 : displayedTimerProgress}
                  size={140}
                  strokeWidth={6}
                  className={activeTimer.status.phase === 'ended' ? 'text-green-600' : activeTimer.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                  trackClassName={activeTimer.status.phase === 'ended' ? 'text-green-500/20' : activeTimer.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {activeTimer.status.phase === 'ended' ? (
                    <>
                      <Icon path={mdiCheckCircle} size={36} className="text-green-600 mb-1" />
                      <span className="text-[13px] font-bold text-green-600 uppercase tracking-widest">
                        {activeTimer.status.endLabel || 'Done'}
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold font-mono text-text-primary tracking-tighter">
                      {activeTimer.remaining}
                    </span>
                  )}
                </div>
              </div>
              {activeTimer.status.phase === 'ended' ? (
                <Button
                  variant="primary"
                  block
                  onClick={() => {
                    dismissActivity(activeTimer.entityId, endedDismissKey(activeTimer.status));
                    closeExpandedSurface();
                  }}
                >
                  Dismiss
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-ha-3 w-full">
                  <Button>Cancel</Button>
                  <Button variant="primary">
                    {activeTimer.isPaused ? 'Resume' : 'Pause'}
                  </Button>
                </div>
              )}
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

    if (expandedSurfaceTab === 'homecenter') {
      return (
        <div className="space-y-ha-5 pb-8">
          <HomeCenterBento onNavigate={navigateFromSurface} />
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
        <HomeModeCard />
        <HomeCenterStatusSections onNavigate={navigateFromSurface} />
        <OpenHomeCenterButton
          onNavigate={navigateFromSurface}
          onClick={() => {
            closeExpandedSurface();
            openHomeCenter();
          }}
        />
      </div>
    );
  };

  return (
    <>
    <nav
      ref={navRef}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-50 ha-mobile-nav-in ${editModeFade || toolbarActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ paddingBottom: 'var(--ha-edge-padding)' }}
      data-component="MobileNav"
      data-connection-status={connectionStatus ?? 'unknown'}
      onMouseEnter={() => {
        setScrollHidden(false);
        setHideFromInactivity(false);
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(9rem+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/45 via-black/18 to-transparent transition-opacity duration-300"
        // Nothing left to darken behind once the bar tucks away, so the scrim
        // fades back with it rather than sitting there as a dark smudge.
        style={{
          opacity: (showBottomEdgeGradient ? 0.8 : 0.55) * (1 - 0.6 * effectiveHideProgress),
        }}
      />
      <button
        type="button"
        aria-label="Close expanded panel"
        onClick={closeExpandedSurface}
        className={`fixed inset-0 transition-opacity duration-300 ${
          isSheetVisible ? 'z-0' : '-z-10'
        } ${
          statusExpanded && !isBottomSheetDragging ? '' : 'pointer-events-none'
        } bg-black/70`}
        style={{ opacity: isSheetVisible ? 1 : 0 }}
      />
      <div className="relative z-10 px-edge flex justify-center">
        <div
          ref={navPillRef}
          // Closed, the pill hugs the tab strip; the drawer needs the full width.
          className={`mobile-nav-pill relative rounded-[var(--mobile-nav-radius)] bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)] overflow-hidden ${
            isSheetVisible ? 'w-full' : 'w-auto'
          }`}
          // Collapsed, the whole bar is the drag-up affordance; expanded, touch
          // handling goes back to the browser so the sheet content can scroll.
          style={{
            touchAction: statusExpanded ? 'auto' : 'none',
            // Auto-hidden with nothing live to show, the leftover sliver keeps the
            // full tab-strip width — squeeze it down to a small nub instead. The
            // cap is inert until the last stretch of the hide (natural width is
            // ~290px), so it reads as a tuck-away rather than a width animation.
            // With activities up top the row still needs its real width.
            maxWidth: isTopRowHidden && !isSheetVisible
              ? `${104 + 456 * (1 - effectiveHideProgress)}px`
              : undefined,
            transition: 'max-width 0.42s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <div className="relative rounded-[calc(var(--mobile-nav-radius)_-_1px)] bg-surface-default/95">
            <div
              className="flex flex-col px-ha-2 pt-0 transition-[padding] duration-300 ease-out"
              // The residual bottom padding is all that's left once the rows
              // collapse — halve it so the hidden nub is a thin bar, not a slab.
              style={{ paddingBottom: `${isBottomRowHidden && isTopRowHidden ? 4 : 8}px` }}
            >
              <div className="flex justify-center py-0 mb-0 shrink-0">
                {/* Generous, mostly-invisible grab zone so a swipe that starts
                    anywhere near the pill's top edge reliably opens/closes the
                    sheet — the visible pill bar itself is only 28×4px. */}
                <button
                  ref={bottomSheetHandleRef}
                  type="button"
                  aria-label={sheetOpenProgress > 0.5 ? 'Collapse bottom panel' : 'Expand bottom panel'}
                  onClick={() => (statusExpanded ? closeExpandedSurface() : openExpandedSurface(expandedSurfaceTab))}
                  className={`w-32 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none transition-[height,margin,opacity] duration-300 ease-out ${
                    hideHandle
                      ? 'h-0 my-0 opacity-0 pointer-events-none'
                      : statusExpanded
                        ? 'mt-0 -mb-ha-2 h-6'
                        : '-my-ha-2 h-6'
                  }`}
                >
                  <span className="w-7 h-[3px] rounded-full bg-text-secondary/30" />
                </button>
              </div>
              <div
                // w-0 while closed so the sheet's content can't widen the
                // now-shrink-to-fit pill.
                className={`overflow-hidden flex flex-col ${isSheetVisible ? 'mb-ha-1' : 'mb-0 w-0 pointer-events-none'}`}
                style={{
                  height: `calc(${sheetOpenProgress} * (100svh - ${SHEET_TOP_INSET_REM}rem))`,
                  opacity: Math.max(0, Math.min(1, sheetOpenProgress * 1.5)),
                  transition: isBottomSheetDragging
                    ? 'none'
                    : 'height 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                {/* Search header stays pinned above the scroll area — only the
                    results list scrolls, fading under the top gradient. */}
                {expandedSurfaceTab === 'search' && (
                  <div className="shrink-0 flex items-center gap-ha-3 px-ha-1 pt-ha-3 pb-ha-2">
                    <SearchField
                      value={expandedSearchQuery}
                      onChange={setExpandedSearchQuery}
                      placeholder="Search or ask anything..."
                      className="flex-1"
                    />
                    <IconButton icon={mdiClose} label="Close search" size="lg" shape="square" filled onClick={closeExpandedSurface} />
                  </div>
                )}
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
        {/* Top row: Ask your home + Media + Timer + Status. Collapses away while
            the pull-up sheet is open on a nav surface — see topRowVisibleRatio. */}
        <div
          className="overflow-hidden shrink-0"
          style={{
            maxHeight: `${52 * topRowVisibleRatio}px`,
            opacity: topRowVisibleRatio,
            pointerEvents: isTopRowHidden ? 'none' : 'auto',
            transition: isBottomSheetDragging
              ? 'none'
              : 'max-height 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
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
          {/* Ask your home — hidden for now: the assistant is reached via the
              spark-badged search tab in the bottom bar (design experiment). */}
          {false && (
          <button
            type="button"
            onClick={() => openAssistant()}
            aria-label="Ask your home"
            className="flex-1 min-w-0 h-10 flex items-center gap-ha-2 bg-surface-low rounded-full px-ha-3 active:scale-95 transition-transform"
          >
            <span className="text-sm text-text-disabled truncate flex-1 text-left">
              Ask <span className="text-text-tertiary/60 capitalize">{
                pathname === '/' ? 'Home' :
                pathname.startsWith('/dashboard/') ? pathname.split('/')[2] :
                pathname.startsWith('/panel/') ? pathname.split('/')[2] :
                'Home'
              }</span>…
            </span>
            <Icon path={mdiMicrophone} size={18} className="text-text-secondary flex-shrink-0" />
          </button>
          )}

          {/* Release + Media + Timer + Camera + Printer + Vacuum widgets container.
              Hidden from the bottom nav — activities now live only in Home Center
              ("Happening now"). */}
          {false && (showReleaseWidget || showMediaWidget || showTimerWidget || showCameraWidget || showPrinterWidget || showVacuumWidget) && (
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
                  style={{ order: visibleActivityTypes.indexOf('release') }}
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
                    className={`relative flex items-center justify-center rounded-full w-9 h-9 transition-all bg-surface-low border ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'release' &&
                      expandedWidgetId === activeRelease?.entityId
                        ? 'border-green-600 ring-2 ring-green-600/25'
                        : 'border-transparent'
                    }`}
                  >
                    <Icon path={mdiUpdate} size={14} exact className="text-green-600" />
                    {activeReleaseCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeReleaseCount}
                      </span>
                    )}
                    {activeReleaseCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                        <Icon path={mdiUpdate} size={10} exact className="text-green-600" />
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Camera - show when alert */}
              {visibleActivityTypes.includes('camera') && (
                <motion.div
                  key={`camera-widget-${activeCamera?.status.alertAt ?? 'quiet'}`}
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className={`relative ${activeCamera?.status.alertAt ? 'ha-status-pulse' : ''}`}
                  style={{ order: visibleActivityTypes.indexOf('camera') }}
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
                    className={`relative flex items-center justify-center rounded-full w-9 h-9 transition-all bg-red-500/10 border ${
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
                        className={`w-full h-full object-cover ${activeCamera?.status.phase === 'ended' ? '' : 'animate-pulse'}`}
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
                        <Icon path={mdiDoorbellVideo} size={10} exact className="text-white" />
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Printer - show when active */}
              {visibleActivityTypes.includes('printer') && (
                <motion.div
                  key={`printer-widget-${activePrinter?.status.alertAt ?? 'quiet'}`}
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className={`relative ${activePrinter?.status.alertAt ? 'ha-status-pulse' : ''} ${activePrinter?.status.isStale ? 'opacity-70' : ''}`}
                  style={{ order: visibleActivityTypes.indexOf('printer') }}
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
                    className={`relative flex items-center justify-center rounded-full w-9 h-9 transition-all bg-surface-low ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'printer' &&
                      expandedWidgetId === activePrinter?.entityId
                        ? 'ha-selected'
                        : ''
                    }`}
                  >
                    {activePrinter?.status.phase === 'ended' ? (
                      <Icon path={mdiCheckCircle} size={26} exact className={activePrinter?.status.endLabel === 'Print complete' ? 'text-green-600' : 'text-text-secondary'} />
                    ) : (
                      <CircularProgress
                        progress={(activePrinter?.progress || 0) / 100}
                        size={28}
                        strokeWidth={2.5}
                        className="text-ha-blue"
                        trackClassName="text-fill-primary-quiet"
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-surface-mid">
                          <img src={getEntityPictureUrl(activePrinter?.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                        </div>
                      </CircularProgress>
                    )}
                    {/* Count badge - always on top */}
                    {activePrinterCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activePrinterCount}
                      </span>
                    )}
                    {/* Type badge - only when a single item (count badge takes over otherwise) */}
                    {activePrinterCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                        <Icon path={mdiPrinter3d} size={10} exact className="text-ha-blue" />
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Vacuum - show when cleaning/returning */}
              {visibleActivityTypes.includes('vacuum') && (
                <motion.div
                  key="vacuum-widget"
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className={`relative ${activeVacuum?.status.isStale ? 'opacity-70' : ''}`}
                  style={{ order: visibleActivityTypes.indexOf('vacuum') }}
                >
                  <motion.button
                    layoutId={activeVacuum?.entityId}
                    onClick={() => {
                      if (activeVacuumCount > 1) {
                        setActivityListType('vacuum');
                      } else {
                        if (activeVacuum?.entityId) toggleWidgetSurface('vacuum', activeVacuum.entityId);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-9 h-9 transition-all bg-surface-low ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'vacuum' &&
                      expandedWidgetId === activeVacuum?.entityId
                        ? 'ha-selected'
                        : ''
                    }`}
                  >
                    {activeVacuum?.status.phase === 'ended' ? (
                      <Icon path={mdiCheckCircle} size={26} exact className="text-green-600" />
                    ) : (
                      <CircularProgress
                        progress={(activeVacuum?.progress || 0) / 100}
                        size={28}
                        strokeWidth={2.5}
                        className="text-ha-blue"
                        trackClassName="text-fill-primary-quiet"
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-surface-mid">
                          <img src={getEntityPictureUrl(activeVacuum?.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
                        </div>
                      </CircularProgress>
                    )}
                    {/* Count badge - always on top */}
                    {activeVacuumCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeVacuumCount}
                      </span>
                    )}
                    {/* Type badge - only when a single item (count badge takes over otherwise) */}
                    {activeVacuumCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                        <Icon path={mdiRobotVacuum} size={10} exact className="text-ha-blue" />
                      </span>
                    )}
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
                  className={`relative ${activeMedia?.status.isStale ? 'opacity-70' : ''}`}
                  style={{ order: visibleActivityTypes.indexOf('media') }}
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
                    className={`relative flex items-center justify-center rounded-full w-9 h-9 bg-surface-low transition-all ${
                      statusExpanded &&
                      expandedSurfaceTab === 'widget' &&
                      expandedWidgetType === 'media' &&
                      expandedWidgetId === activeMedia?.entityId
                        ? 'ha-selected'
                        : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center">
                      {activeMedia?.entityPicture ? (
                        <img src={getEntityPictureUrl(activeMedia?.entityPicture)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icon path={mdiPlay} size={15} exact className="text-ha-blue" />
                      )}
                    </div>
                    {/* Count badge - always on top */}
                    {activeMediaCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeMediaCount}
                      </span>
                    )}
                    {/* State badge - only when a single item (count badge takes over otherwise) */}
                    {activeMediaCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                        <Icon
                          path={activeMedia?.state === 'playing' ? mdiPlay : mdiPause}
                          size={10}
                          exact
                          className={activeMedia?.state === 'playing' ? 'text-ha-blue' : 'text-yellow-600'}
                        />
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {/* Timer - only show when active */}
              {visibleActivityTypes.includes('timer') && (
                <motion.div
                  key={`timer-widget-${activeTimer?.status.alertAt ?? 'quiet'}`}
                  layout="position"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={activityWidgetTransition}
                  className={`relative ${activeTimer?.status.alertAt ? 'ha-status-pulse' : ''}`}
                  style={{ order: visibleActivityTypes.indexOf('timer') }}
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
                    className={`relative flex items-center justify-center rounded-full w-9 h-9 transition-all bg-surface-low ${
                    statusExpanded &&
                    expandedSurfaceTab === 'widget' &&
                    expandedWidgetType === 'timer' &&
                    expandedWidgetId === activeTimer?.entityId
                      ? 'ha-selected'
                      : ''
                  }`}>
                    {activeTimer?.status.phase === 'ended' ? (
                      <Icon path={mdiCheckCircle} size={26} exact className="text-green-600" />
                    ) : (
                      <CircularProgress
                        progress={displayedTimerProgress}
                        size={28}
                        strokeWidth={2.5}
                        className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                        trackClassName={activeTimer?.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                      >
                        <Icon
                          path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                          size={13}
                          exact
                          className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                        />
                      </CircularProgress>
                    )}
                    {/* Count badge - always on top */}
                    {activeTimerCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[13px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center ring-1 ring-surface-default">
                        {activeTimerCount}
                      </span>
                    )}
                    {/* State badge - only when a single item (count badge takes over otherwise) */}
                    {activeTimerCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                        <Icon
                          path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                          size={10}
                          exact
                          className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                        />
                      </span>
                    )}
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
                    className="flex items-center justify-center rounded-full w-9 h-9 bg-surface-low border border-surface-lower text-text-secondary text-sm font-bold active:scale-95 transition-transform"
                  >
                    +{activityOverflowCount}
                  </button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )}

          {/* Status pill — hidden for now: Home Center is reached via its own tab
              in the bottom bar (design experiment). */}
          {false && (() => {
            const activeWidgetsCount = (showReleaseWidget ? 1 : 0) + (showMediaWidget ? 1 : 0) + (showTimerWidget ? 1 : 0) + (showCameraWidget ? 1 : 0) + (showPrinterWidget ? 1 : 0) + (showVacuumWidget ? 1 : 0);
            // Two indicators when activities compete for width, four when the row
            // is otherwise quiet; the chevron surfaces the rest.
            const maxIcons = activeWidgetsCount >= 1 ? 2 : 4;
            const hasMore = visibleSections.length > maxIcons;

            return (
              <button
                onClick={() => {
                  closeExpandedSurface();
                  openHomeCenter();
                }}
                className={`flex items-center gap-ha-3 bg-surface-low rounded-ha-xl px-ha-4 h-10 flex-shrink-0 ml-auto active:scale-95 transition-transform duration-300 ${statusPulsing ? 'ha-status-pulse' : ''}`}
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
        </div>

        {/* Bottom row: Navigation pill */}
        <div
          className="overflow-hidden shrink-0"
          style={{
            transition:
              'max-height 0.42s cubic-bezier(0.22,1,0.36,1), margin-top 0.42s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease-out, transform 0.42s cubic-bezier(0.22,1,0.36,1)',
            maxHeight: `${48 * bottomRowVisibleRatio}px`,
            // The tab strip sits an even 8px in from the pill on all sides. When
            // the drag handle shows (non-settings) its band already fills that 8px
            // top gap, so no extra margin; when it's hidden (settings routes) this
            // supplies the 8px directly.
            marginTop: `${(hideHandle ? 8 : 0) * bottomRowVisibleRatio}px`,
            opacity: bottomRowVisibleRatio,
            transform: `translateY(${8 * effectiveHideProgress}px)`,
            pointerEvents: isBottomRowHidden ? 'none' : 'auto',
          }}
        >
          {/* Concentric rounding: outer pill is --mobile-nav-radius with ha-2 (8px)
              side padding, so this inner strip is that radius minus 8px. */}
          <div className="mobile-nav-tabs flex items-center justify-center gap-ha-6 rounded-[calc(var(--mobile-nav-radius)_-_var(--ha-space-2))] px-ha-6 h-12">
            <button
              type="button"
              onClick={handleDashboardsTap}
              aria-label={pathname === '/' ? 'Browse dashboards and apps' : 'Home'}
              className={`relative h-full px-ha-2 flex items-center justify-center text-text-secondary transition-colors ${
                isDashboardsActive ? 'text-text-primary' : 'hover:text-text-primary'
              }`}
            >
              {/* Once you're home the tap changes meaning to "browse" — the caret
                  says there's more above, matching the sheet's drag handle. */}
              <Icon
                path={mdiChevronUp}
                size={16}
                exact
                className={`absolute top-0 left-1/2 -translate-x-1/2 text-text-tertiary transition-opacity ${
                  pathname === '/' && !statusExpanded ? 'opacity-100' : 'opacity-0'
                }`}
              />
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
              aria-label="Search or ask anything"
              className={`relative h-full px-ha-2 flex items-center justify-center transition-colors ${
                isSearchActive ? 'text-ha-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="relative inline-flex">
                <Icon path={mdiMagnify} size={28} />
                {/* AI spark — signifies the search also answers with the assistant */}
                <Icon path={mdiStarFourPoints} size={11} exact className="absolute -top-0.5 -right-0.5" />
              </span>
              <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-ha-blue transition-opacity ${
                isSearchActive ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
            {/* Prototyping flag hides the Home Center tab (see DebugFlagsContext). */}
            {!hideHomeCenterEnabled && (
            <button
              type="button"
              onClick={() => openExpandedSurface('homecenter')}
              aria-label="Home Center"
              className={`relative h-full px-ha-2 flex items-center justify-center transition-colors ${
                isHomeCenterSurfaceVisible ? 'text-ha-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon path={HOME_CENTER_ICON} size={28} />
              <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-ha-blue transition-opacity ${
                isHomeCenterSurfaceVisible ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
            )}
            <button
              type="button"
              onClick={handleSettingsTap}
              className={`relative h-full pl-ha-4 pr-ha-2 flex items-center justify-center transition-opacity ${
                isSettingsActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <SettingsGlyph hover={false} />
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
        type SheetItem = { type: WidgetSurfaceType; entityId: string; name: string; subtitle: string; status?: ActivityStatus };
        const endedSubtitle = (status: ActivityStatus, fallback: string) =>
          status.phase === 'ended' ? (status.endLabel || 'Ended') : fallback;
        const releaseItems: SheetItem[] = visibleReleaseNotes.map((n) => ({ type: 'release', entityId: n.entityId, name: n.name, subtitle: n.version, status: n.status }));
        const cameraItems: SheetItem[] = allActiveCameras.map((c) => ({ type: 'camera', entityId: c.entityId, name: c.name, subtitle: c.event ?? '', status: c.status }));
        const printerItems: SheetItem[] = allActivePrinters.map((p) => ({ type: 'printer', entityId: p.entityId, name: p.name, subtitle: endedSubtitle(p.status, `${p.progress}% complete`), status: p.status }));
        const vacuumItems: SheetItem[] = allActiveVacuums.map((v) => ({ type: 'vacuum', entityId: v.entityId, name: v.name, subtitle: endedSubtitle(v.status, `${v.progress}% • ${v.area || 'Cleaning'}`), status: v.status }));
        const mediaItems: SheetItem[] = allActiveMedia.map((m) => ({ type: 'media', entityId: m.entityId, name: m.name, subtitle: m.state, status: m.status }));
        const timerItems: SheetItem[] = allActiveTimers.map((t) => ({ type: 'timer', entityId: t.entityId, name: t.name, subtitle: endedSubtitle(t.status, t.remaining), status: t.status }));
        const updateItems: SheetItem[] = activities.updateInstalls.map(({ summary, status }) => ({ type: 'update', entityId: summary.entityId, name: summary.name, subtitle: endedSubtitle(status, summary.percentage !== null ? `${summary.percentage}% installed` : 'Installing…'), status }));
        const backupItems: SheetItem[] = activities.backups.map(({ summary, status }) => ({ type: 'backup', entityId: summary.entityId, name: summary.name, subtitle: endedSubtitle(status, summary.stage || (summary.progress !== null ? `${summary.progress}%` : 'Running…')), status }));
        const alarmItems: SheetItem[] = activities.alarms.map(({ summary, status }) => ({ type: 'alarm', entityId: summary.entityId, name: summary.name, subtitle: endedSubtitle(status, summary.state === 'triggered' ? 'Triggered' : summary.state === 'pending' ? 'Pending' : 'Arming'), status }));
        const byType: Record<WidgetSurfaceType, SheetItem[]> = {
          release: releaseItems, camera: cameraItems, printer: printerItems, vacuum: vacuumItems, media: mediaItems, timer: timerItems,
          update: updateItems, backup: backupItems, alarm: alarmItems,
        };
        const items: SheetItem[] = activityListType === 'all'
          ? activities.typeOrder.flatMap((type) => byType[type])
          : byType[activityListType];
        const selectedIdFor = (type: WidgetSurfaceType) =>
          type === 'release' ? selectedReleaseId
          : type === 'media' ? selectedMediaId
          : type === 'timer' ? selectedTimerId
          : type === 'camera' ? selectedCameraId
          : type === 'printer' ? selectedPrinterId
          : type === 'update' ? selectedUpdateId
          : type === 'backup' ? selectedBackupId
          : type === 'alarm' ? selectedAlarmId
          : selectedVacuumId;
        const ACTIVITY_META: Record<WidgetSurfaceType, { icon: string; iconBg: string; iconColor: string }> = {
          release: { icon: mdiUpdate, iconBg: 'bg-green-500/10', iconColor: 'text-green-600' },
          camera: { icon: mdiDoorbellVideo, iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
          printer: { icon: mdiPrinter3d, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          vacuum: { icon: mdiRobotVacuum, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          media: { icon: mdiPlay, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          timer: { icon: mdiTimerOutline, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          update: { icon: mdiUpdate, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          backup: { icon: mdiCloudUpload, iconBg: 'bg-fill-primary-normal', iconColor: 'text-ha-blue' },
          alarm: { icon: mdiShieldAlert, iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
        };
        const title = activityListType === 'all' ? 'Active Now'
          : activityListType === 'release' ? "What's New"
          : activityListType === 'media' ? 'Active Media Players'
          : activityListType === 'timer' ? 'Active Timers'
          : activityListType === 'camera' ? 'Active Cameras'
          : activityListType === 'vacuum' ? 'Active Vacuums'
          : activityListType === 'update' ? 'Updates Installing'
          : activityListType === 'backup' ? 'Backups Running'
          : activityListType === 'alarm' ? 'Alarm'
          : 'Active Printers';
        return (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setActivityListType(null)}
            />
            {/* Sheet */}
            <div className="relative bg-surface-default w-full rounded-t-ha-sheet shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[70vh]">
              {/* Handle */}
              <div className="flex justify-center pt-ha-3 pb-ha-1 flex-shrink-0" onClick={() => setActivityListType(null)}>
                <SheetGrabber />
              </div>
              {/* Header — the shared one */}
              <SheetHeader
                eyebrow="Happening now"
                title={title}
                onClose={() => setActivityListType(null)}
                className="border-b border-surface-low"
              />
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
                    const isEnded = item.status?.phase === 'ended';
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
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isEnded ? 'bg-green-500/10' : meta.iconBg}`}>
                          <Icon path={isEnded ? mdiCheckCircle : meta.icon} size={18} className={isEnded ? 'text-green-600' : meta.iconColor} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-semibold text-text-primary truncate">{item.name}</span>
                          <span className={`text-xs truncate ${isEnded ? 'text-green-600 font-semibold' : 'text-text-secondary'}`}>{item.subtitle}</span>
                        </div>
                        {isEnded && item.status ? (
                          <span
                            role="button"
                            aria-label="Dismiss"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissActivity(item.entityId, endedDismissKey(item.status!));
                            }}
                            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors flex-shrink-0"
                          >
                            <Icon path={mdiClose} size={16} />
                          </span>
                        ) : (
                          <Icon path={mdiChevronRight} size={18} className="text-text-disabled flex-shrink-0" />
                        )}
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
      message="Hides it from your sidebar — bring it back anytime while rearranging."
      confirmLabel="Remove"
      cancelLabel="Keep"
      destructive
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => {
        if (pendingDelete) hideItem(pendingDelete.id);
        setPendingDelete(null);
      }}
    />

    <ShortcutPicker open={shortcutPickerOpen} onClose={() => setShortcutPickerOpen(false)} />
    </>
  );
}
