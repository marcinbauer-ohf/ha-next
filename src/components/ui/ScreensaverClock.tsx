'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { RollingDigit } from './RollingDigit';
import { useHomeAssistant, useHomeAssistantSelector, useFeatureFlags, useHomeEventReactor, useHomePingPulse, useHomeCenterPrefs, useWeatherParams, useHomeSummary } from '@/hooks';
import { useNotificationCenter } from '@/contexts';
import { formatBackupAge, type HomeCenterSectionId } from '@/lib/homeCenter';
import {
  mdiDevices,
  mdiBell,
  mdiDoorbellVideo,
  mdiPause,
  mdiPlay,
  mdiTimerOutline,
  mdiUpdate,
  mdiWeb,
  mdiWrench,
  mdiBatteryAlertVariantOutline,
  mdiBackupRestore,
  mdiRobotVacuum,
  mdiChevronRight,
  mdiPaletteOutline,
} from '@mdi/js';
import { TalkWidgetGlow } from './TalkWidgetGlow';
import { ScreensaverVoiceMode } from './ScreensaverVoiceMode';
import { CircularProgress } from './CircularProgress';
import { resolveEntityPictureUrl } from '@/lib/utils';
import { SummaryCard, TRANSLUCENT_CHIP_FILL } from '../cards/SummaryCard';
import { PeopleBadge, useLiveSummaryItems } from '../sections/SummariesPanel';
import { RingShaderBackground, useRingOrigin } from './RingShaderBackground';
import { ScreensaverPulseLog } from './ScreensaverPulseLog';
import { EnergyGlance } from '../glances';
import {
  areActivityDataEqual,
  areScreensaverDataEqual,
  selectActivityData,
  selectScreensaverData,
} from '@/lib/homeassistant/selectors';

interface ScreensaverClockProps {
  visible: boolean;
  onDismiss: () => void;
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(parts[0]) || 0;
}

// Corner count badge shared by activity pills (matches the dashboard StatusBar pills).
function ActivityCountBadge({ count, variant = 'neutral' }: { count: number; variant?: 'neutral' | 'green' }) {
  if (count <= 1) return null;
  const cls =
    variant === 'green'
      ? 'bg-green-600 text-white border-surface-default'
      : 'bg-surface-default text-text-primary border-surface-lower';
  return (
    <div className={`absolute -top-1 -right-1 ${cls} text-[13px] font-bold h-4 min-w-[16px] px-0.5 leading-none rounded-full flex items-center justify-center border shadow-sm z-10`}>
      {count}
    </div>
  );
}

