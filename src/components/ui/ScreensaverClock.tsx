'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { Tooltip } from './Tooltip';
import { RollingDigit } from './RollingDigit';
import { useHomeAssistant } from '@/hooks';
import { mdiUpdate, mdiWeb, mdiBell, mdiAlertCircle } from '@mdi/js';
import { SummaryCard } from '../cards/SummaryCard';
import { PeopleBadge, summaryItems } from '../sections/SummariesPanel';

interface ScreensaverClockProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ScreensaverClock({ visible, onDismiss }: ScreensaverClockProps) {
  const { entities, haUrl } = useHomeAssistant();
  const [time, setTime] = useState({ hours: '', minutes: '', seconds: '', period: '', isAM: true });
  const [date, setDate] = useState('');
  const [colonVisible, setColonVisible] = useState(true);
  // Initialize based on visible prop to avoid flash on initial load
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(visible);
  const [dragDistance, setDragDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Count pending updates
  const pendingUpdates = useMemo(() => {
    return Object.entries(entities).filter(
      ([entityId, entity]) =>
        entityId.startsWith('update.') && entity.state === 'on'
    ).length;
  }, [entities]);

  // Count active notifications
  const notificationCount = useMemo(() => {
    return Object.entries(entities).filter(([entityId]) =>
      entityId.startsWith('persistent_notification.')
    ).length;
  }, [entities]);

  // Check cloud/remote connection status
  const isRemoteConnected = useMemo(() => {
    const cloudEntity = entities['cloud.cloud'];
    if (cloudEntity) {
      return cloudEntity.state === 'connected';
    }
    const remoteUi = entities['binary_sensor.remote_ui'];
    if (remoteUi) {
      return remoteUi.state === 'on';
    }
    // Default to false (not exposed) if we can't determine
    return false;
  }, [entities]);

  // Count offline devices (only entities that belong to physical devices)
  const offlineCount = useMemo(() => {
    return Object.values(entities).filter((entity) => {
      // Only count entities that belong to a physical device
      const hasDeviceId = entity.attributes.device_id !== undefined && entity.attributes.device_id !== null;
      if (!hasDeviceId) return false;
      
      // Check if the device is offline
      return entity.state === 'unavailable' || entity.state === 'unknown';
    }).length;
  }, [entities]);

  // Get current user's avatar
  const userAvatar = useMemo(() => {
    const personEntry = Object.entries(entities).find(
      ([entityId]) => entityId.startsWith('person.')
    );
    if (personEntry) {
      const [, entity] = personEntry;
      const picture = entity.attributes.entity_picture as string | undefined;
      const name = entity.attributes.friendly_name as string | undefined;
      return {
        picture: picture ? `${haUrl}${picture}` : undefined,
        name: name || 'User',
        initials: name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U',
      };
    }
    return { picture: undefined, name: 'User', initials: 'U' };
  }, [entities, haUrl]);

  // Handle mount/unmount with animation
  useEffect(() => {
    if (visible) {
      // First mount the component
      setShouldRender(true);
      // Then trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      // Start hide animation
      setIsVisible(false);
    }
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

    const handleTouchStart = (e: TouchEvent) => {
      // Only enable drag on mobile (< 1024px)
      if (window.innerWidth >= 1024) return;
      touchStartY.current = e.touches[0].clientY;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null) return;

      const currentY = e.touches[0].clientY;
      const diff = touchStartY.current - currentY; // Positive when dragging up

      if (diff > 0) {
        e.preventDefault();
        dragDistanceRef.current = diff;
        setDragDistance(diff);
      }
    };

    const handleTouchEnd = () => {
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
      touchStartY.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onDismiss, shouldRender]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const isAM = hours < 12;
      const displayHours = hours % 12 || 12;

      setTime({
        hours: displayHours.toString(),
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
  }, []);

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
      } lg:cursor-pointer`}
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
      {/* Main time display */}
      <div className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
        <div className="flex items-center">
          {time.hours.split('').map((digit, i) => (
            <RollingDigit
              key={i}
              digit={digit}
              className="text-[6rem] lg:text-[8rem] font-light text-text-primary leading-none tracking-tight"
            />
          ))}
        </div>
        <span
          className={`text-[6rem] lg:text-[8rem] font-light text-text-primary leading-none transition-opacity duration-100 ${
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
              className="text-[6rem] lg:text-[8rem] font-light text-text-primary leading-none tracking-tight"
            />
          ))}
        </div>
        <div className="flex flex-col ml-3 -mt-2">
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

      {/* User and status icons */}
      <div className="flex items-center gap-ha-4 bg-surface-low rounded-ha-pill px-ha-4 py-ha-3 mt-8">
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

      {/* Desktop: Build Info */}
      <p className="hidden lg:block absolute bottom-6 text-xs text-text-disabled opacity-40 font-mono">
        Build 2026.2.0 • Feb 6, 2026 • 22:01
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
        <p className="text-[10px] text-text-disabled opacity-40 font-mono">
          Build 2026.2.0 • Feb 6, 2026 • 22:01
        </p>
      </div>
    </div>
  );
}
