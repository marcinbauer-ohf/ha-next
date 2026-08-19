'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  mdiLightbulb,
  mdiFan,
  mdiLock,
  mdiSpeaker,
  mdiThermostat,
  mdiGauge,
  mdiAccount,
  mdiCctv,
  mdiMotionSensor,
  mdiWindowShutter,
  mdiToggleSwitch,
  mdiPowerPlug,
  mdiPower,
  mdiClose,
} from '@mdi/js';
import type { HassEntity } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { useHomeAssistantEntities } from '@/hooks/useHomeAssistant';
import { useEnergyMetrics } from '@/hooks/useEnergyMetrics';
import { useEdgeFade } from '@/hooks/useEdgeFade';
import {
  SPIN_CATEGORY_MAP,
  activeEntities,
  bulkTargets,
  friendlyState,
  entityName,
  isTogglable,
  type CategoryDevice,
  type SpinCategoryId,
} from './spinCategories';

const DOMAIN_ICONS: Record<string, string> = {
  light: mdiLightbulb,
  fan: mdiFan,
  lock: mdiLock,
  media_player: mdiSpeaker,
  climate: mdiThermostat,
  sensor: mdiGauge,
  person: mdiAccount,
  camera: mdiCctv,
  binary_sensor: mdiMotionSensor,
  cover: mdiWindowShutter,
  switch: mdiToggleSwitch,
};

export function domainIcon(entity: HassEntity): string {
  return DOMAIN_ICONS[entity.entity_id.split('.')[0]] ?? mdiPowerPlug;
}

interface SummaryValue {
  id: SpinCategoryId;
  value: string;
  detail: string;
  live: boolean;
  /** Friendly names of what's currently active — the glance that saves a tap. */
  names: string[];
  /** Entity ids the category's bulk action would hit right now. */
  targets: string[];
}