// Activity pills for the screensaver — identical styling to the main dashboard
// StatusBar collapsed pills, but non-interactive (display only).
function ScreensaverActivityPills({
  activityData,
  haUrl,
}: {
  activityData: ReturnType<typeof selectActivityData>;
  haUrl: string | undefined;
}) {
  const picUrl = (picture?: string, fallback?: string) =>
    resolveEntityPictureUrl(haUrl, picture) ?? fallback;

  const pills: React.ReactNode[] = [];
  // Phone portrait shows at most this many pills; the rest collapse into a "+N more" chip.
  const MOBILE_PILL_LIMIT = 3;
  const mobileHide = () => (pills.length >= MOBILE_PILL_LIMIT ? 'max-md:portrait:hidden' : '');

  if (activityData.activeReleaseNotes.length > 0) {
    const note = activityData.activeReleaseNotes[0];
    pills.push(
      <div
        key="release-notes"
        className={`relative flex items-center gap-ha-3 ${TRANSLUCENT_CHIP_FILL} rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
            <Icon path={mdiUpdate} size={16} className="text-green-600" />
          </div>
          <ActivityCountBadge count={activityData.activeReleaseNotes.length} variant="green" />
        </div>
        <div className="flex flex-col min-w-0 max-w-[180px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <span className="text-sm font-medium text-white truncate">What&apos;s New</span>
          <span className="text-xs text-white/70 truncate">{note.version}</span>
        </div>
      </div>
    );
  }

  if (activityData.activePlayers.length > 0) {
    const player = activityData.activePlayers[0];
    const picture = picUrl(player.entityPicture);
    pills.push(
      <div
        key="media"
        className={`relative flex items-center gap-ha-3 ${TRANSLUCENT_CHIP_FILL} rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative">
          {picture ? (
            <img src={picture} alt="" className="w-8 h-8 rounded-full object-cover border border-surface-low" />
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
          <ActivityCountBadge count={activityData.activePlayers.length} />
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <span className="text-sm font-medium text-white truncate">
            {player.mediaTitle || player.name}
          </span>
          <span className={`text-xs truncate ${player.state === 'paused' ? 'text-yellow-300' : 'text-white/70'}`}>
            {player.mediaArtist || (player.state === 'playing' ? 'Playing' : 'Paused')}
          </span>
        </div>
      </div>
    );
  }

  if (activityData.activeTimers.length > 0) {
    const timer = activityData.activeTimers[0];
    const remainingSec = parseTimeToSeconds(timer.remaining);
    const progress = timer.durationSec > 0 ? remainingSec / timer.durationSec : 0;
    const isActive = timer.state === 'active';
    pills.push(
      <div
        key="timer"
        className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 ${TRANSLUCENT_CHIP_FILL} ${mobileHide()}`}
      >
        <div className="relative">
          <ActivityCountBadge count={activityData.activeTimers.length} />
          <CircularProgress
            progress={progress}
            size={32}
            strokeWidth={2.5}
            className={isActive ? 'text-ha-blue' : 'text-yellow-600'}
            trackClassName={isActive ? 'text-fill-primary-quiet' : 'text-yellow-200'}
          >
            <Icon path={isActive ? mdiTimerOutline : mdiPause} size={14} className={isActive ? 'text-ha-blue' : 'text-yellow-600'} />
          </CircularProgress>
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <span className="text-sm font-medium text-white truncate">{timer.remaining}</span>
          <span className="text-xs text-white/70 truncate">{timer.name}</span>
        </div>
      </div>
    );
  }

  if (activityData.activeCameras.length > 0) {
    const camera = activityData.activeCameras[0];
    pills.push(
      <div
        key="camera"
        className={`relative flex items-center gap-ha-3 ${TRANSLUCENT_CHIP_FILL} rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
          <img src={picUrl(camera.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover animate-pulse" />
          <div className="absolute inset-0 bg-red-500/10" />
          <ActivityCountBadge count={activityData.activeCameras.length} />
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <span className="text-sm font-medium text-white truncate flex items-center gap-1">
            <Icon path={mdiDoorbellVideo} size={14} className="text-red-400 shrink-0" />
            {camera.name}
          </span>
          <span className="text-xs text-white/70 truncate">{camera.event}</span>
        </div>
      </div>
    );
  }

  if (activityData.activePrinters.length > 0) {
    const printer = activityData.activePrinters[0];
    pills.push(
      <div
        key="printer"
        className={`relative flex items-center gap-ha-3 ${TRANSLUCENT_CHIP_FILL} rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative">
          <ActivityCountBadge count={activityData.activePrinters.length} />
          <CircularProgress
            progress={printer.progress / 100}
            size={32}
            strokeWidth={2.5}
            className="text-ha-blue shrink-0"
            trackClassName="text-fill-primary-quiet"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
              <img src={picUrl(printer.entityPicture, '/printer_3d.png')} alt="" className="w-full h-full object-cover" />
            </div>
          </CircularProgress>
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-white truncate font-mono">{printer.progress}%</span>
            <span className="text-[13px] text-white/50 uppercase font-bold tracking-tighter">Printing</span>
          </div>
          <span className="text-xs text-white/70 truncate">{printer.fileName}</span>
        </div>
      </div>
    );
  }

  if (activityData.activeVacuums.length > 0) {
    const vacuum = activityData.activeVacuums[0];
    const status = vacuum.state === 'returning' ? 'Returning' : 'Cleaning';
    pills.push(
      <div
        key="vacuum"
        className={`relative flex items-center gap-ha-3 ${TRANSLUCENT_CHIP_FILL} rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative">
          <ActivityCountBadge count={activityData.activeVacuums.length} />
          <CircularProgress
            progress={vacuum.progress / 100}
            size={32}
            strokeWidth={2.5}
            className="text-ha-blue shrink-0"
            trackClassName="text-fill-primary-quiet"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
              <img src={picUrl(vacuum.entityPicture, '/devices/robot_vacuum.png')} alt="" className="w-full h-full object-cover" />
            </div>
          </CircularProgress>
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-white truncate font-mono">{vacuum.progress}%</span>
            <span className="text-[13px] text-white/50 uppercase font-bold tracking-tighter flex items-center gap-0.5">
              <Icon path={mdiRobotVacuum} size={13} className="text-ha-blue shrink-0" />
              {status}
            </span>
          </div>
          <span className="text-xs text-white/70 truncate">{vacuum.area || vacuum.name}</span>
        </div>
      </div>
    );
  }

  if (pills.length > MOBILE_PILL_LIMIT) {
    pills.push(
      <div
        key="more"
        className="hidden max-md:portrait:flex items-center justify-center self-center h-8 px-ha-4 rounded-ha-pill bg-black/40 border border-white/15 text-[13px] font-medium text-white/70"
      >
        +{pills.length - MOBILE_PILL_LIMIT} more
      </div>
    );
  }

  return <>{pills}</>;
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

export function ScreensaverClock({ visible, onDismiss }: ScreensaverClockProps) {
  const liveSummaryItems = useLiveSummaryItems();
  const { haUrl } = useHomeAssistant();
  const { wavyBackgroundEnabled, reactiveBackgroundEnabled, reactiveTriggerConfig, reactiveIntensity, reactiveTriggerLabelsEnabled, pulseMode, setPulseMode } = useFeatureFlags();
  const weatherParams = useWeatherParams();
  const ringOrigin = useRingOrigin();
  // Only watch for events while the screensaver is actually on screen.
  useHomeEventReactor(reactiveBackgroundEnabled && visible, reactiveTriggerConfig);
  // Classic mode only: a latency-scaled ping ripple to the instance (width = RTT).
  useHomePingPulse(reactiveBackgroundEnabled && visible && pulseMode === 'classic');
  const [time, setTime] = useState({ hours: '', minutes: '', period: '', isAM: true });
  const use24HourClock = useMemo(() => systemPrefers24HourClock(), []);
  const [date, setDate] = useState('');
  // Initialize based on visible prop to avoid flash on initial load
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(visible);
  const [dragDistance, setDragDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  // Voice mode — the screensaver's "face": clock UI fades, the dot-wave takes
  // over, and the Assist conversation runs as chat bubbles.
  const [voiceMode, setVoiceMode] = useState(false);
  // "While you were away" — the talk widget shows the single most notable
  // thing since the screensaver came up (urgent-first, no ticker); tapping it
  // opens the conversation to dig deeper. Window resets when the saver appears.
  // Seeded rAF-inside-effect (not in render) — Date.now() at render and
  // ref-reads-during-render both trip compiler rules. Until seeded, the
  // sentinel keeps the "since" window empty.
  const [summarySince, setSummarySince] = useState(Number.MAX_SAFE_INTEGER);
  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => setSummarySince(Date.now()));
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  const summaryPhrases = useHomeSummary(summarySince);
  // The widget reads like an AI-written note left on the door: one longer
  // sentence composed from the top phrases (urgent-first, no ticker). Each
  // time the saver comes up it shows a brief "catching up" loading beat —
  // dummy pacing for now; a real summarizer can slot in behind the same state.
  const [summaryLoading, setSummaryLoading] = useState(true);
  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => setSummaryLoading(true));
    const timer = setTimeout(() => setSummaryLoading(false), 1800);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [visible]);
  const summaryText = useMemo(() => {
    if (summaryPhrases.length === 0) {
      return 'All quiet while you were away — nothing needed your attention, and everything is just as you left it.';
    }
    const parts = summaryPhrases.slice(0, 3);
    const joined =
      parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
    const rest = summaryPhrases.length - parts.length;
    return `While you were away: ${joined}${rest > 0 ? `, plus ${rest} more thing${rest > 1 ? 's' : ''}` : ''}.`;
  }, [summaryPhrases]);
  const router = useRouter();
  const dragStartY = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const screensaverData = useHomeAssistantSelector(selectScreensaverData, areScreensaverDataEqual);
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { visibleSections } = useHomeCenterPrefs();
  const { notifications: centerNotifications } = useNotificationCenter();
  // Status-pill indicators derive from the full activity data so they can cover
  // every configurable Home Center section (repairs, battery, backups, …).
  const notificationCount = activityData.activeNotifications.length + centerNotifications.length;
  const pendingUpdates = activityData.activeUpdates.length;
  const offlineCount = activityData.offlineDevices.length;
  const repairCount = activityData.repairs.length;
  const hasCriticalRepair = activityData.repairs.some((r) => r.severity === 'critical');
  const lowBatteryCount = activityData.lowBatteryDevices.length;
  const backupAge = formatBackupAge(activityData.lastBackup?.lastBackup ?? null);
  const isRemoteConnected = activityData.isRemoteConnected;
  const hasActivities =
    activityData.activeReleaseNotes.length > 0 ||
    activityData.activePlayers.length > 0 ||
    activityData.activeTimers.length > 0 ||
    activityData.activeCameras.length > 0 ||
    activityData.activePrinters.length > 0 ||
    activityData.activeVacuums.length > 0;
  const userAvatar = useMemo(() => {
    if (!screensaverData.user) {
      return { picture: undefined, name: 'User', initials: 'U' };
    }

    return {
      picture: screensaverData.user.picture ? `${haUrl}${screensaverData.user.picture}` : undefined,
      name: screensaverData.user.name || 'User',
      initials: screensaverData.user.initials,
    };
  }, [screensaverData.user, haUrl]);
  
  // Handle mount/unmount with animation
  useEffect(() => {
    let firstFrameId: number | null = null;
    let secondFrameId: number | null = null;

    if (visible) {
      firstFrameId = requestAnimationFrame(() => {
        setShouldRender(true);
        secondFrameId = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      firstFrameId = requestAnimationFrame(() => {
        setIsVisible(false);
      });
    }

    return () => {
      if (firstFrameId !== null) {
        cancelAnimationFrame(firstFrameId);
      }
      if (secondFrameId !== null) {
        cancelAnimationFrame(secondFrameId);
      }
    };
  }, [visible]);

  const handleTransitionEnd = () => {
    if (isDismissing) {
      // Swipe-away animation finished — now actually dismiss
      setIsDismissing(false);
      setDragDistance(0);
      dragDistanceRef.current = 0;
      onDismiss();
      return;
    }
    if (!visible && !isVisible) {
      setShouldRender(false);
      setVoiceMode(false);
    }
  };

  // Mobile drag to dismiss - works anywhere on screen. Suspended in voice
  // mode: a conversation in progress must not fly off on a stray swipe.
  useEffect(() => {
    if (!shouldRender || voiceMode) return;

    const container = containerRef.current;
    if (!container) return;

    const isMobileViewport = () => window.innerWidth < 1024;

    const startDrag = (startY: number) => {
      dragStartY.current = startY;
      setIsDragging(true);
    };

    const updateDrag = (currentY: number, preventDefault?: () => void) => {
      if (dragStartY.current === null) return;

      const diff = dragStartY.current - currentY; // Positive when dragging up

      if (diff > 0) {
        preventDefault?.();
        dragDistanceRef.current = diff;
        setDragDistance(diff);
      }
    };

    const endDrag = () => {
      const minSwipe = 30; // minimum drag to count as intentional swipe
      if (dragDistanceRef.current >= minSwipe) {
        // Animate off-screen to the top, then dismiss
        setIsDragging(false);
        setIsDismissing(true);
      } else {
        // Snap back for tiny accidental touches
        dragDistanceRef.current = 0;
        setDragDistance(0);
        setIsDragging(false);
      }

      dragStartY.current = null;
      activePointerId.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobileViewport()) return;

      const touch = e.touches[0];
      if (!touch) return;
      startDrag(touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      updateDrag(touch.clientY, () => e.preventDefault());
    };

    const handleTouchEnd = () => {
      endDrag();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isMobileViewport() || e.pointerType === 'touch') return;

      activePointerId.current = e.pointerId;
      startDrag(e.clientY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      updateDrag(e.clientY);
    };

    const handlePointerUpOrCancel = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      endDrag();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    container.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerup', handlePointerUpOrCancel, { passive: true });
    document.addEventListener('pointercancel', handlePointerUpOrCancel, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUpOrCancel);
      document.removeEventListener('pointercancel', handlePointerUpOrCancel);
    };
  }, [onDismiss, shouldRender, voiceMode]);

  useEffect(() => {
    // Only tick while the screensaver is actually mounted; the colon blink is
    // pure CSS, and the setters bail on unchanged values, so this re-renders
    // the tree once per minute rather than once per second.
    if (!shouldRender) return;

    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const isAM = hours < 12;
      const displayHours = use24HourClock ? hours.toString().padStart(2, '0') : (hours % 12 || 12).toString();
      const minutes = now.getMinutes().toString().padStart(2, '0');

      setTime((prev) =>
        prev.hours === displayHours && prev.minutes === minutes && prev.isAM === isAM
          ? prev
          : { hours: displayHours, minutes, period: isAM ? 'AM' : 'PM', isAM }
      );

      setDate(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [use24HourClock, shouldRender]);

  // Status-pill indicator per configurable Home Center section.
  const renderStatusIndicator = (id: HomeCenterSectionId) => {
    let icon = mdiBell;
    let dot: string | null = null;
    let pulse = false;
    switch (id) {
      case 'notifications':
        icon = mdiBell;
        dot = notificationCount > 0 ? 'bg-yellow-500' : null;
        break;
      case 'updates':
        icon = mdiUpdate;
        dot = pendingUpdates > 0 ? 'bg-ha-blue' : null;
        break;
      case 'repairs':
        icon = mdiWrench;
        dot = repairCount > 0 ? (hasCriticalRepair ? 'bg-red-500' : 'bg-orange-500') : null;
        pulse = hasCriticalRepair;
        break;
      case 'issues':
        icon = mdiDevices;
        dot = offlineCount > 0 ? 'bg-red-500' : null;
        pulse = offlineCount > 0;
        break;
      case 'battery':
        icon = mdiBatteryAlertVariantOutline;
        dot = lowBatteryCount > 0 ? 'bg-amber-500' : null;
        break;
      case 'backups':
        icon = mdiBackupRestore;
        dot = backupAge.stale ? 'bg-orange-500' : null;
        break;
      case 'connectivity':
        icon = mdiWeb;
        dot = isRemoteConnected ? 'bg-green-500' : 'bg-red-500';
        break;
    }
    return (
      <div key={id} className="relative">
        {/* Width classes shrink the icon below lg to match the compact pill */}
        <Icon path={icon} size={20} className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-white/85" />
        {dot && <span className={`absolute -top-0.5 -right-0.5 ${dot} rounded-full w-2 h-2 ${pulse ? 'animate-pulse' : ''}`} />}
      </div>
    );
  };

  // TEMP: cycle the wallpaper style on click (replaces the debug picker). The
  // hint text below shows the current style; tapping it steps to the next one.
  const PULSE_MODE_LABELS: Record<typeof pulseMode, string> = {
    classic: 'Classic',
    heartbeat: 'Heartbeat',
    breathing: 'Breathing',
    aurora: 'Aurora',
    bokeh: 'Bokeh',
    dawn: 'Dawn',
    breathOrb: 'Breath orb',
    weather: 'Weather',
    warp: 'Warp',
    northernLights: 'Northern lights',
    meshGradient: 'Mesh gradient',
    grainGradient: 'Grain gradient',
    paperWarp: 'Color warp',
    simplexNoise: 'Simplex flow',
    metaballs: 'Metaballs',
  };
  const cyclePulseMode = () => {
    const order = Object.keys(PULSE_MODE_LABELS) as (typeof pulseMode)[];
    const next = order[(order.indexOf(pulseMode) + 1) % order.length];
    setPulseMode(next);
  };

  if (!shouldRender) return null;

  // Ambient ring modes draw rings over transparency (no opaque scene). The
  // screensaver is a white-text-on-dark surface, so these need a forced dark
  // ground + light rings; immersive modes paint their own dark scene.
  const isAmbientMode = ['classic', 'heartbeat', 'breathing', 'breathOrb'].includes(pulseMode);

  // Calculate transform based on drag
  const dragProgress = Math.min(dragDistance / 150, 1); // 0 to 1
  const translateY = isDismissing ? -window.innerHeight : isDragging ? -dragDistance : 0;

  return (
    <div
      ref={containerRef}
      data-component="Screensaver"
      className={`fixed inset-0 z-[100] bg-surface-default flex flex-col items-center justify-center max-lg:pb-12 transition-all ease-out ${
        isDragging ? 'duration-0' : isDismissing ? 'duration-300' : 'duration-500'
      } ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
      } cursor-grab select-none lg:cursor-pointer`}
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: isDismissing ? 0 : isDragging ? 1 - dragProgress * 0.3 : undefined,
      }}
      onClick={() => {
        if (!voiceMode && window.innerWidth >= 1024) {
          onDismiss();
        }
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Background layers sit below every content element. They're absolutely
          positioned, so without a negative z they'd paint *over* the in-flow
          content (chips, date, activity rows) — which stayed invisible only
          while the shader was transparent. The opaque immersive fill made that
          covering real, so keep the whole backdrop on its own -z layer above
          the root surface. */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        {/* Ambient ring modes (classic/heartbeat/breathing/breathOrb) draw rings
            over transparency rather than an opaque scene, so on their own they
            fell back to the theme surface — light in light mode, leaving the
            white clock/text with no contrast. Give them a fixed dark ground and
            force the rings to their light (dark-theme) colour so they read on
            it. Immersive modes paint their own dark scene, so they keep
            following the theme. */}
        {isAmbientMode && <div className="absolute inset-0 bg-[#0b0d12]" />}
        <RingShaderBackground
          resolvedMode={isAmbientMode ? 'dark' : undefined}
          wavy={wavyBackgroundEnabled}
          reactive={reactiveBackgroundEnabled}
          intensity={reactiveIntensity}
          center={ringOrigin.center}
          reach={ringOrigin.reach}
          mode={pulseMode}
          weather={weatherParams}
          opaque
        />
        {/* Legibility backdrop — a flat 15% black wash over the whole shader so
            every mode (including the ones that bloom to white) is knocked down
            uniformly and the white text/chips read on top. Even coverage, no
            vignette, so no corner keeps a bright/white tint. */}
        <div className="absolute inset-0 bg-black/15" />
      </div>

      {/* Everything clock-ish lives in this wrapper so voice mode can fade the
          whole surface out in one move while the background keeps running. */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center max-lg:pb-12 transition-opacity duration-500 ${
          voiceMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-hidden={voiceMode}
      >

      {/* Names the entity behind each reactive ripple, bottom-center. Opt-in
          (Settings → screensaver) and only while the reactive background is on. */}
      {reactiveBackgroundEnabled && reactiveTriggerLabelsEnabled && <ScreensaverPulseLog />}

      {/* Style toggle — a near-invisible ghost, top-right. No fill, no border;
          it only reveals itself on hover. The style name flashes for a moment
          after each change, then fades away. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          cyclePulseMode();
        }}
        aria-label={`Wallpaper style: ${PULSE_MODE_LABELS[pulseMode]} — tap to change`}
        title={`Style: ${PULSE_MODE_LABELS[pulseMode]}`}
        className="absolute top-5 right-5 lg:top-6 lg:right-6 w-9 h-9 flex items-center justify-center text-white/20 hover:text-white/70 transition-colors active:scale-95"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <Icon path={mdiPaletteOutline} size={15} />
      </button>
      <span
        key={pulseMode}
        className="ha-style-flash absolute top-14 right-5 lg:top-16 lg:right-6 text-xs text-white/45 pointer-events-none"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        {PULSE_MODE_LABELS[pulseMode]}
      </span>

      {/* Main time display */}
      <div
        className="relative tabular-nums [text-shadow:0_2px_16px_rgba(0,0,0,0.55)]"
        style={{ fontFamily: 'var(--ha-font-family-base, var(--font-poppins)), system-ui, sans-serif' }}
      >
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {time.hours.split('').map((digit, i) => (
              <RollingDigit
                key={i}
                digit={digit}
                className="text-[4.5rem] md:text-[6rem] lg:text-[8rem] font-semibold text-white leading-none tracking-tight"
              />
            ))}
          </div>
          <span className="ha-colon-blink text-[4.5rem] md:text-[6rem] lg:text-[8rem] font-semibold text-white leading-none">
            :
          </span>
          <div className="flex items-center">
            {time.minutes.split('').map((digit, i) => (
              <RollingDigit
                key={i}
                digit={digit}
                className="text-[4.5rem] md:text-[6rem] lg:text-[8rem] font-semibold text-white leading-none tracking-tight"
              />
            ))}
          </div>
        </div>
        {!use24HourClock && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 -mt-2 flex flex-col">
            <span
              className={`text-lg md:text-xl lg:text-2xl font-medium leading-tight ${
                time.isAM ? 'text-white' : 'text-white/40'
              }`}
            >
              AM
            </span>
            <span
              className={`text-lg md:text-xl lg:text-2xl font-medium leading-tight ${
                !time.isAM ? 'text-white' : 'text-white/40'
              }`}
            >
              PM
            </span>
          </div>
        )}
      </div>

      {/* Date display */}
      <p className="text-lg mt-3 md:text-xl md:mt-6 lg:text-2xl text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">{date}</p>

      {/* Summary badges — the Glance family; Energy opens its detail dialog in
          place (the glance stops click propagation so the screensaver stays). */}
      <div className="flex flex-wrap justify-center gap-ha-2 mt-5 md:gap-ha-4 md:mt-8 lg:mt-12 max-w-4xl px-ha-6">
        <PeopleBadge compact translucent />
        <EnergyGlance compact translucent />
        {liveSummaryItems.map((item) => (
          <SummaryCard
            key={item.title}
            id={item.id}
            icon={item.icon}
            title={item.title}
            state={item.state}
            color={item.color}
            compact
            translucent
          />
        ))}
      </div>

      {hasActivities && (
        <div className="w-full max-w-6xl px-ha-6 mt-4 md:mt-6 lg:mt-8">
          <div className="flex items-center justify-center gap-ha-3 mb-ha-2 md:mb-ha-4">
            <span className="h-px w-8 bg-white/20" />
            <p className="text-[13px] lg:text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Active Now
            </p>
            <span className="h-px w-8 bg-white/20" />
          </div>

          {/* Portrait phones: one pill per row, all equal width (flex-col stretch);
              everything else keeps the centered wrapping row. */}
          <div className="flex flex-wrap justify-center gap-ha-3 max-md:portrait:gap-ha-2 max-lg:portrait:flex-col max-lg:portrait:flex-nowrap max-lg:portrait:max-w-sm max-lg:portrait:mx-auto">
            <ScreensaverActivityPills activityData={activityData} haUrl={haUrl} />
          </div>
        </div>
      )}

      {/* Status pill — clickable, opens Home Center settings */}
      <div className={`relative ${hasActivities ? 'mt-4 md:mt-6' : 'mt-5 md:mt-8'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
            // Open Settings → Home Center. ≥xl shows the two-column workspace
            // (deep-linked via ?section); below that the workspace doesn't
            // exist, so route straight to the full-page Home Center detail.
            const hasWorkspace = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches;
            router.push(hasWorkspace ? '/settings?section=home-center' : '/settings/home-center');
          }}
          className={`flex items-center gap-ha-2 lg:gap-ha-3 rounded-ha-pill px-ha-3 py-ha-2 lg:px-ha-4 lg:py-ha-3 transition-all hover:brightness-110 active:scale-95 ${TRANSLUCENT_CHIP_FILL}`}
        >
          {/* Compact below lg — the desktop pill reads oversized on a phone */}
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="sm" className="lg:hidden" />
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="md" className="hidden lg:flex" />

          <div className="w-px h-5 lg:h-6 bg-white/20" />

          {/* Status indicators — order and visibility follow Home Center prefs */}
          {visibleSections.map(renderStatusIndicator)}
        </button>
      </div>

      {/* Talk widget — docked exactly where the voice-mode input lands (same
          container padding, same max-w-lg pill, same bottom offset), so
          entering the mode keeps the bar in place while the scene changes
          around it. Shows the one-line "while you were away" note. */}
      <div
        className="absolute bottom-0 left-0 right-0 px-ha-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        {/* Ambient halo under the widget — toast-family blue glow with a slow
            rainbow drift and the voice screen's wave dots mixed in, so the bar
            foreshadows the talking UI it opens. Livelier while "thinking". */}
        <div
          className="absolute inset-x-0 bottom-0 h-52 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_top,black_45%,transparent)]"
          aria-hidden
        >
          <TalkWidgetGlow className="w-full h-full" active={summaryLoading} />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVoiceMode(true);
          }}
          className="relative w-full max-w-lg mx-auto flex items-center gap-ha-2 min-h-12 py-ha-2 px-ha-4 rounded-ha-pill bg-white/8 border border-white/12 backdrop-blur-md transition-colors hover:bg-white/12 hover:border-white/20 active:scale-[0.99]"
        >
          {summaryLoading ? (
            <span className="flex-1 flex items-center gap-ha-3 text-left">
              <span className="flex gap-1" aria-hidden>
                <span className="w-1.5 h-1.5 rounded-full bg-ha-blue/90 animate-bounce motion-reduce:animate-none [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ha-blue/90 animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ha-blue/90 animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
              </span>
              <span className="text-base lg:text-sm text-white/50">Catching up on your home…</span>
            </span>
          ) : (
            <span
              key={summaryText}
              className="ha-summary-swap flex-1 text-left text-base lg:text-sm leading-snug text-white/80 line-clamp-2"
            >
              {summaryText}
            </span>
          )}
          <Icon path={mdiChevronRight} size={20} className="text-white/50 flex-shrink-0" />
        </button>
      </div>

      {/* Desktop: Hint to dismiss */}
      <div className="hidden lg:flex flex-col items-center gap-ha-2 mt-12">
        <p className="text-sm text-white/50 animate-pulse">
          Tap anywhere to dismiss
        </p>
      </div>

      {/* Mobile: drag hint sits just above the talk widget (which owns the
          bottom edge now) */}
      <div
        className="lg:hidden absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-none"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 5.75rem)`, paddingTop: '1rem' }}
      >
        <p className="text-sm text-white/50 mb-ha-2 animate-pulse">
          Drag up to dismiss
        </p>
        <div className="w-10 h-1.5 rounded-full bg-white/40" />
      </div>

      </div>

      {/* Voice mode overlay — covers the shader with its own reactive scene */}
      {voiceMode && <ScreensaverVoiceMode onExit={() => setVoiceMode(false)} />}
    </div>
  );
}
