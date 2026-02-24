'use client';

import { useEffect, useState, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { CircularProgress } from '../ui/CircularProgress';
import { Tooltip } from '../ui/Tooltip';
import { useHomeAssistant } from '@/hooks';
import { resolveEntityPictureUrl } from '@/lib/utils';
import {
  mdiMicrophone,
  mdiPlay,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiTimerOutline,
  mdiPause,
  mdiUpdate,
  mdiBell,
  mdiWeb,
  mdiSend,
  mdiDevices,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiCloudCheck,
  mdiCloudOff,
  mdiClose,
  mdiChevronRight,
  mdiDoorbellVideo,
  mdiChevronDown,
  mdiChevronUp,
  mdiVolumeHigh,
  mdiStop,
  mdiLayers,
  mdiThermometer,
  mdiAccount,
  mdiVideo,
} from '@mdi/js';

const RELEASE_NOTES_PREFIX = 'update.home_assistant_release_notes_simulated';

interface Timer {
  entity_id: string;
  name: string;
  state: string;
  remaining: string;
  duration: string;
  progress: number;
}

interface MediaPlayer {
  entity_id: string;
  name: string;
  state: string;
  mediaTitle?: string;
  mediaArtist?: string;
  entityPicture?: string;
}

interface Camera {
  entity_id: string;
  name: string;
  state: string;
  event?: string;
  entityPicture?: string;
}

interface Printer {
  entity_id: string;
  name: string;
  state: string;
  progress: number;
  fileName?: string;
  remainingTime?: string;
  entityPicture?: string;
}

interface ReleaseNotesWidget {
  entity_id: string;
  name: string;
  version: string;
  summary: string;
  notes: string[];
  updatedAt: string;
}

type ActivityWidgetKey =
  | 'release-notes-widget'
  | 'media-widget'
  | 'timer-widget'
  | 'camera-widget'
  | 'printer-widget';

const ACTIVITY_FLYOUT_WIDTHS: Record<ActivityWidgetKey, number> = {
  'release-notes-widget': 320,
  'media-widget': 280,
  'timer-widget': 260,
  'camera-widget': 340,
  'printer-widget': 280,
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
};

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

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;

interface StatusBarProps {
  connectionStatus?: ConnectionStatusType;
  profileOpen?: boolean;
  onProfileToggle?: () => void;
}

export function StatusBar({ connectionStatus, profileOpen, onProfileToggle }: StatusBarProps) {
  const { entities, callService, haUrl } = useHomeAssistant();
  const [currentTime, setCurrentTime] = useState({ hours: '', minutes: '' });
  const [timerDisplays, setTimerDisplays] = useState<Record<string, string>>({});
  const [timerProgress, setTimerProgress] = useState<Record<string, number>>({});
  const use24HourClock = useMemo(() => systemPrefers24HourClock(), []);
  const [isAM, setIsAM] = useState(true);
  const [colonVisible, setColonVisible] = useState(true);
  // Widget container refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Widget expansion state
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  const [hoveredActivityWidget, setHoveredActivityWidget] = useState<ActivityWidgetKey | null>(null);
  const [activityFlyoutStyles, setActivityFlyoutStyles] = useState<Record<ActivityWidgetKey, CSSProperties>>({
    'release-notes-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'media-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'timer-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'camera-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
    'printer-widget': DEFAULT_ACTIVITY_FLYOUT_STYLE,
  });
  const [activityWidgetWidths, setActivityWidgetWidths] = useState<Record<ActivityWidgetKey, number>>(DEFAULT_ACTIVITY_WIDGET_WIDTHS);
  const [dismissedReleaseNotes, setDismissedReleaseNotes] = useState<Record<string, string>>({});

  // Status pop-up state
  const [statusExpanded, setStatusExpanded] = useState(false);
  const statusContainerRef = useRef<HTMLDivElement>(null);

  // Footer scroll state
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);
  const activitiesScrollRef = useRef<HTMLDivElement>(null);

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
        let activeRef: HTMLDivElement | null = null;
        if (expandedWidgetId === 'chat') {
          activeRef = chatContainerRef.current;
        } else if (expandedWidgetId === 'list-release-notes') {
          activeRef = widgetContainerRefs.current['release-notes-widget'];
        } else if (expandedWidgetId === 'list-media') {
          activeRef = widgetContainerRefs.current['media-widget'];
        } else if (expandedWidgetId === 'list-timer') {
          activeRef = widgetContainerRefs.current['timer-widget'];
        } else if (expandedWidgetId === 'list-camera') {
          activeRef = widgetContainerRefs.current['camera-widget'];
        } else if (expandedWidgetId === 'list-printer') {
          activeRef = widgetContainerRefs.current['printer-widget'];
        } else {
          // It's an entity_id — check all widget containers
          activeRef = widgetContainerRefs.current['release-notes-widget']
            ?? widgetContainerRefs.current['media-widget']
            ?? widgetContainerRefs.current['timer-widget']
            ?? widgetContainerRefs.current['camera-widget']
            ?? widgetContainerRefs.current['printer-widget']
            ?? null;
          // Find the specific one that contains the click target
          const allRefs = ['release-notes-widget', 'media-widget', 'timer-widget', 'camera-widget', 'printer-widget'];
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
          return;
        }

        if (activeRef && !activeRef.contains(event.target as Node)) {
          setExpandedWidgetId(null);
          setHoveredActivityWidget(null);
        }
      }
    };

    if (statusExpanded || expandedWidgetId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusExpanded, expandedWidgetId, setExpandedWidgetId, setStatusExpanded]);

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

  const openActivityWidget = useCallback((widgetId: string, widgetKey: ActivityWidgetKey) => {
    updateActivityFlyoutPosition(widgetKey);
    setHoveredActivityWidget(null);
    setExpandedWidgetId(widgetId);
  }, [updateActivityFlyoutPosition]);

  const minimizeActivityWidget = useCallback(() => {
    setHoveredActivityWidget(null);
    setExpandedWidgetId(null);
  }, []);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const displayHours = use24HourClock ? hours.toString().padStart(2, '0') : (hours % 12 || 12).toString();
      setIsAM(hours < 12);
      setColonVisible((prev) => !prev);
      setCurrentTime({
        hours: displayHours,
        minutes: now.getMinutes().toString().padStart(2, '0'),
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [use24HourClock]);

  // Get active timers from HA entities
  const activeTimers = useMemo(() => {
    const timers: Timer[] = [];

    Object.entries(entities).forEach(([entityId, entity]) => {
      if (entityId.startsWith('timer.') && (entity.state === 'active' || entity.state === 'paused')) {
        const remaining = String(entity.attributes.remaining || '0:00:00');
        const duration = String(entity.attributes.duration || '0:00:00');
        const remainingSec = parseTimeToSeconds(remaining);
        const durationSec = parseTimeToSeconds(duration);
        const progress = durationSec > 0 ? remainingSec / durationSec : 0;

        timers.push({
          entity_id: entityId,
          name: String(entity.attributes.friendly_name || entityId.replace('timer.', '')),
          state: entity.state,
          remaining,
          duration,
          progress,
        });
      }
    });

    return timers;
  }, [entities]);

  // No longer needed to manually set visibility in effects

  // Get active media players from HA entities
  const activePlayers = useMemo(() => {
    const players: MediaPlayer[] = [];

    Object.entries(entities).forEach(([entityId, entity]) => {
      if (entityId.startsWith('media_player.') && (entity.state === 'playing' || entity.state === 'paused')) {
        players.push({
          entity_id: entityId,
          name: String(entity.attributes.friendly_name || entityId.replace('media_player.', '')),
          state: entity.state,
          mediaTitle: entity.attributes.media_title as string | undefined,
          mediaArtist: entity.attributes.media_artist as string | undefined,
          entityPicture: entity.attributes.entity_picture as string | undefined,
        });
      }
    });

    return players;
  }, [entities]);

  // No longer needed to manually set visibility in effects

  // Get active cameras from HA entities
  const activeCameras = useMemo(() => {
    const cameras: Camera[] = [];

    Object.entries(entities).forEach(([entityId, entity]) => {
      // We look for our simulated camera or any camera with an active event
      if (entityId.startsWith('camera.') || entityId.startsWith('binary_sensor.camera_simulated')) {
        const isActive = entityId.startsWith('binary_sensor.camera_simulated')
          ? entity.state === 'on'
          : entity.state === 'motion' || entity.state === 'person';

        if (isActive) {
          cameras.push({
            entity_id: entityId,
            name: String(entity.attributes.friendly_name || 'Front Door'),
            state: entity.state,
            event: entity.attributes.event_type as string || (entityId.includes('camera') ? 'Movement detected' : 'Somebody at the door'),
            entityPicture: entity.attributes.entity_picture as string | undefined,
          });
        }
      }
    });

    return cameras;
  }, [entities]);

  // No longer needed to manually set visibility in effects

  // Get active printers from HA entities
  const activePrinters = useMemo(() => {
    const printers: Printer[] = [];

    Object.entries(entities).forEach(([entityId, entity]) => {
      // Only show printers that are actively printing
      const isPrinting = entity.state.toLowerCase() === 'printing';

      if (isPrinting && (entityId.startsWith('sensor.printer_') || entityId === 'sensor.printer_simulated' || entityId.includes('printer'))) {
        printers.push({
          entity_id: entityId,
          name: String(entity.attributes.friendly_name || '3D Printer'),
          state: entity.state,
          progress: Number(entity.attributes.progress || 0),
          fileName: entity.attributes.file_name as string || 'Unknown file',
          remainingTime: entity.attributes.time_remaining as string || '00:00:00',
          entityPicture: entity.attributes.entity_picture as string | undefined,
        });
      }
    });

    return printers;
  }, [entities]);

  // Simulated release notes widget entities
  const activeReleaseNotes = useMemo(() => {
    const notes: ReleaseNotesWidget[] = [];

    Object.entries(entities).forEach(([entityId, entity]) => {
      if (entityId !== RELEASE_NOTES_PREFIX || entity.state !== 'on') return;

      const rawNotes = entity.attributes.release_notes;
      const parsedNotes = Array.isArray(rawNotes)
        ? rawNotes.map((item) => String(item))
        : typeof rawNotes === 'string'
          ? [rawNotes]
          : [];

      notes.push({
        entity_id: entityId,
        name: String(entity.attributes.friendly_name || 'Home Assistant release notes'),
        version: String(entity.attributes.latest_version || entity.attributes.release_version || 'Latest'),
        summary: String(entity.attributes.release_summary || 'See what is new in Home Assistant.'),
        notes: parsedNotes,
        updatedAt: entity.last_updated,
      });
    });

    return notes.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  }, [entities]);

  const visibleReleaseNotes = useMemo(
    () => activeReleaseNotes.filter((note) => dismissedReleaseNotes[note.entity_id] !== note.updatedAt),
    [activeReleaseNotes, dismissedReleaseNotes]
  );

  const activityWidgetTransition = {
    duration: 0.16,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  const activityWindowTransition = {
    duration: 0.16,
    ease: [0.2, 0.9, 0.2, 1] as const,
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
        const durationSec = parseTimeToSeconds(timer.duration);

        if (timer.state === 'active') {
          const entity = entities[timer.entity_id];
          const finishesAt = entity?.attributes.finishes_at;
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
  }, [activeTimers, entities]);

  // Get pending updates
  const activeUpdates = useMemo(() => {
    return Object.entries(entities).filter(
      ([entityId, entity]) =>
        entityId.startsWith('update.') && entity.state === 'on'
    ).map(([id, entity]) => ({
      id,
      name: entity.attributes.friendly_name || id,
      picture: entity.attributes.entity_picture as string | undefined,
    }));
  }, [entities]);

  // Get active notifications
  const activeNotifications = useMemo(() => {
    return Object.entries(entities).filter(([entityId]) =>
      entityId.startsWith('persistent_notification.')
    ).map(([id, entity]) => ({
      id,
      title: (entity.attributes.title || entity.attributes.friendly_name || 'System Notification') as string,
      message: entity.attributes.message as string | undefined,
    }));
  }, [entities]);

  // Check cloud/remote connection status
  const isRemoteConnected = useMemo(() => {
    // Check for Nabu Casa cloud connection
    const cloudEntity = entities['cloud.cloud'];
    if (cloudEntity) {
      return cloudEntity.state === 'connected';
    }

    // Alternative: check binary_sensor.remote_ui if available
    const remoteUi = entities['binary_sensor.remote_ui'];
    if (remoteUi) {
      return remoteUi.state === 'on';
    }

    // Default to false (not exposed) if we can't determine
    return false;
  }, [entities]);

  // Count/List offline devices (only entities that belong to physical devices)
  const offlineDevices = useMemo(() => {
    return Object.values(entities).filter((entity) => {
      // Only count entities that belong to a physical device
      const hasDeviceId = entity.attributes.device_id !== undefined && entity.attributes.device_id !== null;
      if (!hasDeviceId) return false;

      // Check if the device is offline
      return entity.state === 'unavailable' || entity.state === 'unknown';
    }).map(entity => ({
      id: entity.entity_id,
      name: (entity.attributes.friendly_name || entity.entity_id) as string,
    }));
  }, [entities]);

  // Calculated counts for display
  const pendingUpdates = activeUpdates.length;
  const notificationCount = activeNotifications.length;
  const offlineCount = offlineDevices.length;

  // Get current user's avatar (for immersive mode)
  const userAvatar = useMemo(() => {
    const personEntry = Object.entries(entities).find(
      ([entityId]) => entityId.startsWith('person.')
    );
    if (personEntry) {
      const [, entity] = personEntry;
      const picture = entity.attributes.entity_picture as string | undefined;
      const name = entity.attributes.friendly_name as string | undefined;
      return {
        picture: resolveEntityPictureUrl(haUrl, picture),
        initials: name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U',
      };
    }
    return { picture: undefined, initials: 'U' };
  }, [entities, haUrl]);

  const getEntityPictureUrl = (picture?: string, fallback?: string) => {
    return resolveEntityPictureUrl(haUrl, picture) ?? fallback;
  };

  const dismissReleaseNote = useCallback((entityId: string, updatedAt: string) => {
    setDismissedReleaseNotes((prev) => {
      if (prev[entityId] === updatedAt) return prev;
      return { ...prev, [entityId]: updatedAt };
    });

    const remaining = visibleReleaseNotes.filter((note) => note.entity_id !== entityId);
    setExpandedWidgetId(remaining[0]?.entity_id ?? null);
  }, [visibleReleaseNotes]);

  return (
    <footer className="hidden lg:flex items-center justify-between pr-edge pt-ha-2 pb-edge col-span-full z-50" data-component="StatusBar">
      {/* Left side widgets */}
      <div className="flex items-center flex-1 min-w-0 mr-4 gap-ha-5">
        {/* User profile avatar - Fixed */}
        <button
          onClick={onProfileToggle}
          className={`p-ha-1 rounded-full transition-all flex-shrink-0 ${
            profileOpen ? 'ring-2 ring-ha-blue' : 'hover:ring-2 hover:ring-surface-lower'
          }`}
          style={{ marginLeft: '8px' }}
        >
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="md" />
        </button>
        
        {/* Voice input widget - Fixed */}
        <div ref={chatContainerRef} className="relative flex-shrink-0">
          <AnimatePresence mode="wait">
            {expandedWidgetId === 'chat' ? (
              <motion.div
                key="chat-expanded"
                layoutId="chat-widget"
                className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[320px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default"
                transition={activityWindowTransition}
              >
                <div className="p-ha-4 flex flex-col gap-ha-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Ask my home</span>
                    <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                      <Icon path={mdiClose} size={18} className="text-text-secondary" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-ha-4 h-full min-h-[180px] justify-center items-center text-center px-ha-4">
                    <div className="w-16 h-16 bg-ha-blue/10 rounded-full flex items-center justify-center mb-ha-2">
                       <Icon path={mdiMicrophone} size={32} className="text-ha-blue" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-text-primary mb-1">How can I help you?</h4>
                      <p className="text-xs text-text-secondary">Try &quot;Turn off the kitchen lights&quot; or &quot;Show me the front door&quot;</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill p-ha-1">
                    <div className="flex-1 px-ha-3 text-sm text-text-secondary font-medium italic">Type or speak...</div>
                    <button className="w-9 h-9 rounded-full bg-ha-blue flex items-center justify-center text-white shadow-md active:scale-90 transition-transform">
                      <Icon path={mdiSend} size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="chat-collapsed"
                layoutId="chat-widget"
                onClick={() => setExpandedWidgetId('chat')}
                className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 pr-ha-1 h-12 transition-all hover:bg-surface-mid min-w-[200px] group border border-transparent"
              >
                <div className="w-8 h-8 rounded-full bg-ha-blue flex items-center justify-center shadow-ha-sm group-hover:scale-110 transition-transform">
                  <Icon path={mdiMicrophone} size={18} className="text-white" />
                </div>
                <span className="flex-1 text-sm font-medium text-text-primary text-left">
                  Ask your home...
                </span>
                <div className="p-ha-1 rounded-full group-hover:bg-surface-lower transition-colors">
                  <Icon path={mdiChevronRight} size={20} className="text-text-secondary" />
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        
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
            const showPreview = hoveredActivityWidget === 'release-notes-widget' && !expandedWidgetId;
            return (
            <motion.div
              key="release-notes-widget"
              layout="position"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={activityWidgetTransition}
              ref={(el) => { widgetContainerRefs.current['release-notes-widget'] = el; }}
              className="relative"
              onMouseEnter={() => {
                if (!expandedWidgetId) {
                  updateActivityFlyoutPosition('release-notes-widget');
                  setHoveredActivityWidget('release-notes-widget');
                }
              }}
              onMouseLeave={() => {
                setHoveredActivityWidget((current) => (current === 'release-notes-widget' ? null : current));
              }}
            >
              <AnimatePresence mode="wait">
                {selectedReleaseNote || showPreview ? (
                  <>
                    <motion.div
                      key={showPreview ? 'release-notes-preview' : 'release-notes-expanded'}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`fixed -translate-x-1/2 w-[320px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default ${showPreview ? 'pointer-events-none' : ''}`}
                      style={activityFlyoutStyles['release-notes-widget']}
                      transition={activityWindowTransition}
                    >
                      <div className="p-ha-4 flex flex-col gap-ha-3">
                        <div className="w-full flex justify-between items-center pl-1">
                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest pl-1">What&apos;s New</span>
                          {!showPreview && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(visibleReleaseNotes.length > 1 ? 'list-release-notes' : null); }}
                              className="p-ha-1 hover:bg-surface-low rounded-full"
                            >
                              <Icon path={visibleReleaseNotes.length > 1 ? mdiChevronUp : mdiClose} size={18} className="text-text-secondary" />
                            </button>
                          )}
                        </div>

                        <div className="w-full rounded-ha-xl bg-green-500/10 border border-green-500/20 p-ha-3">
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">{releaseNote.version}</p>
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

                        {!showPreview && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissReleaseNote(releaseNote.entity_id, releaseNote.updatedAt);
                            }}
                            className="h-10 rounded-ha-xl bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
                          >
                            Dismiss Notes
                          </button>
                        )}
                      </div>
                    </motion.div>

                    {selectedReleaseNote && (
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

                    {showPreview && (
                      <div
                        className="h-12 rounded-ha-pill bg-green-500/12 border border-green-500/20"
                        style={{ width: activityWidgetWidths['release-notes-widget'] }}
                      />
                    )}
                  </>
                ) : isListView ? (
                  <>
                    <motion.div
                      key="release-notes-list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed -translate-x-1/2 w-[320px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default"
                      style={activityFlyoutStyles['release-notes-widget']}
                      transition={activityWindowTransition}
                    >
                      <div className="p-ha-4">
                        <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest pl-1">What&apos;s New ({visibleReleaseNotes.length})</span>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                            <Icon path={mdiClose} size={18} className="text-text-secondary" />
                          </button>
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

                    {isExpanded && (
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
                    onClick={() => openActivityWidget(visibleReleaseNotes.length > 1 ? 'list-release-notes' : releaseNote.entity_id, 'release-notes-widget')}
                    className="flex items-center gap-ha-3 bg-green-500/12 border border-green-500/25 rounded-ha-pill px-ha-3 h-12 transition-all hover:bg-green-500/20 cursor-pointer"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                        <Icon path={mdiUpdate} size={16} className="text-green-600" />
                      </div>
                      {visibleReleaseNotes.length > 1 && (
                        <div className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-default shadow-sm z-10">
                          {visibleReleaseNotes.length}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[180px]">
                      <span className="text-sm font-bold text-green-600 truncate">What&apos;s New</span>
                      <span className="text-xs text-text-secondary truncate">{releaseNote.version}</span>
                    </div>
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
          return (
          <motion.div
            key="media-widget"
            layout="position"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['media-widget'] = el; }}
            className="relative"
            onMouseEnter={() => {
              if (!expandedWidgetId) {
                updateActivityFlyoutPosition('media-widget');
                setHoveredActivityWidget('media-widget');
              }
            }}
            onMouseLeave={() => {
              setHoveredActivityWidget((current) => (current === 'media-widget' ? null : current));
            }}
          >
            <AnimatePresence mode="wait">
              {selectedPlayer || showPreview ? (
                <>
                  <motion.div
                    key={showPreview ? 'media-preview' : 'media-expanded'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed -translate-x-1/2 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default ${showPreview ? 'pointer-events-none' : ''}`}
                    style={activityFlyoutStyles['media-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                        <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Now Playing</span>
                        {!showPreview && (
                          <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(activePlayers.length > 1 ? 'list-media' : null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                            <Icon path={activePlayers.length > 1 ? mdiChevronUp : mdiClose} size={18} className="text-text-secondary" />
                          </button>
                        )}
                      </div>

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

                  {selectedPlayer && (
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

                  {showPreview && (
                    <div
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid"
                      style={{ width: activityWidgetWidths['media-widget'] }}
                    />
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="media-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed -translate-x-1/2 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default"
                    style={activityFlyoutStyles['media-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                        <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Media Players ({activePlayers.length})</span>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                          <Icon path={mdiClose} size={18} className="text-text-secondary" />
                        </button>
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

                  {isExpanded && (
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
                  onClick={() => openActivityWidget(activePlayers.length > 1 ? 'list-media' : player.entity_id, 'media-widget')}
                  className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 transition-all hover:bg-surface-mid cursor-pointer"
                >
                  <div className="relative">
                    {player.entityPicture ? (
                      <img
                        src={getEntityPictureUrl(player.entityPicture)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-surface-low"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-fill-primary-normal flex items-center justify-center">
                        <Icon path={mdiPlay} size={16} className="text-ha-blue" />
                      </div>
                    )}
                    {player.state === 'playing' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-ha-blue rounded-full border-2 border-surface-low flex items-center justify-center">
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                      </span>
                    )}
                    {activePlayers.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[10px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
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
          return (
          <motion.div
            key="timer-widget"
            layout="position"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['timer-widget'] = el; }}
            className="relative"
            onMouseEnter={() => {
              if (!expandedWidgetId) {
                updateActivityFlyoutPosition('timer-widget');
                setHoveredActivityWidget('timer-widget');
              }
            }}
            onMouseLeave={() => {
              setHoveredActivityWidget((current) => (current === 'timer-widget' ? null : current));
            }}
          >
            <AnimatePresence mode="wait">
              {selectedTimer || showPreview ? (
                <>
                  <motion.div
                    key={showPreview ? 'timer-preview' : 'timer-expanded'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed -translate-x-1/2 w-[260px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default ${showPreview ? 'pointer-events-none' : ''}`}
                    style={activityFlyoutStyles['timer-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-5 flex flex-col items-center">
                      <div className="w-full flex justify-between items-center mb-ha-4 pl-1">
                        <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Timer</span>
                        {!showPreview && (
                          <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(activeTimers.length > 1 ? 'list-timer' : null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                            <Icon path={activeTimers.length > 1 ? mdiChevronUp : mdiClose} size={18} className="text-text-secondary" />
                          </button>
                        )}
                      </div>

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
                          <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest mt-1">
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
                  </motion.div>

                  {selectedTimer && (
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

                  {showPreview && (
                    <div
                      className={`h-12 rounded-ha-pill border ${
                        timer.state === 'active'
                          ? 'bg-fill-primary-normal border-fill-primary-quiet'
                          : 'bg-yellow-95 border-yellow-200'
                      }`}
                      style={{ width: activityWidgetWidths['timer-widget'] }}
                    />
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="timer-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed -translate-x-1/2 w-[260px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default"
                    style={activityFlyoutStyles['timer-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                        <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Timers ({activeTimers.length})</span>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                          <Icon path={mdiClose} size={18} className="text-text-secondary" />
                        </button>
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
                              <span className="text-xs text-text-secondary truncate">{timerDisplays[t.entity_id] || t.remaining}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && (
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
                  key="timer-collapsed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => openActivityWidget(activeTimers.length > 1 ? 'list-timer' : timer.entity_id, 'timer-widget')}
                  className={`flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer hover:opacity-90 ${
                    timer.state === 'active' ? 'bg-fill-primary-normal' : 'bg-yellow-95'
                  }`}
                >
                  <div className="relative">
                  {activeTimers.length > 1 && (
                    <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[10px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                      {activeTimers.length}
                    </div>
                  )}
                  <CircularProgress
                    progress={timerProgress[timer.entity_id] ?? timer.progress}
                    size={32}
                    strokeWidth={2.5}
                    className={timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                    trackClassName={timer.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
                  >
                    <Icon
                      path={timer.state === 'active' ? mdiTimerOutline : mdiPause}
                      size={14}
                      className={timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
                    />
                  </CircularProgress>
                  </div>
                  <div className="flex flex-col min-w-0 max-w-[140px]">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {timerDisplays[timer.entity_id] || timer.remaining}
                    </span>
                    <span className="text-xs text-text-secondary truncate">{timer.name}</span>
                  </div>
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
          return (
          <motion.div
            key="camera-widget"
            layout="position"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['camera-widget'] = el; }}
            className="relative"
            onMouseEnter={() => {
              if (!expandedWidgetId) {
                updateActivityFlyoutPosition('camera-widget');
                setHoveredActivityWidget('camera-widget');
              }
            }}
            onMouseLeave={() => {
              setHoveredActivityWidget((current) => (current === 'camera-widget' ? null : current));
            }}
          >
            <AnimatePresence mode="wait">
              {selectedCamera || showPreview ? (
                <>
                  <motion.div
                    key={showPreview ? 'camera-preview' : 'camera-expanded'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed -translate-x-1/2 w-[340px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default ${showPreview ? 'pointer-events-none' : ''}`}
                    style={activityFlyoutStyles['camera-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="bg-surface-low p-ha-3 flex items-center justify-between border-b border-surface-low">
                      <div className="flex items-center gap-2 pl-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest pl-1">Live Feed</span>
                      </div>
                      {!showPreview && (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(activeCameras.length > 1 ? 'list-camera' : null); }} className="p-ha-1 hover:bg-surface-mid rounded-full transition-colors">
                          <Icon path={activeCameras.length > 1 ? mdiChevronUp : mdiClose} size={18} className="text-text-secondary" />
                        </button>
                      )}
                    </div>
                    <div className="w-full aspect-video bg-black relative">
                      <img src={getEntityPictureUrl(camera.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[10px] text-white font-mono border border-white/10">
                        LIVE • 2026-02-12 23:38:00
                      </div>
                    </div>
                    <div className="p-ha-4">
                      <div className="flex items-center gap-ha-3 mb-ha-4">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                          <Icon path={mdiAccount} size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{camera.name}</h4>
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{camera.event}</p>
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

                  {selectedCamera && (
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

                  {showPreview && (
                    <div
                      className="h-12 rounded-ha-pill bg-red-500/10 border border-red-500/20"
                      style={{ width: activityWidgetWidths['camera-widget'] }}
                    />
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="camera-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed -translate-x-1/2 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default"
                    style={activityFlyoutStyles['camera-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest pl-1">Cameras ({activeCameras.length})</span>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                          <Icon path={mdiClose} size={18} className="text-text-secondary" />
                        </button>
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

                  {isExpanded && (
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
                  key="camera-collapsed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => openActivityWidget(activeCameras.length > 1 ? 'list-camera' : camera.entity_id, 'camera-widget')}
                  className="flex items-center gap-ha-3 bg-red-500/10 border border-red-500/20 rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer hover:bg-red-500/20"
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
                    <img 
                      src={getEntityPictureUrl(camera.entityPicture, '/camera_doorbell.png')} 
                      alt="" 
                      className="w-full h-full object-cover animate-pulse"
                    />
                    <div className="absolute inset-0 bg-red-500/10" />
                    {activeCameras.length > 1 && (
                      <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[10px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                        {activeCameras.length}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 max-w-[140px]">
                    <span className="text-sm font-bold text-red-500 truncate flex items-center gap-1">
                      <Icon path={mdiDoorbellVideo} size={14} />
                      {camera.name}
                    </span>
                    <span className="text-xs text-text-secondary truncate">{camera.event}</span>
                  </div>
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
          return (
          <motion.div
            key="printer-widget"
            layout="position"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={activityWidgetTransition}
            ref={(el) => { widgetContainerRefs.current['printer-widget'] = el; }}
            className="relative"
            onMouseEnter={() => {
              if (!expandedWidgetId) {
                updateActivityFlyoutPosition('printer-widget');
                setHoveredActivityWidget('printer-widget');
              }
            }}
            onMouseLeave={() => {
              setHoveredActivityWidget((current) => (current === 'printer-widget' ? null : current));
            }}
          >
            <AnimatePresence mode="wait">
              {selectedPrinter || showPreview ? (
                <>
                  <motion.div
                    key={showPreview ? 'printer-preview' : 'printer-expanded'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed -translate-x-1/2 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default ${showPreview ? 'pointer-events-none' : ''}`}
                    style={activityFlyoutStyles['printer-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4 flex flex-col items-center">
                      <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                        <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">3D Printer</span>
                        {!showPreview && (
                          <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(activePrinters.length > 1 ? 'list-printer' : null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                            <Icon path={activePrinters.length > 1 ? mdiChevronUp : mdiClose} size={18} className="text-text-secondary" />
                          </button>
                        )}
                      </div>

                      <div className="w-full aspect-square rounded-ha-2xl overflow-hidden mb-ha-4 shadow-md bg-surface-mid relative border border-surface-low">
                        <img src={getEntityPictureUrl(printer.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded-ha-lg px-2 py-1 flex items-center gap-2 border border-white/10">
                          <Icon path={mdiLayers} size={14} className="text-ha-blue" />
                          <span className="text-[10px] font-bold text-white font-mono">Layer 142/208</span>
                        </div>
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

                      <div className="grid grid-cols-2 gap-ha-3 w-full mb-ha-4">
                        <div className="bg-surface-low rounded-ha-xl p-ha-3 flex flex-col items-center gap-1 border border-surface-mid/30">
                          <Icon path={mdiThermometer} size={18} className="text-red-500" />
                          <span className="text-[9px] font-bold text-text-disabled uppercase tracking-tight">NOZZLE</span>
                          <span className="text-sm font-bold text-text-primary font-mono">215°C</span>
                        </div>
                        <div className="bg-surface-low rounded-ha-xl p-ha-3 flex flex-col items-center gap-1 border border-surface-mid/30">
                          <Icon path={mdiThermometer} size={18} className="text-ha-blue" />
                          <span className="text-[9px] font-bold text-text-disabled uppercase tracking-tight">BED</span>
                          <span className="text-sm font-bold text-text-primary font-mono">60°C</span>
                        </div>
                      </div>

                      <div className="w-full p-ha-3 bg-surface-low rounded-ha-xl border border-surface-mid/30 flex items-center justify-between">
                        <div className="flex flex-col pl-1">
                          <span className="text-[9px] font-bold text-text-disabled uppercase tracking-tight">TIME LEFT</span>
                          <span className="text-sm font-mono font-bold text-text-primary">{printer.remainingTime}</span>
                        </div>
                        <button className="w-10 h-10 bg-red-500/10 text-red-500 rounded-ha-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center">
                          <Icon path={mdiStop} size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {selectedPrinter && (
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

                  {showPreview && (
                    <div
                      className="h-12 rounded-ha-pill bg-surface-low border border-surface-mid"
                      style={{ width: activityWidgetWidths['printer-widget'] }}
                    />
                  )}
                </>
              ) : isListView ? (
                <>
                  <motion.div
                    key="printer-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed -translate-x-1/2 w-[280px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden z-50 flex flex-col cursor-default"
                    style={activityFlyoutStyles['printer-widget']}
                    transition={activityWindowTransition}
                  >
                    <div className="p-ha-4">
                      <div className="w-full flex justify-between items-center mb-ha-3 pl-1">
                        <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">3D Printers ({activePrinters.length})</span>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-low rounded-full">
                          <Icon path={mdiClose} size={18} className="text-text-secondary" />
                        </button>
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
                              <span className="text-xs text-text-secondary truncate font-mono">{p.progress}% • {p.remainingTime}</span>
                            </div>
                            <Icon path={mdiChevronRight} size={18} className="text-text-disabled shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {isExpanded && (
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
                  key="printer-collapsed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={activityMiniTransition}
                  onClick={() => openActivityWidget(activePrinters.length > 1 ? 'list-printer' : printer.entity_id, 'printer-widget')}
                  className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 transition-all cursor-pointer hover:bg-surface-mid"
                >
                  <div className="relative">
                  {activePrinters.length > 1 && (
                    <div className="absolute -top-1 -right-1 bg-surface-default text-text-primary text-[10px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border border-surface-lower shadow-sm z-10">
                      {activePrinters.length}
                    </div>
                  )}
                  <CircularProgress
                    progress={printer.progress / 100}
                    size={32}
                    strokeWidth={2.5}
                    className="text-ha-blue shrink-0"
                    trackClassName="text-fill-primary-quiet"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                      <img src={getEntityPictureUrl(printer.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
                    </div>
                  </CircularProgress>
                  </div>
                  <div className="flex flex-col min-w-0 max-w-[140px]">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-text-primary truncate font-mono">
                        {printer.progress}%
                      </span>
                      <span className="text-[9px] text-text-disabled uppercase font-bold tracking-tighter">
                        Printing
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary truncate">{printer.fileName}</span>
                  </div>
                  <div className="hidden xl:flex flex-col items-end ml-1 pl-2 border-l border-surface-mid">
                    <span className="text-[9px] text-text-disabled font-bold leading-none mb-0.5 uppercase">Left</span>
                    <span className="text-xs font-mono text-text-secondary">{printer.remainingTime}</span>
                  </div>
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
        
        {/* Status Details Pop-up */}
        {statusExpanded && (
          <div 
            className="absolute right-0 bottom-full mb-ha-2 w-[340px] bg-surface-default rounded-ha-3xl shadow-xl border border-surface-low overflow-hidden transition-all duration-300 z-50 flex flex-col origin-bottom-right animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-ha-4 border-b border-surface-low bg-surface-low/50 backdrop-blur-md sticky top-0 z-10">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <Icon path={mdiCheckCircle} size={20} className="text-ha-blue" />
                  Home status
                </h3>
                <button 
                    onClick={() => setStatusExpanded(false)}
                    className="p-1 hover:bg-surface-mid rounded-full text-text-secondary transition-colors"
                >
                    <Icon path={mdiClose} size={20} />
                </button>
            </div>
            
            <div className="overflow-y-auto p-ha-3 space-y-ha-3 custom-scrollbar">
                
                {/* Connection Section */}
                <div className="bg-surface-low rounded-2xl p-ha-3">
                    <div className="flex items-center gap-ha-3 mb-ha-3">
                        <div className={`p-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          <Icon path={connectionStatus === 'connected' ? mdiCheckCircle : mdiAlertCircle} size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-text-primary">Home Assistant</h4>
                          <p className="text-xs text-text-secondary font-medium">
                              {connectionStatus === 'connecting' ? 'Connecting...' :
                               connectionStatus === 'connected' ? 'Connected securely' :
                               connectionStatus === 'error' ? 'Connection Error' : 'Unknown Status'}
                          </p>
                        </div>
                    </div>
                      
                    {/* Connection Details */}
                    <div className="space-y-2 mt-2 pt-2 border-t border-surface-mid/50">
                        {/* Remote Access */}
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <Icon path={isRemoteConnected ? mdiCloudCheck : mdiCloudOff} size={16} className={isRemoteConnected ? "text-green-500" : "text-text-disabled"} />
                            <span className="text-sm text-text-secondary">Remote Access</span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isRemoteConnected ? 'bg-green-500/10 text-green-500' : 'bg-surface-mid text-text-disabled'}`}>
                             {isRemoteConnected ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                    </div>
                </div>

                {/* Notifications Section - Always shown */}
                <div className="bg-surface-low rounded-2xl p-ha-3">
                  <div className="flex items-center justify-between mb-ha-2 px-1">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notifications</h4>
                    {activeNotifications.length > 0 && (
                      <span className="text-xs font-bold text-white bg-yellow-500 px-1.5 py-0.5 rounded-md">{activeNotifications.length}</span>
                    )}
                  </div>
                  {activeNotifications.length > 0 ? (
                    <div className="space-y-2">
                      {activeNotifications.map(notif => (
                        <div key={notif.id} className="flex items-start gap-ha-3 p-ha-2.5 bg-surface-mid/30 hover:bg-surface-mid rounded-xl transition-colors">
                          <Icon path={mdiBell} size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary leading-tight">{notif.title}</p>
                            {notif.message && <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-snug">{notif.message}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-disabled px-1 py-1 flex items-center gap-2">
                      <Icon path={mdiCheckCircle} size={14} className="opacity-50" />
                      No notifications
                    </p>
                  )}
                </div>

                {/* Active Updates Section */}
                {(activeUpdates.length > 0) && (
                    <div className="bg-surface-low rounded-2xl p-ha-3">
                        <div className="flex items-center justify-between mb-ha-2 px-1">
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Updates Available</h4>
                          <span className="text-xs font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-md">{activeUpdates.length}</span>
                        </div>
                        <div className="space-y-2">
                            {activeUpdates.map(update => (
                                <div key={update.id} className="flex items-center gap-ha-3 p-ha-2 hover:bg-surface-mid rounded-xl transition-colors cursor-pointer group">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-110 transition-transform">
                                        {update.picture ? <img src={getEntityPictureUrl(update.picture)} alt={update.name} className="w-full h-full rounded-full object-cover"/> : <Icon path={mdiUpdate} size={18} />}
                                    </div>
                                    <span className="text-sm font-medium text-text-primary truncate">{update.name}</span>
                                    <Icon path={mdiChevronRight} size={16} className="text-text-disabled ml-auto" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Offline Devices Section - Always shown */}
                <div className="bg-surface-low rounded-2xl p-ha-3">
                  <div className="flex items-center justify-between mb-ha-2 px-1">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Offline Devices</h4>
                    {offlineDevices.length > 0 && (
                      <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md">{offlineDevices.length}</span>
                    )}
                  </div>
                  {offlineDevices.length > 0 ? (
                    <div className="space-y-1">
                      {offlineDevices.map(device => (
                        <div key={device.id} className="flex items-center gap-ha-2 p-ha-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-mid/50 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                          <span className="text-sm truncate font-medium">{device.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-disabled px-1 py-1 flex items-center gap-2">
                       <Icon path={mdiCheckCircle} size={14} className="opacity-50" />
                       All devices online
                    </p>
                  )}
                </div>

                {/* Empty State / All Good */}
                {activeUpdates.length === 0 && activeNotifications.length === 0 && offlineDevices.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center opacity-80">
                        <p className="text-sm font-medium text-text-primary">All systems nominal</p>
                        <p className="text-xs text-text-secondary mt-1">No issues detected in your home environment.</p>
                    </div>
                )}
            </div>
            
            {/* Footer with version or info */}
            <div className="p-3 border-t border-surface-low bg-surface-low/30 text-center">
               <p className="text-[10px] text-text-disabled">Home Assistant • Connected</p>
            </div>
          </div>
        )}

        <button 
          className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-4 h-12 hover:bg-surface-mid transition-all active:scale-95 cursor-pointer outline-none ring-offset-2 focus:ring-2 ring-ha-blue/50"
          onClick={() => setStatusExpanded(!statusExpanded)}
        >
        {/* Updates indicator */}
        <Tooltip content={pendingUpdates > 0 ? `Updates: ${pendingUpdates} update${pendingUpdates > 1 ? 's' : ''} available` : 'Updates: System is up to date'}>
          <div className="relative">
            <Icon
              path={mdiUpdate}
              size={20}
              className="text-text-secondary"
            />
            {pendingUpdates > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-ha-blue rounded-full w-2 h-2" />
            )}
          </div>
        </Tooltip>

        {/* Remote access indicator */}
        <Tooltip content={isRemoteConnected ? 'Remote Access: Available via internet' : 'Remote Access: Not exposed to internet'}>
          <div className="relative">
            <Icon
              path={mdiWeb}
              size={20}
              className="text-text-secondary"
            />
            {isRemoteConnected && (
              <span className="absolute -top-0.5 -right-0.5 bg-green-500 rounded-full w-2 h-2" />
            )}
            {!isRemoteConnected && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2" />
            )}
          </div>
        </Tooltip>

        {/* Notifications indicator */}
        <Tooltip content={notificationCount > 0 ? `Notifications: ${notificationCount} active` : 'Notifications: None'}>
          <div className="relative">
            <Icon
              path={mdiBell}
              size={20}
              className="text-text-secondary"
            />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-yellow-500 rounded-full w-2 h-2" />
            )}
          </div>
        </Tooltip>

        {/* Offline devices indicator */}
        <Tooltip content={offlineCount > 0 ? `Offline: ${offlineCount} device${offlineCount > 1 ? 's' : ''} unavailable` : 'Devices: All online'}>
          <div className="relative">
            <Icon
              path={mdiDevices}
              size={20}
              className="text-text-secondary"
            />
            {offlineCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2" />
            )}
          </div>
        </Tooltip>

          {/* Time with stacked AM/PM */}
          <div className="flex items-center gap-ha-1">
            <span className="text-base font-semibold text-text-primary tabular-nums" style={{ fontFamily: 'system-ui' }}>
              {currentTime.hours}
              <span className={colonVisible ? 'opacity-100' : 'opacity-0'}>:</span>
              {currentTime.minutes}
            </span>
            <div className="flex items-center gap-ha-1">
              {!use24HourClock && (
                <div className="flex flex-col text-[9px] font-medium leading-tight">
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
  );
}
