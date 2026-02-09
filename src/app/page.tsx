'use client';

import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { TopBar } from '@/components/layout';
import { EntityCard, RoomCard } from '@/components/cards';
import { DashboardSection, MobileSummaryRow, SummariesPanel, PullToRevealPanel } from '@/components/sections';
import { useTheme, useIdleTimer, useImmersiveMode, useHomeAssistant } from '@/hooks';
import { usePullToRevealContext } from '@/contexts';
import { ScreensaverClock } from '@/components/ui/ScreensaverClock';
import {
  mdiLightbulb,
  mdiTelevision,
  mdiSpeaker,
  mdiLock,
  mdiSofa,
  mdiBed,
  mdiSilverwareForkKnife,
  mdiDesk,
  mdiShower,
  mdiDoorOpen,
  mdiToyBrickOutline,
  mdiBalcony,
  mdiDeleteOutline,
  mdiArrowExpandAll,
  mdiWeatherNight,
  mdiClockOutline,
} from '@mdi/js';

// Mock data for static rendering - will be replaced with real HA data
const favoriteEntities = [
  { id: 'light.living_room', icon: mdiLightbulb, title: 'Living Room', state: 'On', color: 'yellow' as const },
  { id: 'media_player.tv', icon: mdiTelevision, title: 'TV', state: 'Off', color: 'default' as const },
  { id: 'media_player.speaker', icon: mdiSpeaker, title: 'Speaker', state: 'Playing', color: 'primary' as const },
  { id: 'lock.front_door', icon: mdiLock, title: 'Front Door', state: 'Locked', color: 'success' as const },
];

const rooms = [
  { id: 'living_room', icon: mdiSofa, name: 'Living Room', temperature: 22, humidity: 45, activeEntities: 2 },
  { id: 'kitchen', icon: mdiSilverwareForkKnife, name: 'Kitchen', temperature: 21, humidity: 50, activeEntities: 1 },
  { id: 'office', icon: mdiDesk, name: 'Office', temperature: 23, humidity: 40, activeEntities: 3 },
  { id: 'bedroom', icon: mdiBed, name: 'Bedroom', temperature: 20, humidity: 48, activeEntities: 0 },
  { id: 'kids_room', icon: mdiToyBrickOutline, name: 'Kids Room', temperature: 21, humidity: 47, activeEntities: 0 },
  { id: 'balcony', icon: mdiBalcony, name: 'Balcony', temperature: 18, humidity: 60, activeEntities: 0 },
  { id: 'bathroom', icon: mdiShower, name: 'Bathroom', temperature: 24, humidity: 65, activeEntities: 0 },
  { id: 'hallway', icon: mdiDoorOpen, name: 'Hallway', temperature: 20, humidity: 44, activeEntities: 0 },
];