function useCategorySummaries(): SummaryValue[] {
  const entities = useHomeAssistantEntities();
  const energy = useEnergyMetrics();
  return useMemo(() => {
    const all = Object.values(entities);
    const byDomain = (d: string) => all.filter((e) => e.entity_id.startsWith(`${d}.`));

    const lights = byDomain('light');
    const lightsOn = lights.filter((e) => e.state === 'on').length;

    const temps = all.filter(
      (e) => e.entity_id.startsWith('sensor.') && e.attributes.device_class === 'temperature' && !Number.isNaN(parseFloat(e.state)),
    );
    const climates = byDomain('climate');
    const tempValues = [
      ...temps.map((e) => parseFloat(e.state)),
      ...climates.map((e) => e.attributes.current_temperature as number).filter((v) => typeof v === 'number'),
    ];
    const avgTemp = tempValues.length ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

    const people = byDomain('person');
    const home = people.filter((e) => e.state === 'home');

    const locks = byDomain('lock');
    const locked = locks.filter((e) => e.state === 'locked').length;
    const openings = all.filter(
      (e) =>
        e.entity_id.startsWith('binary_sensor.') &&
        ['door', 'window', 'garage_door', 'opening'].includes((e.attributes.device_class as string) ?? '') &&
        e.state === 'on',
    ).length;

    const fans = byDomain('fan');
    const fansOn = fans.filter((e) => e.state === 'on').length;

    const players = byDomain('media_player');
    const playing = players.filter((e) => e.state === 'playing').length;

    const watts = energy.watts;

    const covers = byDomain('cover');
    const coversOpen = covers.filter((e) => e.state === 'open' || Number(e.attributes.current_position ?? 0) > 0);

    const batteries = all.filter(
      (e) =>
        (e.entity_id.startsWith('sensor.') || e.entity_id.startsWith('binary_sensor.')) &&
        e.attributes.device_class === 'battery',
    );
    const batteryLow = batteries.filter((e) =>
      e.entity_id.startsWith('binary_sensor.') ? e.state === 'on' : parseFloat(e.state) < 20,
    );
    const lowest = batteries
      .filter((e) => e.entity_id.startsWith('sensor.') && !Number.isNaN(parseFloat(e.state)))
      .sort((a, b) => parseFloat(a.state) - parseFloat(b.state))[0];

    const weather = byDomain('weather')[0];
    const automations = byDomain('automation');
    const automationsOff = automations.filter((e) => e.state === 'off');

    const base = [
      {
        id: 'power' as const,
        value: watts != null ? (watts >= 1000 ? `${(watts / 1000).toFixed(1)} kW` : `${Math.round(watts)} W`) : '—',
        detail: energy.kwhToday != null ? `${energy.kwhToday.toFixed(1)} kWh today` : 'Live usage',
        live: watts != null && watts > 0,
      },
      {
        id: 'presence' as const,
        value: `${home.length} home`,
        detail: home.length ? home.map((p) => entityName(p)).slice(0, 3).join(', ') : `${people.length - home.length} away`,
        live: home.length > 0,
      },
      {
        id: 'lights' as const,
        value: `${lightsOn} on`,
        detail: `${lights.length} lights`,
        live: lightsOn > 0,
      },
      {
        id: 'climate' as const,
        value: avgTemp != null ? `${avgTemp.toFixed(1)}°` : '—',
        detail: climates.length ? `${climates.filter((c) => c.state !== 'off').length} active` : 'Around the home',
        live: climates.some((c) => c.state !== 'off' && c.state !== 'unavailable'),
      },
      {
        id: 'security' as const,
        value: locks.length ? (locked === locks.length ? 'Secure' : `${locked}/${locks.length} locked`) : openings ? `${openings} open` : 'Secure',
        detail: openings ? `${openings} open` : 'Doors & locks',
        live: locked !== locks.length || openings > 0,
      },
      {
        id: 'fans' as const,
        value: `${fansOn} on`,
        detail: `${fans.length} fans`,
        live: fansOn > 0,
      },
      {
        id: 'media' as const,
        value: playing ? `${playing} playing` : 'Idle',
        detail: `${players.length} players`,
        live: playing > 0,
      },
      {
        id: 'covers' as const,
        value: coversOpen.length ? `${coversOpen.length} open` : 'All closed',
        detail: `${covers.length} blinds & covers`,
        live: coversOpen.length > 0,
      },
      {
        id: 'batteries' as const,
        value: batteryLow.length ? `${batteryLow.length} low` : 'All good',
        detail: lowest
          ? `Lowest ${entityName(lowest)} · ${Math.round(parseFloat(lowest.state))}%`
          : `${batteries.length} tracked`,
        live: batteryLow.length > 0,
      },
      {
        id: 'weather' as const,
        value:
          weather?.attributes.temperature != null
            ? `${Math.round(weather.attributes.temperature as number)}°`
            : '—',
        detail: weather
          ? String(weather.state)
              .replace('partlycloudy', 'partly cloudy')
              .replaceAll('-', ' ')
              .replace(/^./, (c) => c.toUpperCase())
          : 'No forecast',
        live: false,
      },
      {
        id: 'automations' as const,
        value: automationsOff.length ? `${automationsOff.length} paused` : `${automations.length} on`,
        detail: automationsOff.length ? `${automations.length - automationsOff.length} running` : 'All running',
        live: automationsOff.length > 0,
      },
    ];

    return base
      .filter((s) => {
        // Hide categories the home simply doesn't have.
        if (s.id === 'fans') return fans.length > 0;
        if (s.id === 'media') return players.length > 0;
        if (s.id === 'covers') return covers.length > 0;
        if (s.id === 'batteries') return batteries.length > 0;
        if (s.id === 'weather') return weather != null;
        if (s.id === 'automations') return automations.length > 0;
        if (s.id === 'power') return energy.watts != null || energy.powerSensors.length > 0;
        return true;
      })
      .map((s) => {
        const cat = SPIN_CATEGORY_MAP.get(s.id)!;
        return {
          ...s,
          names: activeEntities(all, cat).map(entityName),
          targets: cat.bulk ? bulkTargets(all, cat) : [],
        };
      });
  }, [entities, energy]);
}

interface SpinWidgetsProps {
  onFocus: (id: SpinCategoryId) => void;
}

/**
 * The home glance: one widget per category, each carrying enough state that most
 * checks end here. Horizontal strip on phones, full grid from `sm` up — the whole
 * set is fixed-length, so the grid never needs to scroll.
 */
