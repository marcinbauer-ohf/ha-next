'use client';

import { useMemo, useState, useEffect } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant } from '@/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import {
  mdiAccountMultiple,
  mdiLightbulbGroup,
  mdiThermometer,
  mdiShieldHome,
  mdiWeatherPartlyCloudy,
  mdiGestureTap,
  mdiArrowExpandAll,
  mdiChevronLeft,
  mdiChevronRight,
  mdiThemeLightDark,
  mdiClockOutline,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { clsx } from 'clsx';

export const summaryItems = [
  { icon: mdiLightbulbGroup, title: 'Lights', state: '3 on', color: 'yellow' as const },
  { icon: mdiThermometer, title: 'Climate', state: '22°C avg', color: 'primary' as const },
  { icon: mdiShieldHome, title: 'Security', state: 'Armed', color: 'success' as const },
  { icon: mdiWeatherPartlyCloudy, title: 'Weather', state: '18°C Cloudy', color: 'default' as const },
];

const tips = [
  {
    id: 'immersive',
    icon: mdiArrowExpandAll,
    title: 'Immersive Mode',
    description: 'Press ⌘ + \\ to toggle immersive view',
  },
  {
    id: 'darkmode',
    icon: mdiThemeLightDark,
    title: 'Dark Mode',
    description: 'Press ⌘ + Shift + D to toggle dark mode',
  },
  {
    id: 'screensaver',
    icon: mdiClockOutline,
    title: 'Screensaver',
    description: 'Press ⌘ + Shift + S to toggle, or wait 1 minute of inactivity',
  },
  {
    id: 'pull',
    icon: mdiGestureTap,
    title: 'Pull to Reveal',
    description: 'Pull down on the dashboard to reveal quick actions',
  },
];

interface TipsCardProps {
  onToggleImmersive?: () => void;
  onToggleDarkMode?: () => void;
  onToggleScreensaver?: () => void;
}

