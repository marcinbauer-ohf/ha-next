'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CHIP_PRESS, TRANSLUCENT_CHIP_FILL } from '../cards/SummaryCard';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector, useHomeAssistantEntities, useEdgeFade } from '@/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import {
  mdiAccountMultiple,
  mdiLightbulbGroup,
  mdiThermometer,
  mdiShieldHome,
  mdiWeatherPartlyCloudy,
  mdiBattery,
  mdiBatteryAlertVariantOutline,
  mdiGestureTap,
  mdiArrowExpandAll,
  mdiChevronLeft,
  mdiChevronRight,
  mdiThemeLightDark,
  mdiClockOutline,
  mdiTuneVariant,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { clsx } from 'clsx';
import { arePeoplePresenceEqual, selectPeoplePresence } from '@/lib/homeassistant/selectors';
import { CONTENT_MAX, CONTENT_GUTTER } from '@/lib/layout';
import { EnergyGlance, AutomationsGlance, SummaryGlance } from '../glances';
import { PeopleDetail } from '../glances/summaryDetails';
import { ModalSheet } from '../layout/ModalSheet';
import { useHomeMode } from '@/lib/homeMode';
import { batteryEntities, batteryLevel, climateSensors, lowBatteryAt, securityEntities, temperatureOf, useSummaryConfig, weatherSource, type SummaryConfig } from '@/lib/summaryConfig';
import type { SummaryScope } from '../glances/summaryScope';
import type { GlanceId, HassEntities } from '@/types';

export function useLiveSummaryItems(areaEntities?: HassEntities) {
  const home = useHomeAssistantEntities();
  const entities = areaEntities ?? home;
  const scoped = areaEntities !== undefined;
  const homeMode = useHomeMode();
  // Connected, and the home really is empty — as opposed to still loading,
  // which shows nothing at all rather than a row of invitations that vanish.

  // Which sensors count is the user's call, made in each chip's dialog — the
  // chip and the dialog have to read the same ones or they'd disagree. An
  // unconfigured home falls back to the sane default (see summaryConfig).
  const stored = useSummaryConfig();
  // Same rule as the dialogs: inside a room, which sensors count as "the home"
  // is beside the point; the threshold is a preference, so it carries over.
  const config = useMemo<SummaryConfig>(
    () => (scoped
      ? { climate: [], humidity: [], security: [], weather: [], battery: [], batteryLow: stored.batteryLow }
      : stored),
    [scoped, stored],
  );
  return useMemo(() => {
    const all = Object.values(entities);

    const lights = all.filter(e => e.entity_id.startsWith('light.'));
    const lightsOn = lights.filter(e => e.state === 'on').length;

    const temps = climateSensors(entities, config).map(temperatureOf).filter(v => !isNaN(v));
    const avgTemp = temps.length > 0
      ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
      : null;

    const locks = securityEntities(entities, config).filter(e => e.entity_id.startsWith('lock.'));
    const locksLocked = locks.filter(e => e.state === 'locked').length;
    const allLocked = locks.length > 0 && locksLocked === locks.length;

    const weather = weatherSource(entities, config);
    const weatherTemp = weather?.attributes.temperature as number | undefined;

    const low = lowBatteryAt(config);
    const batteries = batteryEntities(entities, config).map(batteryLevel).filter(v => !isNaN(v));
    const batteriesLow = batteries.filter(v => v <= low).length;

    const items = [
      // Home mode leads the row when a helper is configured — it's the
      // "state of the whole home" so it reads first. Display-only.
      ...(homeMode && !scoped ? [{
        id: 'mode' as GlanceId,
        // A fixed "mode" glyph, not the per-option icon — the chip's job is to
        // say "this is the home's mode"; the value below it says which one.
        icon: mdiTuneVariant,
        title: 'Mode',
        state: homeMode.current,
        color: 'violet' as const,
      }] : []),
      ...(lights.length > 0 ? [{
        id: 'lights' as GlanceId,
        icon: mdiLightbulbGroup,
        title: 'Lights',
        state: `${lightsOn} on`,
        color: 'yellow' as const,
      }] : []),
      ...(avgTemp ? [{
        id: 'climate' as GlanceId,
        icon: mdiThermometer,
        title: 'Climate',
        // "avg" only when there is something to average — one room with one
        // thermometer just reads the temperature.
        state: temps.length > 1 ? `${avgTemp}°C avg` : `${avgTemp}°C`,
        color: 'primary' as const,
      }] : []),
      ...(locks.length > 0 ? [{
        id: 'security' as GlanceId,
        icon: mdiShieldHome,
        title: 'Security',
        state: allLocked ? 'All locked' : `${locksLocked}/${locks.length} locked`,
        color: (allLocked ? 'success' : 'default') as 'success' | 'default',
      }] : []),
      ...(weather && !scoped ? [{
        id: 'weather' as GlanceId,
        icon: mdiWeatherPartlyCloudy,
        title: 'Weather',
        state: weatherTemp != null ? `${weatherTemp}° ${weather.state}` : weather.state,
        color: 'default' as const,
      }] : []),
      // Batteries only earn a chip in a home that has them, and only shout
      // when one is actually low — otherwise it's the lowest reading, quietly.
      ...(batteries.length > 0 ? [{
        id: 'battery' as GlanceId,
        icon: batteriesLow > 0 ? mdiBatteryAlertVariantOutline : mdiBattery,
        title: 'Batteries',
        state: batteriesLow > 0 ? `${batteriesLow} low` : `${Math.round(Math.min(...batteries))}% lowest`,
        color: (batteriesLow > 0 ? 'yellow' : 'default') as 'yellow' | 'default',
      }] : []),
    ];

    return items;
  }, [entities, homeMode, config, scoped]);
}

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
    title: 'Color Mode',
    description: 'Press ⌘ + Shift + D to cycle between Light, Dark, and System',
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
          Cycle mode
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

export function PeopleBadge({ compact = false, size = 'sm', variant, translucent = false }: { compact?: boolean; size?: 'sm' | 'md' | 'lg'; variant?: 'compact' | 'full'; translucent?: boolean }) {
  const { haUrl } = useHomeAssistant();
  const isLg = size === 'lg';
  const isMd = size === 'md';
  const { peopleHome, peopleAway } = useHomeAssistantSelector(selectPeoplePresence, arePeoplePresenceEqual);
  const resolvedPeopleHome = peopleHome.map((person) => ({
    ...person,
    picture: person.picture ? `${haUrl}${person.picture}` : undefined,
  }));
  const resolvedPeopleAway = peopleAway.map((person) => ({
    ...person,
    picture: person.picture ? `${haUrl}${person.picture}` : undefined,
  }));

  // Use variant if provided, otherwise fallback to compact prop
  const isCompact = variant ? variant === 'compact' : compact;



  // Opens the People dialog, like every other chip in the row.
  const [detailOpen, setDetailOpen] = useState(false);
  const peopleDialog = (
    <ModalSheet open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth={1100} contained>
      {detailOpen && <PeopleDetail onClose={() => setDetailOpen(false)} />}
    </ModalSheet>
  );
  // Over the screensaver, a click that isn't stopped dismisses it.
  const openDetail = (e: React.MouseEvent) => { e.stopPropagation(); setDetailOpen(true); };

  if (isCompact) {
    // Mobile: stacked avatars + count
    return (
      <>
      <button
        type="button"
        onClick={openDetail}
        className={clsx(
        'flex items-center rounded-full whitespace-nowrap flex-shrink-0',
        CHIP_PRESS,
        translucent ? TRANSLUCENT_CHIP_FILL
          : 'bg-surface-default [--ha-hover-grow:var(--ha-color-surface-default)]',
        // sm matches SummaryCard's compact chip: same fixed height and padding.
        isLg ? 'gap-ha-3 px-ha-4 py-ha-3' : isMd ? 'gap-ha-2 px-ha-3 py-2.5' : 'gap-ha-2 px-ha-2 h-10'
      )}>
        <div className={clsx(
          'flex flex-shrink-0',
          isLg ? '-space-x-3' : isMd ? '-space-x-2' : '-space-x-1.5'
        )}>
          {resolvedPeopleHome.length > 0 ? (
            resolvedPeopleHome.slice(0, 4).map((person) => (
              <Avatar
                key={person.id}
                src={person.picture}
                initials={person.initials}
                size={isLg ? 'md' : isMd ? 'sm' : 'xs'}
                className={clsx(
                  'ring-2 ring-surface-low flex-shrink-0 bg-surface-default',
                  isLg ? 'w-10 h-10' : isMd ? 'w-8 h-8' : 'w-6 h-6'
                )}
              />
            ))
          ) : (
            <div className={clsx(
              'rounded-full bg-surface-mid flex items-center justify-center flex-shrink-0',
              isLg ? 'w-10 h-10' : isMd ? 'w-8 h-8' : 'w-6 h-6'
            )}>
              <span className={clsx('text-ha-blue font-bold leading-none', isLg ? 'text-lg' : isMd ? 'text-base' : 'text-xs')}>?</span>
            </div>
          )}
        </div>
        <div className={clsx(
          'flex flex-col items-start leading-tight flex-shrink-0',
          isLg ? 'pr-ha-3' : isMd ? 'pr-ha-2' : 'pr-ha-1'
        )}>
          <span className={clsx(
            translucent ? 'text-white/70' : 'text-text-secondary',
            isLg ? 'text-sm' : isMd ? 'text-xs' : 'text-[11px]'
          )}>
            People
          </span>
          <span className={clsx(
            'font-mono font-medium text-left',
            translucent ? 'text-white' : 'text-text-primary',
            isLg ? 'text-xl' : isMd ? 'text-base' : 'text-[13px]'
          )}>
            {resolvedPeopleHome.length} home
          </span>
        </div>
      </button>
      {peopleDialog}
      </>
    );
  }

  // Desktop: icon + text on left, avatars on right (home | away)
  return (
    <>
    <button
      type="button"
      onClick={openDetail}
      className={`flex w-full items-center gap-ha-3 p-ha-3 rounded-ha-xl bg-surface-default border border-surface-lower [--ha-hover-grow:var(--ha-color-surface-default)] [--ha-hover-grow-edge:var(--ha-color-surface-lower)] text-left ${CHIP_PRESS}`}
    >
      <div className="flex-shrink-0 text-ha-blue">
        <Icon path={mdiAccountMultiple} size={24} />
      </div>
      <div className="flex flex-col items-start min-w-0 flex-1">
        <span className="text-sm font-medium text-text-primary text-left">People</span>
        <span className="text-xs text-text-secondary text-left">{resolvedPeopleHome.length} home</span>
      </div>
      <div className="flex items-center gap-ha-2 flex-shrink-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* Home People */}
          <motion.div key="home-group" layout className="flex -space-x-2">
            {resolvedPeopleHome.map((person) => (
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
          {resolvedPeopleHome.length > 0 && resolvedPeopleAway.length > 0 && (
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
            {resolvedPeopleAway.map((person) => (
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
    </button>
    {peopleDialog}
    </>
  );
}

/**
 * The summary row above one room's devices. Same chips as the dashboard, every
 * reading scoped to this area — and the dialogs behind them scoped too, so
 * "Lights" opens this room's lights rather than the whole house's.
 *
 * Unlike the dashboard row this shows on phones as well: there is no Home Center
 * copy of a single room's summary to fall back to. It renders nothing when the
 * room has nothing worth summarising.
 */
export function AreaSummaryRow({ entities, areaName }: { entities: HassEntities; areaName: string }) {
  const items = useLiveSummaryItems(entities);
  const { ref, onScroll, style } = useEdgeFade();
  const scope = useMemo<SummaryScope>(() => ({ entities, areaName }), [entities, areaName]);

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      style={style}
      className="mb-ha-4 -mx-ha-1 overflow-x-auto overscroll-x-contain scrollbar-hide px-ha-1 lg:overflow-visible"
    >
      <div className="flex w-max items-center gap-ha-2 lg:w-full lg:flex-wrap">
        {items.map((item) => (
          <SummaryGlance key={item.title} item={item} scope={scope} compact />
        ))}
      </div>
    </div>
  );
}

interface MobileSummaryRowProps {
  fullBleed?: boolean;
  /** Disable sticky pinning of the filters block (e.g. 3D view) */
  noSticky?: boolean;
  /** Extra content rendered below the chips row (e.g. floor tabs) — stays pinned while the chips scroll away */
  extraContent?: React.ReactNode;
  /** Ref to the sticky filters block, for measuring its height (--dashboard-sticky-top) */
  extraRef?: React.Ref<HTMLDivElement>;
  /**
   * Editing a below-lg viewport (phone / tablet portrait) on a desktop window:
   * lg: utilities still fire off the real window width, so drop the desktop-only
   * horizontal gutters and keep the mobile ones — otherwise the chips sit inset
   * ~32px past the dashboard cards inside the preview frame.
   */
  narrowPreview?: boolean;
  /**
   * Fires when the chips are pinned over the scrolled content (revealed by a
   * drag up, past the top). The page's own top scroll-fade paints above this
   * row — it lives outside the scroller's stacking context — so the page hides
   * that fade while the chips are up; they carry their own fade instead.
   */
  onOverlayChange?: (overlaying: boolean) => void;
}

export function MobileSummaryRow({ fullBleed = false, noSticky = false, extraContent, extraRef, narrowPreview = false, onOverlayChange }: MobileSummaryRowProps) {
  const liveSummaryItems = useLiveSummaryItems();
  const { ref: chipsScrollRef, onScroll: onChipsScroll, style: chipsFadeStyle } = useEdgeFade();

  // Chips scroll away, but a small upward drag brings them back from anywhere in
  // the page — same reflex as the bottom nav's auto-hide. Sticky + translate, so
  // the flow (and the natural position at scroll-top) is unchanged.
  const chipsRef = useRef<HTMLDivElement | null>(null);
  // 'top' = sitting in its natural place, 'shown' = pinned over the content,
  // 'hidden' = tucked above the fold.
  const [chipsMode, setChipsMode] = useState<'top' | 'shown' | 'hidden'>('top');
  useEffect(() => {
    if (noSticky) return;
    const scroller = chipsRef.current?.closest<HTMLElement>('[data-scrollable]');
    if (!scroller) return;
    let last = scroller.scrollTop;
    let travel = 0;
    const onScroll = () => {
      const top = scroller.scrollTop;
      const delta = top - last;
      last = top;
      if (top <= 8) {
        travel = 0;
        setChipsMode('top');
        return;
      }
      // Accumulate per direction so a jittery finger doesn't flip the row.
      // Same thresholds as the bottom nav's auto-hide (see MobileNav), so the
      // two edges of the screen tuck away and come back on the same gesture.
      travel = (travel > 0) === (delta > 0) ? travel + delta : delta;
      if (travel <= -16) setChipsMode('shown');
      else if (travel >= 24) setChipsMode('hidden');
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [noSticky]);
  useEffect(() => {
    onOverlayChange?.(!noSticky && chipsMode === 'shown');
  }, [chipsMode, noSticky, onOverlayChange]);
  useEffect(() => () => onOverlayChange?.(false), [onOverlayChange]);

  // Split in half rather than alternated, so the DOM order is the reading order
  // in both layouts: left-to-right along the top row, then the bottom one — and
  // unchanged when the rows dissolve into a single wrapping row on desktop.
  const chips = [
    <PeopleBadge key="people" compact />,
    <EnergyGlance key="energy" compact />,
    <AutomationsGlance key="automations" compact />,
    ...liveSummaryItems.map((item) => <SummaryGlance key={item.title} item={item} compact />),
  ];
  const chipRows = [chips.slice(0, Math.ceil(chips.length / 2)), chips.slice(Math.ceil(chips.length / 2))];

  // Solid so revealed chips cover the cards scrolling under them; at scroll-top
  // it's the same colour as the surface behind, so invisible. The fade lives
  // below the row instead (see the under-fade element) — a gradient inside the
  // row let cards show through the chips.
  const summaryBackground = 'var(--ha-color-surface-lower)';
  const containerStyle = fullBleed
    ? {
        background: summaryBackground,
        width: '100vw',
        maxWidth: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
        paddingLeft: 'calc(var(--ha-space-4) + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(var(--ha-space-4) + env(safe-area-inset-right, 0px))',
      }
    : { background: summaryBackground };

  return (
    <>
    {/* Chips — scroll out of view with the page content, back on a drag up */}
    <div
      ref={chipsRef}
      data-section-key="__summaries__"
      className={clsx(
        'pt-ha-3 pb-0 w-full relative',
        // Desktop-only: on a phone the same chips live in the Home Center, so
        // the dashboard opens on the devices instead of a two-row chip block.
        'hidden lg:block',
        !narrowPreview && 'lg:mx-0 lg:px-0',
        fullBleed ? '' : '-mx-ha-1 px-ha-1',
        // top-0, not --app-topbar-clear: the scroller's own pt-[--app-topbar-clear]
        // already clears the top bar, and sticky offsets measure from its content
        // box — adding the bar's height again left a bar-sized gap at scroll-top.
        !noSticky && 'sticky top-0 z-[55] transition-[transform,opacity] duration-300 ease-out',
        !noSticky && chipsMode === 'hidden' && 'opacity-0 pointer-events-none -translate-y-[130%]'
      )}
      style={containerStyle}
    >
      <div className={clsx(CONTENT_MAX, !narrowPreview && CONTENT_GUTTER)}>
        {/* Two rows deep at most, scrolling sideways past that — a wrapping row
            grew to four lines on a phone and ate the fold. The rows pack
            independently, so chips stagger instead of lining up in columns.
            Desktop dissolves both rows (lg:contents) back into one wrapping
            row in the original order — the whole set fits on a line there. */}
        <div
          ref={chipsScrollRef}
          onScroll={onChipsScroll}
          style={chipsFadeStyle}
          className="overflow-x-auto overscroll-x-contain scrollbar-hide lg:overflow-visible"
        >
          <div className="flex flex-col gap-ha-2 w-max p-1 lg:flex-row lg:flex-wrap lg:items-center lg:w-full">
            {chipRows.map((row, i) => (
              <div key={i} className="flex items-center gap-ha-2 lg:contents">{row}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Under-fade — while the row is pinned over scrolled content it stands in
          for the page's top scroll fade (which the page hides), so it needs the
          same depth as that one, not a hairline. */}
      {!noSticky && (
        <div
          aria-hidden
          className={clsx(
            'pointer-events-none absolute left-0 right-0 top-full h-16 transition-opacity duration-300 ease-out',
            chipsMode === 'shown' ? 'opacity-100' : 'opacity-0',
          )}
          style={{ background: 'linear-gradient(to bottom, var(--ha-color-surface-lower) 0%, color-mix(in srgb, var(--ha-color-surface-lower) 60%, transparent) 45%, transparent 100%)' }}
        />
      )}
    </div>

    {/* Filters (floor tabs / grouping) — pinned while content scrolls under */}
    {extraContent && (
      <div
        ref={extraRef}
        className={clsx(
          !noSticky && 'sticky top-0 z-[60]',
          'pt-ha-1 pb-ha-2 w-full',
          !narrowPreview && 'lg:mx-0 lg:px-0',
          fullBleed ? '' : '-mx-ha-1 px-ha-1'
        )}
        style={containerStyle}
      >
        <div className={clsx(CONTENT_MAX, !narrowPreview && CONTENT_GUTTER)}>
          {extraContent}
        </div>
      </div>
    )}
    </>
  );
}

interface SummariesPanelProps {
  onToggleImmersive?: () => void;
  onToggleDarkMode?: () => void;
  onToggleScreensaver?: () => void;
}

export function SummariesPanel({ onToggleImmersive, onToggleDarkMode, onToggleScreensaver }: SummariesPanelProps) {
  const liveSummaryItems = useLiveSummaryItems();
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
        <EnergyGlance variant={isCompact ? 'filled' : 'outlined'} compact={isCompact} />
        <AutomationsGlance variant={isCompact ? 'filled' : 'outlined'} compact={isCompact} />
        {liveSummaryItems.map((item) => (
          <SummaryGlance
            key={item.title}
            item={item}
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