export function SpinWidgets({ onFocus }: SpinWidgetsProps) {
  const ha = useHomeAssistant();
  const summaries = useCategorySummaries();
  const { ref: fadeRef, onScroll: onFadeScroll, style: fadeStyle } = useEdgeFade();

  // The bottom padding clears the floating prompt chip (it sits 112px up).
  return (
    <div className="relative z-10 shrink-0 pb-[72px]">
      <div
        ref={fadeRef}
        onScroll={onFadeScroll}
        style={fadeStyle}
        className="flex gap-3 overflow-x-auto px-6 py-2 sm:grid sm:grid-cols-4 sm:overflow-x-visible sm:px-10 lg:grid-cols-5 2xl:grid-cols-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {summaries.map((s, i) => {
          const cat = SPIN_CATEGORY_MAP.get(s.id)!;
          const glance = s.names.slice(0, 2).join(', ');
          const more = s.names.length - 2;
          return (
            <motion.div
              key={s.id}
              className="relative w-[168px] shrink-0 sm:w-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              whileHover={{ y: -4 }}
            >
              <button
                type="button"
                onClick={() => onFocus(s.id)}
                className="flex h-full w-full flex-col justify-between gap-3 rounded-3xl border border-white/12 bg-white/[0.07] p-4 text-left backdrop-blur-xl transition-colors hover:bg-white/[0.13] active:scale-[0.98]"
                style={{ minHeight: 136 }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    background: s.live ? `${cat.accent}2b` : 'rgba(255,255,255,0.08)',
                    boxShadow: s.live ? `0 0 24px ${cat.accent}33` : 'none',
                    color: s.live ? cat.accent : 'rgba(255,255,255,0.7)',
                  }}
                >
                  <Icon path={cat.icon} size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[22px] font-semibold leading-tight text-white">{s.value}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-white/50">{s.detail}</span>
                  <span className="mt-1 block text-[13px] font-medium text-white/75">{cat.label}</span>
                  {glance && (
                    <span className="mt-1.5 block truncate text-[11px]" style={{ color: `${cat.accent}cc` }}>
                      {glance}
                      {more > 0 && ` +${more}`}
                    </span>
                  )}
                </span>
              </button>

              {cat.bulk && s.targets.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    ha.callService({
                      domain: cat.bulk!.domain,
                      service: cat.bulk!.service,
                      target: { entity_id: s.targets },
                    })
                  }
                  className="absolute right-3 top-3 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md transition-colors hover:bg-white/25"
                >
                  {cat.bulk.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Device modal ---------------- */

export function SpinDeviceModal({ item, onClose }: { item: CategoryDevice; onClose: () => void }) {
  const ha = useHomeAssistant();
  const [leadId, setLeadId] = useState(item.lead.entity_id);
  const entities = useHomeAssistantEntities();

  const allEntities = item.device.entities
    .map((e) => entities[e.entity_id] ?? e)
    .filter((e) => e.state !== 'unavailable' || e.entity_id === leadId);
  const lead = allEntities.find((e) => e.entity_id === leadId) ?? allEntities[0];
  const others = allEntities.filter((e) => e.entity_id !== lead.entity_id).slice(0, 8);

  const leadActive = lead.state === 'on' || lead.state === 'playing' || lead.state === 'unlocked';
  const isLight = lead.entity_id.startsWith('light.');
  const brightness = isLight && lead.state === 'on' ? Math.round((((lead.attributes.brightness as number) ?? 255) / 255) * 100) : null;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/12 bg-[#0a1120]/85 p-6 shadow-2xl backdrop-blur-2xl"
        initial={{ opacity: 0, y: 42, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 42, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{item.device.name}</h2>
            <p className="text-[13px] text-white/50">{entityName(lead)} · {friendlyState(lead)}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <Icon path={mdiClose} size={18} className="fill-white" />
          </button>
        </div>

        {/* Lead control */}
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ background: leadActive ? 'rgba(24,188,242,0.22)' : 'rgba(255,255,255,0.08)', color: leadActive ? '#18bcf2' : 'rgba(255,255,255,0.7)' }}
              >
                <Icon path={domainIcon(lead)} size={24} />
              </span>
              <div>
                <span className="block text-[15px] font-medium text-white/90">{entityName(lead)}</span>
                <span className="block text-[12px] text-white/50">{friendlyState(lead)}</span>
              </div>
            </div>
            {isTogglable(lead) && (
              <button
                type="button"
                aria-label={leadActive ? 'Turn off' : 'Turn on'}
                onClick={() => ha.toggleEntity(lead.entity_id, lead.state)}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-colors"
                style={{ background: leadActive ? '#18bcf2' : 'rgba(255,255,255,0.12)' }}
              >
                <Icon path={mdiPower} size={20} className="fill-white" />
              </button>
            )}
          </div>
          {brightness != null && (
            <input
              type="range"
              min={1}
              max={100}
              defaultValue={brightness}
              aria-label="Brightness"
              className="mt-4 w-full accent-[#18bcf2]"
              onPointerUp={(e) =>
                ha.callService({
                  domain: 'light',
                  service: 'turn_on',
                  serviceData: { brightness_pct: Number((e.target as HTMLInputElement).value) },
                  target: { entity_id: lead.entity_id },
                })
              }
            />
          )}
        </div>

        {/* Other entities of this device */}
        {others.length > 0 && (
          <div className="space-y-1">
            {others.map((e) => (
              <button
                key={e.entity_id}
                type="button"
                onClick={() => setLeadId(e.entity_id)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]"
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon path={domainIcon(e)} size={18} className="shrink-0 fill-white/50" exact />
                  <span className="truncate text-[14px] text-white/80">{entityName(e)}</span>
                </span>
                <span className="shrink-0 text-[13px] text-white/50">{friendlyState(e)}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
