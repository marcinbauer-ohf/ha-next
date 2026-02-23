'use client';

import { use, useState, useEffect, useRef } from 'react';
import { EntityCard } from '@/components/cards';
import { DashboardSection, PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks';
import Link from 'next/link';
import {
  mdiSofa,
  mdiBed,
  mdiSilverwareForkKnife,
  mdiDesk,
  mdiShower,
  mdiDoorOpen,
  mdiToyBrickOutline,
  mdiBalcony,
  mdiLightbulb,
  mdiLightbulbGroup,
  mdiThermometer,
  mdiWaterPercent,
  mdiMotionSensor,
  mdiWindowOpenVariant,
  mdiTelevision,
  mdiSpeaker,
  mdiPowerPlug,
  mdiRobotVacuum,
  mdiClose,
  mdiFan,
  mdiLightSwitch,
  mdiArrowLeft,
  mdiInformation,
  mdiInformationOutline,
} from '@mdi/js';

// Room metadata lookup
const roomData: Record<string, { icon: string; name: string; temperature: number; humidity: number }> = {
  living_room: { icon: mdiSofa, name: 'Living Room', temperature: 22, humidity: 45 },
  kitchen: { icon: mdiSilverwareForkKnife, name: 'Kitchen', temperature: 21, humidity: 50 },
  office: { icon: mdiDesk, name: 'Office', temperature: 23, humidity: 40 },
  bedroom: { icon: mdiBed, name: 'Bedroom', temperature: 20, humidity: 48 },
  kids_room: { icon: mdiToyBrickOutline, name: 'Kids Room', temperature: 21, humidity: 47 },
  balcony: { icon: mdiBalcony, name: 'Balcony', temperature: 18, humidity: 60 },
  bathroom: { icon: mdiShower, name: 'Bathroom', temperature: 24, humidity: 65 },
  hallway: { icon: mdiDoorOpen, name: 'Hallway', temperature: 20, humidity: 44 },
};

// Mock entities per room
const roomEntities: Record<string, Array<{ id: string; icon: string; title: string; state: string; color: 'primary' | 'yellow' | 'default' | 'success' }>> = {
  living_room: [
    { id: 'light.living_room_main', icon: mdiLightbulb, title: 'Main Light', state: 'On · 80%', color: 'yellow' },
    { id: 'light.living_room_ambient', icon: mdiLightbulbGroup, title: 'Ambient Lights', state: 'On · 40%', color: 'yellow' },
    { id: 'media_player.tv', icon: mdiTelevision, title: 'TV', state: 'Off', color: 'default' },
    { id: 'media_player.soundbar', icon: mdiSpeaker, title: 'Soundbar', state: 'Off', color: 'default' },
    { id: 'climate.living_room', icon: mdiThermometer, title: 'Climate', state: '22°C · Heating', color: 'primary' },
    { id: 'sensor.motion_living', icon: mdiMotionSensor, title: 'Motion', state: 'Detected', color: 'primary' },
    { id: 'switch.plug_lamp', icon: mdiPowerPlug, title: 'Floor Lamp', state: 'On', color: 'yellow' },
    { id: 'vacuum.robot', icon: mdiRobotVacuum, title: 'Robot Vacuum', state: 'Docked', color: 'default' },
  ],
  kitchen: [
    { id: 'light.kitchen_main', icon: mdiLightbulb, title: 'Ceiling Light', state: 'On · 100%', color: 'yellow' },
    { id: 'sensor.kitchen_temp', icon: mdiThermometer, title: 'Temperature', state: '21°C', color: 'default' },
    { id: 'sensor.kitchen_humidity', icon: mdiWaterPercent, title: 'Humidity', state: '50%', color: 'default' },
    { id: 'switch.coffee_machine', icon: mdiPowerPlug, title: 'Coffee Machine', state: 'Off', color: 'default' },
    { id: 'sensor.kitchen_window', icon: mdiWindowOpenVariant, title: 'Window', state: 'Closed', color: 'success' },
    { id: 'sensor.kitchen_motion', icon: mdiMotionSensor, title: 'Motion', state: 'Clear', color: 'default' },
  ],
  office: [
    { id: 'light.office_desk', icon: mdiLightbulb, title: 'Desk Light', state: 'On · 70%', color: 'yellow' },
    { id: 'light.office_ceiling', icon: mdiLightbulbGroup, title: 'Ceiling Light', state: 'On · 90%', color: 'yellow' },
    { id: 'climate.office', icon: mdiThermometer, title: 'Climate', state: '23°C · Cooling', color: 'primary' },
    { id: 'switch.monitor', icon: mdiTelevision, title: 'Monitor', state: 'On', color: 'primary' },
    { id: 'switch.desk_fan', icon: mdiFan, title: 'Desk Fan', state: 'On', color: 'primary' },
    { id: 'sensor.office_motion', icon: mdiMotionSensor, title: 'Motion', state: 'Detected', color: 'primary' },
  ],
  bedroom: [
    { id: 'light.bedroom_main', icon: mdiLightbulb, title: 'Main Light', state: 'Off', color: 'default' },
    { id: 'light.bedroom_bedside', icon: mdiLightbulbGroup, title: 'Bedside Lamps', state: 'Off', color: 'default' },
    { id: 'climate.bedroom', icon: mdiThermometer, title: 'Climate', state: '20°C · Off', color: 'default' },
    { id: 'sensor.bedroom_humidity', icon: mdiWaterPercent, title: 'Humidity', state: '48%', color: 'default' },
    { id: 'sensor.bedroom_window', icon: mdiWindowOpenVariant, title: 'Window', state: 'Closed', color: 'success' },
  ],
  kids_room: [
    { id: 'light.kids_main', icon: mdiLightbulb, title: 'Main Light', state: 'Off', color: 'default' },
    { id: 'light.kids_nightlight', icon: mdiLightbulbGroup, title: 'Night Light', state: 'Off', color: 'default' },
    { id: 'climate.kids_room', icon: mdiThermometer, title: 'Climate', state: '21°C · Off', color: 'default' },
    { id: 'sensor.kids_motion', icon: mdiMotionSensor, title: 'Motion', state: 'Clear', color: 'default' },
  ],
  balcony: [
    { id: 'light.balcony', icon: mdiLightbulb, title: 'Balcony Light', state: 'Off', color: 'default' },
    { id: 'sensor.balcony_temp', icon: mdiThermometer, title: 'Temperature', state: '18°C', color: 'default' },
    { id: 'sensor.balcony_humidity', icon: mdiWaterPercent, title: 'Humidity', state: '60%', color: 'default' },
    { id: 'switch.balcony_plug', icon: mdiPowerPlug, title: 'Power Outlet', state: 'Off', color: 'default' },
  ],
  bathroom: [
    { id: 'light.bathroom_main', icon: mdiLightbulb, title: 'Main Light', state: 'Off', color: 'default' },
    { id: 'switch.bathroom_fan', icon: mdiFan, title: 'Exhaust Fan', state: 'Off', color: 'default' },
    { id: 'sensor.bathroom_temp', icon: mdiThermometer, title: 'Temperature', state: '24°C', color: 'default' },
    { id: 'sensor.bathroom_humidity', icon: mdiWaterPercent, title: 'Humidity', state: '65%', color: 'default' },
    { id: 'sensor.bathroom_motion', icon: mdiMotionSensor, title: 'Motion', state: 'Clear', color: 'default' },
  ],
  hallway: [
    { id: 'light.hallway', icon: mdiLightbulb, title: 'Hallway Light', state: 'Off', color: 'default' },
    { id: 'sensor.hallway_motion', icon: mdiMotionSensor, title: 'Motion', state: 'Clear', color: 'default' },
    { id: 'sensor.front_door', icon: mdiDoorOpen, title: 'Front Door', state: 'Closed', color: 'success' },
    { id: 'switch.hallway_switch', icon: mdiLightSwitch, title: 'Smart Switch', state: 'Off', color: 'default' },
  ],
};

// Mock automations per room
const roomAutomations: Record<string, Array<{ name: string; enabled: boolean; lastTriggered: string }>> = {
  living_room: [
    { name: 'Turn off lights at midnight', enabled: true, lastTriggered: '2h ago' },
    { name: 'Motion-activated ambient', enabled: true, lastTriggered: '15m ago' },
    { name: 'Movie mode on TV start', enabled: false, lastTriggered: '3d ago' },
  ],
  kitchen: [
    { name: 'Morning coffee at 7:00', enabled: true, lastTriggered: '8h ago' },
    { name: 'Lights on at sunset', enabled: true, lastTriggered: '5h ago' },
  ],
  office: [
    { name: 'Work hours climate', enabled: true, lastTriggered: '1h ago' },
    { name: 'Auto lights on motion', enabled: true, lastTriggered: '30m ago' },
    { name: 'Turn off at 6 PM', enabled: true, lastTriggered: '1d ago' },
  ],
  bedroom: [
    { name: 'Wake-up lights at 7:30', enabled: true, lastTriggered: '12h ago' },
    { name: 'Night mode at 10 PM', enabled: true, lastTriggered: '8h ago' },
  ],
  kids_room: [
    { name: 'Night light at bedtime', enabled: true, lastTriggered: '10h ago' },
  ],
  balcony: [
    { name: 'Lights at sunset', enabled: true, lastTriggered: '5h ago' },
  ],
  bathroom: [
    { name: 'Fan on with light', enabled: true, lastTriggered: '3h ago' },
    { name: 'Auto off after 15min', enabled: true, lastTriggered: '3h ago' },
  ],
  hallway: [
    { name: 'Motion-activated lights', enabled: true, lastTriggered: '45m ago' },
  ],
};

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-ha-4 flex-shrink-0">
        <h3 className="text-base font-semibold text-text-primary">Room Info</h3>
        <button
          onClick={onClose}
          className="p-ha-1 rounded-ha-lg hover:bg-surface-low text-text-secondary transition-colors"
        >
          <Icon path={mdiClose} size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-ha-4 pb-ha-4 space-y-ha-4">
        {/* Climate - Basic cards without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Climate</div>
          <div className="grid grid-cols-2 gap-ha-2">
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-20" />
            <div className="bg-surface-low rounded-ha-xl p-ha-3 h-20" />
          </div>
        </div>

        {/* Temperature History - Basic card without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Temperature (24h)</div>
          <div className="bg-surface-low rounded-ha-xl p-ha-3 h-32" />
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

        {/* Energy - Basic card without data */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-ha-2">Energy Today</div>
          <div className="bg-surface-low rounded-ha-xl p-ha-3 h-20" />
        </div>
      </div>
    </div>
  );
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const [infoOpen, setInfoOpen] = useState(false);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const { background } = useTheme();
  const scrollableRef = useRef<HTMLElement | null>(null);

  const room = roomData[id] || { icon: mdiDoorOpen, name: id.replace(/_/g, ' '), temperature: 20, humidity: 45 };
  const entities = roomEntities[id] || [];
  const automations = roomAutomations[id] || [];

  useEffect(() => {
    setHeader({
      title: room.name,
      subtitle: 'Home',
      icon: room.icon,
      primaryAction: {
        icon: infoOpen ? mdiInformation : mdiInformationOutline,
        onClick: () => setInfoOpen(prev => !prev)
      }
    });
  }, [setHeader, room.name, room.icon, infoOpen]);

  // Cmd/Ctrl + I to toggle info panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInfoOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10;
      setShowTopGradient(scrollTop > threshold);
      
      const hasOverflow = scrollHeight > clientHeight + threshold;
      setShowBottomGradient(hasOverflow && scrollTop + clientHeight < scrollHeight - threshold);
    };

    updateGradients();
    scrollElement.addEventListener('scroll', updateGradients);
    window.addEventListener('resize', updateGradients);

    return () => {
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
    };
  }, []);

  const lights = entities.filter(e => e.id.startsWith('light.'));
  const climate = entities.filter(e => e.id.startsWith('climate.') || e.id.startsWith('sensor.'));
  const switches = entities.filter(e => e.id.startsWith('switch.') || e.id.startsWith('media_player.') || e.id.startsWith('vacuum.'));


  return (
    <>
      {/* TopBar row */}


      {/* Pull to reveal (Mobile only) */}
      <PullToRevealPanel />

      {/* Main content row */}
      <div className={`min-h-0 overflow-hidden px-edge pb-0 mt-1 lg:mt-0 lg:pb-ha-0 lg:pr-edge transition-all duration-300 ease-out ${
        isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
      }`}>
        <div className={`h-full flex ${infoOpen ? 'gap-ha-3' : ''}`}>
          {/* Dashboard container */}
            <div className="flex-1 min-w-0 bg-surface-lower overflow-hidden rounded-ha-3xl relative transition-all duration-300 ease-out">
              {/* Top scroll gradient - absolute to container */}
              {showTopGradient && background !== 'image' && background !== 'gradient' && (
                <div className="absolute top-0 left-0 right-0 lg:left-14 lg:right-14 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
              )}
              {/* Bottom scroll gradient - absolute to container */}
              {showBottomGradient && background !== 'image' && background !== 'gradient' && (
                <div className="absolute bottom-0 left-0 right-0 lg:left-14 lg:right-14 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
              )}

            {/* Back arrow in left padding - full height hit area, desktop only */}
            <Link
              href="/"
              className="hidden lg:flex group absolute inset-y-0 left-0 w-14 z-10 items-center justify-center transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-l-ha-3xl bg-gradient-to-r from-transparent to-transparent group-hover:from-ha-blue/[0.06] group-hover:to-transparent transition-all duration-500 delay-0 group-hover:delay-150" />
              <Icon
                path={mdiArrowLeft}
                size={16}
                className="relative opacity-15 group-hover:opacity-100 group-hover:text-ha-blue group-hover:-translate-x-0.5 transition-all duration-500 delay-0 group-hover:delay-150 text-text-primary"
              />
            </Link>
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
            <main 
              ref={(el) => { scrollableRef.current = el; }}
              className="h-full overflow-y-auto overscroll-none touch-pan-y relative px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-14 lg:pt-ha-5 lg:pb-ha-5" 
              data-scrollable="dashboard"
            >
              <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
                {/* Lights */}
                {lights.length > 0 && (
                  <DashboardSection title="Lights" columns={2}>
                    {lights.map((entity) => (
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
                )}

                {/* Climate & Sensors */}
                {climate.length > 0 && (
                  <DashboardSection title="Climate & Sensors" columns={2}>
                    {climate.map((entity) => (
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
                )}

                {/* Devices */}
                {switches.length > 0 && (
                  <DashboardSection title="Devices" columns={2}>
                    {switches.map((entity) => (
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
                )}

                {/* Automations */}
                {automations.length > 0 && (
                  <section className="mb-ha-6">
                    <h2 className="text-lg font-semibold text-text-primary mb-ha-3">Automations</h2>
                    <div className="space-y-ha-2">
                      {automations.map((auto) => (
                        <div key={auto.name} className="flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-default">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${auto.enabled ? 'bg-green-500' : 'bg-text-disabled'}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-text-primary block truncate">{auto.name}</span>
                            <span className="text-xs text-text-secondary">Last: {auto.lastTriggered}</span>
                          </div>
                          <span className={`text-xs px-ha-2 py-0.5 rounded-ha-pill ${auto.enabled ? 'bg-fill-success-normal text-green-600' : 'bg-surface-low text-text-secondary'}`}>
                            {auto.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
              {/* Gradient overlay - bottom */}
            </main>
          </div>

          {/* Info Side Panel - Desktop only, separate rounded container */}
          <div className={`hidden lg:block overflow-hidden transition-[width] duration-300 ease-out flex-shrink-0 ${
            infoOpen ? 'w-80' : 'w-0'
          }`}>
            <div className="w-80 h-full bg-surface-default border border-surface-lower overflow-hidden rounded-ha-3xl lg:pt-ha-5 lg:pb-ha-5">
              <InfoPanel onClose={() => setInfoOpen(false)} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating back arrow - near bottom bar */}
      <Link
        href="/"
        className="lg:hidden fixed bottom-40 left-3 z-40 w-10 h-10 rounded-full bg-surface-default/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-text-tertiary active:scale-90 transition-transform"
      >
        <Icon path={mdiArrowLeft} size={20} />
      </Link>

      {/* Mobile Bottom Sheet */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          infoOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setInfoOpen(false)}
        />
        {/* Sheet */}
        <div className={`absolute bottom-0 left-0 right-0 bg-surface-lower rounded-t-ha-3xl transition-transform duration-300 ease-out ${
          infoOpen ? 'translate-y-0' : 'translate-y-full'
        }`} style={{ maxHeight: '80dvh' }}>
          {/* Drag indicator */}
          <div className="flex justify-center py-ha-2">
            <div className="w-8 h-1 rounded-full bg-text-secondary/40" />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(80dvh - 20px)' }}>
            <InfoPanel onClose={() => setInfoOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
