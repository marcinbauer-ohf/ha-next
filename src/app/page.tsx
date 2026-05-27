'use client';

import { useState, useEffect, useRef, CSSProperties } from 'react';
import { EntityCard, RoomCard } from '@/components/cards';
import { DashboardSection, MobileSummaryRow, PullToRevealPanel } from '@/components/sections';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { DashboardSidePanel } from '@/components/layout/DashboardSidePanel';
import { useTheme, useImmersiveMode } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';
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
  mdiClose,
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
      <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-4 pb-ha-4 space-y-ha-4">
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
  const { theme, background } = useTheme();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();
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
  const isMobileImmersive = immersiveMode && !isImmersiveFixed;

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
    zIndex: 5,
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

  const contentPaddingClasses = isImmersiveFixed
    ? ''
    : isMobileImmersive
      ? 'pb-0 lg:px-edge lg:pb-ha-0 lg:pr-edge'
      : 'px-edge pt-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] pb-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] lg:pt-0 lg:pb-ha-0 lg:pr-edge';

  // Dashboard entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setDashboardReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + \ for immersive mode
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleImmersiveMode();
      }
      
      // Cmd/Ctrl + I to toggle info panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInfoOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleImmersiveMode]);

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
        } ${contentPaddingClasses} ${
          immersivePhase === 'normal' ? 'transition-[flex,height,opacity,padding] duration-300 ease-out lg:transition-[flex,height,opacity]' : ''
        }`}
        style={contentStyle}
      >
        <div className={`h-full flex ${infoOpen ? 'gap-ha-3' : ''}`}>
          {/* Dashboard container */}
          <div
            data-component="dashboard-surface"
            className={`flex-1 min-w-0 overflow-hidden transition-[opacity,transform,border-radius,background-color] duration-500 ease-out ${
              dashboardReady ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.9]'
            } relative ${
              isMobileImmersive
                ? 'bg-surface-lower rounded-none lg:rounded-ha-3xl'
                : 'bg-surface-lower rounded-ha-3xl'
            }`}
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
            
            <div className="h-full flex flex-col overflow-hidden">
              {/* Content area */}
              <div className="flex-1 flex gap-ha-4 overflow-hidden w-full">
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
                    className={`flex-1 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-ha-5 ${isMobileImmersive ? 'px-ha-4' : 'px-ha-1'} lg:px-0 overscroll-none overflow-x-hidden overflow-y-auto touch-pan-y relative scrollbar-hide lg:scrollbar-hide transition-[padding] duration-300 ease-out`}
                    data-scrollable="dashboard"
                  >
                  {/* Mobile summary row - sticky with glass effect on scroll */}
                  <MobileSummaryRow fullBleed={isMobileImmersive} />

                  <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
                    <ApplicationViewNotice />
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

                  </div>
                  </main>
              </div>


              </div>
            </div>
          </div>

          <DashboardSidePanel open={infoOpen} onClose={() => setInfoOpen(false)}>
            <HomeInfoPanel onClose={() => setInfoOpen(false)} />
          </DashboardSidePanel>
        </div>
      </div>
    </>
  );
}