const SCREENSAVER_TIMEOUT = 60000; // 1 minute of inactivity

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const { clearCredentials } = useHomeAssistant();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();
  const [screensaverActive, setScreensaverActive] = useState(false);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const { isRevealed } = usePullToRevealContext();
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);

  const isImmersiveFixed = immersivePhase !== 'normal';

  // Status bar height: pt-ha-2 (8px) + h-12 content (48px) + pb-edge (12px)
  const statusBarHeight = 'calc(var(--ha-space-2) + 48px + var(--ha-edge-padding))';

  // Padding that positions bg-surface-lower at its normal grid location when fixed
  const compensatingPadding = {
    paddingLeft: 'calc(2 * var(--ha-edge-padding) + 64px)',
    paddingTop: 'calc(var(--ha-edge-padding) + 64px)',
    paddingRight: 'var(--ha-edge-padding)',
    paddingBottom: 0,
  };

  // Expanded: edge padding on 3 sides, dashboard keeps rounded corners
  const expandedPadding = {
    paddingLeft: 'var(--ha-edge-padding)',
    paddingTop: 'var(--ha-edge-padding)',
    paddingRight: 'var(--ha-edge-padding)',
    paddingBottom: 0,
  };

  const contentStyle: CSSProperties = isImmersiveFixed ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: statusBarHeight,
    zIndex: 50,
    margin: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--ha-color-surface-default)',
    ...(immersivePhase === 'preparing' ? {
      ...compensatingPadding,
      transition: 'none',
    } : immersivePhase === 'expanded' ? {
      ...expandedPadding,
      transition: 'padding 300ms ease-out',
    } : {
      ...compensatingPadding,
      transition: 'padding 300ms ease-out',
    }),
  } : {};

  // Dashboard entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setDashboardReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Screensaver idle timer
  const { wake } = useIdleTimer({
    timeout: SCREENSAVER_TIMEOUT,
    onIdle: () => {
      setScreensaverActive(true);
    },
  });

  const dismissScreensaver = useCallback(() => {
    setScreensaverActive(false);
    wake();
  }, [wake]);

  const activateScreensaver = useCallback(() => {
    setScreensaverActive(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + \ for immersive mode
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleImmersiveMode();
      }
      // Cmd/Ctrl + Shift + S for screensaver
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (screensaverActive) {
          dismissScreensaver();
        } else {
          activateScreensaver();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screensaverActive, dismissScreensaver, activateScreensaver, toggleImmersiveMode]);

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10; // Small threshold to account for rounding

      // Show top gradient if scrolled down from the top
      setShowTopGradient(scrollTop > threshold);

      // Show bottom gradient if there's more content below
      setShowBottomGradient(scrollTop + clientHeight < scrollHeight - threshold);
    };

    // Check on mount and when content changes
    updateGradients();

    // Listen to scroll events
    scrollElement.addEventListener('scroll', updateGradients);
    
    // Also check on resize
    window.addEventListener('resize', updateGradients);

    return () => {
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
    };
  }, []);

  return (
    <>
      {/* TopBar row */}
      <div className={`px-edge lg:pr-edge overflow-hidden flex-shrink-0 h-16 transition-opacity duration-300 ease-out ${
        immersivePhase !== 'normal' ? 'lg:opacity-0 lg:pointer-events-none' : 'opacity-100'
      }`}>
        <TopBar title="Home" />
      </div>

      {/* Pull to reveal - drag handle between TopBar and dashboard (Mobile only) */}
      <PullToRevealPanel />

      {/* Main content row - expands over chrome in immersive mode */}
      <div
        className={`min-h-0 overflow-hidden ${
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
        } ${!isImmersiveFixed ? 'px-edge pb-20 lg:pb-ha-0 lg:pr-edge' : ''} ${
          immersivePhase === 'normal' ? 'transition-[flex,height,opacity] duration-300 ease-out' : ''
        }`}
        style={contentStyle}
      >
        <div
          className={`h-full bg-surface-lower overflow-hidden rounded-ha-3xl transition-[opacity,transform] duration-500 ease-out ${
            dashboardReady ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.9]'
          }`}
        >
          <div className="h-full flex flex-col lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5 overflow-hidden">
            {/* Content area */}
            <div className="flex-1 flex gap-ha-4 overflow-hidden">
              {/* Main dashboard */}
              <main
                ref={(el) => { scrollableRef.current = el; }}
                className="flex-1 lg:pb-0 px-ha-3 lg:px-0 overscroll-none overflow-x-hidden overflow-y-auto touch-pan-y relative"
                data-scrollable="dashboard"
              >
                {/* Gradient overlay - top */}
                {showTopGradient && (
                  <div className="sticky top-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-b from-surface-lower to-transparent z-10 -mb-12" />
                )}
                
                {/* Mobile summary row - sticky with glass effect on scroll */}
                <MobileSummaryRow />

                {/* Favorites */}
                <DashboardSection title="Favorites" columns={2}>
                  {favoriteEntities.map((entity) => (
                    <EntityCard
                      key={entity.id}
                      icon={entity.icon}
                      title={entity.title}
                      state={entity.state}
                      color={entity.color}
                      size="sm"
                    />
                  ))}
                </DashboardSection>

                {/* Rooms */}
                <DashboardSection title="Rooms" columns={3}>
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      icon={room.icon}
                      name={room.name}
                      temperature={room.temperature}
                      humidity={room.humidity}
                      activeEntities={room.activeEntities}
                      href={`/room/${room.id}`}
                    />
                  ))}
                </DashboardSection>

                {/* Debug */}
                <DashboardSection title="Debug" columns={3}>
                  <EntityCard
                    icon={mdiArrowExpandAll}
                    title="Immersive Mode"
                    state={immersiveMode ? 'On' : 'Off'}
                    color={immersiveMode ? 'primary' : 'default'}
                    onClick={toggleImmersiveMode}
                  />
                  <EntityCard
                    icon={mdiWeatherNight}
                    title="Dark Mode"
                    state={theme === 'dark' ? 'On' : 'Off'}
                    color={theme === 'dark' ? 'primary' : 'default'}
                    onClick={toggleTheme}
                  />
                  <EntityCard
                    icon={mdiClockOutline}
                    title="Screensaver"
                    state={screensaverActive ? 'On' : 'Off'}
                    color={screensaverActive ? 'primary' : 'default'}
                    onClick={screensaverActive ? dismissScreensaver : activateScreensaver}
                  />
                  <EntityCard
                    icon={mdiDeleteOutline}
                    title="Clear credentials"
                    state="Reset connection"
                    color="danger"
                    onClick={clearCredentials}
                  />
                </DashboardSection>

                {/* Gradient overlay - bottom */}
                {showBottomGradient && (
                  <div className="sticky bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-surface-lower to-transparent z-10 -mt-12" />
                )}
              </main>

              {/* Summaries panel - Desktop only */}
              <SummariesPanel
                onToggleImmersive={toggleImmersiveMode}
                onToggleDarkMode={toggleTheme}
                onToggleScreensaver={activateScreensaver}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Screensaver */}
      <ScreensaverClock visible={screensaverActive} onDismiss={dismissScreensaver} />
    </>
  );
}
