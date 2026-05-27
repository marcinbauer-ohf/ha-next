'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { Tooltip } from './Tooltip';
import { RollingDigit } from './RollingDigit';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import {
  mdiAlertCircle,
  mdiBell,
  mdiCctv,
  mdiNewspaperVariantOutline,
  mdiPlayCircleOutline,
  mdiPrinter3d,
  mdiTimerOutline,
  mdiUpdate,
  mdiWeb,
} from '@mdi/js';
import { SummaryCard } from '../cards/SummaryCard';
import { PeopleBadge, summaryItems } from '../sections/SummariesPanel';
import { RingShaderBackground } from './RingShaderBackground';
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

interface ScreensaverActivityCard {
  id: string;
  icon: string;
  label: string;
  headline: string;
  detail: string;
  panelClassName: string;
  iconClassName: string;
  badgeClassName: string;
  count?: number;
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

function buildScreensaverActivityCards(
  activityData: ReturnType<typeof selectActivityData>
): ScreensaverActivityCard[] {
  const cards: ScreensaverActivityCard[] = [];

  if (activityData.activeReleaseNotes.length > 0) {
    const note = activityData.activeReleaseNotes[0];
    cards.push({
      id: 'release-notes',
      icon: mdiNewspaperVariantOutline,
      label: 'Release',
      headline: note.name,
      detail: `Version ${note.version}`,
      panelClassName: 'bg-fill-primary-normal/45 border-fill-primary-quiet/80',
      iconClassName: 'text-ha-blue',
      badgeClassName: 'bg-fill-primary-normal text-ha-blue',
      count: activityData.activeReleaseNotes.length > 1 ? activityData.activeReleaseNotes.length : undefined,
    });
  }

  if (activityData.activePlayers.length > 0) {
    const player = activityData.activePlayers[0];
    const stateLabel = player.state === 'paused' ? 'Paused' : 'Playing';
    const detailParts = [player.mediaArtist, player.name].filter(Boolean);

    cards.push({
      id: 'media',
      icon: mdiPlayCircleOutline,
      label: 'Media',
      headline: player.mediaTitle || player.name,
      detail: detailParts.length > 0 ? detailParts.join(' • ') : stateLabel,
      panelClassName: 'bg-green-500/10 border-green-500/20',
      iconClassName: 'text-green-600',
      badgeClassName: 'bg-green-500/15 text-green-600',
      count: activityData.activePlayers.length > 1 ? activityData.activePlayers.length : undefined,
    });
  }

  if (activityData.activeTimers.length > 0) {
    const timer = activityData.activeTimers[0];
    cards.push({
      id: 'timers',
      icon: mdiTimerOutline,
      label: 'Timer',
      headline: timer.name,
      detail: timer.state === 'paused' ? `Paused • ${timer.remaining}` : `${timer.remaining} remaining`,
      panelClassName: 'bg-fill-primary-normal/45 border-fill-primary-quiet/80',
      iconClassName: 'text-ha-blue',
      badgeClassName: 'bg-fill-primary-normal text-ha-blue',
      count: activityData.activeTimers.length > 1 ? activityData.activeTimers.length : undefined,
    });
  }

  if (activityData.activeCameras.length > 0) {
    const camera = activityData.activeCameras[0];
    const eventLabel = camera.event || (camera.state === 'person' ? 'Person detected' : 'Motion detected');

    cards.push({
      id: 'cameras',
      icon: mdiCctv,
      label: 'Camera',
      headline: camera.name,
      detail: eventLabel,
      panelClassName: 'bg-red-500/10 border-red-500/20',
      iconClassName: 'text-red-500',
      badgeClassName: 'bg-red-500/15 text-red-500',
      count: activityData.activeCameras.length > 1 ? activityData.activeCameras.length : undefined,
    });
  }

  if (activityData.activePrinters.length > 0) {
    const printer = activityData.activePrinters[0];
    const progress = `${Math.round(printer.progress)}% complete`;
    const detail = printer.remainingTime ? `${progress} • ${printer.remainingTime} left` : progress;

    cards.push({
      id: 'printers',
      icon: mdiPrinter3d,
      label: 'Printer',
      headline: printer.fileName || printer.name,
      detail,
      panelClassName: 'bg-surface-low border-surface-low/80',
      iconClassName: 'text-text-primary',
      badgeClassName: 'bg-surface-default text-text-primary',
      count: activityData.activePrinters.length > 1 ? activityData.activePrinters.length : undefined,
    });
  }

  return cards;
}

export function ScreensaverClock({ visible, onDismiss }: ScreensaverClockProps) {
  const { haUrl } = useHomeAssistant();
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
  const dragStartY = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const screensaverData = useHomeAssistantSelector(selectScreensaverData, areScreensaverDataEqual);
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const pendingUpdates = screensaverData.pendingUpdates;
  const notificationCount = screensaverData.notificationCount;
  const isRemoteConnected = screensaverData.isRemoteConnected;
  const offlineCount = screensaverData.offlineCount;
  const activeActivityCards = useMemo(
    () => buildScreensaverActivityCards(activityData),
    [activityData]
  );
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
    return `Build 2026.2.11 • ${date} • ${time}`;
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

  if (!shouldRender) return null;

  // Calculate transform based on drag
  const dragProgress = Math.min(dragDistance / 150, 1); // 0 to 1
  const translateY = isDismissing ? -window.innerHeight : isDragging ? -dragDistance : 0;

  return (
    <div
      ref={containerRef}
      data-component="Screensaver"
      className={`fixed inset-0 z-[100] bg-surface-default flex flex-col items-center justify-center transition-all ease-out ${
        isDragging ? 'duration-0' : isDismissing ? 'duration-300' : 'duration-500'
      } ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
      } cursor-grab select-none lg:cursor-pointer`}
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: isDismissing ? 0 : isDragging ? 1 - dragProgress * 0.3 : undefined,
      }}
      onClick={() => {
        // Only dismiss on click for desktop
        if (window.innerWidth >= 1024) {
          onDismiss();
        }
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <RingShaderBackground />
      {/* Build Info - Top */}
      <div className="absolute top-8 left-0 right-0 flex justify-center px-ha-6 pointer-events-none">
        <p className="text-[10px] lg:text-xs text-text-disabled opacity-40 font-mono text-center">
          {buildInfo}
        </p>
      </div>

      {/* Main time display */}
      <div
        className="relative tabular-nums"
        style={{ fontFamily: 'var(--font-poppins), "Poppins", system-ui, sans-serif' }}
      >
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {time.hours.split('').map((digit, i) => (
              <RollingDigit
                key={i}
                digit={digit}
                className="text-[6rem] lg:text-[8rem] font-semibold text-text-primary leading-none tracking-tight"
              />
            ))}
          </div>
          <span
            className={`text-[6rem] lg:text-[8rem] font-semibold text-text-primary leading-none transition-opacity duration-100 ${
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
                className="text-[6rem] lg:text-[8rem] font-semibold text-text-primary leading-none tracking-tight"
              />
            ))}
          </div>
        </div>
        {!use24HourClock && (
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 -mt-2 flex flex-col">
            <span
              className={`text-xl lg:text-2xl font-medium leading-tight ${
                time.isAM ? 'text-text-primary' : 'text-text-disabled'
              }`}
            >
              AM
            </span>
            <span
              className={`text-xl lg:text-2xl font-medium leading-tight ${
                !time.isAM ? 'text-text-primary' : 'text-text-disabled'
              }`}
            >
              PM
            </span>
          </div>
        )}
      </div>

      {/* Date display */}
      <p className="text-xl lg:text-2xl text-text-secondary mt-6">{date}</p>

      {/* Summary badges */}
      <div className="flex flex-wrap justify-center gap-ha-4 mt-12 max-w-4xl px-ha-6">
        <PeopleBadge compact />
        {summaryItems.map((item) => (
          <SummaryCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            state={item.state}
            color={item.color}
            compact
          />
        ))}
      </div>

      {activeActivityCards.length > 0 && (
        <div className="w-full max-w-6xl px-ha-6 mt-8">
          <div className="flex items-center justify-center gap-ha-3 mb-ha-4">
            <span className="h-px w-8 bg-surface-lower" />
            <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-[0.22em] text-text-disabled">
              Active Now
            </p>
            <span className="h-px w-8 bg-surface-lower" />
          </div>

          <div className="flex flex-wrap justify-center gap-ha-3">
            {activeActivityCards.map((activity) => (
              <div
                key={activity.id}
                className={`flex min-w-[150px] max-w-[220px] flex-[1_1_160px] items-start gap-ha-3 rounded-ha-2xl border px-ha-3 py-ha-3 ${activity.panelClassName}`}
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-default/80 ${activity.iconClassName}`}>
                  <Icon path={activity.icon} size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-ha-2">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                      {activity.label}
                    </p>
                    {activity.count && (
                      <span className={`rounded-ha-pill px-ha-2 py-0.5 text-[10px] font-semibold ${activity.badgeClassName}`}>
                        {activity.count}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-sm font-semibold text-text-primary">
                    {activity.headline}
                  </p>
                  <p className="mt-1 truncate text-xs text-text-secondary">
                    {activity.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User and status icons */}
      <div className={`flex items-center gap-ha-4 bg-surface-low rounded-ha-pill px-ha-4 py-ha-3 ${activeActivityCards.length > 0 ? 'mt-6' : 'mt-8'}`}>
        {/* User avatar and name */}
        <div className="flex items-center gap-ha-3">
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="md" />
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-surface-lower" />

        {/* Updates indicator */}
        <Tooltip content={pendingUpdates > 0 ? `Updates: ${pendingUpdates} update${pendingUpdates > 1 ? 's' : ''} available` : 'Updates: System is up to date'}>
          <div className="relative cursor-help">
            <Icon
              path={mdiUpdate}
              size={22}
              className="text-text-secondary"
            />
            {pendingUpdates > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-ha-blue rounded-full w-2.5 h-2.5" />
            )}
          </div>
        </Tooltip>

        {/* Remote access indicator */}
        <Tooltip content={isRemoteConnected ? 'Remote Access: Available via internet' : 'Remote Access: Not exposed to internet'}>
          <div className="relative cursor-help">
            <Icon
              path={mdiWeb}
              size={22}
              className="text-text-secondary"
            />
            {isRemoteConnected && (
              <span className="absolute -top-0.5 -right-0.5 bg-green-500 rounded-full w-2.5 h-2.5" />
            )}
            {!isRemoteConnected && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2.5 h-2.5" />
            )}
          </div>
        </Tooltip>

        {/* Notifications indicator */}
        <Tooltip content={notificationCount > 0 ? `Notifications: ${notificationCount} active` : 'Notifications: None'}>
          <div className="relative cursor-help">
            <Icon
              path={mdiBell}
              size={22}
              className="text-text-secondary"
            />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-yellow-500 rounded-full w-2.5 h-2.5" />
            )}
          </div>
        </Tooltip>

        {/* Offline devices indicator */}
        {offlineCount > 0 && (
          <Tooltip content={`Offline: ${offlineCount} device${offlineCount > 1 ? 's' : ''} unavailable`}>
            <div className="relative cursor-help">
              <Icon
                path={mdiAlertCircle}
                size={22}
                className="text-text-secondary"
              />
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2.5 h-2.5 animate-pulse" />
            </div>
          </Tooltip>
        )}
      </div>

      {/* Desktop: Hint to dismiss */}
      <p className="hidden lg:block text-sm text-text-disabled mt-12 animate-pulse">
        Tap anywhere to dismiss
      </p>

      {/* Mobile: Drag handle visual at bottom */}
      <div
        className="lg:hidden absolute bottom-0 left-0 right-0 flex flex-col items-center"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 1.5rem)`, paddingTop: '2rem' }}
      >
        <p className="text-sm text-text-disabled mb-ha-3 animate-pulse">
          Drag up to dismiss
        </p>
        <div className="w-10 h-1.5 rounded-full bg-text-secondary/40 mb-4" />
      </div>
    </div>
  );
}