function TipsCard({ onToggleImmersive, onToggleDarkMode, onToggleScreensaver }: TipsCardProps) {
  const [currentTip, setCurrentTip] = useState(0);

  const tip = tips[currentTip];

  const goToPrev = () => setCurrentTip((prev) => (prev - 1 + tips.length) % tips.length);
  const goToNext = () => setCurrentTip((prev) => (prev + 1) % tips.length);

  const getActionButton = () => {
    if (tip.id === 'immersive' && onToggleImmersive) {
      return (
        <button onClick={onToggleImmersive} className="text-ha-blue font-medium hover:underline">
          Try it now
        </button>
      );
    }
    if (tip.id === 'darkmode' && onToggleDarkMode) {
      return (
        <button onClick={onToggleDarkMode} className="text-ha-blue font-medium hover:underline">
          Try it now
        </button>
      );
    }
    if (tip.id === 'screensaver' && onToggleScreensaver) {
      return (
        <button onClick={onToggleScreensaver} className="text-ha-blue font-medium hover:underline">
          Try it now
        </button>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-ha-2 p-ha-3 rounded-ha-xl bg-surface-default border border-surface-lower">
      <div className="flex items-center gap-ha-2">
        <div className="w-8 h-8 rounded-full bg-fill-primary-normal flex items-center justify-center flex-shrink-0">
          <Icon path={tip.icon} size={18} className="text-ha-blue" />
        </div>
        <span className="text-sm font-medium text-text-primary flex-1">{tip.title}</span>
        <div className="flex items-center gap-ha-1">
          <button
            onClick={goToPrev}
            className="w-6 h-6 rounded-full bg-surface-lower flex items-center justify-center text-text-secondary hover:bg-surface-default transition-colors"
          >
            <Icon path={mdiChevronLeft} size={16} />
          </button>
          <button
            onClick={goToNext}
            className="w-6 h-6 rounded-full bg-surface-lower flex items-center justify-center text-text-secondary hover:bg-surface-default transition-colors"
          >
            <Icon path={mdiChevronRight} size={16} />
          </button>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {tip.description}
        {getActionButton() && <> {getActionButton()}</>}
      </p>
      <div className="flex gap-ha-1 mt-ha-1">
        {tips.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentTip(index)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              index === currentTip ? 'bg-ha-blue' : 'bg-surface-lower'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function PeopleBadge({ compact = false, size = 'sm', variant }: { compact?: boolean; size?: 'sm' | 'md' | 'lg'; variant?: 'compact' | 'full' }) {
  const { entities, haUrl } = useHomeAssistant();
  const isLg = size === 'lg';
  const isMd = size === 'md';

  const { peopleHome, peopleAway } = useMemo(() => {
    const allPeople = Object.entries(entities)
      .filter(([entityId]) => entityId.startsWith('person.'))
      .map(([entityId, entity]) => ({
        id: entityId,
        name: entity.attributes.friendly_name as string || 'User',
        state: entity.state,
        picture: entity.attributes.entity_picture
          ? `${haUrl}${entity.attributes.entity_picture}`
          : undefined,
        initials: ((entity.attributes.friendly_name as string) || 'U')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      }));

    return {
      peopleHome: allPeople.filter(p => p.state === 'home'),
      peopleAway: allPeople.filter(p => p.state !== 'home'),
    };
  }, [entities, haUrl]);

  // Use variant if provided, otherwise fallback to compact prop
  const isCompact = variant ? variant === 'compact' : compact;

  if (isCompact) {
    // Mobile: stacked avatars + count
    return (
      <div className={clsx(
        'flex items-center rounded-ha-pill whitespace-nowrap bg-fill-primary-quiet flex-shrink-0 transition-all',
        isLg ? 'gap-ha-3 px-ha-4 py-ha-3' : isMd ? 'gap-ha-2 px-ha-3 py-ha-2.5' : 'gap-ha-2 px-ha-2 py-ha-1'
      )}>
        <div className={clsx(
          'flex flex-shrink-0',
          isLg ? '-space-x-3' : isMd ? '-space-x-2' : '-space-x-1.5'
        )}>
          {peopleHome.length > 0 ? (
            peopleHome.slice(0, 4).map((person) => (
              <Avatar
                key={person.id}
                src={person.picture}
                initials={person.initials}
                size={isLg ? 'md' : isMd ? 'sm' : 'xs'}
                className={clsx(
                  'ring-2 ring-fill-primary-quiet flex-shrink-0 bg-surface-default',
                  isLg ? 'w-10 h-10' : isMd ? 'w-8 h-8' : 'w-7 h-7'
                )}
              />
            ))
          ) : (
            <div className={clsx(
              'rounded-full bg-fill-primary-normal flex items-center justify-center flex-shrink-0',
              isLg ? 'w-10 h-10' : isMd ? 'w-8 h-8' : 'w-7 h-7'
            )}>
              <span className={clsx('text-ha-blue font-bold leading-none', isLg ? 'text-lg' : isMd ? 'text-base' : 'text-xs')}>?</span>
            </div>
          )}
        </div>
        <span className={clsx(
          'font-medium text-text-primary text-left flex-shrink-0',
          isLg ? 'text-xl pr-ha-3' : isMd ? 'text-base pr-ha-2' : 'text-sm pr-ha-1'
        )}>
          {peopleHome.length} home
        </span>
      </div>
    );
  }

  // Desktop: icon + text on left, avatars on right (home | away)
  return (
    <div className="flex items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-default border border-surface-lower">
      <div className="flex-shrink-0 text-ha-blue">
        <Icon path={mdiAccountMultiple} size={24} />
      </div>
      <div className="flex flex-col items-start min-w-0 flex-1">
        <span className="text-sm font-medium text-text-primary text-left">People</span>
        <span className="text-xs text-text-secondary text-left">{peopleHome.length} home</span>
      </div>
      <div className="flex items-center gap-ha-2 flex-shrink-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* Home People */}
          <motion.div key="home-group" layout className="flex -space-x-2">
            {peopleHome.map((person) => (
              <motion.div
                key={person.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="relative z-10"
              >
                <Avatar
                  src={person.picture}
                  initials={person.initials}
                  size="sm"
                  className="ring-2 ring-surface-default bg-surface-default"
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Separator */}
          {peopleHome.length > 0 && peopleAway.length > 0 && (
            <motion.div
              key="separator"
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="px-1"
            >
              <div className="w-px h-6 bg-surface-lower" />
            </motion.div>
          )}

          {/* Away People */}
          <motion.div key="away-group" layout className="flex -space-x-2">
            {peopleAway.map((person) => (
              <motion.div
                key={person.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="relative opacity-40 grayscale-[0.5]"
              >
                <Avatar
                  src={person.picture}
                  initials={person.initials}
                  size="sm"
                  className="ring-2 ring-surface-default bg-surface-default"
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function MobileSummaryRow() {
  return (
    <div
      className="lg:hidden sticky top-0 -mx-ha-4 px-ha-4 pt-ha-4 pb-ha-3 z-10 backdrop-blur-md"
      style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--ha-color-surface-lower) 60%, transparent), transparent)' }}
    >
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-ha-2">
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
      </div>
    </div>
  );
}

interface SummariesPanelProps {
  onToggleImmersive?: () => void;
  onToggleDarkMode?: () => void;
  onToggleScreensaver?: () => void;
}

export function SummariesPanel({ onToggleImmersive, onToggleDarkMode, onToggleScreensaver }: SummariesPanelProps) {
  const [isCompact, setIsCompact] = useState(false);

  // Check window width to clear up space on smaller desktop screens
  useEffect(() => {
    const checkWidth = () => {
      // If width < 1280px (xl breakpoint), switch to compact mode
      setIsCompact(window.innerWidth < 1280);
    };
    
    // Check initially
    checkWidth();

    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <aside className={clsx(
      "hidden lg:block bg-surface-default rounded-ha-2xl h-fit transition-all duration-300",
      isCompact ? "w-[260px] p-ha-4" : "w-80 xl:w-96 p-ha-5"
    )}>
      <h2 className="text-lg font-semibold text-text-primary mb-ha-4">Summary</h2>
      <div className="space-y-ha-3">
        <PeopleBadge variant={isCompact ? 'compact' : 'full'} />
        {summaryItems.map((item) => (
          <SummaryCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            state={item.state}
            color={item.color}
            variant={isCompact ? 'filled' : 'outlined'}
            compact={isCompact}
          />
        ))}
        {!isCompact && (
          <div className="pt-ha-2">
            <TipsCard onToggleImmersive={onToggleImmersive} onToggleDarkMode={onToggleDarkMode} onToggleScreensaver={onToggleScreensaver} />
          </div>
        )}
      </div>
    </aside>
  );
}
