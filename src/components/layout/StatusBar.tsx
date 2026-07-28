'use client';

import { useEffect, useState, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { CircularProgress } from '../ui/CircularProgress';
import { RollingNumericValue } from '../ui/RollingNumericValue';
import { useHomeAssistant, useHomeCenterPrefs } from '@/hooks';
import { useAssistantContext, useHomeCenterContext } from '@/contexts';
import { useActivities } from '@/hooks/useActivities';
import { dismissActivity } from '@/lib/activities/dismissals';
import { endedDismissKey } from '@/lib/activities/ledger';
import { ALERT_WINDOW_MS, type ActivityStatus, type ActivityType } from '@/lib/activities/types';
import { HomeCenterPillIndicators } from '../sections/HomeCenterStatus';
import { subscribeStatusPulse } from '@/lib/statusPulseBus';
import {
  mdiMicrophone,
  mdiPlay,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiTimerOutline,
  mdiPause,
  mdiUpdate,
  mdiClose,
  mdiChevronRight,
  mdiDoorbellVideo,
  mdiOpenInNew,
  mdiPin,
  mdiPinOff,
  mdiChevronDown,
  mdiChevronUp,
  mdiVolumeHigh,
  mdiStop,
  mdiAccount,
  mdiVideo,
  mdiMenu,
  mdiRobotVacuum,
  mdiBatteryHigh,
  mdiMapMarkerRadius,
  mdiCheckCircle,
  mdiArrowTopRight,
  mdiCloudUpload,
  mdiShieldAlert,
} from '@mdi/js';

const RELEASE_NOTES_PREFIX = 'update.home_assistant_release_notes_simulated';

interface Timer {
  entity_id: string;
  name: string;
  state: string;
  remaining: string;
  duration: string;
  durationSec: number;
  finishesAt?: string;
  progress: number;
  status: ActivityStatus;
}

interface MediaPlayer {
  entity_id: string;
  name: string;
  state: string;
  mediaTitle?: string;
  mediaArtist?: string;
  entityPicture?: string;
  status: ActivityStatus;
}

interface Camera {
  entity_id: string;
  name: string;
  state: string;
  event?: string;
  entityPicture?: string;
  since: string;
  status: ActivityStatus;
}

interface Printer {
  entity_id: string;
  name: string;
  state: string;
  progress: number;
  fileName?: string;
  remainingTime?: string;
  entityPicture?: string;
  status: ActivityStatus;
}

interface Vacuum {
  entity_id: string;
  name: string;
  state: string;
  progress: number;
  area?: string;
  battery?: number;
  fanSpeed?: string;
  remainingTime?: string;
  entityPicture?: string;
  status: ActivityStatus;
}

interface ReleaseNotesWidget {
  entity_id: string;
  name: string;
  version: string;
  summary: string;
  notes: string[];
  updatedAt: string;
  status: ActivityStatus;
}

interface UpdateInstall {
  entity_id: string;
  name: string;
  percentage: number | null;
  installedVersion?: string;
  latestVersion?: string;
  entityPicture?: string;
  status: ActivityStatus;
}

interface BackupRun {
  entity_id: string;
  name: string;
  progress: number | null;
  stage?: string;
  status: ActivityStatus;
}

interface AlarmWidget {
  entity_id: string;
  name: string;
  state: string;
  since: string;
  status: ActivityStatus;
}

type ActivityWidgetKey =
  | 'release-notes-widget'
  | 'media-widget'
  | 'timer-widget'
  | 'camera-widget'
  | 'printer-widget'
  | 'vacuum-widget'
  | 'update-widget'
  | 'backup-widget'
  | 'alarm-widget';

const ACTIVITY_FLYOUT_WIDTHS: Record<ActivityWidgetKey, number> = {
  'release-notes-widget': 320,
  'media-widget': 280,
  'timer-widget': 260,
  'camera-widget': 340,
  'printer-widget': 280,
  'vacuum-widget': 280,
  'update-widget': 280,
  'backup-widget': 280,
  'alarm-widget': 300,
};

const DEFAULT_ACTIVITY_FLYOUT_STYLE: CSSProperties = {
  left: '50%',
  bottom: 88,
};

const DEFAULT_ACTIVITY_WIDGET_WIDTHS: Record<ActivityWidgetKey, number> = {
  'release-notes-widget': 176,
  'media-widget': 176,
  'timer-widget': 168,
  'camera-widget': 176,
  'printer-widget': 188,
  'vacuum-widget': 188,
  'update-widget': 188,
  'backup-widget': 188,
  'alarm-widget': 176,
};

const PINNED_ACTIVITY_FOOTER_SLOT_STYLE: CSSProperties = {
  position: 'fixed',
  width: 0,
  height: 0,
  left: 0,
  top: 0,
};

/** Popped-out activity windows share the device-card modal's card language:
    a wide centered card, generous rounding, and the same deep soft shadow. */
const ACTIVITY_DIALOG_WIDTH = 460;
const ACTIVITY_DIALOG_CARD_CLASS = 'z-[200] bg-surface-default rounded-ha-3xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]';
const ACTIVITY_DOCK_CARD_CLASS = '-translate-x-1/2 z-50 bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low';

function formatTimeRemaining(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function systemPrefers24HourClock(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
    const { hourCycle } = formatter.resolvedOptions();
    if (hourCycle) {
      return hourCycle === 'h23' || hourCycle === 'h24';
    }
    return !formatter.formatToParts(new Date()).some((part) => part.type === 'dayPeriod');
  } catch {
    return false;
  }
}

/** Deep-link target per activity type — tap-through lands on the matching domain page. */
const ACTIVITY_DEEP_LINKS: Record<ActivityType, string | null> = {
  media: '/type/media_player',
  timer: '/type/timer',
  camera: '/type/camera',
  printer: '/type/sensor',
  vacuum: '/type/vacuum',
  release: null,
  update: '/type/update',
  backup: '/type/backup',
  alarm: '/type/alarm_control_panel',
};

function formatRelativeAge(sinceIso: string, nowMs: number): string {
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return '';
  const seconds = Math.max(0, Math.floor((nowMs - since) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function isAlerting(status: ActivityStatus, nowMs: number): boolean {
  return status.alertAt !== null && nowMs - status.alertAt < ALERT_WINDOW_MS;
}

/** Never render a blank or zero countdown — show working intent instead. */
function formatRemainingLabel(remaining: string | undefined): string {
  if (!remaining || parseTimeToSeconds(remaining) <= 0) return 'Calculating…';
  return remaining;
}

/** Same "never blank" rule for percentage-based progress that starts unknown. */
function formatProgressLabel(progress: number | null): string {
  return progress === null ? 'Calculating…' : `${progress}%`;
}

function resolveEntityPictureUrl(haUrl: string | undefined, picture: string | undefined | null): string | undefined {
  if (!picture) return undefined;

  const trimmed = picture.trim();
  if (!trimmed) return undefined;

  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  if (!haUrl) {
    return trimmed;
  }

  const base = haUrl.replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;

interface StatusBarProps {
  connectionStatus?: ConnectionStatusType;
  onProfileToggle?: () => void;
  editModeFade?: boolean;
}

export function StatusBar({ connectionStatus, onProfileToggle, editModeFade }: StatusBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { callService, haUrl } = useHomeAssistant();
  const { toggleAssistant } = useAssistantContext();
  const { toggleHomeCenter } = useHomeCenterContext();
  const { data: activityData, activities } = useActivities();
  const { visibleSections } = useHomeCenterPrefs();
  const [currentTime, setCurrentTime] = useState({ hours: '', minutes: '' });
  // Pulse the clock pill when a toast about one of its sections appears.
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
  const [timerDisplays, setTimerDisplays] = useState<Record<string, string>>({});
  const [timerProgress, setTimerProgress] = useState<Record<string, number>>({});
  const use24HourClock = useMemo(() => systemPrefers24HourClock(), []);
  const [isAM, setIsAM] = useState(true);
  const [colonVisible, setColonVisible] = useState(true);
  // Widget container refs
  const widgetContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Widget expansion state
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  const [activityWidgetView, setActivityWidgetView] = useState<'dock' | 'dialog' | 'pinned'>('dock');
  const [activityDialogOffset, setActivityDialogOffset] = useState({ x: 0, y: 0 });
  const [hoveredActivityWidget, setHoveredActivityWidget] = useState<ActivityWidgetKey | null>(null);
  const [activityFlyoutStyles, setActivityFlyoutStyles] = useState<Record<ActivityWidgetKey, CSSProperties>>({
    'release-notes-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'media-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'timer-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'camera-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'printer-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'vacuum-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'update-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'backup-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'alarm-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
  });
  const [activityWidgetWidths, setActivityWidgetWidths] = useState<Record<ActivityWidgetKey, number>>(DEFAULT_ACTIVITY_WIDGET_WIDTHS);
  // Client clock driving alert pulses and relative "Xm ago" labels. The clock
  // interval below already re-renders every second, so this rides along.
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Status pop-up state — retained for the activity-widget outside-click logic;
  // the status pill itself now opens the Home Center bento overlay directly.
  const [statusExpanded, setStatusExpanded] = useState(false);
  const statusContainerRef = useRef<HTMLDivElement>(null);

  // Footer scroll state
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);
  const activitiesScrollRef = useRef<HTMLDivElement>(null);
  const activityDialogRef = useRef<HTMLDivElement | null>(null);
  const activityPreviewHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityDialogDragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const activityDialogDragMoveRef = useRef<((event: MouseEvent) => void) | null>(null);
  const activityDialogDragUpRef = useRef<(() => void) | null>(null);

  const isActivityWidgetId = (widgetId: string | null) => {
    if (!widgetId) return false;

    if (
      widgetId === 'list-release-notes'
      || widgetId === 'list-media'
      || widgetId === 'list-timer'
      || widgetId === 'list-camera'
      || widgetId === 'list-printer'
      || widgetId === 'list-vacuum'
      || widgetId === 'list-update'
      || widgetId === 'list-backup'
      || widgetId === 'list-alarm'
    ) {
      return true;
    }

    return (
      widgetId === RELEASE_NOTES_PREFIX
      || widgetId.startsWith('media_player.')
      || widgetId.startsWith('timer.')
      || widgetId.startsWith('camera.')
      || widgetId.startsWith('binary_sensor.camera_simulated')
      || widgetId.startsWith('sensor.printer_')
      || widgetId === 'sensor.printer_simulated'
      || widgetId.includes('printer')
      || widgetId.startsWith('vacuum.')
      || widgetId.startsWith('update.')
      || widgetId.startsWith('backup.')
      || widgetId.startsWith('alarm_control_panel.')
    );
  };

  const isActivityDialogOpen = activityWidgetView === 'dialog' && isActivityWidgetId(expandedWidgetId);
  const isPinnedActivityWidget = activityWidgetView === 'pinned' && isActivityWidgetId(expandedWidgetId);
  const isFloatingActivityWidget = (activityWidgetView === 'dialog' || activityWidgetView === 'pinned') && isActivityWidgetId(expandedWidgetId);
  const checkActivitiesScroll = () => {
    if (!activitiesScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = activitiesScrollRef.current;
    setShowLeftGradient(scrollLeft > 0);
    setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    checkActivitiesScroll();
    window.addEventListener('resize', checkActivitiesScroll);
    return () => window.removeEventListener('resize', checkActivitiesScroll);
  }, []);

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusExpanded && statusContainerRef.current && !statusContainerRef.current.contains(event.target as Node)) {
        setStatusExpanded(false);
      }
      if (expandedWidgetId) {
        if ((activityWidgetView === 'dialog' || activityWidgetView === 'pinned') && isActivityWidgetId(expandedWidgetId)) {
          // Floating modes should close only through controls inside the widget.
          return;
        }

        let activeRef: HTMLDivElement | null = null;
        if (expandedWidgetId === 'list-release-notes') {
          activeRef = widgetContainerRefs.current['release-notes-widget'];
        } else if (expandedWidgetId === 'list-media') {
          activeRef = widgetContainerRefs.current['media-widget'];
        } else if (expandedWidgetId === 'list-timer') {
          activeRef = widgetContainerRefs.current['timer-widget'];
        } else if (expandedWidgetId === 'list-camera') {
          activeRef = widgetContainerRefs.current['camera-widget'];
        } else if (expandedWidgetId === 'list-printer') {
          activeRef = widgetContainerRefs.current['printer-widget'];
        } else if (expandedWidgetId === 'list-vacuum') {
          activeRef = widgetContainerRefs.current['vacuum-widget'];
        } else if (expandedWidgetId === 'list-update') {
          activeRef = widgetContainerRefs.current['update-widget'];
        } else if (expandedWidgetId === 'list-backup') {
          activeRef = widgetContainerRefs.current['backup-widget'];
        } else if (expandedWidgetId === 'list-alarm') {
          activeRef = widgetContainerRefs.current['alarm-widget'];
        } else {
          // It's an entity_id — check all widget containers
          activeRef = widgetContainerRefs.current['release-notes-widget']
            ?? widgetContainerRefs.current['media-widget']
            ?? widgetContainerRefs.current['timer-widget']
            ?? widgetContainerRefs.current['camera-widget']
            ?? widgetContainerRefs.current['printer-widget']
            ?? widgetContainerRefs.current['vacuum-widget']
            ?? widgetContainerRefs.current['update-widget']
            ?? widgetContainerRefs.current['backup-widget']
            ?? widgetContainerRefs.current['alarm-widget']
            ?? null;
          // Find the specific one that contains the click target
          const allRefs = ['release-notes-widget', 'media-widget', 'timer-widget', 'camera-widget', 'printer-widget', 'vacuum-widget', 'update-widget', 'backup-widget', 'alarm-widget'];
          const containingRef = allRefs.find(key => {
            const ref = widgetContainerRefs.current[key];
            return ref && ref.contains(event.target as Node);
          });
          if (containingRef) {
            // Click is inside a widget container, don't close
            return;
          }
          // Click is outside all widget containers, close
          setExpandedWidgetId(null);
          setHoveredActivityWidget(null);
          setActivityWidgetView('dock');
          return;
        }

        if (activeRef && !activeRef.contains(event.target as Node)) {
          setExpandedWidgetId(null);
          setHoveredActivityWidget(null);
          setActivityWidgetView('dock');
        }
      }
    };

    if (statusExpanded || expandedWidgetId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusExpanded, expandedWidgetId, setExpandedWidgetId, setStatusExpanded, activityWidgetView]);

  const updateActivityFlyoutPosition = useCallback((widgetKey: ActivityWidgetKey) => {
    if (typeof window === 'undefined') return;

    const anchor = widgetContainerRefs.current[widgetKey];
    if (!anchor) return;

    const width = ACTIVITY_FLYOUT_WIDTHS[widgetKey];
    const rect = anchor.getBoundingClientRect();
    const measuredWidth = Math.max(48, Math.round(rect.width));
    const center = rect.left + rect.width / 2;
    const halfWidth = width / 2;
    const viewportPadding = 16;
    const clampedCenter = Math.min(
      window.innerWidth - viewportPadding - halfWidth,
      Math.max(viewportPadding + halfWidth, center),
    );
    const nextStyle: CSSProperties = {
      left: clampedCenter,
      bottom: window.innerHeight - rect.top + 8,
    };

    setActivityFlyoutStyles((prev) => {
      const current = prev[widgetKey];
      if (current.left === nextStyle.left && current.bottom === nextStyle.bottom) {
        return prev;
      }
      return { ...prev, [widgetKey]: nextStyle };
    });

    setActivityWidgetWidths((prev) => {
      if (prev[widgetKey] === measuredWidth) return prev;
      return { ...prev, [widgetKey]: measuredWidth };
    });
  }, []);

  const clearActivityPreviewHideTimeout = useCallback(() => {
    if (activityPreviewHideTimeoutRef.current) {
      clearTimeout(activityPreviewHideTimeoutRef.current);
      activityPreviewHideTimeoutRef.current = null;
    }
  }, []);

  const showActivityPreview = useCallback((widgetKey: ActivityWidgetKey) => {
    if (expandedWidgetId) return;
    clearActivityPreviewHideTimeout();
    updateActivityFlyoutPosition(widgetKey);
    setHoveredActivityWidget(widgetKey);
  }, [clearActivityPreviewHideTimeout, expandedWidgetId, updateActivityFlyoutPosition]);

  const scheduleHideActivityPreview = useCallback((widgetKey: ActivityWidgetKey) => {
    clearActivityPreviewHideTimeout();
    activityPreviewHideTimeoutRef.current = setTimeout(() => {
      setHoveredActivityWidget((current) => (current === widgetKey ? null : current));
      activityPreviewHideTimeoutRef.current = null;
    }, 140);
  }, [clearActivityPreviewHideTimeout]);

  useEffect(() => () => {
    clearActivityPreviewHideTimeout();
  }, [clearActivityPreviewHideTimeout]);

  const stopActivityDialogDrag = useCallback(() => {
    if (activityDialogDragMoveRef.current) {
      window.removeEventListener('mousemove', activityDialogDragMoveRef.current);
      activityDialogDragMoveRef.current = null;
    }
    if (activityDialogDragUpRef.current) {
      window.removeEventListener('mouseup', activityDialogDragUpRef.current);
      activityDialogDragUpRef.current = null;
    }
    activityDialogDragStateRef.current = null;
    document.body.style.userSelect = '';
  }, []);

  const handleActivityDialogHeaderMouseDown = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (activityWidgetView === 'dock') return;

    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, label, [data-no-drag="true"]')) {
      return;
    }

    event.preventDefault();
    const origin = activityDialogOffset;
    activityDialogDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
    };

    const onMove = (moveEvent: MouseEvent) => {
      if (!activityDialogDragStateRef.current) return;
      const deltaX = moveEvent.clientX - activityDialogDragStateRef.current.startX;
      const deltaY = moveEvent.clientY - activityDialogDragStateRef.current.startY;
      setActivityDialogOffset({
        x: activityDialogDragStateRef.current.originX + deltaX,
        y: activityDialogDragStateRef.current.originY + deltaY,
      });
    };

    const onUp = () => {
      stopActivityDialogDrag();
    };

    activityDialogDragMoveRef.current = onMove;
    activityDialogDragUpRef.current = onUp;
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [activityDialogOffset, activityWidgetView, stopActivityDialogDrag]);

  useEffect(() => () => {
    stopActivityDialogDrag();
  }, [stopActivityDialogDrag]);

  const activityDialogStyle = useMemo<CSSProperties>(() => ({
    left: '50%',
    top: '50%',
    // Center via the independent `translate` CSS property, not `transform`:
    // the dialog card animates scale/y with framer-motion, which owns and
    // overwrites `transform` — a translate placed there gets dropped, leaving
    // the card anchored by its top-left corner (off to the lower-right).
    translate: `calc(-50% + ${activityDialogOffset.x}px) calc(-50% + ${activityDialogOffset.y}px)`,
  }), [activityDialogOffset.x, activityDialogOffset.y]);

  useEffect(() => {
    if (!isFloatingActivityWidget) {
      stopActivityDialogDrag();
    }
  }, [isFloatingActivityWidget, stopActivityDialogDrag]);

  const openActivityWidget = useCallback((widgetId: string, widgetKey: ActivityWidgetKey, view: 'dock' | 'dialog' | 'pinned' = 'dock') => {
    clearActivityPreviewHideTimeout();
    updateActivityFlyoutPosition(widgetKey);
    setActivityDialogOffset({ x: 0, y: 0 });
    setHoveredActivityWidget(null);
    setActivityWidgetView(view);
    setExpandedWidgetId(widgetId);
  }, [clearActivityPreviewHideTimeout, updateActivityFlyoutPosition]);

  const openActivityWidgetDialog = useCallback((widgetId: string, widgetKey: ActivityWidgetKey) => {
    openActivityWidget(widgetId, widgetKey, 'dialog');
  }, [openActivityWidget]);

  const togglePinActivityWidget = useCallback(() => {
    if (!isActivityWidgetId(expandedWidgetId)) return;

    if (activityWidgetView === 'pinned') {
      stopActivityDialogDrag();
      setActivityWidgetView('dock');
      return;
    }

    setActivityWidgetView('pinned');
  }, [activityWidgetView, expandedWidgetId, stopActivityDialogDrag]);

  const minimizeActivityWidget = useCallback(() => {
    clearActivityPreviewHideTimeout();
    stopActivityDialogDrag();
    setActivityDialogOffset({ x: 0, y: 0 });
    setHoveredActivityWidget(null);
    setActivityWidgetView('dock');
    setExpandedWidgetId(null);
  }, [clearActivityPreviewHideTimeout, stopActivityDialogDrag]);

  // Tap-through: deep link straight to the matching domain page (never a
  // generic landing), closing any open flyout first.
  const openActivityDeepLink = useCallback((type: ActivityType) => {
    const target = ACTIVITY_DEEP_LINKS[type];
    if (!target) return;
    minimizeActivityWidget();
    router.push(target);
  }, [minimizeActivityWidget, router]);

  const renderActivityWindowActions = useCallback(
    (onClose: (event: React.MouseEvent<HTMLButtonElement>) => void, closeIconPath: string, deepLinkType?: ActivityType) => (
      <div className="flex items-center gap-0.5 rounded-full bg-surface-low p-0.5" data-no-drag="true">
        {deepLinkType && ACTIVITY_DEEP_LINKS[deepLinkType] && (
          <button
            type="button"
            aria-label="Open details page"
            onClick={(event) => {
              event.stopPropagation();
              openActivityDeepLink(deepLinkType);
            }}
            className="p-ha-1 hover:bg-surface-mid rounded-full transition-colors"
          >
            <Icon path={mdiArrowTopRight} size={17} className="text-text-secondary" />
          </button>
        )}
        <button
          type="button"
          aria-label={isPinnedActivityWidget ? 'Unpin widget' : 'Pin widget'}
          onClick={(event) => {
            event.stopPropagation();
            togglePinActivityWidget();
          }}
          className="p-ha-1 hover:bg-surface-mid rounded-full transition-colors"
        >
          <Icon path={isPinnedActivityWidget ? mdiPinOff : mdiPin} size={17} className="text-text-secondary" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-ha-1 hover:bg-surface-mid rounded-full transition-colors"
        >
          <Icon path={closeIconPath} size={18} className="text-text-secondary" />
        </button>
      </div>
    ),
    [isPinnedActivityWidget, togglePinActivityWidget, openActivityDeepLink]
  );

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const displayHours = use24HourClock ? hours.toString().padStart(2, '0') : (hours % 12 || 12).toString();
      setIsAM(hours < 12);
      setColonVisible((prev) => !prev);
      setNowMs(now.getTime());
      setCurrentTime({
        hours: displayHours,
        minutes: now.getMinutes().toString().padStart(2, '0'),
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [use24HourClock]);

  // Per-type lists come from the activity ledger: relevance-sorted, with
  // ended items lingering in their final state and dismissals filtered out.
  const activeTimers = useMemo<Timer[]>(() => activities.timers.map(({ summary, status }) => {
    const remainingSec = parseTimeToSeconds(summary.remaining);
    return {
      entity_id: summary.entityId,
      name: summary.name,
      state: summary.state,
      remaining: summary.remaining,
      duration: summary.duration,
      durationSec: summary.durationSec,
      finishesAt: summary.finishesAt,
      progress: summary.durationSec > 0 ? remainingSec / summary.durationSec : 0,
      status,
    };
  }), [activities.timers]);

  const activePlayers = useMemo<MediaPlayer[]>(() => activities.players.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    state: summary.state,
    mediaTitle: summary.mediaTitle,
    mediaArtist: summary.mediaArtist,
    entityPicture: summary.entityPicture,
    status,
  })), [activities.players]);

  const activeCameras = useMemo<Camera[]>(() => activities.cameras.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    state: summary.state,
    event: summary.event,
    entityPicture: summary.entityPicture,
    since: summary.since,
    status,
  })), [activities.cameras]);

  const activePrinters = useMemo<Printer[]>(() => activities.printers.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    state: summary.state,
    progress: summary.progress,
    fileName: summary.fileName || 'Unknown file',
    remainingTime: summary.remainingTime,
    entityPicture: summary.entityPicture,
    status,
  })), [activities.printers]);

  const activeVacuums = useMemo<Vacuum[]>(() => activities.vacuums.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    state: summary.state,
    progress: summary.progress,
    area: summary.area,
    battery: summary.battery,
    fanSpeed: summary.fanSpeed,
    remainingTime: summary.remainingTime,
    entityPicture: summary.entityPicture,
    status,
  })), [activities.vacuums]);

  const visibleReleaseNotes = useMemo<ReleaseNotesWidget[]>(() => activities.releaseNotes.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    version: summary.version,
    summary: summary.summary,
    notes: summary.notes,
    updatedAt: summary.updatedAt,
    status,
  })), [activities.releaseNotes]);

  const activeUpdateInstalls = useMemo<UpdateInstall[]>(() => activities.updateInstalls.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    percentage: summary.percentage,
    installedVersion: summary.installedVersion,
    latestVersion: summary.latestVersion,
    entityPicture: summary.entityPicture,
    status,
  })), [activities.updateInstalls]);

  const activeBackups = useMemo<BackupRun[]>(() => activities.backups.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    progress: summary.progress,
    stage: summary.stage,
    status,
  })), [activities.backups]);

  const activeAlarms = useMemo<AlarmWidget[]>(() => activities.alarms.map(({ summary, status }) => ({
    entity_id: summary.entityId,
    name: summary.name,
    state: summary.state,
    since: summary.since,
    status,
  })), [activities.alarms]);

  const isExpandedActivityValid = useMemo(() => {
    if (!expandedWidgetId || !isActivityWidgetId(expandedWidgetId)) return true;

    if (expandedWidgetId === 'list-release-notes') return visibleReleaseNotes.length > 0;
    if (expandedWidgetId === 'list-media') return activePlayers.length > 0;
    if (expandedWidgetId === 'list-timer') return activeTimers.length > 0;
    if (expandedWidgetId === 'list-camera') return activeCameras.length > 0;
    if (expandedWidgetId === 'list-printer') return activePrinters.length > 0;
    if (expandedWidgetId === 'list-vacuum') return activeVacuums.length > 0;
    if (expandedWidgetId === 'list-update') return activeUpdateInstalls.length > 0;
    if (expandedWidgetId === 'list-backup') return activeBackups.length > 0;
    if (expandedWidgetId === 'list-alarm') return activeAlarms.length > 0;

    if (expandedWidgetId.startsWith(RELEASE_NOTES_PREFIX)) {
      return visibleReleaseNotes.some((note) => note.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('media_player.')) {
      return activePlayers.some((player) => player.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('timer.')) {
      return activeTimers.some((timer) => timer.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('camera.') || expandedWidgetId.startsWith('binary_sensor.camera_simulated')) {
      return activeCameras.some((camera) => camera.entity_id === expandedWidgetId);
    }
    if (
      expandedWidgetId.startsWith('sensor.printer_')
      || expandedWidgetId === 'sensor.printer_simulated'
      || expandedWidgetId.includes('printer')
    ) {
      return activePrinters.some((printer) => printer.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('vacuum.')) {
      return activeVacuums.some((vacuum) => vacuum.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('update.')) {
      return activeUpdateInstalls.some((update) => update.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('backup.')) {
      return activeBackups.some((backup) => backup.entity_id === expandedWidgetId);
    }
    if (expandedWidgetId.startsWith('alarm_control_panel.')) {
      return activeAlarms.some((alarm) => alarm.entity_id === expandedWidgetId);
    }

    return true;
  }, [
    expandedWidgetId,
    activeCameras,
    activePlayers,
    activePrinters,
    activeVacuums,
    activeTimers,
    activeUpdateInstalls,
    activeBackups,
    activeAlarms,
    visibleReleaseNotes,
  ]);

  useEffect(() => {
    if (!expandedWidgetId || !isActivityWidgetId(expandedWidgetId) || isExpandedActivityValid) return;

    const frameId = window.requestAnimationFrame(() => {
      minimizeActivityWidget();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    expandedWidgetId,
    isExpandedActivityValid,
    minimizeActivityWidget,
  ]);

  const activityWidgetTransition = {
    duration: 0.16,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  const activityWindowTransition = {
    duration: 0.28,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  const activityMiniTransition = {
    duration: 0.12,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  // Calculate remaining time and progress for display (updates every second)
  useEffect(() => {
    if (activeTimers.length === 0) {
      // Use functional update to avoid synchronous loop or just let it be handled by render
      return;
    }

    const updateTimerDisplays = () => {
      const displays: Record<string, string> = {};
      const progress: Record<string, number> = {};

      activeTimers.forEach((timer) => {
        const durationSec = timer.durationSec;

        if (timer.status.phase === 'ended') {
          // Final state: the chronometer freezes at zero.
          displays[timer.entity_id] = '0:00';
          progress[timer.entity_id] = 0;
        } else if (timer.state === 'active') {
          const finishesAt = timer.finishesAt;
          if (finishesAt && typeof finishesAt === 'string') {
            const finishTime = new Date(finishesAt).getTime();
            const now = Date.now();
            const remainingSec = Math.max(0, Math.floor((finishTime - now) / 1000));
            displays[timer.entity_id] = formatTimeRemaining(remainingSec);
            progress[timer.entity_id] = durationSec > 0 ? remainingSec / durationSec : 0;
          } else {
            displays[timer.entity_id] = timer.remaining;
            progress[timer.entity_id] = timer.progress;
          }
        } else {
          const remainingSec = parseTimeToSeconds(timer.remaining);
          displays[timer.entity_id] = formatTimeRemaining(remainingSec);
          progress[timer.entity_id] = durationSec > 0 ? remainingSec / durationSec : 0;
        }
      });

      setTimerDisplays(displays);
      setTimerProgress(progress);
    };

    updateTimerDisplays();
    const interval = setInterval(updateTimerDisplays, 1000);
    return () => clearInterval(interval);
  }, [activeTimers]);

  // Get current user's avatar (for immersive mode)
  const userAvatar = useMemo(() => {
    if (activityData.user) {
      return {
        picture: resolveEntityPictureUrl(haUrl, activityData.user.picture),
        initials: activityData.user.initials,
      };
    }
    return { picture: undefined, initials: 'U' };
  }, [activityData.user, haUrl]);

  const getEntityPictureUrl = (picture?: string, fallback?: string) => {
    return resolveEntityPictureUrl(haUrl, picture) ?? fallback;
  };

  const dismissReleaseNote = useCallback((entityId: string, updatedAt: string) => {
    // Persisted + shared with the mobile nav; never reposts for this updatedAt.
    dismissActivity(entityId, updatedAt);

    const remaining = visibleReleaseNotes.filter((note) => note.entity_id !== entityId);
    setExpandedWidgetId(remaining[0]?.entity_id ?? null);
  }, [visibleReleaseNotes]);


  return (
    <>
    <AnimatePresence>
      {isActivityDialogOpen && (
        <motion.div
          key="activity-dialog-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[150] bg-black/70"
          onClick={minimizeActivityWidget}
        />
      )}
    </AnimatePresence>
    {/* Bottom/right inset matches the desktop corner toast's 1.5rem float
        (.corner-toast) so the bar has the same breathing room from the screen
        edges. Left is anchored to the sidebar column via the shell grid. */}
    {/* z-50 makes the footer a stacking context (flex item + z-index), which
        would trap an open activity dialog below the z-[150] scrim. Drop the
        z-index while a dialog is open so the z-[200] card escapes to the root
        stacking context and floats above the scrim — like the device dialog. */}
    <footer className={`hidden lg:flex items-center justify-between pr-6 pt-ha-2 pb-6 col-span-full ${isActivityDialogOpen ? '' : 'z-50'} transition-opacity duration-300 ${editModeFade ? 'opacity-30 pointer-events-none' : 'opacity-100'}`} data-component="StatusBar">
      {/* Left side widgets */}
      <div className="flex items-center flex-1 min-w-0 mr-4 gap-ha-5">
        {/* User profile avatar — same hamburger-behind-avatar composition as
            the mobile nav settings item */}
        <Tooltip content="Settings" shortcut="S" placement="top">
        <button
          onClick={onProfileToggle}
          aria-label="Open settings"
          className="group pl-ha-4 pr-ha-1 py-ha-1 flex items-center justify-center flex-shrink-0 transition-opacity opacity-90 hover:opacity-100"
          style={{ marginLeft: '8px' }}
        >
          <div className="relative flex items-center justify-center">
            <Icon path={mdiMenu} size={28} className={`absolute -left-3 z-0 transition-[transform,color] duration-500 ease-out group-hover:-translate-x-1 ${pathname.startsWith('/settings') ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`} />
            <div className="relative z-10 rounded-full ring-[3px] ring-surface-low bg-surface-low">
              <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="sm" />
            </div>
          </div>
        </button>
        </Tooltip>

        {/* Ask your home — always-visible entry to the assistant overlay,
            styled as the same quiet field as the lock screen's talk widget:
            flat pill, left-aligned text, trailing chevron, no mic chrome. */}
        <button
          type="button"
          onClick={() => toggleAssistant()}
          aria-label="Ask your home"
          className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill px-ha-4 h-12 flex-shrink-0 min-w-[220px] border border-surface-low hover:bg-surface-mid hover:border-ha-blue/40 transition-colors active:scale-[0.99]"
        >
          <span className="flex-1 text-sm text-text-secondary text-left">
            Ask your home…
          </span>
          <Icon path={mdiChevronRight} size={20} className="text-text-tertiary flex-shrink-0" />
        </button>

        {/* Scrollable Container for Activities */}
        <div className="flex-1 min-w-0 relative group">
           {/* Left Gradient */}
           <div 
            className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
              showLeftGradient ? 'opacity-100' : 'opacity-0'
            }`} 
           />

           <div 
             ref={activitiesScrollRef}
             onScroll={checkActivitiesScroll}
             className="overflow-x-auto scrollbar-hide flex items-center gap-ha-4 mask-linear-fade pr-4 pl-1"
           >
          <AnimatePresence initial={false} mode="popLayout">
          {/* Release notes widget(s) - always first */}
          {visibleReleaseNotes.length > 0 && (() => {
            const selectedReleaseNote = visibleReleaseNotes.find((note) => note.entity_id === expandedWidgetId);
            const isListView = expandedWidgetId === 'list-release-notes';
            const releaseNote = selectedReleaseNote || visibleReleaseNotes[0];
            const isExpanded = Boolean(selectedReleaseNote || isListView);
            const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
            const showPreview = hoveredActivityWidget === 'release-notes-widget' && !expandedWidgetId;
            return (
            <motion.div
              key="release-notes-widget"
              layout={isPinnedInFooter ? false : 'position'}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={activityWidgetTransition}
              ref={(el) => { widgetContainerRefs.current['release-notes-widget'] = el; }}
              className="relative"
              style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('release') }}
              onMouseEnter={() => showActivityPreview('release-notes-widget')}
              onMouseLeave={() => scheduleHideActivityPreview('release-notes-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="release-notes-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('release-notes-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('release-notes-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[320px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['release-notes-widget']}
                  transition={activityWindowTransition}
                >
                  <div className="p-ha-4 flex flex-col gap-ha-3">
                    <div className="w-full rounded-ha-xl bg-green-500/10 border border-green-500/20 p-ha-3">
                      <p className="text-[13px] font-bold text-green-600 uppercase tracking-widest mb-1">{releaseNote.version}</p>
                      <h3 className="text-sm font-bold text-text-primary">{releaseNote.name}</h3>
                      <p className="text-xs text-text-secondary mt-1">{releaseNote.summary}</p>
                    </div>

                    <div className="space-y-ha-2 max-h-[220px] overflow-y-auto pr-1">
                      {(releaseNote.notes.length > 0 ? releaseNote.notes : ['No release notes available.']).map((note, index) => (
                        <div key={`${releaseNote.entity_id}-preview-note-${index}`} className="flex gap-ha-2 text-xs text-text-secondary">
                          <span className="text-green-600 font-bold">{index + 1}.</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
                {selectedReleaseNote ? (
                  <>
                    <motion.div
                      key="release-notes-expanded"
                      ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[320px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                      style={activityWidgetView === 'dock' ? activityFlyoutStyles['release-notes-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                      transition={activityWindowTransition}
                    >
                      <div className="p-ha-4 flex flex-col gap-ha-3">
                        <div
                          onMouseDown={handleActivityDialogHeaderMouseDown}
                          className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                        >
                          {renderActivityWindowActions(
                            (e) => { e.stopPropagation(); setExpandedWidgetId(visibleReleaseNotes.length > 1 ? 'list-release-notes' : null); },
                            visibleReleaseNotes.length > 1 ? mdiChevronUp : mdiClose
                          )}
                        </div>

                        <div className="w-full rounded-ha-xl bg-green-500/10 border border-green-500/20 p-ha-3">
                          <p className="text-[13px] font-bold text-green-600 uppercase tracking-widest mb-1">{releaseNote.version}</p>
                          <h3 className="text-sm font-bold text-text-primary">{releaseNote.name}</h3>
                          <p className="text-xs text-text-secondary mt-1">{releaseNote.summary}</p>
                        </div>

                        <div className="space-y-ha-2 max-h-[220px] overflow-y-auto pr-1">
                          {(releaseNote.notes.length > 0 ? releaseNote.notes : ['No release notes available.']).map((note, index) => (
                            <div key={`${releaseNote.entity_id}-note-${index}`} className="flex gap-ha-2 text-xs text-text-secondary">
                              <span className="text-green-600 font-bold">{index + 1}.</span>
                              <span>{note}</span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissReleaseNote(releaseNote.entity_id, releaseNote.updatedAt);
                          }}
                          className="h-10 rounded-ha-xl bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
                        >
                          Dismiss Notes
                        </button>
                      </div>
                    </motion.div>

                    {selectedReleaseNote && activityWidgetView !== 'pinned' && (
                      <motion.button
                        key="release-notes-minimize"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={activityMiniTransition}
                        onClick={(e) => {
                          e.stopPropagation();
                          minimizeActivityWidget();
                        }}
                        className="h-12 rounded-ha-pill bg-green-500/15 border border-green-500/25 text-green-600 flex items-center justify-center hover:bg-green-500/25 transition-colors"
                        style={{ width: activityWidgetWidths['release-notes-widget'] }}
                      >
                        <Icon path={mdiChevronDown} size={20} />
                      </motion.button>
                    )}

                  </>
                ) : isListView ? (
                  <>
                    <motion.div
                      key="release-notes-list"
                      ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[320px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                      style={activityWidgetView === 'dock' ? activityFlyoutStyles['release-notes-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                      transition={activityWindowTransition}
                    >
                      <div className="p-ha-4">
                        <div
                          onMouseDown={handleActivityDialogHeaderMouseDown}
                          className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                        >
                          {renderActivityWindowActions(
                            (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                            mdiClose
                          )}
                        </div>
                        <div className="space-y-ha-2">
                          {visibleReleaseNotes.map((note) => (
                            <button
                              key={note.entity_id}
                              onClick={() => setExpandedWidgetId(note.entity_id)}
                              className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center shrink-0">
                                <Icon path={mdiUpdate} size={16} className="text-green-600" />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-text-primary truncate">{note.name}</span>
                                <span className="text-xs text-text-secondary truncate">{note.version} • {note.notes.length} note{note.notes.length === 1 ? '' : 's'}</span>
                              </div>
                              <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>

                    {isExpanded && activityWidgetView !== 'pinned' && (
                      <motion.button
                        key="release-notes-list-minimize"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={activityMiniTransition}
                        onClick={(e) => {
                          e.stopPropagation();
                          minimizeActivityWidget();
                        }}
                        className="h-12 rounded-ha-pill bg-green-500/15 border border-green-500/25 text-green-600 flex items-center justify-center hover:bg-green-500/25 transition-colors"
                        style={{ width: activityWidgetWidths['release-notes-widget'] }}
                      >
                        <Icon path={mdiChevronDown} size={20} />
                      </motion.button>
                    )}
                  </>
                ) : (
                  <motion.div
                    key="release-notes-collapsed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={activityMiniTransition}
                    onClick={() => (
                      showPreview
                        ? openActivityWidgetDialog(visibleReleaseNotes.length > 1 ? 'list-release-notes' : releaseNote.entity_id, 'release-notes-widget')
                        : openActivityWidget(visibleReleaseNotes.length > 1 ? 'list-release-notes' : releaseNote.entity_id, 'release-notes-widget')
                    )}
                    className="relative flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 transition-all hover:bg-surface-mid cursor-pointer"
                  >
                    <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                          <Icon path={mdiUpdate} size={14} className="text-green-600" />
                        </div>
                        {visibleReleaseNotes.length > 1 && (
                          <div className="absolute -top-1 -right-1 bg-green-600 text-white text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-default shadow-sm z-10">
                            {visibleReleaseNotes.length}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 max-w-[180px]">
                        <span className="text-sm font-medium text-text-primary truncate">What&apos;s New</span>
                        <span className="text-xs text-text-secondary truncate">{releaseNote.version}</span>
                      </div>
                    </div>
                    {showPreview && (
                      <div className="absolute inset-0 flex items-center justify-center text-text-primary pointer-events-none">
                        <Icon path={mdiOpenInNew} size={18} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            );
          })()}

          {/* Media player widget(s) - show when playing */}
        {activePlayers.length > 0 && (() => {
          const selectedPlayer = activePlayers.find(p => p.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-media';
          const player = selectedPlayer || activePlayers[0];
          const showPreview = hoveredActivityWidget === 'media-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedPlayer || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          return (
          <motion.div
            key="media-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['media-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('media') }}
            onMouseEnter={() => showActivityPreview('media-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('media-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="media-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('media-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('media-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['media-widget']}
                  transition={activityWindowTransition}
                >
                  {activePlayers.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activePlayers.map((previewPlayer) => (
                          <button
                            key={previewPlayer.entity_id}
                            onClick={() => openActivityWidget(previewPlayer.entity_id, 'media-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-fill-primary-normal flex items-center justify-center shrink-0 overflow-hidden">
                              {previewPlayer.entityPicture ? (
                                <img src={getEntityPictureUrl(previewPlayer.entityPicture)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Icon path={mdiPlay} size={16} className="text-ha-blue" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewPlayer.mediaTitle || previewPlayer.name}</span>
                              <span className="text-xs text-text-secondary truncate">{previewPlayer.mediaArtist || previewPlayer.state}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-lg border border-surface-low">
                        {player.entityPicture ? (
                          <img src={getEntityPictureUrl(player.entityPicture)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-surface-mid flex items-center justify-center">
                            <Icon path={mdiPlay} size={48} className="text-ha-blue opacity-20" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-text-primary text-center truncate w-full">{player.mediaTitle || player.name}</h3>
                      <p className="text-sm text-text-secondary mb-ha-5 text-center truncate w-full">{player.mediaArtist || 'Media Player'}</p>

                      <div className="w-full h-1 bg-surface-mid rounded-full mb-ha-5 overflow-hidden">
                        <div className="bg-ha-blue h-full w-1/3 rounded-full" />
                      </div>

                      <div className="flex items-center justify-center gap-ha-6 mb-ha-5">
                        <button onClick={() => callService({ domain: 'media_player', service: 'media_previous_track', target: { entity_id: player.entity_id } })}>
                          <Icon path={mdiSkipPrevious} size={28} className="text-text-primary hover:text-ha-blue" />
                        </button>
                        <button
                          onClick={() => callService({ domain: 'media_player', service: player.state === 'playing' ? 'media_pause' : 'media_play', target: { entity_id: player.entity_id } })}
                          className="w-14 h-14 rounded-full bg-ha-blue text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
                        >
                          <Icon path={player.state === 'playing' ? mdiPause : mdiPlay} size={32} />
                        </button>
                        <button onClick={() => callService({ domain: 'media_player', service: 'media_next_track', target: { entity_id: player.entity_id } })}>
                          <Icon path={mdiSkipNext} size={28} className="text-text-primary hover:text-ha-blue" />
                        </button>
                      </div>

                      <div className="w-full flex items-center gap-ha-3 text-text-secondary">
                        <Icon path={mdiVolumeHigh} size={18} />
                        <div className="flex-1 h-1.5 bg-surface-mid rounded-full overflow-hidden">
                          <div className="bg-text-secondary h-full w-2/3 rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedPlayer ? (
                <>
                  <motion.div
                    key="media-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['media-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activePlayers.length > 1 ? 'list-media' : null); },
                          activePlayers.length > 1 ? mdiChevronUp : mdiClose,
                          'media'
                        )}
                      </div>

                      {player.status.isStale && (
                        <div className="w-full mb-ha-3 px-ha-3 py-ha-2 rounded-ha-lg bg-yellow-95 text-yellow-600 text-xs font-semibold text-center">
                          Data may be outdated
                        </div>
                      )}

                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-lg border border-surface-low">
                        {player.entityPicture ? (
                          <img src={getEntityPictureUrl(player.entityPicture)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-surface-mid flex items-center justify-center">
                            <Icon path={mdiPlay} size={48} className="text-ha-blue opacity-20" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-text-primary text-center truncate w-full">{player.mediaTitle || player.name}</h3>
                      <p className="text-sm text-text-secondary mb-ha-5 text-center truncate w-full">{player.mediaArtist || 'Media Player'}</p>

                      <div className="w-full h-1 bg-surface-mid rounded-full mb-ha-5 overflow-hidden">
                        <div className="bg-ha-blue h-full w-1/3 rounded-full" />
                      </div>

                      <div className="flex items-center justify-center gap-ha-6 mb-ha-5">
                        <button onClick={() => callService({ domain: 'media_player', service: 'media_previous_track', target: { entity_id: player.entity_id } })}>
                          <Icon path={mdiSkipPrevious} size={28} className="text-text-primary hover:text-ha-blue" />
                        </button>
                        <button
                          onClick={() => callService({ domain: 'media_player', service: player.state === 'playing' ? 'media_pause' : 'media_play', target: { entity_id: player.entity_id } })}
                          className="w-14 h-14 rounded-full bg-ha-blue text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
                        >
                          <Icon path={player.state === 'playing' ? mdiPause : mdiPlay} size={32} />
                        </button>
                        <button onClick={() => callService({ domain: 'media_player', service: 'media_next_track', target: { entity_id: player.entity_id } })}>
                          <Icon path={mdiSkipNext} size={28} className="text-text-primary hover:text-ha-blue" />
                        </button>
                      </div>

                      <div className="w-full flex items-center gap-ha-3 text-text-secondary">
                        <Icon path={mdiVolumeHigh} size={18} />
                        <div className="flex-1 h-1.5 bg-surface-mid rounded-full overflow-hidden">
                          <div className="bg-text-secondary h-full w-2/3 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {selectedPlayer && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="media-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['media-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="media-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['media-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activePlayers.map(p => (
                          <button
                            key={p.entity_id}
                            onClick={() => setExpandedWidgetId(p.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-fill-primary-normal flex items-center justify-center shrink-0">
                              {p.entityPicture ? (
                                <img src={getEntityPictureUrl(p.entityPicture)} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <Icon path={mdiPlay} size={16} className="text-ha-blue" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{p.mediaTitle || p.name}</span>
                              <span className="text-xs text-text-secondary truncate">{p.mediaArtist || p.state}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="media-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['media-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key="media-collapsed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activePlayers.length > 1 ? 'list-media' : player.entity_id, 'media-widget')
                      : openActivityWidget(activePlayers.length > 1 ? 'list-media' : player.entity_id, 'media-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 transition-all hover:bg-surface-mid cursor-pointer ${player.status.isStale ? 'opacity-70' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                      {player.entityPicture ? (
                        <img
                          src={getEntityPictureUrl(player.entityPicture)}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-surface-low"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-fill-primary-normal flex items-center justify-center">
                          <Icon path={mdiPlay} size={14} className="text-ha-blue" />
                        </div>
                      )}
                      {activePlayers.length > 1 && (
                        <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                          {activePlayers.length}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {player.mediaTitle || player.name}
                      </span>
                      <span className={`text-xs truncate ${player.state === 'paused' ? 'text-yellow-600' : 'text-text-secondary'}`}>
                        {player.mediaArtist || (player.state === 'playing' ? 'Playing' : 'Paused')}
                      </span>
                    </div>
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-text-primary pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* Timer widget(s) - show when active */}
        {activeTimers.length > 0 && (() => {
          const selectedTimer = activeTimers.find(t => t.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-timer';
          const timer = selectedTimer || activeTimers[0];
          const showPreview = hoveredActivityWidget === 'timer-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedTimer || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          return (
          <motion.div
            key="timer-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['timer-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('timer') }}
            onMouseEnter={() => showActivityPreview('timer-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('timer-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="timer-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('timer-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('timer-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[260px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['timer-widget']}
                  transition={activityWindowTransition}
                >
                  {activeTimers.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activeTimers.map((previewTimer) => (
                          <button
                            key={previewTimer.entity_id}
                            onClick={() => openActivityWidget(previewTimer.entity_id, 'timer-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={timerProgress[previewTimer.entity_id] ?? previewTimer.progress}
                              size={32}
                              strokeWidth={2.5}
                              className={previewTimer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                              trackClassName={previewTimer.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
                            >
                              <Icon path={previewTimer.state === 'active' ? mdiTimerOutline : mdiPause} size={14} className={previewTimer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'} />
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewTimer.name}</span>
                              <span className={`text-xs truncate ${previewTimer.status.phase === 'ended' ? 'text-green-600 font-semibold' : 'text-text-secondary'}`}>
                                {previewTimer.status.phase === 'ended' ? (previewTimer.status.endLabel || 'Done') : (timerDisplays[previewTimer.entity_id] || previewTimer.remaining)}
                              </span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-5 flex flex-col items-center">
                      <div className="relative mb-ha-5">
                        <CircularProgress
                          progress={timerProgress[timer.entity_id] ?? timer.progress}
                          size={150}
                          strokeWidth={7}
                          className={timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                          trackClassName={timer.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold font-mono text-text-primary tracking-tighter">
                            {timerDisplays[timer.entity_id] || timer.remaining}
                          </span>
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-widest mt-1">
                            {timer.state}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-text-primary mb-ha-5 text-center truncate w-full px-4">{timer.name}</h3>

                      <div className="flex items-center gap-ha-3 w-full">
                        <button
                          onClick={() => callService({ domain: 'timer', service: 'cancel', target: { entity_id: timer.entity_id } })}
                          className="flex-1 h-11 rounded-ha-xl bg-surface-low text-text-secondary font-bold text-xs uppercase tracking-wider hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => callService({ domain: 'timer', service: timer.state === 'active' ? 'pause' : 'start', target: { entity_id: timer.entity_id } })}
                          className={`flex-1 h-11 rounded-ha-xl font-bold text-xs uppercase tracking-wider text-white transition-all shadow-md active:scale-95 ${timer.state === 'active' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-ha-blue hover:bg-ha-blue-dark'}`}
                        >
                          {timer.state === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedTimer ? (
                <>
                  <motion.div
                    key="timer-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[260px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['timer-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-5 flex flex-col items-center">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activeTimers.length > 1 ? 'list-timer' : null); },
                          activeTimers.length > 1 ? mdiChevronUp : mdiClose,
                          'timer'
                        )}
                      </div>

                      <div className="relative mb-ha-5">
                        <CircularProgress
                          progress={timer.status.phase === 'ended' ? 1 : (timerProgress[timer.entity_id] ?? timer.progress)}
                          size={150}
                          strokeWidth={7}
                          className={timer.status.phase === 'ended' ? 'text-green-600' : timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                          trackClassName={timer.status.phase === 'ended' ? 'text-green-500/20' : timer.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          {timer.status.phase === 'ended' ? (
                            <>
                              <Icon path={mdiCheckCircle} size={40} className="text-green-600 mb-1" />
                              <span className="text-[13px] font-bold text-green-600 uppercase tracking-widest">
                                {timer.status.endLabel || 'Done'}
                              </span>
                            </>
                          ) : (
                            <>
                              <RollingNumericValue
                                value={timerDisplays[timer.entity_id] || timer.remaining}
                                className="text-3xl font-bold font-mono text-text-primary tracking-tighter"
                              />
                              <span className="text-[13px] font-bold text-text-disabled uppercase tracking-widest mt-1">
                                {timer.state}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-text-primary mb-ha-5 text-center truncate w-full px-4">{timer.name}</h3>

                      {timer.status.phase === 'ended' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissActivity(timer.entity_id, endedDismissKey(timer.status));
                            minimizeActivityWidget();
                          }}
                          className="w-full h-11 rounded-ha-xl bg-green-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-green-500 transition-colors"
                        >
                          Dismiss
                        </button>
                      ) : (
                        <div className="flex items-center gap-ha-3 w-full">
                          <button
                            onClick={() => callService({ domain: 'timer', service: 'cancel', target: { entity_id: timer.entity_id } })}
                            className="flex-1 h-11 rounded-ha-xl bg-surface-low text-text-secondary font-bold text-xs uppercase tracking-wider hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => callService({ domain: 'timer', service: timer.state === 'active' ? 'pause' : 'start', target: { entity_id: timer.entity_id } })}
                            className={`flex-1 h-11 rounded-ha-xl font-bold text-xs uppercase tracking-wider text-white transition-all shadow-md active:scale-95 ${timer.state === 'active' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-ha-blue hover:bg-ha-blue-dark'}`}
                          >
                            {timer.state === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {selectedTimer && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="timer-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-fill-primary-normal border border-fill-primary-quiet text-ha-blue flex items-center justify-center hover:opacity-90 transition-opacity"
                      style={{ width: activityWidgetWidths['timer-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="timer-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[260px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['timer-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activeTimers.map(t => (
                          <button
                            key={t.entity_id}
                            onClick={() => setExpandedWidgetId(t.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={timerProgress[t.entity_id] ?? t.progress}
                              size={32}
                              strokeWidth={2.5}
                              className={t.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                              trackClassName={t.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
                            >
                              <Icon path={t.state === 'active' ? mdiTimerOutline : mdiPause} size={14} className={t.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'} />
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{t.name}</span>
                              <span className={`text-xs truncate ${t.status.phase === 'ended' ? 'text-green-600 font-semibold' : 'text-text-secondary'}`}>
                                {t.status.phase === 'ended' ? (t.status.endLabel || 'Done') : (timerDisplays[t.entity_id] || t.remaining)}
                              </span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="timer-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-fill-primary-normal border border-fill-primary-quiet text-ha-blue flex items-center justify-center hover:opacity-90 transition-opacity"
                      style={{ width: activityWidgetWidths['timer-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key={`timer-collapsed-${timer.status.alertAt ?? 'quiet'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activeTimers.length > 1 ? 'list-timer' : timer.entity_id, 'timer-widget')
                      : openActivityWidget(activeTimers.length > 1 ? 'list-timer' : timer.entity_id, 'timer-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    timer.status.phase === 'ended'
                      ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15'
                      : 'bg-surface-low hover:bg-surface-mid'
                  } ${timer.status.isStale ? 'opacity-70' : ''} ${isAlerting(timer.status, nowMs) ? 'ha-status-pulse' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                    {activeTimers.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activeTimers.length}
                      </div>
                    )}
                    {timer.status.phase === 'ended' ? (
                      <Icon path={mdiCheckCircle} size={26} className="text-green-600" />
                    ) : (
                      <CircularProgress
                        progress={timerProgress[timer.entity_id] ?? timer.progress}
                        size={28}
                        strokeWidth={14}
                        rounded={false}
                        className={timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                        trackClassName={timer.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
                      />
                    )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      {timer.status.phase === 'ended' ? (
                        <span className="text-sm font-semibold text-green-600 truncate">{timer.status.endLabel || 'Done'}</span>
                      ) : (
                        <RollingNumericValue
                          value={timerDisplays[timer.entity_id] || timer.remaining}
                          className="text-sm font-semibold text-text-primary"
                        />
                      )}
                      <span className="text-xs text-text-secondary truncate">{timer.name}</span>
                    </div>
                    {timer.status.phase === 'ended' && (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(timer.entity_id, endedDismissKey(timer.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-text-primary">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* Camera widget(s) - show when movement/doorbell */}
        {activeCameras.length > 0 && (() => {
          const selectedCamera = activeCameras.find(c => c.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-camera';
          const camera = selectedCamera || activeCameras[0];
          const showPreview = hoveredActivityWidget === 'camera-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedCamera || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          return (
          <motion.div
            key="camera-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['camera-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('camera') }}
            onMouseEnter={() => showActivityPreview('camera-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('camera-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="camera-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('camera-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('camera-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[340px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['camera-widget']}
                  transition={activityWindowTransition}
                >
                  {activeCameras.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activeCameras.map((previewCamera) => (
                          <button
                            key={previewCamera.entity_id}
                            onClick={() => openActivityWidget(previewCamera.entity_id, 'camera-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
                              <img src={getEntityPictureUrl(previewCamera.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewCamera.name}</span>
                              <span className="text-xs text-red-500 truncate">{previewCamera.event}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-full aspect-video bg-black relative">
                        <img src={getEntityPictureUrl(camera.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded text-[13px] text-white font-mono border border-white/10 flex items-center gap-1.5">
                          {camera.status.phase === 'ended' ? (
                            <>ENDED • {formatRelativeAge(camera.since, nowMs)}</>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              LIVE • {formatRelativeAge(camera.since, nowMs)}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="p-ha-4">
                        <div className="flex items-center gap-ha-3 mb-ha-4">
                          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                            <Icon path={mdiAccount} size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-text-primary">{camera.name}</h4>
                            <p className="text-[13px] font-bold text-red-500 uppercase tracking-tight">{camera.event}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-ha-3">
                          <button className="h-11 rounded-ha-xl bg-ha-blue text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-ha-blue-dark shadow-md active:scale-95 transition-all">
                            <Icon path={mdiMicrophone} size={16} />
                            Talk
                          </button>
                          <button className="h-11 rounded-ha-xl bg-surface-low text-text-primary text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-surface-mid border border-surface-low active:scale-95 transition-all">
                            <Icon path={mdiVideo} size={16} />
                            Recordings
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedCamera ? (
                <>
                  <motion.div
                    key="camera-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[340px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['camera-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div
                      onMouseDown={handleActivityDialogHeaderMouseDown}
                      className={`absolute top-0 right-0 p-ha-2 flex items-center gap-1 z-10 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                    >
                      {renderActivityWindowActions(
                        (e) => { e.stopPropagation(); setExpandedWidgetId(activeCameras.length > 1 ? 'list-camera' : null); },
                        activeCameras.length > 1 ? mdiChevronUp : mdiClose,
                        'camera'
                      )}
                    </div>
                    <div className="w-full aspect-video bg-black relative">
                      <img src={getEntityPictureUrl(camera.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded text-[13px] text-white font-mono border border-white/10 flex items-center gap-1.5">
                        {camera.status.phase === 'ended' ? (
                          <>ENDED • {formatRelativeAge(camera.since, nowMs)}</>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE • {formatRelativeAge(camera.since, nowMs)}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-ha-4">
                      <div className="flex items-center gap-ha-3 mb-ha-4">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                          <Icon path={mdiAccount} size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{camera.name}</h4>
                          <p className="text-[13px] font-bold text-red-500 uppercase tracking-tight">{camera.event}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-ha-3">
                        <button className="h-11 rounded-ha-xl bg-ha-blue text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-ha-blue-dark shadow-md active:scale-95 transition-all">
                          <Icon path={mdiMicrophone} size={16} />
                          Talk
                        </button>
                        <button className="h-11 rounded-ha-xl bg-surface-low text-text-primary text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-surface-mid border border-surface-low active:scale-95 transition-all">
                          <Icon path={mdiVideo} size={16} />
                          Recordings
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {selectedCamera && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="camera-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      style={{ width: activityWidgetWidths['camera-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="camera-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['camera-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activeCameras.map(c => (
                          <button
                            key={c.entity_id}
                            onClick={() => setExpandedWidgetId(c.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
                              <img src={getEntityPictureUrl(c.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{c.name}</span>
                              <span className="text-xs text-red-500 truncate">{c.event}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="camera-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      style={{ width: activityWidgetWidths['camera-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key={`camera-collapsed-${camera.status.alertAt ?? 'quiet'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activeCameras.length > 1 ? 'list-camera' : camera.entity_id, 'camera-widget')
                      : openActivityWidget(activeCameras.length > 1 ? 'list-camera' : camera.entity_id, 'camera-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    camera.status.phase === 'ended'
                      ? 'bg-surface-low hover:bg-surface-mid'
                      : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15'
                  } ${isAlerting(camera.status, nowMs) ? 'ha-status-pulse' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative w-7 h-7 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
                      <img
                        src={getEntityPictureUrl(camera.entityPicture, '/camera_doorbell.png')}
                        alt=""
                        className={`w-full h-full object-cover ${camera.status.phase === 'ended' ? '' : 'animate-pulse'}`}
                      />
                      <div className="absolute inset-0 bg-red-500/10" />
                      {activeCameras.length > 1 && (
                        <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                          {activeCameras.length}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[150px]">
                      <span className={`text-sm font-semibold truncate flex items-center gap-1 ${camera.status.phase === 'ended' ? 'text-text-primary' : 'text-red-500'}`}>
                        <Icon path={mdiDoorbellVideo} size={14} className="text-red-500 shrink-0" />
                        {camera.event}
                      </span>
                      <span className="text-xs text-text-secondary truncate">
                        {camera.name} • {formatRelativeAge(camera.since, nowMs)}
                      </span>
                    </div>
                    {camera.status.phase === 'ended' && (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(camera.entity_id, endedDismissKey(camera.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-text-primary pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* 3D Printer widget(s) - show when printing */}
        {activePrinters.length > 0 && (() => {
          const selectedPrinter = activePrinters.find(p => p.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-printer';
          const printer = selectedPrinter || activePrinters[0];
          const showPreview = hoveredActivityWidget === 'printer-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedPrinter || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          return (
          <motion.div
            key="printer-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['printer-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('printer') }}
            onMouseEnter={() => showActivityPreview('printer-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('printer-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="printer-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('printer-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('printer-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['printer-widget']}
                  transition={activityWindowTransition}
                >
                  {activePrinters.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activePrinters.map((previewPrinter) => (
                          <button
                            key={previewPrinter.entity_id}
                            onClick={() => openActivityWidget(previewPrinter.entity_id, 'printer-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={previewPrinter.progress / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                                <img src={getEntityPictureUrl(previewPrinter.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                              </div>
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewPrinter.fileName}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{previewPrinter.progress}% • {formatRemainingLabel(previewPrinter.remainingTime)}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-md bg-surface-mid relative border border-surface-low">
                        <img src={getEntityPictureUrl(printer.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                      </div>

                      <div className="w-full mb-ha-4 px-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-text-primary truncate">{printer.fileName}</h3>
                          <span className="text-xs font-mono text-ha-blue font-bold">{printer.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${printer.progress}%` }}
                            className="bg-ha-blue h-full rounded-full"
                          />
                        </div>
                      </div>

                      <div className="w-full p-ha-3 bg-surface-low rounded-ha-xl border border-surface-mid/30 flex items-center justify-between">
                        <div className="flex flex-col pl-1">
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">TIME LEFT</span>
                          <span className="text-sm font-mono font-bold text-text-primary">{formatRemainingLabel(printer.remainingTime)}</span>
                        </div>
                        <button className="w-10 h-10 bg-red-500/10 text-red-500 rounded-ha-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center">
                          <Icon path={mdiStop} size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedPrinter ? (
                <>
                  <motion.div
                    key="printer-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['printer-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activePrinters.length > 1 ? 'list-printer' : null); },
                          activePrinters.length > 1 ? mdiChevronUp : mdiClose,
                          'printer'
                        )}
                      </div>

                      {printer.status.isStale && (
                        <div className="w-full mb-ha-3 px-ha-3 py-ha-2 rounded-ha-lg bg-yellow-95 text-yellow-600 text-xs font-semibold text-center">
                          Data may be outdated
                        </div>
                      )}

                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-md bg-surface-mid relative border border-surface-low">
                        <img src={getEntityPictureUrl(printer.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                      </div>

                      <div className="w-full mb-ha-4 px-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-text-primary truncate">{printer.fileName}</h3>
                          <span className="text-xs font-mono text-ha-blue font-bold">{printer.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${printer.progress}%` }}
                            className="bg-ha-blue h-full rounded-full"
                          />
                        </div>
                      </div>

                      <div className="w-full p-ha-3 bg-surface-low rounded-ha-xl border border-surface-mid/30 flex items-center justify-between">
                        <div className="flex flex-col pl-1">
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">TIME LEFT</span>
                          <span className="text-sm font-mono font-bold text-text-primary">{formatRemainingLabel(printer.remainingTime)}</span>
                        </div>
                        <button className="w-10 h-10 bg-red-500/10 text-red-500 rounded-ha-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center">
                          <Icon path={mdiStop} size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {selectedPrinter && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="printer-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['printer-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="printer-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['printer-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activePrinters.map(p => (
                          <button
                            key={p.entity_id}
                            onClick={() => setExpandedWidgetId(p.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={p.progress / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                                <img src={getEntityPictureUrl(p.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                              </div>
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{p.fileName}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{p.progress}% • {formatRemainingLabel(p.remainingTime)}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="printer-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['printer-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key={`printer-collapsed-${printer.status.alertAt ?? 'quiet'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activePrinters.length > 1 ? 'list-printer' : printer.entity_id, 'printer-widget')
                      : openActivityWidget(activePrinters.length > 1 ? 'list-printer' : printer.entity_id, 'printer-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    printer.status.phase === 'ended' && printer.status.endLabel === 'Print complete'
                      ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15'
                      : 'bg-surface-low hover:bg-surface-mid'
                  } ${printer.status.isStale ? 'opacity-70' : ''} ${isAlerting(printer.status, nowMs) ? 'ha-status-pulse' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                    {activePrinters.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activePrinters.length}
                      </div>
                    )}
                    {printer.status.phase === 'ended' && printer.status.endLabel === 'Print complete' ? (
                      <Icon path={mdiCheckCircle} size={26} className="text-green-600" />
                    ) : (
                      <CircularProgress
                        progress={printer.progress / 100}
                        size={28}
                        strokeWidth={2.5}
                        className="text-ha-blue shrink-0"
                        trackClassName="text-fill-primary-quiet"
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-surface-mid">
                          <img src={getEntityPictureUrl(printer.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                        </div>
                      </CircularProgress>
                    )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      {printer.status.phase === 'ended' ? (
                        <span className={`text-sm font-semibold truncate ${printer.status.endLabel === 'Print complete' ? 'text-green-600' : 'text-text-primary'}`}>
                          {printer.status.endLabel}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <RollingNumericValue
                            value={`${printer.progress}%`}
                            className="text-sm font-semibold text-text-primary font-mono"
                          />
                          <span className="text-[13px] text-text-disabled uppercase font-bold tracking-tighter">
                            Printing
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-text-secondary truncate">{printer.fileName}</span>
                    </div>
                    {printer.status.phase === 'ended' ? (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(printer.entity_id, endedDismissKey(printer.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    ) : (
                      <div className="hidden xl:flex flex-col items-end ml-1 pl-2 border-l border-surface-mid">
                        <span className="text-[13px] text-text-disabled font-bold leading-none mb-0.5 uppercase">Left</span>
                        <span className="text-xs font-mono text-text-secondary">{formatRemainingLabel(printer.remainingTime)}</span>
                      </div>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-ha-blue pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* Vacuum widget(s) */}
        {activeVacuums.length > 0 && (() => {
          const selectedVacuum = activeVacuums.find(v => v.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-vacuum';
          const vacuum = selectedVacuum || activeVacuums[0];
          const showPreview = hoveredActivityWidget === 'vacuum-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedVacuum || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          const vacuumStatus = vacuum.status.phase === 'ended'
            ? (vacuum.status.endLabel || 'Finished')
            : vacuum.state === 'returning' ? 'Returning' : 'Cleaning';
          return (
          <motion.div
            key="vacuum-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['vacuum-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('vacuum') }}
            onMouseEnter={() => showActivityPreview('vacuum-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('vacuum-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="vacuum-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('vacuum-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('vacuum-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['vacuum-widget']}
                  transition={activityWindowTransition}
                >
                  {activeVacuums.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activeVacuums.map((previewVacuum) => (
                          <button
                            key={previewVacuum.entity_id}
                            onClick={() => openActivityWidget(previewVacuum.entity_id, 'vacuum-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={previewVacuum.progress / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                                <img src={getEntityPictureUrl(previewVacuum.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
                              </div>
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewVacuum.name}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{previewVacuum.progress}% • {previewVacuum.area || 'Cleaning'}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-md bg-surface-mid relative border border-surface-low">
                        <img src={getEntityPictureUrl(vacuum.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-black/60 rounded-ha-lg px-2 py-1 flex items-center gap-2 border border-white/10">
                          <Icon path={mdiMapMarkerRadius} size={14} className="text-ha-blue" />
                          <span className="text-[13px] font-bold text-white">{vacuum.area || 'Whole home'}</span>
                        </div>
                      </div>

                      <div className="w-full mb-ha-4 px-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-text-primary truncate">{vacuum.name}</h3>
                          <span className="text-xs font-mono text-ha-blue font-bold">{vacuum.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${vacuum.progress}%` }}
                            className="bg-ha-blue h-full rounded-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-ha-3 w-full mb-ha-4">
                        <div className="bg-surface-low rounded-ha-xl p-ha-3 flex flex-col items-center gap-1 border border-surface-mid/30">
                          <Icon path={mdiBatteryHigh} size={18} className="text-green-500" />
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">BATTERY</span>
                          <span className="text-sm font-bold text-text-primary font-mono">{vacuum.battery ?? '—'}%</span>
                        </div>
                        <div className="bg-surface-low rounded-ha-xl p-ha-3 flex flex-col items-center gap-1 border border-surface-mid/30">
                          <Icon path={mdiRobotVacuum} size={18} className="text-ha-blue" />
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">MODE</span>
                          <span className="text-sm font-bold text-text-primary">{vacuum.fanSpeed || vacuumStatus}</span>
                        </div>
                      </div>

                      <div className="w-full p-ha-3 bg-surface-low rounded-ha-xl border border-surface-mid/30 flex items-center justify-between">
                        <div className="flex flex-col pl-1">
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">TIME LEFT</span>
                          <span className="text-sm font-mono font-bold text-text-primary">{vacuum.remainingTime || '—'}</span>
                        </div>
                        <button className="w-10 h-10 bg-red-500/10 text-red-500 rounded-ha-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center">
                          <Icon path={mdiStop} size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedVacuum ? (
                <>
                  <motion.div
                    key="vacuum-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['vacuum-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activeVacuums.length > 1 ? 'list-vacuum' : null); },
                          activeVacuums.length > 1 ? mdiChevronUp : mdiClose,
                          'vacuum'
                        )}
                      </div>

                      {vacuum.status.isStale && (
                        <div className="w-full mb-ha-3 px-ha-3 py-ha-2 rounded-ha-lg bg-yellow-95 text-yellow-600 text-xs font-semibold text-center">
                          Data may be outdated
                        </div>
                      )}

                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-md bg-surface-mid relative border border-surface-low">
                        <img src={getEntityPictureUrl(vacuum.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-black/60 rounded-ha-lg px-2 py-1 flex items-center gap-2 border border-white/10">
                          <Icon path={mdiMapMarkerRadius} size={14} className="text-ha-blue" />
                          <span className="text-[13px] font-bold text-white">{vacuum.area || 'Whole home'}</span>
                        </div>
                      </div>

                      <div className="w-full mb-ha-4 px-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-text-primary truncate">{vacuum.name}</h3>
                          <span className="text-xs font-mono text-ha-blue font-bold">{vacuum.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${vacuum.progress}%` }}
                            className="bg-ha-blue h-full rounded-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-ha-3 w-full mb-ha-4">
                        <div className="bg-surface-low rounded-ha-xl p-ha-3 flex flex-col items-center gap-1 border border-surface-mid/30">
                          <Icon path={mdiBatteryHigh} size={18} className="text-green-500" />
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">BATTERY</span>
                          <span className="text-sm font-bold text-text-primary font-mono">{vacuum.battery ?? '—'}%</span>
                        </div>
                        <div className="bg-surface-low rounded-ha-xl p-ha-3 flex flex-col items-center gap-1 border border-surface-mid/30">
                          <Icon path={mdiRobotVacuum} size={18} className="text-ha-blue" />
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">MODE</span>
                          <span className="text-sm font-bold text-text-primary">{vacuum.fanSpeed || vacuumStatus}</span>
                        </div>
                      </div>

                      <div className="w-full p-ha-3 bg-surface-low rounded-ha-xl border border-surface-mid/30 flex items-center justify-between">
                        <div className="flex flex-col pl-1">
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">TIME LEFT</span>
                          <span className="text-sm font-mono font-bold text-text-primary">{vacuum.remainingTime || '—'}</span>
                        </div>
                        <button className="w-10 h-10 bg-red-500/10 text-red-500 rounded-ha-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center">
                          <Icon path={mdiStop} size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {selectedVacuum && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="vacuum-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['vacuum-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="vacuum-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['vacuum-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activeVacuums.map(v => (
                          <button
                            key={v.entity_id}
                            onClick={() => setExpandedWidgetId(v.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={v.progress / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                                <img src={getEntityPictureUrl(v.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
                              </div>
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{v.name}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{v.progress}% • {v.area || 'Cleaning'}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="vacuum-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['vacuum-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key="vacuum-collapsed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activeVacuums.length > 1 ? 'list-vacuum' : vacuum.entity_id, 'vacuum-widget')
                      : openActivityWidget(activeVacuums.length > 1 ? 'list-vacuum' : vacuum.entity_id, 'vacuum-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    vacuum.status.phase === 'ended'
                      ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15'
                      : 'bg-surface-low hover:bg-surface-mid'
                  } ${vacuum.status.isStale ? 'opacity-70' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                    {activeVacuums.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activeVacuums.length}
                      </div>
                    )}
                    {vacuum.status.phase === 'ended' ? (
                      <Icon path={mdiCheckCircle} size={26} className="text-green-600" />
                    ) : (
                      <CircularProgress
                        progress={vacuum.progress / 100}
                        size={28}
                        strokeWidth={2.5}
                        className="text-ha-blue shrink-0"
                        trackClassName="text-fill-primary-quiet"
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-surface-mid">
                          <img src={getEntityPictureUrl(vacuum.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
                        </div>
                      </CircularProgress>
                    )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      {vacuum.status.phase === 'ended' ? (
                        <span className="text-sm font-semibold text-green-600 truncate">{vacuum.status.endLabel || 'Finished'}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <RollingNumericValue
                            value={`${vacuum.progress}%`}
                            className="text-sm font-semibold text-text-primary font-mono"
                          />
                          <span className="text-[13px] text-text-disabled uppercase font-bold tracking-tighter">
                            {vacuumStatus}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-text-secondary truncate">{vacuum.area || vacuum.name}</span>
                    </div>
                    {vacuum.status.phase === 'ended' ? (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(vacuum.entity_id, endedDismissKey(vacuum.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    ) : vacuum.battery !== undefined && (
                      <div className="hidden xl:flex flex-col items-end ml-1 pl-2 border-l border-surface-mid">
                        <span className="text-[13px] text-text-disabled font-bold leading-none mb-0.5 uppercase">Batt</span>
                        <span className="text-xs font-mono text-text-secondary">{vacuum.battery}%</span>
                      </div>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-ha-blue pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* Update install widget(s) - show while a core/add-on update is installing */}
        {activeUpdateInstalls.length > 0 && (() => {
          const selectedUpdate = activeUpdateInstalls.find(u => u.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-update';
          const update = selectedUpdate || activeUpdateInstalls[0];
          const showPreview = hoveredActivityWidget === 'update-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedUpdate || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          const isComplete = update.status.phase === 'ended';
          return (
          <motion.div
            key="update-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['update-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('update') }}
            onMouseEnter={() => showActivityPreview('update-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('update-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="update-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('update-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('update-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['update-widget']}
                  transition={activityWindowTransition}
                >
                  {activeUpdateInstalls.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activeUpdateInstalls.map((previewUpdate) => (
                          <button
                            key={previewUpdate.entity_id}
                            onClick={() => openActivityWidget(previewUpdate.entity_id, 'update-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={(previewUpdate.percentage ?? 0) / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <Icon path={mdiUpdate} size={14} className="text-ha-blue" />
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewUpdate.name}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{formatProgressLabel(previewUpdate.percentage)}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full aspect-[2/1] rounded-ha-2xl mb-ha-4 bg-fill-primary-quiet flex items-center justify-center border border-surface-low">
                        <Icon path={mdiUpdate} size={40} className="text-ha-blue" />
                      </div>
                      <h3 className="text-sm font-bold text-text-primary truncate w-full text-center mb-1">{update.name}</h3>
                      <p className="text-xs text-text-secondary mb-ha-4">
                        {update.installedVersion || '—'} → {update.latestVersion || '—'}
                      </p>
                      <div className="w-full mb-ha-2 px-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">Installing</span>
                          <span className="text-xs font-mono text-ha-blue font-bold">{formatProgressLabel(update.percentage)}</span>
                        </div>
                        <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${update.percentage ?? 0}%` }}
                            className="bg-ha-blue h-full rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedUpdate ? (
                <>
                  <motion.div
                    key="update-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['update-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activeUpdateInstalls.length > 1 ? 'list-update' : null); },
                          activeUpdateInstalls.length > 1 ? mdiChevronUp : mdiClose,
                          'update'
                        )}
                      </div>

                      {update.status.isStale && (
                        <div className="w-full mb-ha-3 px-ha-3 py-ha-2 rounded-ha-lg bg-yellow-95 text-yellow-600 text-xs font-semibold text-center">
                          Data may be outdated
                        </div>
                      )}

                      <div className={`w-full aspect-[2/1] rounded-ha-2xl mb-ha-4 flex items-center justify-center border border-surface-low ${isComplete ? 'bg-green-500/10' : 'bg-fill-primary-quiet'}`}>
                        <Icon path={isComplete ? mdiCheckCircle : mdiUpdate} size={40} className={isComplete ? 'text-green-600' : 'text-ha-blue'} />
                      </div>
                      <h3 className="text-sm font-bold text-text-primary truncate w-full text-center mb-1">{update.name}</h3>

                      {isComplete ? (
                        <>
                          <p className="text-sm font-semibold text-green-600 mb-ha-4">{update.status.endLabel}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissActivity(update.entity_id, endedDismissKey(update.status));
                              minimizeActivityWidget();
                            }}
                            className="w-full h-10 rounded-ha-xl bg-green-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-green-500 transition-colors"
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-text-secondary mb-ha-4">
                            {update.installedVersion || '—'} → {update.latestVersion || '—'}
                          </p>
                          <div className="w-full mb-ha-2 px-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">Installing</span>
                              <span className="text-xs font-mono text-ha-blue font-bold">{formatProgressLabel(update.percentage)}</span>
                            </div>
                            <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${update.percentage ?? 0}%` }}
                                className="bg-ha-blue h-full rounded-full"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>

                  {selectedUpdate && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="update-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['update-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="update-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['update-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activeUpdateInstalls.map(u => (
                          <button
                            key={u.entity_id}
                            onClick={() => setExpandedWidgetId(u.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={(u.percentage ?? 0) / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <Icon path={mdiUpdate} size={14} className="text-ha-blue" />
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{u.name}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{formatProgressLabel(u.percentage)}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="update-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['update-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key={`update-collapsed-${update.status.alertAt ?? 'quiet'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activeUpdateInstalls.length > 1 ? 'list-update' : update.entity_id, 'update-widget')
                      : openActivityWidget(activeUpdateInstalls.length > 1 ? 'list-update' : update.entity_id, 'update-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    isComplete ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15' : 'bg-surface-low hover:bg-surface-mid'
                  } ${update.status.isStale ? 'opacity-70' : ''} ${isAlerting(update.status, nowMs) ? 'ha-status-pulse' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                    {activeUpdateInstalls.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activeUpdateInstalls.length}
                      </div>
                    )}
                    {isComplete ? (
                      <Icon path={mdiCheckCircle} size={26} className="text-green-600" />
                    ) : (
                      <CircularProgress
                        progress={(update.percentage ?? 0) / 100}
                        size={28}
                        strokeWidth={2.5}
                        className="text-ha-blue shrink-0"
                        trackClassName="text-fill-primary-quiet"
                      />
                    )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      {isComplete ? (
                        <span className="text-sm font-semibold text-green-600 truncate">{update.status.endLabel}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <RollingNumericValue
                            value={formatProgressLabel(update.percentage)}
                            className="text-sm font-semibold text-text-primary font-mono"
                          />
                          <span className="text-[13px] text-text-disabled uppercase font-bold tracking-tighter">Update</span>
                        </div>
                      )}
                      <span className="text-xs text-text-secondary truncate">{update.name}</span>
                    </div>
                    {isComplete && (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(update.entity_id, endedDismissKey(update.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-ha-blue pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* Backup widget(s) - show while a backup is actively running */}
        {activeBackups.length > 0 && (() => {
          const selectedBackup = activeBackups.find(b => b.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-backup';
          const backup = selectedBackup || activeBackups[0];
          const showPreview = hoveredActivityWidget === 'backup-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedBackup || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          const isComplete = backup.status.phase === 'ended';
          const failed = backup.status.endLabel === 'Backup failed';
          return (
          <motion.div
            key="backup-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['backup-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('backup') }}
            onMouseEnter={() => showActivityPreview('backup-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('backup-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="backup-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('backup-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('backup-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['backup-widget']}
                  transition={activityWindowTransition}
                >
                  {activeBackups.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activeBackups.map((previewBackup) => (
                          <button
                            key={previewBackup.entity_id}
                            onClick={() => openActivityWidget(previewBackup.entity_id, 'backup-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={(previewBackup.progress ?? 0) / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <Icon path={mdiCloudUpload} size={14} className="text-ha-blue" />
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewBackup.name}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{formatProgressLabel(previewBackup.progress)}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full aspect-[2/1] rounded-ha-2xl mb-ha-4 bg-fill-primary-quiet flex items-center justify-center border border-surface-low">
                        <Icon path={mdiCloudUpload} size={40} className="text-ha-blue" />
                      </div>
                      <h3 className="text-sm font-bold text-text-primary truncate w-full text-center mb-1">{backup.name}</h3>
                      <p className="text-xs text-text-secondary mb-ha-4 truncate w-full text-center">{backup.stage || 'Backing up…'}</p>
                      <div className="w-full mb-ha-2 px-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">Running</span>
                          <span className="text-xs font-mono text-ha-blue font-bold">{formatProgressLabel(backup.progress)}</span>
                        </div>
                        <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${backup.progress ?? 0}%` }}
                            className="bg-ha-blue h-full rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedBackup ? (
                <>
                  <motion.div
                    key="backup-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['backup-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activeBackups.length > 1 ? 'list-backup' : null); },
                          activeBackups.length > 1 ? mdiChevronUp : mdiClose,
                          'backup'
                        )}
                      </div>

                      <div className={`w-full aspect-[2/1] rounded-ha-2xl mb-ha-4 flex items-center justify-center border border-surface-low ${
                        isComplete ? (failed ? 'bg-red-500/10' : 'bg-green-500/10') : 'bg-fill-primary-quiet'
                      }`}>
                        <Icon
                          path={isComplete ? mdiCheckCircle : mdiCloudUpload}
                          size={40}
                          className={isComplete ? (failed ? 'text-red-500' : 'text-green-600') : 'text-ha-blue'}
                        />
                      </div>
                      <h3 className="text-sm font-bold text-text-primary truncate w-full text-center mb-1">{backup.name}</h3>

                      {isComplete ? (
                        <>
                          <p className={`text-sm font-semibold mb-ha-4 ${failed ? 'text-red-500' : 'text-green-600'}`}>{backup.status.endLabel}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissActivity(backup.entity_id, endedDismissKey(backup.status));
                              minimizeActivityWidget();
                            }}
                            className={`w-full h-10 rounded-ha-xl text-white font-bold text-xs uppercase tracking-wider transition-colors ${failed ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-text-secondary mb-ha-4 truncate w-full text-center">{backup.stage || 'Backing up…'}</p>
                          <div className="w-full mb-ha-2 px-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[13px] font-bold text-text-disabled uppercase tracking-tight">Running</span>
                              <span className="text-xs font-mono text-ha-blue font-bold">{formatProgressLabel(backup.progress)}</span>
                            </div>
                            <div className="w-full h-2 bg-surface-mid rounded-full overflow-hidden border border-surface-low/30">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${backup.progress ?? 0}%` }}
                                className="bg-ha-blue h-full rounded-full"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>

                  {selectedBackup && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="backup-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['backup-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="backup-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['backup-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activeBackups.map(b => (
                          <button
                            key={b.entity_id}
                            onClick={() => setExpandedWidgetId(b.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <CircularProgress
                              progress={(b.progress ?? 0) / 100}
                              size={32}
                              strokeWidth={2.5}
                              className="text-ha-blue shrink-0"
                              trackClassName="text-fill-primary-quiet"
                            >
                              <Icon path={mdiCloudUpload} size={14} className="text-ha-blue" />
                            </CircularProgress>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{b.name}</span>
                              <span className="text-xs text-text-secondary truncate font-mono">{formatProgressLabel(b.progress)}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="backup-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid text-text-secondary flex items-center justify-center hover:bg-surface-mid transition-colors"
                      style={{ width: activityWidgetWidths['backup-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key={`backup-collapsed-${backup.status.alertAt ?? 'quiet'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activeBackups.length > 1 ? 'list-backup' : backup.entity_id, 'backup-widget')
                      : openActivityWidget(activeBackups.length > 1 ? 'list-backup' : backup.entity_id, 'backup-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    isComplete
                      ? failed ? 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15' : 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15'
                      : 'bg-surface-low hover:bg-surface-mid'
                  } ${backup.status.isStale ? 'opacity-70' : ''} ${isAlerting(backup.status, nowMs) ? 'ha-status-pulse' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                    {activeBackups.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activeBackups.length}
                      </div>
                    )}
                    {isComplete ? (
                      <Icon path={mdiCheckCircle} size={26} className={failed ? 'text-red-500' : 'text-green-600'} />
                    ) : (
                      <CircularProgress
                        progress={(backup.progress ?? 0) / 100}
                        size={28}
                        strokeWidth={2.5}
                        className="text-ha-blue shrink-0"
                        trackClassName="text-fill-primary-quiet"
                      >
                        <Icon path={mdiCloudUpload} size={13} className="text-ha-blue" />
                      </CircularProgress>
                    )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      {isComplete ? (
                        <span className={`text-sm font-semibold truncate ${failed ? 'text-red-500' : 'text-green-600'}`}>{backup.status.endLabel}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <RollingNumericValue
                            value={formatProgressLabel(backup.progress)}
                            className="text-sm font-semibold text-text-primary font-mono"
                          />
                          <span className="text-[13px] text-text-disabled uppercase font-bold tracking-tighter">Backup</span>
                        </div>
                      )}
                      <span className="text-xs text-text-secondary truncate">{backup.stage || backup.name}</span>
                    </div>
                    {isComplete && (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(backup.entity_id, endedDismissKey(backup.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-ha-blue pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}

        {/* Alarm widget(s) - show while arming, pending, or triggered */}
        {activeAlarms.length > 0 && (() => {
          const selectedAlarm = activeAlarms.find(a => a.entity_id === expandedWidgetId);
          const isListView = expandedWidgetId === 'list-alarm';
          const alarm = selectedAlarm || activeAlarms[0];
          const showPreview = hoveredActivityWidget === 'alarm-widget' && !expandedWidgetId;
          const isExpanded = Boolean(selectedAlarm || isListView);
          const isPinnedInFooter = isPinnedActivityWidget && isExpanded;
          const isTriggered = alarm.state === 'triggered';
          const isComplete = alarm.status.phase === 'ended';
          const alarmLabel = alarm.state === 'triggered' ? 'Triggered' : alarm.state === 'arming' ? 'Arming' : 'Pending';
          return (
          <motion.div
            key="alarm-widget"
            layout={isPinnedInFooter ? false : 'position'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['alarm-widget'] = el; }}
            className="relative"
            style={isPinnedInFooter ? PINNED_ACTIVITY_FOOTER_SLOT_STYLE : { order: activities.typeOrder.indexOf('alarm') }}
            onMouseEnter={() => showActivityPreview('alarm-widget')}
            onMouseLeave={() => scheduleHideActivityPreview('alarm-widget')}
          >
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  key="alarm-preview"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  onMouseEnter={() => showActivityPreview('alarm-widget')}
                  onMouseLeave={() => scheduleHideActivityPreview('alarm-widget')}
                  className="fixed -translate-x-1/2 z-50 w-[300px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden flex flex-col cursor-default"
                  style={activityFlyoutStyles['alarm-widget']}
                  transition={activityWindowTransition}
                >
                  {activeAlarms.length > 1 ? (
                    <div className="p-ha-4">
                      <div className="space-y-ha-2">
                        {activeAlarms.map((previewAlarm) => (
                          <button
                            key={previewAlarm.entity_id}
                            onClick={() => openActivityWidget(previewAlarm.entity_id, 'alarm-widget')}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
                              <Icon path={mdiShieldAlert} size={16} className="text-red-500" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{previewAlarm.name}</span>
                              <span className="text-xs text-red-500 truncate">{previewAlarm.state}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-ha-4">
                      <div className="flex items-center gap-ha-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isTriggered ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-95 text-yellow-600 border-yellow-200'}`}>
                          <Icon path={mdiShieldAlert} size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{alarm.name}</h4>
                          <p className={`text-[13px] font-bold uppercase tracking-tight ${isTriggered ? 'text-red-500' : 'text-yellow-600'}`}>
                            {alarmLabel} • {formatRelativeAge(alarm.since, nowMs)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {selectedAlarm ? (
                <>
                  <motion.div
                    key="alarm-expanded"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[300px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['alarm-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(activeAlarms.length > 1 ? 'list-alarm' : null); },
                          activeAlarms.length > 1 ? mdiChevronUp : mdiClose,
                          'alarm'
                        )}
                      </div>
                      <div className="flex items-center gap-ha-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                          isComplete ? 'bg-green-500/10 text-green-600 border-green-500/20' : isTriggered ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-95 text-yellow-600 border-yellow-200'
                        }`}>
                          <Icon path={isComplete ? mdiCheckCircle : mdiShieldAlert} size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{alarm.name}</h4>
                          {isComplete ? (
                            <p className="text-[13px] font-bold uppercase tracking-tight text-green-600">{alarm.status.endLabel}</p>
                          ) : (
                            <p className={`text-[13px] font-bold uppercase tracking-tight ${isTriggered ? 'text-red-500' : 'text-yellow-600'}`}>
                              {alarmLabel} • {formatRelativeAge(alarm.since, nowMs)}
                            </p>
                          )}
                        </div>
                      </div>
                      {isComplete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissActivity(alarm.entity_id, endedDismissKey(alarm.status));
                            minimizeActivityWidget();
                          }}
                          className="w-full h-10 mt-ha-4 rounded-ha-xl bg-green-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-green-500 transition-colors"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </motion.div>

                  {selectedAlarm && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="alarm-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      style={{ width: activityWidgetWidths['alarm-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="alarm-list"
                    ref={activityWidgetView === 'dialog' ? activityDialogRef : null}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    className={`fixed overflow-hidden flex flex-col cursor-default ${activityWidgetView === 'dock' ? ACTIVITY_DOCK_CARD_CLASS + ' w-[280px]' : ACTIVITY_DIALOG_CARD_CLASS}`}
                    style={activityWidgetView === 'dock' ? activityFlyoutStyles['alarm-widget'] : { ...activityDialogStyle, width: ACTIVITY_DIALOG_WIDTH, maxWidth: '92vw' }}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div
                        onMouseDown={handleActivityDialogHeaderMouseDown}
                        className={`w-full flex justify-end items-center mb-ha-2 ${activityWidgetView !== 'dock' ? 'cursor-move' : ''}`}
                      >
                        {renderActivityWindowActions(
                          (e) => { e.stopPropagation(); setExpandedWidgetId(null); },
                          mdiClose
                        )}
                      </div>
                      <div className="space-y-ha-2">
                        {activeAlarms.map(a => (
                          <button
                            key={a.entity_id}
                            onClick={() => setExpandedWidgetId(a.entity_id)}
                            className="w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low hover:bg-surface-mid transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
                              <Icon path={mdiShieldAlert} size={16} className="text-red-500" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-text-primary truncate">{a.name}</span>
                              <span className="text-xs text-red-500 truncate">{a.state}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && activityWidgetView !== 'pinned' && (
                    <motion.button
                      key="alarm-list-minimize"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={activityMiniTransition}
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeActivityWidget();
                      }}
                      className="h-12 rounded-ha-pill bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      style={{ width: activityWidgetWidths['alarm-widget'] }}
                    >
                      <Icon path={mdiChevronDown} size={20} />
                    </motion.button>
                  )}
                </>
              ) : (
                <motion.div
                  key={`alarm-collapsed-${alarm.status.alertAt ?? 'quiet'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => (
                    showPreview
                      ? openActivityWidgetDialog(activeAlarms.length > 1 ? 'list-alarm' : alarm.entity_id, 'alarm-widget')
                      : openActivityWidget(activeAlarms.length > 1 ? 'list-alarm' : alarm.entity_id, 'alarm-widget')
                  )}
                  className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer ${
                    isComplete
                      ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15'
                      : isTriggered
                        ? 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15'
                        : 'bg-yellow-95 border border-yellow-200 hover:bg-yellow-100'
                  } ${isAlerting(alarm.status, nowMs) ? 'ha-status-pulse' : ''}`}
                >
                  <div className={`flex items-center gap-ha-3 transition-opacity ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="relative">
                    {activeAlarms.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activeAlarms.length}
                      </div>
                    )}
                    <Icon
                      path={isComplete ? mdiCheckCircle : mdiShieldAlert}
                      size={22}
                      className={isComplete ? 'text-green-600' : isTriggered ? 'text-red-500' : 'text-yellow-600'}
                    />
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[140px]">
                      <span className={`text-sm font-semibold truncate ${isComplete ? 'text-green-600' : isTriggered ? 'text-red-500' : 'text-yellow-600'}`}>
                        {isComplete ? alarm.status.endLabel : alarmLabel}
                      </span>
                      <span className="text-xs text-text-secondary truncate">{alarm.name}</span>
                    </div>
                    {isComplete && (
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissActivity(alarm.entity_id, endedDismissKey(alarm.status));
                        }}
                        className="p-1 -mr-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                      >
                        <Icon path={mdiClose} size={15} />
                      </button>
                    )}
                  </div>
                  {showPreview && (
                    <div className="absolute inset-0 flex items-center justify-center text-text-primary pointer-events-none">
                      <Icon path={mdiOpenInNew} size={18} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })()}
          </AnimatePresence>
           </div>
           {/* Right Gradient */}
           <div 
            className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
              showRightGradient ? 'opacity-100' : 'opacity-0'
            }`} 
           />
        </div>
      </div>

      {/* Right side: Status icons + time */}
      <div className="relative" ref={statusContainerRef}>
        
        {/* The status pill toggles the Home Center bento overlay — clicking it
            again while open closes it. */}
        <button
          className={`flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-4 h-12 hover:bg-surface-mid transition-all duration-300 active:scale-95 cursor-pointer outline-none ring-offset-2 focus:ring-2 ring-ha-blue/50 ${statusPulsing ? 'ha-status-pulse' : ''}`}
          onClick={toggleHomeCenter}
        >
        {/* Status indicators — order and visibility follow Home Center prefs */}
        <HomeCenterPillIndicators />

          {/* Time with stacked AM/PM */}
          <div className="flex items-center gap-ha-1">
            <span className="text-base font-semibold text-text-primary tabular-nums" style={{ fontFamily: 'var(--ha-font-family-base, system-ui)' }}>
              {currentTime.hours}
              <span className={colonVisible ? 'opacity-100' : 'opacity-0'}>:</span>
              {currentTime.minutes}
            </span>
            <div className="flex items-center gap-ha-1">
              {!use24HourClock && (
                <div className="flex flex-col text-[13px] font-medium leading-tight">
                  <span className={isAM ? 'text-text-primary' : 'text-text-disabled'}>AM</span>
                  <span className={!isAM ? 'text-text-primary' : 'text-text-disabled'}>PM</span>
                </div>
              )}
              {/* Connection status dot - next to AM/PM */}
              {connectionStatus && (
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      connectionStatus === 'connecting' ? 'bg-ha-blue scale-100' :
                      connectionStatus === 'connected' ? 'bg-green-500 scale-100' :
                      connectionStatus === 'error' ? 'bg-red-500 scale-100' : 'scale-0'
                    }`}
                  />
              )}
              {!connectionStatus && (
                <div className="w-2 h-2 scale-0" />
              )}
            </div>
          </div>
        </button>
      </div>
    </footer>
    </>
  );
}
