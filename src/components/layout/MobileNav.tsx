'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { HALogo } from '../ui/HALogo';
import { MdiIcon } from '../ui/MdiIcon';
import { CircularProgress } from '../ui/CircularProgress';
import { ProfileContent } from '../profile';
import { useHomeAssistant, useSidebarItems } from '@/hooks';
import { usePullToRevealContext, useSearchContext } from '@/contexts';
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
  mdiClose,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiDoorbellVideo,
  mdiSend,
  mdiPrinter3d,
  mdiLayers,
  mdiViewDashboardOutline,
  mdiMenu,
  mdiCog,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiCloudCheck,
  mdiCloudOff,
} from '@mdi/js';

function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

const appPalettes = [
  { bg: 'bg-[var(--ha-color-fill-primary-normal)]', text: 'text-ha-blue' },
  { bg: 'bg-[var(--ha-color-fill-danger-normal)]', text: 'text-red-600' },
  { bg: 'bg-[var(--ha-color-fill-success-normal)]', text: 'text-green-600' },
  { bg: 'bg-[var(--ha-color-yellow-95)]', text: 'text-yellow-600' },
];

function getAppPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return appPalettes[Math.abs(hash) % appPalettes.length];
}

export type ConnectionStatusType = 'connecting' | 'connected' | 'error' | null;
type BottomSurfaceTab = 'dashboards' | 'search' | 'dashboard' | 'chat' | 'settings';

interface SearchResultItem {
  id: string;
  type: 'dashboard' | 'app' | 'entity';
  name: string;
  subtitle: string;
  icon?: string | null;
  href?: string;
}

interface MobileNavProps {
  disableAutoHide?: boolean;
  connectionStatus?: ConnectionStatusType;
  onNavAutoHiddenChange?: (hidden: boolean) => void;
}

