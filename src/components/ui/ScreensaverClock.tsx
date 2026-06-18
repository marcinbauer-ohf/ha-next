'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { RollingDigit } from './RollingDigit';
import { useHomeAssistant, useHomeAssistantSelector, useFeatureFlags, useHomeEventReactor, useHomeCenterPrefs, useWeatherParams } from '@/hooks';
import { deriveWeatherParams } from '@/lib/weatherVisual';
import type { HassEntity } from '@/types';
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
} from '@mdi/js';
import { CircularProgress } from './CircularProgress';
import { resolveEntityPictureUrl } from '@/lib/utils';
import { SummaryCard } from '../cards/SummaryCard';
import { PeopleBadge, useLiveSummaryItems } from '../sections/SummariesPanel';
import { RingShaderBackground, useRingOrigin } from './RingShaderBackground';
import { ScreensaverPulseLog } from './ScreensaverPulseLog';
import { EnergyGlance } from '../glances';
import { APP_BUILD } from '@/lib/version';
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
        className={`relative flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
            <Icon path={mdiUpdate} size={16} className="text-green-600" />
          </div>
          <ActivityCountBadge count={activityData.activeReleaseNotes.length} variant="green" />
        </div>
        <div className="flex flex-col min-w-0 max-w-[180px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <span className="text-sm font-medium text-text-primary truncate">What&apos;s New</span>
          <span className="text-xs text-text-secondary truncate">{note.version}</span>
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
        className={`relative flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
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
          <span className="text-sm font-medium text-text-primary truncate">
            {player.mediaTitle || player.name}
          </span>
          <span className={`text-xs truncate ${player.state === 'paused' ? 'text-yellow-600' : 'text-text-secondary'}`}>
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
        className={`relative flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 bg-surface-low ${mobileHide()}`}
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
          <span className="text-sm font-medium text-text-primary truncate">{timer.remaining}</span>
          <span className="text-xs text-text-secondary truncate">{timer.name}</span>
        </div>
      </div>
    );
  }

  if (activityData.activeCameras.length > 0) {
    const camera = activityData.activeCameras[0];
    pills.push(
      <div
        key="camera"
        className={`relative flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20">
          <img src={picUrl(camera.entityPicture, '/camera_doorbell.png')} alt="" className="w-full h-full object-cover animate-pulse" />
          <div className="absolute inset-0 bg-red-500/10" />
          <ActivityCountBadge count={activityData.activeCameras.length} />
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] max-lg:portrait:max-w-none max-lg:portrait:flex-1">
          <span className="text-sm font-medium text-text-primary truncate flex items-center gap-1">
            <Icon path={mdiDoorbellVideo} size={14} className="text-red-500 shrink-0" />
            {camera.name}
          </span>
          <span className="text-xs text-text-secondary truncate">{camera.event}</span>
        </div>
      </div>
    );
  }

  if (activityData.activePrinters.length > 0) {
    const printer = activityData.activePrinters[0];
    pills.push(
      <div
        key="printer"
        className={`relative flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 ${mobileHide()}`}
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
            <span className="text-sm font-medium text-text-primary truncate font-mono">{printer.progress}%</span>
            <span className="text-[13px] text-text-disabled uppercase font-bold tracking-tighter">Printing</span>
          </div>
          <span className="text-xs text-text-secondary truncate">{printer.fileName}</span>
        </div>
      </div>
    );
  }

  if (pills.length > MOBILE_PILL_LIMIT) {
    pills.push(
      <div
        key="more"
        className="hidden max-md:portrait:flex items-center justify-center self-center h-8 px-ha-4 rounded-ha-pill bg-surface-low/60 text-[13px] font-medium text-text-secondary"
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

// TEMP: weather conditions the on-screen debug control can force, with a
// representative temp/wind so each preview reads distinctly (warm sun, cold
// snow, windy rain). null = follow the live weather entity.
const WEATHER_PREVIEWS: { cond: string; label: string; temp: number; wind: number }[] = [
  { cond: 'sunny', label: 'Sunny', temp: 28, wind: 6 },
  { cond: 'partlycloudy', label: 'Partly', temp: 20, wind: 10 },
  { cond: 'cloudy', label: 'Cloudy', temp: 14, wind: 12 },
  { cond: 'fog', label: 'Fog', temp: 9, wind: 3 },
  { cond: 'rainy', label: 'Rain', temp: 11, wind: 20 },
  { cond: 'pouring', label: 'Pour', temp: 9, wind: 28 },
  { cond: 'snowy', label: 'Snow', temp: -2, wind: 10 },
  { cond: 'clear-night', label: 'Night', temp: 12, wind: 6 },
];

export function ScreensaverClock({ visible, onDismiss }: ScreensaverClockProps) {
  const liveSummaryItems = useLiveSummaryItems();
  const { haUrl } = useHomeAssistant();
  const { wavyBackgroundEnabled, reactiveBackgroundEnabled, reactiveTriggerMode, reactiveIntensity, reactiveTriggerLabelsEnabled, pulseMode, setPulseMode } = useFeatureFlags();
  const weatherParams = useWeatherParams();
  // Manual weather override for previewing on the screensaver (debug). null = live.
  const [weatherPreview, setWeatherPreview] = useState<string | null>(null);
  const effectiveWeather = useMemo(() => {
    if (!weatherPreview) return weatherParams;
    const p = WEATHER_PREVIEWS.find((w) => w.cond === weatherPreview);
    if (!p) return weatherParams;
    return deriveWeatherParams({
      state: p.cond,
      attributes: { temperature: p.temp, wind_speed: p.wind },
    } as unknown as HassEntity);
  }, [weatherPreview, weatherParams]);
  const ringOrigin = useRingOrigin();
  // Only watch for events while the screensaver is actually on screen.
  useHomeEventReactor(reactiveBackgroundEnabled && visible, reactiveTriggerMode);
  const [time, setTime] = useState({ hours: '', minutes: '', seconds: '', period: '', isAM: true });
  const use24HourClock = useMemo(() => systemPrefers24HourClock(), []);
  const [date, setDate] = useState('');
  const [colonVisible, setColonVisible] = useState(true);
  // Initialize based on visible prop to avoid flash on initial load
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(visible);
  const [dragDistance, setDragDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
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
    activityData.activePrinters.length > 0;
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
  
  const buildInfo = useMemo(() => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const time = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `Build ${APP_BUILD} • ${date} • ${time}`;
  }, []);

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
    }
  };

  // Mobile drag to dismiss - works anywhere on screen
  useEffect(() => {
    if (!shouldRender) return;

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
  }, [onDismiss, shouldRender]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const isAM = hours < 12;
      const displayHours = use24HourClock ? hours.toString().padStart(2, '0') : (hours % 12 || 12).toString();

      setTime({
        hours: displayHours,
        minutes: now.getMinutes().toString().padStart(2, '0'),
        seconds: now.getSeconds().toString().padStart(2, '0'),
        period: isAM ? 'AM' : 'PM',
        isAM,
      });

      setDate(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
      );

      setColonVisible((prev) => !prev);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [use24HourClock]);

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
        <Icon path={icon} size={20} className="w-[18px] h-[18px] lg:w-5 lg:h-5 text-text-secondary" />
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
  };
  const cyclePulseMode = () => {
    const order = Object.keys(PULSE_MODE_LABELS) as (typeof pulseMode)[];
    const next = order[(order.indexOf(pulseMode) + 1) % order.length];
    setPulseMode(next);
  };

  if (!shouldRender) return null;

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
        if (window.innerWidth >= 1024) {
          onDismiss();
        }
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <RingShaderBackground
        wavy={wavyBackgroundEnabled}
        reactive={reactiveBackgroundEnabled}
        intensity={reactiveIntensity}
        center={ringOrigin.center}
        reach={ringOrigin.reach}
        mode={pulseMode}
        weather={effectiveWeather}
      />
      {/* Names the entity behind each reactive ripple, bottom-center. Opt-in
          (Settings → screensaver) and only while the reactive background is on. */}
      {reactiveBackgroundEnabled && reactiveTriggerLabelsEnabled && <ScreensaverPulseLog />}

      {/* TEMP: weather preview control — only in weather mode. Forces a
          condition locally for previewing; doesn't touch the real entity.
          Clicks don't dismiss (stopPropagation). */}
      {pulseMode === 'weather' && (
        <div
          className="absolute top-6 left-6 z-10 max-w-[60vw] flex flex-wrap items-center gap-ha-2 rounded-ha-2xl border border-white/10 bg-surface-mid/70 px-ha-3 py-ha-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-disabled mr-ha-1">
            Weather
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setWeatherPreview(null); }}
            className={`rounded-ha-pill px-ha-2 py-1 text-xs font-medium transition-colors ${
              weatherPreview === null ? 'bg-ha-blue text-white' : 'bg-surface-low text-text-secondary hover:bg-surface-lower'
            }`}
          >
            Live
          </button>
          {WEATHER_PREVIEWS.map((w) => (
            <button
              key={w.cond}
              type="button"
              onClick={(e) => { e.stopPropagation(); setWeatherPreview(w.cond); }}
              className={`rounded-ha-pill px-ha-2 py-1 text-xs font-medium transition-colors ${
                weatherPreview === w.cond ? 'bg-ha-blue text-white' : 'bg-surface-low text-text-secondary hover:bg-surface-lower'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {/* Build Info - Top */}
      <div className="absolute top-8 left-0 right-0 flex justify-center px-ha-6 pointer-events-none">
        <p className="text-[13px] lg:text-xs text-text-disabled opacity-40 font-mono text-center">
          {buildInfo}
        </p>
      </div>

      {/* Mobile: clickable style cycler, top of screen */}
      <div className="lg:hidden absolute top-16 left-0 right-0 flex justify-center px-ha-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cyclePulseMode();
          }}
          className="text-sm text-text-secondary"
        >
          Style: {PULSE_MODE_LABELS[pulseMode]} — tap to change
        </button>
      </div>

      {/* Main time display */}
      <div
        className="relative tabular-nums"
        style={{ fontFamily: 'var(--ha-font-family-base, var(--font-poppins)), system-ui, sans-serif' }}
      >
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {time.hours.split('').map((digit, i) => (
              <RollingDigit
                key={i}
                digit={digit}
                className="text-[4.5rem] md:text-[6rem] lg:text-[8rem] font-semibold text-text-primary leading-none tracking-tight"
              />
            ))}
          </div>
          <span
            className={`text-[4.5rem] md:text-[6rem] lg:text-[8rem] font-semibold text-text-primary leading-none transition-opacity duration-100 ${
              colonVisible ? 'opacity-100' : 'opacity-20'
            }`}
          >
            :
          </span>
          <div className="flex items-center">
            {time.minutes.split('').map((digit, i) => (
              <RollingDigit
                key={i}
                digit={digit}
                className="text-[4.5rem] md:text-[6rem] lg:text-[8rem] font-semibold text-text-primary leading-none tracking-tight"
              />
            ))}
          </div>
        </div>
        {!use24HourClock && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 -mt-2 flex flex-col">
            <span
              className={`text-lg md:text-xl lg:text-2xl font-medium leading-tight ${
                time.isAM ? 'text-text-primary' : 'text-text-disabled'
              }`}
            >
              AM
            </span>
            <span
              className={`text-lg md:text-xl lg:text-2xl font-medium leading-tight ${
                !time.isAM ? 'text-text-primary' : 'text-text-disabled'
              }`}
            >
              PM
            </span>
          </div>
        )}
      </div>

      {/* Date display */}
      <p className="text-lg mt-3 md:text-xl md:mt-6 lg:text-2xl text-text-secondary">{date}</p>

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
            <span className="h-px w-8 bg-surface-lower" />
            <p className="text-[13px] lg:text-xs font-semibold uppercase tracking-[0.22em] text-text-disabled">
              Active Now
            </p>
            <span className="h-px w-8 bg-surface-lower" />
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
          className="flex items-center gap-ha-2 lg:gap-ha-3 rounded-ha-pill px-ha-3 py-ha-2 lg:px-ha-4 lg:py-ha-3 border border-white/10 transition-colors bg-surface-mid/65 hover:bg-surface-mid/80"
        >
          {/* Compact below lg — the desktop pill reads oversized on a phone */}
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="sm" className="lg:hidden" />
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="md" className="hidden lg:flex" />

          <div className="w-px h-5 lg:h-6 bg-surface-lower" />

          {/* Status indicators — order and visibility follow Home Center prefs */}
          {visibleSections.map(renderStatusIndicator)}
        </button>
      </div>

      {/* Desktop: Hint to dismiss + clickable style cycler */}
      <div className="hidden lg:flex flex-col items-center gap-ha-2 mt-12">
        <p className="text-sm text-text-disabled animate-pulse">
          Tap anywhere to dismiss
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cyclePulseMode();
          }}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Style: {PULSE_MODE_LABELS[pulseMode]} — tap to change
        </button>
      </div>

      {/* Mobile: Drag handle visual at bottom */}
      <div
        className="lg:hidden absolute bottom-0 left-0 right-0 flex flex-col items-center"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 1rem)`, paddingTop: '1rem' }}
      >
        <p className="text-sm text-text-disabled mb-ha-2 animate-pulse">
          Drag up to dismiss
        </p>
        <div className="w-10 h-1.5 rounded-full bg-text-secondary/40" />
      </div>
    </div>
  );
}
