'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { CircularProgress } from '../ui/CircularProgress';
import { Tooltip } from '../ui/Tooltip';
import { useHomeAssistant } from '@/hooks';
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
} from '@mdi/js';

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

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;

interface StatusBarProps {
  connectionStatus?: ConnectionStatusType;
}

export function StatusBar({ connectionStatus }: StatusBarProps) {
  const pathname = usePathname();
  const { entities, callService, haUrl } = useHomeAssistant();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [timerDisplays, setTimerDisplays] = useState<Record<string, string>>({});
  const [timerProgress, setTimerProgress] = useState<Record<string, number>>({});

  // Track visibility for animations
  const [showTimers, setShowTimers] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);

  const [isAM, setIsAM] = useState(true);
  const [colonVisible, setColonVisible] = useState(true);

  // Chat expansion state
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Status pop-up state
  const [statusExpanded, setStatusExpanded] = useState(false);
  const statusContainerRef = useRef<HTMLDivElement>(null);

  // Close chat/status when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatExpanded && chatContainerRef.current && !chatContainerRef.current.contains(event.target as Node)) {
        setChatExpanded(false);
      }
      if (statusExpanded && statusContainerRef.current && !statusContainerRef.current.contains(event.target as Node)) {
        setStatusExpanded(false);
      }
    };

    if (chatExpanded || statusExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [chatExpanded, statusExpanded]);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      setIsAM(hours < 12);
      setColonVisible((prev) => !prev);
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).replace(/\s?(AM|PM)$/i, '')
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Update showTimers based on activeTimers
  useEffect(() => {
    if (activeTimers.length > 0 && !showTimers) {
      setShowTimers(true);
    } else if (activeTimers.length === 0 && showTimers) {
      setShowTimers(false);
    }
  }, [activeTimers.length, showTimers]);

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

  // Update showPlayers based on activePlayers
  useEffect(() => {
    if (activePlayers.length > 0 && !showPlayers) {
      setShowPlayers(true);
    } else if (activePlayers.length === 0 && showPlayers) {
      setShowPlayers(false);
    }
  }, [activePlayers.length, showPlayers]);

  // Calculate remaining time and progress for display (updates every second)
  useEffect(() => {
    if (activeTimers.length === 0) {
      setTimerDisplays({});
      setTimerProgress({});
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
        picture: picture ? `${haUrl}${picture}` : undefined,
        initials: name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U',
      };
    }
    return { picture: undefined, initials: 'U' };
  }, [entities, haUrl]);

  return (
    <footer className="hidden lg:flex items-center justify-between pr-edge pt-ha-2 pb-edge col-span-full" data-component="StatusBar">
      {/* Left side widgets */}
      <div className="flex items-center gap-ha-5">
        {/* User profile avatar */}
        <Link
          href="/panel/profile"
          className={`p-ha-1 rounded-full transition-all ${
            pathname === '/panel/profile' ? 'ring-2 ring-ha-blue' : 'hover:ring-2 hover:ring-surface-lower'
          }`}
          style={{ marginLeft: '8px' }}
        >
          <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="md" />
        </Link>

        {/* Voice input widget */}
        <div ref={chatContainerRef} className="relative">
          {/* Expanded chat panel - opens upward */}
          {chatExpanded && (
            <div
              className="absolute left-0 bottom-full mb-ha-2 w-[240px] bg-surface-default rounded-ha-3xl shadow-lg overflow-hidden transition-all duration-300 z-50"
              style={{
                height: '420px',
              }}
            >
              {/* Messages area */}
              <div className="h-full overflow-y-auto p-ha-4 flex flex-col items-center">
                <div className="flex flex-col items-center justify-center flex-1 text-center py-ha-4">
                  <div className="relative mb-ha-4 group">
                    <img 
                      src="/casita.png" 
                      alt="Casita Bot" 
                      className="w-28 h-28 object-contain animate-bounce-slow"
                    />
                  </div>

                  {/* Chat Bubble from Casita */}
                  <div className="relative bg-ha-blue text-white p-ha-3 rounded-ha-xl shadow-md mb-ha-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Triangle tip */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-ha-blue rotate-45" />
                    
                    <p className="text-xs font-medium leading-normal">
                      Hola! I&apos;m <span className="font-bold">Casita</span>. How can I help you with your <span className="capitalize font-bold">{
                        pathname === '/' ? 'Home' :
                        pathname.startsWith('/dashboard/') ? pathname.split('/')[2] :
                        pathname.startsWith('/panel/') ? pathname.split('/')[2] :
                        'Home'
                      }</span> today?
                    </p>
                  </div>
                </div>
                
                <div className="w-full mt-auto pt-ha-4 border-t border-surface-low text-center">
                  <p className="text-text-disabled text-[10px] uppercase tracking-widest font-bold">
                    System Ready
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Input area - transforms when expanded */}
          {chatExpanded ? (
            <div className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill px-ha-3 h-12 w-[240px] transition-all duration-300">
              <input
                type="text"
                placeholder="Ask..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled outline-none"
                autoFocus
              />
              <button className="p-ha-1.5 hover:bg-surface-lower rounded-full text-text-secondary transition-colors">
                <Icon path={mdiMicrophone} size={18} />
              </button>
              <button className="p-ha-1.5 bg-ha-blue text-white rounded-full hover:bg-ha-blue-dark transition-colors">
                <Icon path={mdiSend} size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setChatExpanded(true)}
              className="flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-4 h-12 transition-all duration-300"
            >
              <span className="text-sm text-text-disabled whitespace-nowrap">
                Ask your <span className="text-text-tertiary/60 capitalize">{
                  pathname === '/' ? 'Home' :
                  pathname.startsWith('/dashboard/') ? pathname.split('/')[2] :
                  pathname.startsWith('/panel/') ? pathname.split('/')[2] :
                  'Home'
                }</span>...
              </span>
              <Icon path={mdiMicrophone} size={20} className="text-text-secondary" />
            </button>
          )}
        </div>

        {/* Media player widget(s) - only show when playing */}
        {activePlayers.map((player) => (
          <div
            key={player.entity_id}
            className={`flex items-center gap-ha-3 bg-surface-low rounded-ha-pill px-ha-3 h-12 transition-all duration-300 ease-out ${
              showPlayers ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
            }`}
          >
            {player.entityPicture ? (
              <img
                src={`${haUrl}${player.entityPicture}`}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-fill-primary-normal flex items-center justify-center">
                <Icon path={mdiPlay} size={16} className="text-ha-blue" />
              </div>
            )}
            <div className="flex flex-col min-w-0 max-w-[140px]">
              <span className="text-sm font-medium text-text-primary truncate">
                {player.mediaTitle || player.name}
              </span>
              <span className={`text-xs truncate ${player.state === 'paused' ? 'text-yellow-600' : 'text-text-secondary'}`}>
                {player.mediaArtist || (player.state === 'playing' ? 'Playing' : 'Paused')}
              </span>
            </div>
            <div className="flex items-center gap-ha-1 ml-ha-2">
              <button
                className="p-ha-1 hover:bg-surface-lower rounded-full text-text-secondary"
                onClick={() => callService({
                  domain: 'media_player',
                  service: 'media_previous_track',
                  target: { entity_id: player.entity_id },
                })}
              >
                <Icon path={mdiSkipPrevious} size={18} />
              </button>
              <button
                className={`p-ha-1.5 hover:bg-surface-lower rounded-full ${
                  player.state === 'playing' ? 'bg-fill-primary-normal text-ha-blue' : 'bg-yellow-95 text-yellow-600'
                }`}
                onClick={() => callService({
                  domain: 'media_player',
                  service: player.state === 'playing' ? 'media_pause' : 'media_play',
                  target: { entity_id: player.entity_id },
                })}
              >
                <Icon path={player.state === 'playing' ? mdiPause : mdiPlay} size={20} />
              </button>
              <button
                className="p-ha-1 hover:bg-surface-lower rounded-full text-text-secondary"
                onClick={() => callService({
                  domain: 'media_player',
                  service: 'media_next_track',
                  target: { entity_id: player.entity_id },
                })}
              >
                <Icon path={mdiSkipNext} size={18} />
              </button>
            </div>
          </div>
        ))}

        {/* Timer widget(s) - only show when active */}
        {activeTimers.map((timer) => (
          <div
            key={timer.entity_id}
            className={`flex items-center gap-ha-3 rounded-ha-pill px-ha-3 h-12 transition-all duration-300 ease-out ${
              timer.state === 'active' ? 'bg-fill-primary-normal' : 'bg-yellow-95'
            } ${showTimers ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
          >
            <CircularProgress
              progress={timerProgress[timer.entity_id] ?? timer.progress}
              size={32}
              strokeWidth={3}
              className={timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
              trackClassName={timer.state === 'active' ? 'text-fill-primary-quiet' : 'text-yellow-200'}
            >
              <Icon
                path={timer.state === 'active' ? mdiTimerOutline : mdiPause}
                size={16}
                className={timer.state === 'active' ? 'text-ha-blue' : 'text-yellow-600'}
              />
            </CircularProgress>
            <div className="flex flex-col min-w-0 max-w-[140px]">
              <span className="text-sm font-medium text-text-primary truncate">
                {timerDisplays[timer.entity_id] || timer.remaining}
              </span>
              <span className="text-xs text-text-secondary truncate">{timer.name}</span>
            </div>
          </div>
        ))}
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
                                        {update.picture ? <img src={`${haUrl}${update.picture}`} alt={update.name} className="w-full h-full rounded-full object-cover"/> : <Icon path={mdiUpdate} size={18} />}
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
            <span className="text-base font-medium text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
              {currentTime.split(':')[0]}
              <span className={colonVisible ? 'opacity-100' : 'opacity-0'}>:</span>
              {currentTime.split(':')[1]}
            </span>
            <div className="flex items-center gap-ha-1">
              <div className="flex flex-col text-[9px] font-medium leading-tight">
                <span className={isAM ? 'text-text-primary' : 'text-text-disabled'}>AM</span>
                <span className={!isAM ? 'text-text-primary' : 'text-text-disabled'}>PM</span>
              </div>
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
