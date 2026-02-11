'use client';

import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { EntityCard, RoomCard } from '@/components/cards';
import { DashboardSection, MobileSummaryRow, SummariesPanel, PullToRevealPanel } from '@/components/sections';
import { useTheme, useIdleTimer, useImmersiveMode, useHomeAssistant } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { HassEntity } from '@/types';
import { ScreensaverClock } from '@/components/ui/ScreensaverClock';
import { Icon } from '@/components/ui/Icon';
import {
  mdiLightbulb,
  mdiInformation,
  mdiInformationOutline,
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
  mdiPalette,
  mdiImage,
  mdiClose,
  mdiPlay,
  mdiTimerOutline,
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

function HomeInfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-ha-4 flex-shrink-0">
        <h3 className="text-base font-semibold text-text-primary">Dashboard Info</h3>
        <button
          onClick={onClose}
          className="p-ha-1 rounded-ha-lg hover:bg-surface-low text-text-secondary transition-colors"
        >
          <Icon path={mdiClose} size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-ha-4 pb-ha-4 space-y-ha-4">
        {/* Overview Stats - Basic cards without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Overview</div>
          <div className="grid grid-cols-2 gap-ha-2">
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-20" />
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-20" />
          </div>
        </div>

        {/* System - Basic cards without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">System</div>
          <div className="space-y-ha-2">
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-12" />
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-12" />
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-12" />
          </div>
        </div>

        {/* Energy - Basic card without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Energy</div>
          <div className="bg-surface-low rounded-ha-xl p-ha-3 h-20" />
        </div>

        {/* Activity - Basic cards without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Recent Activity</div>
          <div className="space-y-ha-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-low rounded-ha-xl h-8" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { theme, toggleTheme, mode, toggleMode, background, toggleBackground } = useTheme();
  const { clearCredentials, setMockEntity, entities } = useHomeAssistant();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();

  const isSimulatedMediaActive = !!entities['media_player.simulated'];
  const isSimulatedTimerActive = !!entities['timer.simulated'];

  const toggleSimulatedMedia = () => {
    if (isSimulatedMediaActive) {
      setMockEntity('media_player.simulated', null);
    } else {
      setMockEntity('media_player.simulated', {
        entity_id: 'media_player.simulated',
        state: 'playing',
        attributes: {
          friendly_name: 'Simulated Player',
          entity_picture: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop',
          media_title: 'Simulation Song',
          media_artist: 'The Mockers',
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      } as HassEntity);
    }
  };

  const toggleSimulatedTimer = () => {
    if (isSimulatedTimerActive) {
      setMockEntity('timer.simulated', null);
    } else {
      setMockEntity('timer.simulated', {
        entity_id: 'timer.simulated',
        state: 'active',
        attributes: {
          friendly_name: 'Simulated Timer',
          duration: '0:10:00',
          remaining: '0:05:00',
          finishes_at: new Date(Date.now() + 300000).toISOString(),
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      } as HassEntity);
    }
  };
  const [screensaverActive, setScreensaverActive] = useState(false);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const { isRevealed } = usePullToRevealContext();
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);

  const { setHeader } = useHeader();
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    setHeader({ 
      title: 'Home', 
      subtitle: undefined, 
      icon: undefined,
      primaryAction: {
        icon: infoOpen ? mdiInformation : mdiInformationOutline,
        onClick: () => setInfoOpen(prev => !prev)
      }
    });
  }, [setHeader, infoOpen]);

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
    ...(theme !== 'glass' ? { backgroundColor: 'var(--ha-color-surface-default)' } : {}),
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
      // Cmd/Ctrl + I to toggle info panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInfoOpen(prev => !prev);
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

      // Show bottom gradient if there's more content below AND we have overflow
      const hasOverflow = scrollHeight > clientHeight + threshold;
      setShowBottomGradient(hasOverflow && scrollTop + clientHeight < scrollHeight - threshold);
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
        <div className={`h-full flex ${infoOpen ? 'gap-ha-3' : ''}`}>
          {/* Dashboard container */}
          <div
            data-component="dashboard-surface"
            className={`flex-1 min-w-0 bg-surface-lower overflow-hidden rounded-ha-3xl transition-[opacity,transform] duration-500 ease-out ${
              dashboardReady ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.9]'
            } relative`}
          >
            {/* Info panel toggle in right padding - full height hit area, desktop only */}
            <button
              onClick={() => setInfoOpen(prev => !prev)}
              className="hidden lg:flex group absolute inset-y-0 right-0 w-14 z-10 items-center justify-center transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-r-ha-3xl bg-gradient-to-l from-transparent to-transparent group-hover:from-ha-blue/[0.06] group-hover:to-transparent transition-all duration-500 delay-0 group-hover:delay-150" />
              <Icon
                path={infoOpen ? mdiClose : mdiInformationOutline}
                size={16}
                className="relative opacity-15 group-hover:opacity-100 group-hover:text-ha-blue group-hover:translate-x-0.5 transition-all duration-500 delay-0 group-hover:delay-150 text-text-primary"
              />
            </button>
            
            <div className="h-full flex flex-col lg:pl-14 lg:pr-14 overflow-hidden">
              {/* Content area */}
              <div className="flex-1 flex gap-ha-4 overflow-hidden">
                {/* Main dashboard wrapper for gradients */}
                <div className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
                  {showTopGradient && background !== 'image' && background !== 'gradient' && (
                    <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
                  )}
                  {showBottomGradient && background !== 'image' && background !== 'gradient' && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
                  )}
                  <main
                    ref={(el) => { scrollableRef.current = el; }}
                    className="flex-1 lg:pt-ha-5 lg:pb-ha-5 px-ha-3 lg:px-0 overscroll-none overflow-x-hidden overflow-y-auto touch-pan-y relative"
                    data-scrollable="dashboard"
                  >
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
                  <DashboardSection title="Theme & Layout" columns={3}>
                    <EntityCard
                      icon={mdiArrowExpandAll}
                      title="Immersive Mode"
                      state={immersiveMode ? 'On' : 'Off'}
                      color={immersiveMode ? 'primary' : 'default'}
                      onClick={toggleImmersiveMode}
                    />
                    <EntityCard
                      icon={mdiWeatherNight}
                      title="Color Mode"
                      state={mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System'}
                      color={mode === 'dark' ? 'primary' : mode === 'system' ? 'primary' : 'default'}
                      onClick={toggleMode}
                    />
                    <EntityCard
                      icon={mdiPalette}
                      title="Theme Appearance"
                      state={theme === 'glass' ? 'Glass' : 'Default'}
                      color={theme === 'glass' ? 'primary' : 'default'}
                      onClick={toggleTheme}
                    />
                    <EntityCard
                      icon={mdiImage}
                      title="Background"
                      state={background === 'image' ? 'Image' : background === 'gradient' ? 'Home Assistant background' : 'None'}
                      color={background !== 'none' ? 'primary' : 'default'}
                      onClick={toggleBackground}
                    />
                  </DashboardSection>

                  <DashboardSection title="Simulation & Debug" columns={3}>
                    <EntityCard
                      icon={mdiPlay}
                      title="Simulate Media"
                      state={isSimulatedMediaActive ? 'Playing' : 'Idle'}
                      color={isSimulatedMediaActive ? 'primary' : 'default'}
                      onClick={toggleSimulatedMedia}
                    />
                    <EntityCard
                      icon={mdiTimerOutline}
                      title="Simulate Timer"
                      state={isSimulatedTimerActive ? 'Active' : 'Idle'}
                      color={isSimulatedTimerActive ? 'primary' : 'default'}
                      onClick={toggleSimulatedTimer}
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
                </main>
              </div>

                {/* Summaries panel - Desktop only */}
                <div className="hidden lg:block lg:pt-ha-5 lg:pb-ha-5">
                  <SummariesPanel
                    onToggleImmersive={toggleImmersiveMode}
                    onToggleDarkMode={toggleMode}
                    onToggleScreensaver={activateScreensaver}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Info Side Panel - Desktop only, separate rounded container */}
          <div className={`hidden lg:block overflow-hidden transition-[width] duration-300 ease-out flex-shrink-0 ${
            infoOpen ? 'w-80' : 'w-0'
          }`}>
            <div className="w-80 h-full bg-surface-default border border-surface-lower overflow-hidden rounded-ha-3xl">
              <HomeInfoPanel onClose={() => setInfoOpen(false)} />
            </div>
          </div>
        </div>
      </div>

      {/* Screensaver */}
      <ScreensaverClock visible={screensaverActive} onDismiss={dismissScreensaver} />

      {/* Mobile Bottom Sheet for Info */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          infoOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setInfoOpen(false)}
        />
        <div className={`absolute bottom-0 left-0 right-0 bg-surface-lower rounded-t-ha-3xl transition-transform duration-300 ease-out ${
          infoOpen ? 'translate-y-0' : 'translate-y-full'
        }`} style={{ maxHeight: '80dvh' }}>
          <div className="flex justify-center py-ha-2">
            <div className="w-8 h-1 rounded-full bg-text-secondary/40" />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(80dvh - 20px)' }}>
            <HomeInfoPanel onClose={() => setInfoOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
