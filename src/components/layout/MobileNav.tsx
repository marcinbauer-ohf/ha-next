'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { HALogo } from '../ui/HALogo';
import { CircularProgress } from '../ui/CircularProgress';
import { useHomeAssistant } from '@/hooks';
import { usePullToRevealContext, useSearchContext, useAssistantContext } from '@/contexts';
import {
  mdiMagnify,
  mdiUpdate,
  mdiBell,
  mdiWeb,
  mdiPlay,
  mdiTimerOutline,
  mdiPause,
  mdiChevronRight,
  mdiMicrophone,
  mdiDevices,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiCloudCheck,
  mdiCloudOff,
  mdiClose,
} from '@mdi/js';

function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;

interface MobileNavProps {
  disableAutoHide?: boolean;
  connectionStatus?: ConnectionStatusType;
}

export function MobileNav({ disableAutoHide = false, connectionStatus }: MobileNavProps) {
  const pathname = usePathname();
  const { entities, haUrl } = useHomeAssistant();
  const { isRevealed, close, open } = usePullToRevealContext();
  const { searchOpen, toggleSearch } = useSearchContext();
  const { openAssistant } = useAssistantContext();

  const [timerProgress, setTimerProgress] = useState<number>(0);
  const [hideTopRow, setHideTopRow] = useState(false);
  const [hideFromInactivity, setHideFromInactivity] = useState(false);
  const [showMediaWidget, setShowMediaWidget] = useState(false);
  const [showTimerWidget, setShowTimerWidget] = useState(false);
  const [mediaFadingOut, setMediaFadingOut] = useState(false);
  const [timerFadingOut, setTimerFadingOut] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const lastScrollY = useRef(0);
  const scrollAnchor = useRef(0);
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Scroll detection for hiding bottom row
  useEffect(() => {
    // When auto-hide is disabled or the top drawer is open, always show the nav
    if (disableAutoHide || isRevealed) {
      setHideTopRow(prev => prev ? false : prev);
      setHideFromInactivity(prev => prev ? false : prev);
      return;
    }

    const scrollable = document.querySelector('[data-scrollable="dashboard"]');
    if (!scrollable) return;

    const SCROLL_BUFFER = 20; // pixels of scroll before triggering hide/show

    const handleScroll = () => {
      const currentScrollY = scrollable.scrollTop;
      const currentDirection = currentScrollY > lastScrollY.current ? 'down' : 'up';
      const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;

      // Ignore iOS bounce at bottom (when scroll position is near max)
      const isNearBottom = currentScrollY >= maxScroll - 20;

      // Detect direction change - reset anchor
      if (currentDirection !== scrollDirection.current) {
        scrollDirection.current = currentDirection;
        scrollAnchor.current = currentScrollY;
      }

      // Calculate distance from anchor
      const distanceFromAnchor = Math.abs(currentScrollY - scrollAnchor.current);

      // Only toggle after scrolling past buffer
      if (distanceFromAnchor > SCROLL_BUFFER) {
        if (currentDirection === 'down' && currentScrollY > 50 && !isRevealed) {
          setHideTopRow(true);
        } else if (currentDirection === 'up' && !isNearBottom) {
          // Only show when scrolling up AND not in iOS bottom bounce
          setHideTopRow(false);
        }
      }

      lastScrollY.current = currentScrollY;
    };

    scrollable.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollable.removeEventListener('scroll', handleScroll);
  }, [disableAutoHide, isRevealed, hideTopRow, hideFromInactivity]);

  // Inactivity detection for hiding bottom row after 10s
  useEffect(() => {
    if (disableAutoHide || isRevealed) {
      setHideFromInactivity(prev => prev ? false : prev);
      return;
    }

    const scrollable = document.querySelector('[data-scrollable="dashboard"]');

    const resetInactivityTimer = () => {
      setHideFromInactivity(false);
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = setTimeout(() => {
        if (!isRevealed) setHideFromInactivity(true);
      }, 10000); // 10 seconds
    };

    // Start the timer initially
    resetInactivityTimer();

    // Reset on user interactions
    const events = ['touchstart', 'touchmove'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    // Also listen to scroll on the dashboard element
    if (scrollable) {
      scrollable.addEventListener('scroll', resetInactivityTimer, { passive: true });
    }

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
      if (scrollable) {
        scrollable.removeEventListener('scroll', resetInactivityTimer);
      }
    };
  }, [disableAutoHide, isRevealed, hideFromInactivity, hideTopRow]);



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

  // Get current user's avatar from person entity
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
        initials: name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U',
      };
    }
    return { picture: undefined, initials: 'U' };
  }, [entities, haUrl]);

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

  // Get first active media player with image
  const activeMedia = useMemo(() => {
    const mediaEntry = Object.entries(entities).find(
      ([entityId, entity]) =>
        entityId.startsWith('media_player.') && (entity.state === 'playing' || entity.state === 'paused')
    );

    if (!mediaEntry) return null;

    const [entityId, entity] = mediaEntry;
    return {
      entityId,
      state: entity.state,
      entityPicture: entity.attributes.entity_picture as string | undefined,
    };
  }, [entities]);

  // Count active media players
  const activeMediaCount = useMemo(() => {
    return Object.entries(entities).filter(
      ([entityId, entity]) =>
        entityId.startsWith('media_player.') && (entity.state === 'playing' || entity.state === 'paused')
    ).length;
  }, [entities]);

  // Get first active timer
  const activeTimer = useMemo(() => {
    const timerEntry = Object.entries(entities).find(
      ([entityId, entity]) =>
        entityId.startsWith('timer.') && (entity.state === 'active' || entity.state === 'paused')
    );

    if (!timerEntry) return null;

    const [entityId, entity] = timerEntry;
    const duration = String(entity.attributes.duration || '0:00:00');
    const durationSec = parseTime(duration);

    return {
      entityId,
      state: entity.state,
      durationSec,
      isPaused: entity.state === 'paused',
      finishesAt: entity.attributes.finishes_at as string | undefined,
      remaining: String(entity.attributes.remaining || '0:00:00'),
    };
  }, [entities]);

  // Handle media widget fade in/out
  useEffect(() => {
    if (activeMedia) {
      setMediaFadingOut(prev => prev ? false : prev);
      setShowMediaWidget(prev => !prev ? true : prev);
    } else if (showMediaWidget) {
      setMediaFadingOut(prev => !prev ? true : prev);
      const timer = setTimeout(() => {
        setShowMediaWidget(false);
        setMediaFadingOut(false);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [activeMedia, showMediaWidget]);

  // Handle timer widget fade in/out
  useEffect(() => {
    if (activeTimer) {
      setTimerFadingOut(prev => prev ? false : prev);
      setShowTimerWidget(prev => !prev ? true : prev);
    } else if (showTimerWidget) {
      setTimerFadingOut(prev => !prev ? true : prev);
      const timer = setTimeout(() => {
        setShowTimerWidget(false);
        setTimerFadingOut(false);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [activeTimer, showTimerWidget]);

  // Update timer progress every second
  useEffect(() => {
    if (!activeTimer) {
      setTimerProgress(prev => prev !== 0 ? 0 : prev);
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
  }, [activeTimer]);

  // Check for active timers count
  const activeTimerCount = useMemo(() => {
    return Object.entries(entities).filter(
      ([entityId, entity]) =>
        entityId.startsWith('timer.') && (entity.state === 'active' || entity.state === 'paused')
    ).length;
  }, [entities]);
  
  // Get active updates with details
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

  // Get active notifications with details
  const activeNotifications = useMemo(() => {
    return Object.entries(entities).filter(([entityId]) =>
      entityId.startsWith('persistent_notification.')
    ).map(([id, entity]) => ({
      id,
      title: (entity.attributes.title || entity.attributes.friendly_name || 'System Notification') as string,
      message: entity.attributes.message as string | undefined,
    }));
  }, [entities]);

  // Offline devices
  const offlineDevices = useMemo(() => {
    return Object.values(entities).filter((entity) => {
      const hasDeviceId = entity.attributes.device_id !== undefined && entity.attributes.device_id !== null;
      if (!hasDeviceId) return false;
      return entity.state === 'unavailable' || entity.state === 'unknown';
    }).map(entity => ({
      id: entity.entity_id,
      name: (entity.attributes.friendly_name || entity.entity_id) as string,
    }));
  }, [entities]);

  const offlineCount = offlineDevices.length;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-default shadow-[0_-4px_16px_rgba(0,0,0,0.08)]" style={{ paddingBottom: `env(safe-area-inset-bottom)` }} data-component="MobileNav">
      <div className="flex flex-col gap-ha-2 px-edge pt-ha-3 pb-ha-4">
        {/* Top row: Ask your home + Media + Timer + Status */}
        <div className="flex items-center gap-ha-2">
          {/* Ask your home */}
          <button
            onClick={openAssistant}
            className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill px-ha-3 h-10 flex-1 min-w-0 overflow-hidden active:scale-95 transition-transform"
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

          {/* Media + Timer widgets container */}
          {(showMediaWidget || showTimerWidget) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Media player - only show when playing/paused */}
              {showMediaWidget && (
                <button className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-opacity duration-300 ${
                  mediaFadingOut ? 'opacity-0' : 'opacity-100'
                }`}>
                  {/* Image/icon container with overflow hidden for rounded corners */}
                  <div className="absolute inset-0 rounded-full overflow-hidden bg-fill-primary-normal">
                    {activeMedia?.entityPicture ? (
                      <img
                        src={`${haUrl}${activeMedia.entityPicture}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon path={mdiPlay} size={18} className="text-ha-blue" />
                      </div>
                    )}
                  </div>
                  {/* Status badge */}
                  <span className="absolute -top-0.5 -right-0.5 bg-surface-default rounded-full p-0.5 shadow-sm z-10">
                    <Icon
                      path={activeMedia?.state === 'playing' ? mdiPlay : mdiPause}
                      size={10}
                      className={activeMedia?.state === 'playing' ? 'text-ha-blue' : 'text-yellow-600'}
                    />
                  </span>
                  {/* Count badge for multiple players */}
                  {activeMediaCount > 1 && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-ha-blue text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center z-10">
                      {activeMediaCount}
                    </span>
                  )}
                </button>
              )}

              {/* Timer - only show when active */}
              {showTimerWidget && (
                <button className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-opacity duration-300 ${
                  timerFadingOut ? 'opacity-0' : 'opacity-100'
                } ${
                  activeTimer?.isPaused ? 'bg-yellow-95' : 'bg-fill-primary-normal'
                }`}>
                  <CircularProgress
                    progress={timerProgress}
                    size={32}
                    strokeWidth={3}
                    className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                    trackClassName={activeTimer?.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                  >
                    <Icon
                      path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                      size={14}
                      className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                    />
                  </CircularProgress>
                  {activeTimerCount > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-ha-blue text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
                      {activeTimerCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Status pill: icons - pushed to the right */}
          {(() => {
            const statusIcons = [
              // Updates indicator
              <div key="updates" className="relative">
                <Icon
                  path={mdiUpdate}
                  size={18}
                  className="text-text-secondary"
                />
                {pendingUpdates > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-ha-blue rounded-full w-2 h-2" />
                )}
              </div>,
              // Remote access indicator
              <div key="remote" className="relative">
                <Icon
                  path={mdiWeb}
                  size={18}
                  className="text-text-secondary"
                />
                {isRemoteConnected && (
                  <span className="absolute -top-0.5 -right-0.5 bg-green-500 rounded-full w-2 h-2" />
                )}
                {!isRemoteConnected && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2" />
                )}
              </div>,
              // Notifications indicator
              <div key="notifications" className="relative">
                <Icon
                  path={mdiBell}
                  size={18}
                  className="text-text-secondary"
                />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-yellow-500 rounded-full w-2 h-2" />
                )}
              </div>,
              // Offline devices indicator
              <div key="offline" className="relative">
                <Icon
                  path={mdiDevices}
                  size={18}
                  className="text-text-secondary"
                />
                {offlineCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2" />
                )}
              </div>,
            ];

            const maxIcons = activeTimer ? 1 : 4;
            const visibleIcons = statusIcons.slice(0, maxIcons);
            const hasMore = statusIcons.length > maxIcons;

            return (
              <button
                onClick={() => setStatusExpanded(true)}
                className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-10 flex-shrink-0 ml-auto active:scale-95 transition-transform"
              >
                {visibleIcons}

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
        <div className={`overflow-hidden transition-all duration-300 ease-out ${
          (hideTopRow || hideFromInactivity) && !isRevealed ? 'h-0 -mt-ha-2 opacity-0' : 'h-14 opacity-100'
        }`}>
          <div className="flex items-center justify-around bg-surface-low rounded-ha-2xl px-ha-4 h-14">
            <Link
              href="/"
              className={`p-ha-2 rounded-full transition-colors ${
                pathname === '/' ? 'bg-fill-primary-normal' : 'hover:bg-surface-lower'
              }`}
              onClick={(e) => {
                // Only toggle panel when already on home page
                if (pathname === '/') {
                  e.preventDefault();
                  if (isRevealed) {
                    close();
                  } else {
                    open();
                  }
                } else {
                  // Close panel if open, then navigate
                  if (isRevealed) {
                    close();
                  }
                }
              }}
            >
              <HALogo size={28} />
            </Link>
            <button
              onClick={toggleSearch}
              className={`p-ha-2 rounded-full transition-colors ${
                searchOpen ? 'bg-fill-primary-normal text-ha-blue' : 'hover:bg-surface-lower text-text-secondary'
              }`}
            >
              <Icon path={mdiMagnify} size={28} />
            </button>
            <Link href="/panel/profile" className={`p-ha-1 rounded-full transition-all ${
              pathname === '/panel/profile' ? 'ring-2 ring-ha-blue' : 'hover:ring-2 hover:ring-surface-lower'
            }`}>
              <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="md" />
            </Link>
          </div>
        </div>
      </div>

      {/* Status Details Bottom Sheet */}
      {statusExpanded && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setStatusExpanded(false)}
          />
          
          {/* Sheet */}
          <div className="relative bg-surface-default w-full rounded-t-ha-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[85vh]">
            {/* Header handle */}
            <div className="flex justify-center pt-ha-3 pb-ha-1 flex-shrink-0" onClick={() => setStatusExpanded(false)}>
              <div className="w-10 h-1.5 rounded-full bg-surface-low" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-ha-4 py-ha-3 border-b border-surface-low flex-shrink-0">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <Icon path={mdiCheckCircle} size={20} className="text-ha-blue" />
                Home status
              </h3>
              <button
                onClick={() => setStatusExpanded(false)}
                className="p-1 hover:bg-surface-mid rounded-full text-text-secondary transition-colors"
              >
                <Icon path={mdiClose} size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-ha-4 space-y-ha-4 pb-12">
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
                
                <div className="space-y-2 mt-2 pt-2 border-t border-surface-mid/50">
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

              {/* Notifications Section */}
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
                      <div key={notif.id} className="flex items-start gap-ha-3 p-ha-2.5 bg-surface-mid/30 rounded-xl">
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

              {/* Updates Section */}
              {activeUpdates.length > 0 && (
                <div className="bg-surface-low rounded-2xl p-ha-3">
                  <div className="flex items-center justify-between mb-ha-2 px-1">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Updates Available</h4>
                    <span className="text-xs font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-md">{activeUpdates.length}</span>
                  </div>
                  <div className="space-y-2">
                    {activeUpdates.map(update => (
                      <div key={update.id} className="flex items-center gap-ha-3 p-ha-2 bg-surface-mid/30 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                          {update.picture ? <img src={`${haUrl}${update.picture}`} alt={update.name} className="w-full h-full rounded-full object-cover"/> : <Icon path={mdiUpdate} size={18} />}
                        </div>
                        <span className="text-sm font-medium text-text-primary truncate">{update.name}</span>
                        <Icon path={mdiChevronRight} size={16} className="text-text-disabled ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Offline Devices Section */}
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
                      <div key={device.id} className="flex items-center gap-ha-2 p-ha-2 rounded-lg text-text-secondary">
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
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-80">
                  <p className="text-base font-semibold text-text-primary">All systems nominal</p>
                  <p className="text-sm text-text-secondary mt-1">No issues detected in your home environment.</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-ha-4 border-t border-surface-low bg-surface-low/30 text-center flex-shrink-0">
               <p className="text-[10px] text-text-disabled uppercase tracking-widest font-bold">Home Assistant • Connected</p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