export function MobileNav({ disableAutoHide = false, connectionStatus, onNavAutoHiddenChange }: MobileNavProps) {
  const pathname = usePathname();
  const { entities, haUrl, callService } = useHomeAssistant();
  const { items } = useSidebarItems();
  const { isRevealed, close } = usePullToRevealContext();
  const { searchOpen, closeSearch } = useSearchContext();
  // Assistant now handled via expandedWidgetId

  const [timerProgress, setTimerProgress] = useState<number>(0);
  const [hideTopRow, setHideTopRow] = useState(false);
  const [hideFromInactivity, setHideFromInactivity] = useState(false);
  const [showBottomEdgeGradient, setShowBottomEdgeGradient] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [expandedSurfaceTab, setExpandedSurfaceTab] = useState<BottomSurfaceTab>('dashboards');
  const [expandedSearchQuery, setExpandedSearchQuery] = useState('');
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  // For multi-activity list picker
  const [activityListType, setActivityListType] = useState<'media' | 'timer' | 'camera' | 'printer' | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const lastScrollY = useRef(0);
  const scrollAnchor = useRef(0);
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const lastScrollTimestamp = useRef(0);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const bottomSheetHandleRef = useRef<HTMLButtonElement | null>(null);
  const expandedSurfaceScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSheetTouchStartY = useRef<number | null>(null);
  const bottomSheetPullDistance = useRef(0);
  const isDashboardsActive = expandedSurfaceTab === 'dashboards';
  const isSearchActive = expandedSurfaceTab === 'search' || searchOpen;
  const isSettingsActive = expandedSurfaceTab === 'settings';
  const isBottomRowHidden = (hideTopRow || hideFromInactivity) && !isRevealed && !statusExpanded;

  useEffect(() => {
    onNavAutoHiddenChange?.(isBottomRowHidden);
  }, [isBottomRowHidden, onNavAutoHiddenChange]);

  useEffect(() => {
    return () => {
      onNavAutoHiddenChange?.(false);
    };
  }, [onNavAutoHiddenChange]);

  // Scroll behavior
  useEffect(() => {
    if (disableAutoHide || isRevealed) {
      if (hideTopRow !== false) setHideTopRow(false);
      if (hideFromInactivity !== false) setHideFromInactivity(false);
      return;
    }

    const scrollable = document.querySelector('[data-scrollable="dashboard"]');
    if (!scrollable) return;

    // Asymmetric thresholds tuned to avoid accidental toggles on slow scroll.
    const HIDE_BUFFER = 28;
    const SHOW_BUFFER = 96;
    const FORCE_HIDE_DISTANCE = 120;
    const FORCE_SHOW_DISTANCE = 170;
    const MIN_HIDE_VELOCITY = 0.28; // px/ms
    const MIN_SHOW_VELOCITY = 0.32; // px/ms

    const handleScroll = () => {
      const now = performance.now();
      const currentScrollY = scrollable.scrollTop;
      const deltaY = currentScrollY - lastScrollY.current;
      const deltaTime = Math.max(now - lastScrollTimestamp.current, 1);
      const currentDirection: 'up' | 'down' =
        deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : (scrollDirection.current ?? 'down');
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
      const canShow = hideTopRow || hideFromInactivity;

      if (currentDirection === 'down' && distanceFromAnchor > HIDE_BUFFER && currentScrollY > 80 && !isRevealed) {
        const downwardVelocity = Math.abs(deltaY) / deltaTime;
        const hideFastEnough = downwardVelocity >= MIN_HIDE_VELOCITY;
        const hideLongEnough = distanceFromAnchor >= FORCE_HIDE_DISTANCE;

        if (hideFastEnough || hideLongEnough) {
          setHideTopRow(true);
        }
      } else if (currentDirection === 'up' && canShow && !isNearBottom) {
        // Prevent accidental re-show from tiny/slow upward scrolls.
        const upwardVelocity = Math.abs(deltaY) / deltaTime;
        const fastEnough = upwardVelocity >= MIN_SHOW_VELOCITY;
        const longEnough = distanceFromAnchor >= FORCE_SHOW_DISTANCE;

        if (distanceFromAnchor >= SHOW_BUFFER && (fastEnough || longEnough)) {
          setHideTopRow(false);
          if (hideFromInactivity) {
            setHideFromInactivity(false);
          }
        }
      }

      lastScrollY.current = currentScrollY;
      lastScrollTimestamp.current = now;
    };

    lastScrollY.current = scrollable.scrollTop;
    scrollAnchor.current = scrollable.scrollTop;
    scrollDirection.current = null;
    lastScrollTimestamp.current = performance.now();

    scrollable.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollable.removeEventListener('scroll', handleScroll);
  }, [disableAutoHide, isRevealed, hideTopRow, hideFromInactivity, pathname]);

  // Inactivity detection for hiding bottom row after 10s
  useEffect(() => {
    if (disableAutoHide || isRevealed) {
      if (hideFromInactivity !== false) setHideFromInactivity(false);
      return;
    }

    const scrollable = document.querySelector('[data-scrollable="dashboard"]');

    const resetInactivityTimer = () => {
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
  }, [disableAutoHide, isRevealed, hideFromInactivity, hideTopRow, pathname]);

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
      const nextScrollable = document.querySelector('[data-scrollable="dashboard"]') as HTMLElement | null;
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

  const closeExpandedSurface = useCallback(() => {
    setStatusExpanded(false);
  }, []);

  const openExpandedSurface = useCallback(
    (tab: BottomSurfaceTab) => {
      if (statusExpanded && expandedSurfaceTab === tab) {
        closeExpandedSurface();
        return;
      }
      if (isRevealed) close();
      if (searchOpen) closeSearch();
      setExpandedWidgetId(null);
      setActivityListType(null);
      setExpandedSurfaceTab(tab);
      if (tab === 'search') setExpandedSearchQuery('');
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        if (expandedSurfaceScrollRef.current) {
          expandedSurfaceScrollRef.current.scrollTop = 0;
        }
      });
    },
    [close, closeExpandedSurface, closeSearch, expandedSurfaceTab, isRevealed, searchOpen, statusExpanded]
  );

  // Shared drag handle behavior:
  // collapsed -> drag up to open, expanded -> drag down to close.
  useEffect(() => {
    const handle = bottomSheetHandleRef.current;
    if (!handle) return;

    const threshold = statusExpanded ? 80 : 70;

    const reset = () => {
      bottomSheetTouchStartY.current = null;
      bottomSheetPullDistance.current = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      bottomSheetTouchStartY.current = e.touches[0].clientY;
      bottomSheetPullDistance.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (bottomSheetTouchStartY.current === null) return;
      const currentY = e.touches[0].clientY;

      if (statusExpanded) {
        const downwardPull = currentY - bottomSheetTouchStartY.current;
        if (downwardPull > 0) {
          if (e.cancelable) e.preventDefault();
          bottomSheetPullDistance.current = downwardPull;
        }
      } else {
        const upwardPull = bottomSheetTouchStartY.current - currentY;
        if (upwardPull > 0) {
          if (e.cancelable) e.preventDefault();
          bottomSheetPullDistance.current = upwardPull;
        }
      }
    };

    const onTouchEnd = () => {
      if (bottomSheetTouchStartY.current === null) return;
      if (bottomSheetPullDistance.current >= threshold) {
        if (statusExpanded) {
          closeExpandedSurface();
        } else {
          openExpandedSurface(expandedSurfaceTab);
        }
      }
      reset();
    };

    const onTouchCancel = () => reset();

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    handle.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove', onTouchMove);
      handle.removeEventListener('touchend', onTouchEnd);
      handle.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [closeExpandedSurface, openExpandedSurface, expandedSurfaceTab, statusExpanded]);



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

  const pendingUpdates = activeUpdates.length;
  const notificationCount = activeNotifications.length;

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

  // Get all active media players
  const allActiveMedia = useMemo(() => {
    return Object.entries(entities)
      .filter(([entityId, entity]) =>
        entityId.startsWith('media_player.') && (entity.state === 'playing' || entity.state === 'paused')
      )
      .map(([entityId, entity]) => ({
        entityId,
        state: entity.state,
        name: (entity.attributes.friendly_name as string) || entityId,
        entityPicture: entity.attributes.entity_picture as string | undefined,
      }));
  }, [entities]);

  // Get active media player with image (selected or first)
  const activeMedia = useMemo(() => {
    if (allActiveMedia.length === 0) return null;
    const found = selectedMediaId ? allActiveMedia.find(m => m.entityId === selectedMediaId) : null;
    return found || allActiveMedia[0];
  }, [allActiveMedia, selectedMediaId]);

  // Count active media players
  const activeMediaCount = allActiveMedia.length;

  // Get all active timers
  const allActiveTimers = useMemo(() => {
    return Object.entries(entities)
      .filter(([entityId, entity]) =>
        entityId.startsWith('timer.') && (entity.state === 'active' || entity.state === 'paused')
      )
      .map(([entityId, entity]) => {
        const duration = String(entity.attributes.duration || '0:00:00');
        const durationSec = parseTime(duration);
        return {
          entityId,
          state: entity.state,
          name: (entity.attributes.friendly_name as string) || entityId,
          durationSec,
          isPaused: entity.state === 'paused',
          finishesAt: entity.attributes.finishes_at as string | undefined,
          remaining: String(entity.attributes.remaining || '0:00:00'),
        };
      });
  }, [entities]);

  // Get active timer (selected or first)
  const activeTimer = useMemo(() => {
    if (allActiveTimers.length === 0) return null;
    const found = selectedTimerId ? allActiveTimers.find(t => t.entityId === selectedTimerId) : null;
    return found || allActiveTimers[0];
  }, [allActiveTimers, selectedTimerId]);

  // Get all active cameras
  const allActiveCameras = useMemo(() => {
    return Object.entries(entities)
      .filter(([entityId, entity]) => {
        if (entityId.startsWith('binary_sensor.camera_simulated') && entity.state === 'on') return true;
        if (entityId.startsWith('camera.') && (entity.state === 'motion' || entity.state === 'person')) return true;
        return false;
      })
      .map(([entityId, entity]) => ({
        entityId,
        name: String(entity.attributes.friendly_name || 'Front Door'),
        event: (entity.attributes.event_type as string) || 'Movement detected',
        entityPicture: (entity.attributes.entity_picture as string) || '/camera_doorbell.png',
      }));
  }, [entities]);

  // Get active camera (selected or first)
  const activeCamera = useMemo(() => {
    if (allActiveCameras.length === 0) return null;
    const found = selectedCameraId ? allActiveCameras.find(c => c.entityId === selectedCameraId) : null;
    return found || allActiveCameras[0];
  }, [allActiveCameras, selectedCameraId]);

  // Get all active printers
  const allActivePrinters = useMemo(() => {
    return Object.entries(entities)
      .filter(([entityId, entity]) => {
        const isPrinting = entity.state.toLowerCase() === 'printing';
        if (!isPrinting) return false;
        return entityId.startsWith('sensor.printer_simulated') || entityId.startsWith('sensor.printer_') || entityId.includes('printer');
      })
      .map(([entityId, entity]) => ({
        entityId,
        state: entity.state,
        name: (entity.attributes.friendly_name as string) || entityId,
        progress: Number(entity.attributes.progress || 0),
        fileName: (entity.attributes.file_name || entity.attributes.friendly_name || 'Printing') as string,
        remainingTime: (entity.attributes.time_remaining || '00:00:00') as string,
        entityPicture: (entity.attributes.entity_picture as string) || '/printer_3d.png',
      }));
  }, [entities]);

  // Get active printer (selected or first)
  const activePrinter = useMemo(() => {
    if (allActivePrinters.length === 0) return null;
    const found = selectedPrinterId ? allActivePrinters.find(p => p.entityId === selectedPrinterId) : null;
    return found || allActivePrinters[0];
  }, [allActivePrinters, selectedPrinterId]);

  // Derive visibility
  const showMediaWidget = !!activeMedia;
  const showTimerWidget = !!activeTimer;
  const showCameraWidget = !!activeCamera;
  const showPrinterWidget = !!activePrinter;

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
      if (timerProgress !== 0) setTimerProgress(0);
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
  const activeTimerCount = allActiveTimers.length;
  const activeCameraCount = allActiveCameras.length;
  const activePrinterCount = allActivePrinters.length;
  
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

  const dashboards = useMemo(() => items.filter(item => !item.isApp), [items]);
  const apps = useMemo(() => items.filter(item => item.isApp), [items]);

  const dashboardSearchResults = useMemo<SearchResultItem[]>(() => {
    if (!expandedSearchQuery.trim()) return [];
    const query = expandedSearchQuery.trim().toLowerCase();

    const matchingDashboards = dashboards
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

    const matchingEntities = Object.entries(entities)
      .filter(([entityId, entity]) => {
        const friendlyName = String(entity.attributes.friendly_name || entityId);
        const state = String(entity.state || '');
        return (
          friendlyName.toLowerCase().includes(query) ||
          entityId.toLowerCase().includes(query) ||
          state.toLowerCase().includes(query)
        );
      })
      .slice(0, 12)
      .map(([entityId, entity]) => ({
        id: entityId,
        type: 'entity' as const,
        name: String(entity.attributes.friendly_name || entityId),
        subtitle: `${entityId} · ${entity.state}`,
      }));

    return [...matchingDashboards, ...matchingApps, ...matchingEntities];
  }, [apps, dashboards, entities, expandedSearchQuery]);

  const dashboardSearchSuggestions = useMemo<SearchResultItem[]>(() => {
    return [
      ...dashboards.slice(0, 4).map(item => ({
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
  }, [apps, dashboards]);

  const expandedSurfaceHeader = useMemo(() => {
    if (expandedSurfaceTab === 'dashboards') {
      return { title: 'Dashboards and Apps', icon: mdiLayers };
    }
    if (expandedSurfaceTab === 'search') {
      return { title: 'Search', icon: mdiMagnify };
    }
    if (expandedSurfaceTab === 'chat') {
      return { title: 'Ask your home', icon: mdiMicrophone };
    }
    if (expandedSurfaceTab === 'settings') {
      return { title: 'Settings', icon: mdiCog };
    }
    return { title: 'Dashboard', icon: mdiViewDashboardOutline };
  }, [expandedSurfaceTab]);

  const expandedSearchItems = expandedSearchQuery.trim()
    ? dashboardSearchResults
    : dashboardSearchSuggestions;
  const showSearchEmptyState = expandedSearchQuery.trim().length > 0 && expandedSearchItems.length === 0;

  const renderExpandedSurfaceContent = () => {
    if (expandedSurfaceTab === 'dashboards') {
      return (
        <div className="space-y-ha-4">
          <div>
            <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-ha-3">Dashboards</div>
            <div className="grid grid-cols-3 gap-ha-3">
              {dashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={dashboard.urlPath}
                  onClick={closeExpandedSurface}
                  className="flex flex-col group"
                >
                  <div className="w-full aspect-[3/4] bg-surface-lower rounded-ha-xl overflow-hidden">
                    <div className="p-ha-2 space-y-ha-1">
                      <div className="h-2 bg-surface-low rounded-full w-full" />
                      <div className="h-2 bg-surface-low rounded-full w-3/4" />
                      <div className="h-3 bg-surface-low rounded-ha-lg w-full mt-ha-2" />
                      <div className="h-3 bg-surface-low rounded-ha-lg w-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-ha-1 mt-ha-1">
                    {dashboard.icon ? (
                      <MdiIcon
                        icon={dashboard.icon}
                        size={24}
                        className="text-text-secondary flex-shrink-0"
                      />
                    ) : (
                      <HALogo size={24} />
                    )}
                    <span className="text-[10px] text-text-secondary truncate">{dashboard.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="h-px bg-border-default" />

          <div>
            <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-ha-2">Applications</div>
            <div className="flex flex-wrap gap-ha-1">
              {apps.map((app) => {
                const isActive = pathname === app.urlPath ||
                  (app.urlPath !== '/' && pathname.startsWith(app.urlPath));
                const palette = getAppPalette(app.id);

                return (
                  <Link
                    key={app.id}
                    href={app.urlPath}
                    onClick={closeExpandedSurface}
                    className="p-ha-1 rounded-ha-xl hover:bg-surface-low transition-colors flex items-center justify-center"
                    title={app.title}
                  >
                    <div
                      className={`w-10 h-10 rounded-ha-xl flex items-center justify-center transition-colors ${
                        isActive ? 'bg-ha-blue' : palette.bg
                      }`}
                    >
                      <MdiIcon
                        icon={app.icon || 'mdi:application'}
                        size={22}
                        className={isActive ? 'text-white' : 'text-text-secondary'}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (expandedSurfaceTab === 'search') {
      return (
        <div className="space-y-ha-4">
          <div className="flex items-center gap-ha-2">
            <div className="flex items-center gap-ha-3 px-ha-3 h-12 rounded-ha-xl border border-surface-low bg-surface-low/50 flex-1">
              <Icon path={mdiMagnify} size={20} className="text-text-secondary flex-shrink-0" />
              <input
                type="text"
                placeholder="Search dashboards, apps, entities..."
                value={expandedSearchQuery}
                onChange={(e) => setExpandedSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-tertiary outline-none"
              />
            </div>
            <button
              type="button"
              aria-label="Close search"
              onClick={closeExpandedSurface}
              className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <Icon path={mdiClose} size={20} />
            </button>
          </div>

          {!showSearchEmptyState && (
            <div className="space-y-ha-2">
              <p className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium px-1">
                {expandedSearchQuery.trim() ? 'Results' : 'Suggestions'}
              </p>
              {expandedSearchItems.map(result => {
                const content = (
                  <>
                    <div className="w-9 h-9 rounded-ha-xl bg-surface-low flex items-center justify-center flex-shrink-0">
                      {result.type === 'entity' ? (
                        <Icon path={mdiDevices} size={18} className="text-text-secondary" />
                      ) : result.icon ? (
                        <MdiIcon icon={result.icon} size={18} className="text-ha-blue" />
                      ) : (
                        <HALogo size={18} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary font-medium truncate">{result.name}</p>
                      <p className="text-xs text-text-secondary truncate">{result.subtitle}</p>
                    </div>
                    {result.href && <Icon path={mdiChevronRight} size={16} className="text-text-disabled" />}
                  </>
                );

                if (result.href) {
                  return (
                    <Link
                      key={result.id}
                      href={result.href}
                      onClick={closeExpandedSurface}
                      className="w-full flex items-center gap-ha-3 p-ha-2.5 rounded-ha-xl bg-surface-low/60 hover:bg-surface-low transition-colors"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={result.id}
                    className="w-full flex items-center gap-ha-3 p-ha-2.5 rounded-ha-xl bg-surface-low/60"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}

          {showSearchEmptyState && (
            <div className="text-center py-10">
              <Icon path={mdiMagnify} size={36} className="text-text-tertiary mx-auto mb-ha-2" />
              <p className="text-sm text-text-secondary">No results for &ldquo;{expandedSearchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      );
    }

    if (expandedSurfaceTab === 'chat') {
      return (
        <div className="flex flex-col h-full min-h-[50vh]">
           <div className="flex flex-col gap-ha-4 justify-center items-center text-center px-ha-4 flex-1">
              <div className="w-16 h-16 bg-ha-blue/10 rounded-full flex items-center justify-center mb-ha-2">
                 <Icon path={mdiMicrophone} size={32} className="text-ha-blue" />
              </div>
              <div>
                <h4 className="text-base font-bold text-text-primary mb-1">How can I help you?</h4>
                <p className="text-xs text-text-secondary">Try &quot;Turn off the kitchen lights&quot; or &quot;Show me the front door&quot;</p>
              </div>
           </div>

           <div className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill p-ha-1 mt-auto flex-shrink-0">
              <input type="text" placeholder="Type or speak..." className="flex-1 px-ha-4 text-sm text-text-primary bg-transparent outline-none focus:ring-0" />
              <button className="w-10 h-10 rounded-full bg-ha-blue flex items-center justify-center text-white shadow-md active:scale-95 transition-transform flex-shrink-0">
                <Icon path={mdiSend} size={18} />
              </button>
           </div>
        </div>
      );
    }

    if (expandedSurfaceTab === 'settings') {
      return <ProfileContent />;
    }

    return (
      <div className="space-y-ha-3 pb-8">
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
    );
  };

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: `calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))` }}
      data-component="MobileNav"
      data-connection-status={connectionStatus ?? 'unknown'}
      onMouseEnter={() => {
        setHideTopRow(false);
        setHideFromInactivity(false);
      }}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[calc(9rem+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-surface-default/80 via-surface-default/35 to-transparent transition-opacity duration-300 ${
          showBottomEdgeGradient ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <button
        type="button"
        aria-label="Close expanded panel"
        onClick={closeExpandedSurface}
        className={`fixed inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ${
          statusExpanded ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none -z-10'
        }`}
      />
      <div className="relative z-10 px-edge">
        <div className="mobile-nav-pill relative rounded-ha-3xl bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)] max-h-[calc(100dvh-4rem)] overflow-hidden">
          <div className="relative rounded-[23px] bg-surface-default/95 backdrop-blur-md">
            <div className="flex flex-col px-edge pt-ha-1 pb-ha-4">
              <div className="flex justify-center py-0 mb-0">
                <button
                  ref={bottomSheetHandleRef}
                  type="button"
                  aria-label={statusExpanded ? 'Collapse bottom panel' : 'Expand bottom panel'}
                  onClick={() => (statusExpanded ? closeExpandedSurface() : openExpandedSurface(expandedSurfaceTab))}
                  className="h-4 w-10 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none"
                >
                  <span className="w-7 h-1 rounded-full bg-text-secondary/60" />
                </button>
              </div>
              <div className={`overflow-hidden flex flex-col transition-all duration-300 ease-out ${
                statusExpanded ? 'h-[calc(100dvh-4rem-10rem)] opacity-100 mb-ha-1' : 'h-0 opacity-0 pointer-events-none mb-0'
              }`}>
                {expandedSurfaceTab !== 'search' && (
                  <div className="flex-none flex items-center justify-between px-ha-1 py-ha-2 border-b border-surface-low">
                    <h3 className="font-semibold text-text-primary">
                      {expandedSurfaceHeader.title}
                    </h3>
                    <button
                      onClick={closeExpandedSurface}
                      className="p-1 hover:bg-surface-mid rounded-full text-text-secondary transition-colors"
                    >
                      <Icon path={mdiClose} size={24} />
                    </button>
                  </div>
                )}
                <div
                  ref={expandedSurfaceScrollRef}
                  className="flex-1 overflow-y-auto px-ha-1 pt-ha-3 pb-ha-5"
                >
                  {renderExpandedSurfaceContent()}
                </div>
              </div>
        {/* Top row: Ask your home + Media + Timer + Status */}
        <div className="flex items-center gap-ha-2">
          {/* Ask your home */}
          <div className="flex-1 min-w-0 h-10 relative">
            <button
              onClick={() => openExpandedSurface('chat')}
              className="flex items-center gap-ha-2 bg-surface-low rounded-ha-pill px-ha-3 h-full w-full active:scale-95 transition-transform"
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
          </div>

          {/* Media + Timer + Camera + Printer widgets container */}
          {(showMediaWidget || showTimerWidget || showCameraWidget || showPrinterWidget) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Camera - show when alert */}
              {showCameraWidget && (
                <div className="relative">
                  <AnimatePresence>
                    {expandedWidgetId === activeCamera?.entityId && (
                      <motion.div
                        layoutId={activeCamera.entityId}
                        className="fixed left-0 right-0 bottom-16 bg-surface-default mx-ha-4 rounded-ha-2xl shadow-2xl border border-surface-low overflow-hidden z-[60] flex flex-col"
                      >
                         <div className="bg-surface-low p-ha-3 flex items-center justify-between border-b border-surface-low">
                            <div className="flex items-center gap-2 pl-1">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest pl-1">Live Feed</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-mid rounded-full">
                              <Icon path={mdiClose} size={18} className="text-text-secondary" />
                            </button>
                         </div>
                         <div className="w-full aspect-video bg-black relative">
                            <img src={activeCamera.entityPicture} alt="" className="w-full h-full object-cover" />
                         </div>
                         <div className="p-ha-4">
                            <h4 className="text-sm font-bold text-text-primary mb-1">{activeCamera.name}</h4>
                            <p className="text-xs text-red-500 font-bold uppercase tracking-tight mb-4">{activeCamera.event}</p>
                            <button className="w-full h-12 rounded-ha-xl bg-ha-blue text-white text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                               <Icon path={mdiMicrophone} size={18} />
                               Talk to Doors
                            </button>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button 
                    layoutId={activeCamera?.entityId}
                    onClick={() => {
                      if (activeCameraCount > 1) {
                        setActivityListType('camera');
                      } else {
                        setExpandedWidgetId(expandedWidgetId === activeCamera?.entityId ? null : activeCamera?.entityId || null);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all bg-red-500/10 border ${expandedWidgetId === activeCamera?.entityId ? 'border-red-500 ring-2 ring-red-500/20' : 'border-red-500/20'}`}
                  >
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      <img
                        src={activeCamera?.entityPicture}
                        alt=""
                        className="w-full h-full object-cover animate-pulse"
                      />
                    </div>
                    {/* Count badge - always on top */}
                    {activeCameraCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeCameraCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    {activeCameraCount <= 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5 shadow-sm z-10 border border-surface-default">
                        <Icon path={mdiDoorbellVideo} size={10} className="text-white" />
                      </span>
                    )}
                  </motion.button>
                </div>
              )}

              {/* Printer - show when active */}
              {showPrinterWidget && (
                <div className="relative">
                  <AnimatePresence>
                     {expandedWidgetId === activePrinter?.entityId && (
                        <motion.div
                          layoutId={activePrinter.entityId}
                          className="fixed left-0 right-0 bottom-16 bg-surface-default mx-ha-4 rounded-ha-2xl shadow-2xl border border-surface-low overflow-hidden z-[60] flex flex-col p-ha-4"
                        >
                           <div className="flex justify-between items-center mb-ha-4 pl-1">
                              <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">3D Printing</span>
                              <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-mid rounded-full">
                                <Icon path={mdiClose} size={18} className="text-text-secondary" />
                              </button>
                           </div>
                           <div className="w-full aspect-square rounded-ha-xl overflow-hidden mb-ha-4 border border-surface-low">
                              <img src={activePrinter.entityPicture} alt="" className="w-full h-full object-cover" />
                           </div>
                           <div className="mb-ha-4">
                              <div className="flex justify-between mb-1">
                                 <span className="text-xs font-bold text-text-primary truncate">{activePrinter.fileName}</span>
                                 <span className="text-xs font-mono font-bold text-ha-blue">{activePrinter.progress}%</span>
                              </div>
                              <div className="w-full h-2 bg-surface-low rounded-full overflow-hidden border border-surface-low/30">
                                 <div className="bg-ha-blue h-full transition-all duration-500" style={{ width: `${activePrinter.progress}%` }} />
                              </div>
                           </div>
                           <div className="flex items-center justify-between p-ha-3 bg-surface-low rounded-ha-xl">
                              <div className="flex flex-col pl-1">
                                 <span className="text-[9px] font-bold text-text-disabled uppercase">Time Left</span>
                                 <span className="text-sm font-mono font-bold text-text-primary">{activePrinter.remainingTime}</span>
                              </div>
                              <button className="h-10 px-4 bg-red-500/10 text-red-500 rounded-ha-lg font-bold text-xs uppercase transition-colors hover:bg-red-500 hover:text-white">
                                 Stop
                              </button>
                           </div>
                        </motion.div>
                     )}
                  </AnimatePresence>
                  <motion.button 
                    layoutId={activePrinter?.entityId}
                    onClick={() => {
                      if (activePrinterCount > 1) {
                        setActivityListType('printer');
                      } else {
                        setExpandedWidgetId(expandedWidgetId === activePrinter?.entityId ? null : activePrinter?.entityId || null);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all bg-fill-primary-normal ${expandedWidgetId === activePrinter?.entityId ? 'ring-2 ring-ha-blue' : ''}`}
                  >
                    <CircularProgress
                      progress={(activePrinter?.progress || 0) / 100}
                      size={32}
                      strokeWidth={2.5}
                      className="text-ha-blue"
                      trackClassName="text-fill-primary-quiet"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-surface-mid">
                        <img src={activePrinter?.entityPicture} alt="" className="w-full h-full object-cover" />
                      </div>
                    </CircularProgress>
                    {/* Count badge - always on top */}
                    {activePrinterCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activePrinterCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                      <Icon path={mdiPrinter3d} size={10} className="text-ha-blue" />
                    </span>
                  </motion.button>
                </div>
              )}

              {/* Media player - only show when playing/paused */}
              {showMediaWidget && (
                <div className="relative">
                  <AnimatePresence>
                    {expandedWidgetId === activeMedia?.entityId && (
                      <motion.div
                        layoutId={activeMedia.entityId}
                        className="fixed left-0 right-0 bottom-16 bg-surface-default mx-ha-4 rounded-ha-2xl shadow-2xl border border-surface-low overflow-hidden z-[60] flex flex-col p-ha-5 items-center"
                      >
                         <div className="w-full flex justify-between items-center mb-ha-4 pl-1">
                            <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Now Playing</span>
                            <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-mid rounded-full">
                               <Icon path={mdiClose} size={18} className="text-text-secondary" />
                            </button>
                         </div>
                         <div className="w-full aspect-square rounded-ha-xl overflow-hidden mb-ha-5 shadow-lg border border-surface-low">
                            <img src={activeMedia.entityPicture ? `${haUrl}${activeMedia.entityPicture}` : undefined} alt="" className="w-full h-full object-cover" />
                         </div>
                         <div className="w-full flex items-center justify-center gap-ha-6 mb-ha-2">
                           <Icon path={mdiSkipPrevious} size={28} className="text-text-primary" />
                           <button 
                             className="w-14 h-14 rounded-full bg-ha-blue text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                             onClick={() => callService({ domain: 'media_player', service: activeMedia.state === 'playing' ? 'media_pause' : 'media_play', target: { entity_id: activeMedia.entityId } })}
                           >
                              <Icon path={activeMedia.state === 'playing' ? mdiPause : mdiPlay} size={32} />
                           </button>
                           <Icon path={mdiSkipNext} size={28} className="text-text-primary" />
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button 
                    layoutId={activeMedia?.entityId}
                    onClick={() => {
                      if (activeMediaCount > 1) {
                        setActivityListType('media');
                      } else {
                        setExpandedWidgetId(expandedWidgetId === activeMedia?.entityId ? null : activeMedia?.entityId || null);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 bg-ha-blue transition-all ${expandedWidgetId === activeMedia?.entityId ? 'ring-2 ring-ha-blue ring-offset-2' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                      {activeMedia?.entityPicture ? (
                        <img src={`${haUrl}${activeMedia.entityPicture}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icon path={mdiPlay} size={18} className="text-white" />
                      )}
                    </div>
                    {/* Count badge - always on top */}
                    {activeMediaCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center z-10 ring-1 ring-surface-default">
                        {activeMediaCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                      <Icon
                        path={activeMedia?.state === 'playing' ? mdiPlay : mdiPause}
                        size={10}
                        className={activeMedia?.state === 'playing' ? 'text-ha-blue' : 'text-yellow-600'}
                      />
                    </span>
                  </motion.button>
                </div>
              )}

              {/* Timer - only show when active */}
              {showTimerWidget && (
                <div className="relative">
                  <AnimatePresence>
                    {expandedWidgetId === activeTimer?.entityId && (
                      <motion.div
                        layoutId={activeTimer.entityId}
                        className="fixed left-0 right-0 bottom-16 bg-surface-default mx-ha-4 rounded-ha-2xl shadow-2xl border border-surface-low overflow-hidden z-[60] flex flex-col p-ha-5 items-center"
                      >
                         <div className="w-full flex justify-between items-center mb-ha-4 pl-1">
                            <span className="text-[10px] font-bold text-ha-blue uppercase tracking-widest pl-1">Timer</span>
                            <button onClick={(e) => { e.stopPropagation(); setExpandedWidgetId(null); }} className="p-ha-1 hover:bg-surface-mid rounded-full">
                               <Icon path={mdiClose} size={18} className="text-text-secondary" />
                            </button>
                         </div>
                         <div className="relative mb-ha-5">
                            <CircularProgress
                              progress={timerProgress}
                              size={140}
                              strokeWidth={6}
                              className={activeTimer.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                              trackClassName={activeTimer.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                               <span className="text-2xl font-bold font-mono text-text-primary tracking-tighter">
                                 {activeTimer.remaining}
                               </span>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-ha-3 w-full">
                            <button className="h-11 rounded-ha-xl bg-surface-low text-text-secondary font-bold text-xs uppercase tracking-wider">Cancel</button>
                            <button className={`h-11 rounded-ha-xl font-bold text-xs uppercase tracking-wider text-white ${activeTimer.isPaused ? 'bg-ha-blue' : 'bg-yellow-500'}`}>
                               {activeTimer.isPaused ? 'Resume' : 'Pause'}
                            </button>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button 
                    layoutId={activeTimer?.entityId}
                    onClick={() => {
                      if (activeTimerCount > 1) {
                        setActivityListType('timer');
                      } else {
                        setExpandedWidgetId(expandedWidgetId === activeTimer?.entityId ? null : activeTimer?.entityId || null);
                      }
                    }}
                    className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all ${
                    activeTimer?.isPaused ? 'bg-yellow-95' : 'bg-fill-primary-normal'
                  } ${expandedWidgetId === activeTimer?.entityId ? 'ring-2 ring-ha-blue' : ''}`}>
                    <CircularProgress
                      progress={timerProgress}
                      size={32}
                      strokeWidth={2.5}
                      className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                      trackClassName={activeTimer?.isPaused ? 'text-yellow-200' : 'text-fill-primary-quiet'}
                    >
                      <Icon
                        path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                        size={14}
                        className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                      />
                    </CircularProgress>
                    {/* Count badge - always on top */}
                    {activeTimerCount > 1 && (
                      <span className="absolute -top-1 -right-1 bg-ha-blue text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center ring-1 ring-surface-default">
                        {activeTimerCount}
                      </span>
                    )}
                    {/* Status badge - always on bottom */}
                    <span className="absolute -bottom-1 -right-1 bg-surface-default rounded-full p-0.5 shadow-sm z-10 border border-surface-low">
                      <Icon
                        path={activeTimer?.isPaused ? mdiPause : mdiTimerOutline}
                        size={10}
                        className={activeTimer?.isPaused ? 'text-yellow-600' : 'text-ha-blue'}
                      />
                    </span>
                  </motion.button>
                </div>
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

            const activeWidgetsCount = (showMediaWidget ? 1 : 0) + (showTimerWidget ? 1 : 0) + (showCameraWidget ? 1 : 0) + (showPrinterWidget ? 1 : 0);
            const maxIcons = activeWidgetsCount >= 2 ? 1 : activeWidgetsCount === 1 ? 2 : 4;
            const visibleIcons = statusIcons.slice(0, maxIcons);
            const hasMore = statusIcons.length > maxIcons;

            return (
              <button
                onClick={() => openExpandedSurface('dashboard')}
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
        <div className={`overflow-hidden transition-all duration-200 ease-out ${
          isBottomRowHidden ? 'h-0 m-0 opacity-0' : 'h-14 mt-ha-3 opacity-100'
        }`}>
          <div className="mobile-nav-tabs flex items-center justify-around bg-surface-low rounded-ha-2xl px-ha-4 h-14">
            <button
              type="button"
              onClick={() => openExpandedSurface('dashboards')}
              className={`relative h-full px-ha-2 flex items-center justify-center text-text-secondary transition-colors ${
                isDashboardsActive ? 'text-text-primary' : 'hover:text-text-primary'
              }`}
            >
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
              className={`relative h-full px-ha-2 flex items-center justify-center transition-colors ${
                isSearchActive ? 'text-ha-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon path={mdiMagnify} size={28} />
              <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-ha-blue transition-opacity ${
                isSearchActive ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
            <button
              type="button"
              onClick={() => openExpandedSurface('settings')}
              className={`relative h-full pl-ha-4 pr-ha-2 flex items-center justify-center transition-opacity ${
                isSettingsActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon path={mdiMenu} size={28} className="absolute -left-2 text-text-secondary z-0" />
                <div className="relative z-10 rounded-full ring-[3px] ring-surface-low bg-surface-low">
                  <Avatar src={userAvatar.picture} initials={userAvatar.initials} size="sm" />
                </div>
              </div>
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

      {/* Activity List Bottom Sheet - for selecting from multiple active items */}
      {activityListType && (() => {
        const items = activityListType === 'media' ? allActiveMedia
          : activityListType === 'timer' ? allActiveTimers
          : activityListType === 'camera' ? allActiveCameras
          : allActivePrinters;
        const title = activityListType === 'media' ? 'Active Media Players'
          : activityListType === 'timer' ? 'Active Timers'
          : activityListType === 'camera' ? 'Active Cameras'
          : 'Active Printers';
        return (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setActivityListType(null)}
            />
            {/* Sheet */}
            <div className="relative bg-surface-default w-full rounded-t-ha-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[70vh]">
              {/* Handle */}
              <div className="flex justify-center pt-ha-3 pb-ha-1 flex-shrink-0" onClick={() => setActivityListType(null)}>
                <div className="w-10 h-1.5 rounded-full bg-surface-low" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-ha-4 py-ha-3 border-b border-surface-low flex-shrink-0">
                <h3 className="font-semibold text-text-primary">{title}</h3>
                <button
                  onClick={() => setActivityListType(null)}
                  className="p-1 hover:bg-surface-mid rounded-full text-text-secondary transition-colors"
                >
                  <Icon path={mdiClose} size={24} />
                </button>
              </div>
              {/* List */}
              <div className="overflow-y-auto p-ha-4 space-y-ha-2 pb-8">
                {items.map((item) => {
                  const isSelected = activityListType === 'media' ? selectedMediaId === item.entityId
                    : activityListType === 'timer' ? selectedTimerId === item.entityId
                    : activityListType === 'camera' ? selectedCameraId === item.entityId
                    : selectedPrinterId === item.entityId;
                  return (
                    <button
                      key={item.entityId}
                      onClick={() => {
                        if (activityListType === 'media') setSelectedMediaId(item.entityId);
                        else if (activityListType === 'timer') setSelectedTimerId(item.entityId);
                        else if (activityListType === 'camera') setSelectedCameraId(item.entityId);
                        else setSelectedPrinterId(item.entityId);
                        setActivityListType(null);
                        setExpandedWidgetId(item.entityId);
                      }}
                      className={`w-full flex items-center gap-ha-3 p-ha-3 rounded-ha-xl border transition-all text-left ${
                        isSelected
                          ? 'bg-fill-primary-normal border-ha-blue/30'
                          : 'bg-surface-low border-surface-lower hover:bg-surface-mid'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activityListType === 'camera' ? 'bg-red-500/10' : 'bg-fill-primary-normal'
                      }`}>
                        <Icon
                          path={activityListType === 'media' ? mdiPlay : activityListType === 'timer' ? mdiTimerOutline : activityListType === 'camera' ? mdiDoorbellVideo : mdiPrinter3d}
                          size={18}
                          className={activityListType === 'camera' ? 'text-red-500' : 'text-ha-blue'}
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text-primary truncate">{item.name}</span>
                        <span className="text-xs text-text-secondary truncate">
                          {activityListType === 'timer' ? (item as typeof allActiveTimers[0]).remaining
                            : activityListType === 'printer' ? `${(item as typeof allActivePrinters[0]).progress}% complete`
                            : activityListType === 'camera' ? (item as typeof allActiveCameras[0]).event
                            : (item as typeof allActiveMedia[0]).state}
                        </span>
                      </div>
                      <Icon path={mdiChevronRight} size={18} className="text-text-disabled flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

    </nav>
  );
}
