'use client';

import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { EntityCard, RoomCard } from '@/components/cards';
import { DashboardSection, MobileSummaryRow, SummariesPanel, PullToRevealPanel } from '@/components/sections';
import { useTheme, useIdleTimer, useImmersiveMode, useHomeAssistant } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';
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
  mdiHomeAssistant,
  mdiThermometer,
  mdiWaterPercent,
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
        {/* App Info */}
        <div className="flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-low">
          <div className="w-10 h-10 rounded-full bg-fill-primary-quiet flex items-center justify-center flex-shrink-0">
            <Icon path={mdiHomeAssistant} size={24} className="text-ha-blue" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">Note HA</div>
            <div className="text-xs text-text-secondary">v2.0.0-beta · Next.js 14</div>
          </div>
        </div>

        {/* Overview Stats */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Overview</div>
          <div className="grid grid-cols-2 gap-ha-2">
            <div className="bg-surface-low rounded-ha-xl p-ha-3">
              <div className="flex items-center gap-ha-2 mb-ha-1">
                <Icon path={mdiThermometer} size={16} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">Avg Temp</span>
              </div>
              <span className="text-xl font-semibold text-text-primary">21°C</span>
            </div>
            <div className="bg-surface-low rounded-ha-xl p-ha-3">
              <div className="flex items-center gap-ha-2 mb-ha-1">
                <Icon path={mdiWaterPercent} size={16} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">Avg Humidity</span>
              </div>
              <span className="text-xl font-semibold text-text-primary">49%</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">System</div>
          <div className="space-y-ha-2">
            <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower">
              <span className="text-sm text-text-secondary">Lights On</span>
              <span className="text-sm font-medium text-text-primary">3 of 12</span>
            </div>
            <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower">
              <span className="text-sm text-text-secondary">Active Automations</span>
              <span className="text-sm font-medium text-text-primary">8</span>
            </div>
            <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower">
              <span className="text-sm text-text-secondary">People Home</span>
              <span className="text-sm font-medium text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                2
              </span>
            </div>
            <div className="flex justify-between items-center py-ha-2 border-b border-surface-lower">
              <span className="text-sm text-text-secondary">Security</span>
              <span className="text-sm font-medium text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Armed
              </span>
            </div>
          </div>
        </div>

        {/* Energy */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Energy Today</div>
          <div className="bg-surface-low rounded-ha-xl p-ha-3">
            <div className="flex justify-between items-baseline mb-ha-2">
              <span className="text-xl font-semibold text-text-primary">12.4 kWh</span>
              <span className="text-xs text-text-secondary">$2.86</span>
            </div>
            <div className="h-1.5 bg-surface-lower rounded-full overflow-hidden">
              <div className="h-full bg-ha-blue rounded-full" style={{ width: '62%' }} />
            </div>
            <span className="text-[10px] text-text-disabled mt-ha-1 block">62% of daily average</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Recent Activity</div>
          <div className="space-y-ha-2">
            {[
              { time: '5m ago', event: 'Living Room light turned on' },
              { time: '12m ago', event: 'Front door locked' },
              { time: '30m ago', event: 'Thermostat adjusted to 22°C' },
              { time: '1h ago', event: 'Away mode deactivated' },
              { time: '2h ago', event: 'Kitchen motion detected' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-ha-2">
                <div className="w-1.5 h-1.5 rounded-full bg-text-disabled flex-shrink-0" />
                <span className="text-xs text-text-secondary flex-1">{activity.event}</span>
                <span className="text-[10px] text-text-disabled flex-shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { theme, toggleTheme, mode, toggleMode, background, toggleBackground } = useTheme();
  const { clearCredentials } = useHomeAssistant();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();
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
                      title="Color Mode"
                      state={mode === 'dark' ? 'Dark' : 'Light'}
                      color={mode === 'dark' ? 'primary' : 'default'}
                      onClick={toggleMode}
                    />
                    <EntityCard
                      icon={mdiPalette}
                      title="Theme"
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
