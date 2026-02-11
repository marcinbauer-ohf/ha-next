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

export function MobileNav({ disableAutoHide = false }: MobileNavProps) {
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
  const lastScrollY = useRef(0);
  const scrollAnchor = useRef(0);
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Scroll detection for hiding bottom row
  useEffect(() => {
    // When auto-hide is disabled, always show the bottom row
    if (disableAutoHide) {
      setHideTopRow(false);
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
        if (currentDirection === 'down' && currentScrollY > 50) {
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
  }, [disableAutoHide]);

  // Inactivity detection for hiding bottom row after 10s
  useEffect(() => {
    if (disableAutoHide) {
      setHideFromInactivity(false);
      return;
    }

    const scrollable = document.querySelector('[data-scrollable="dashboard"]');

    const resetInactivityTimer = () => {
      setHideFromInactivity(false);
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = setTimeout(() => {
        setHideFromInactivity(true);
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
  }, [disableAutoHide]);



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
      setMediaFadingOut(false);
      setShowMediaWidget(true);
    } else if (showMediaWidget) {
      setMediaFadingOut(true);
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
      setTimerFadingOut(false);
      setShowTimerWidget(true);
    } else if (showTimerWidget) {
      setTimerFadingOut(true);
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
      setTimerProgress(0);
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

          {/* Status pill: icons + time - pushed to the right */}
          {(() => {
            const statusIcons = [
              // Updates indicator - gray
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
              <Icon
                key="remote"
                path={mdiWeb}
                size={18}
                className={isRemoteConnected ? 'text-text-secondary' : 'text-red-500'}
              />,
              // Notifications indicator
              <div key="notifications" className="relative">
                <Icon
                  path={mdiBell}
                  size={18}
                  className={notificationCount > 0 ? 'text-yellow-600' : 'text-text-secondary'}
                />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-yellow-500 rounded-full w-2 h-2" />
                )}
              </div>,
            ];

            const maxIcons = activeTimer ? 1 : 3;
            const visibleIcons = statusIcons.slice(0, maxIcons);
            const hasMore = statusIcons.length > maxIcons;

            return (
              <div className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-10 flex-shrink-0 ml-auto">
                {visibleIcons}

                {/* Chevron if more icons */}
                {hasMore && (
                  <Icon
                    path={mdiChevronRight}
                    size={18}
                    className="text-text-secondary"
                  />
                )}

              </div>
            );
          })()}
        </div>

        {/* Bottom row: Navigation pill */}
        <div className={`overflow-hidden transition-all duration-300 ease-out ${
          (hideTopRow || hideFromInactivity || isRevealed) ? 'h-0 -mt-ha-2 opacity-0' : 'h-14 opacity-100'
        }`}>
          <div className="flex items-center justify-around bg-surface-low rounded-ha-2xl px-ha-4 h-14">
            <Link
              href="/"
              className={`p-ha-2 rounded-full transition-colors ${
                pathname === '/' ? 'bg-fill-primary-normal' : 'hover:bg-surface-lower'
              }`}
              onClick={(e) => {
                if (isRevealed) {
                  e.preventDefault();
                  close();
                } else if (pathname === '/') {
                  e.preventDefault();
                  open();
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
    </nav>
  );
}
