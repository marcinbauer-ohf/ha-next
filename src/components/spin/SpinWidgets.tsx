'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import type { HassDevice } from '@/hooks/useDevices';
import {
  SPIN_CATEGORIES,
  devicesForCategory,
  friendlyState,
  entityName,
  isTogglable,
  type CategoryDevice,
  type SpinCategory,
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

function domainIcon(entity: HassEntity): string {
  return DOMAIN_ICONS[entity.entity_id.split('.')[0]] ?? mdiPowerPlug;
}

/** Scroll-edge gradient fade, per the app-wide scrollable-list pattern. */
function useEdgeFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: true });
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 8, right: el.scrollLeft < max - 8 });
  }, []);
  const mask = useMemo(() => {
    const from = edges.left ? 'transparent 0, black 48px' : 'black 0';
    const to = edges.right ? 'black calc(100% - 48px), transparent 100%' : 'black 100%';
    return `linear-gradient(to right, ${from}, ${to})`;
  }, [edges]);
  return { ref, onScroll, style: { WebkitMaskImage: mask, maskImage: mask } as const };
}

interface SummaryValue {
  id: SpinCategoryId;
  value: string;
  detail: string;
  live: boolean;
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

    return [
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
    ].filter((s) => {
      // Hide categories the home simply doesn't have.
      if (s.id === 'fans') return fans.length > 0;
      if (s.id === 'media') return players.length > 0;
      if (s.id === 'power') return energy.watts != null || energy.powerSensors.length > 0;
      return true;
    });
  }, [entities, energy]);
}

interface SpinWidgetsProps {
  devices: HassDevice[];
  focusCategory: SpinCategory | null;
  selectedArea: string | null;
  onFocus: (id: SpinCategoryId) => void;
  onOpenDevice: (item: CategoryDevice) => void;
}

export function SpinWidgets({ devices, focusCategory, selectedArea, onFocus, onOpenDevice }: SpinWidgetsProps) {
  const summaries = useCategorySummaries();
  const { ref: fadeRef, onScroll: onFadeScroll, style: fadeStyle } = useEdgeFade();

  const detailItems = useMemo<CategoryDevice[] | null>(() => {
    if (!focusCategory && !selectedArea) return null;
    let pool = devices;
    if (selectedArea) pool = pool.filter((d) => d.areaId === selectedArea);
    if (focusCategory) return devicesForCategory(pool, focusCategory);
    return pool
      .filter((d) => !d.isService && d.entities.length > 0)
      .map((d) => ({
        device: d,
        lead: d.primaryEntity ?? d.entities[0],
        categoryEntities: d.entities,
      }));
  }, [devices, focusCategory, selectedArea]);

  const modeKey = detailItems ? `detail-${focusCategory?.id ?? 'area'}-${selectedArea ?? 'all'}` : 'summary';

  return (
    <div className="relative z-10 shrink-0 pb-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={modeKey}
          ref={fadeRef}
          onScroll={onFadeScroll}
          className="flex gap-3.5 overflow-x-auto px-6 py-2 sm:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={fadeStyle}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          {!detailItems &&
            summaries.map((s, i) => {
              const cat = SPIN_CATEGORIES.find((c) => c.id === s.id)!;
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  onClick={() => onFocus(s.id)}
                  className="group flex w-[172px] shrink-0 flex-col justify-between rounded-3xl border border-white/12 bg-white/[0.07] p-4 text-left backdrop-blur-xl transition-colors hover:bg-white/[0.13]"
                  style={{ minHeight: 148 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
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
                  <span>
                    <span className="block text-[22px] font-semibold leading-tight text-white">{s.value}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-white/50">{s.detail}</span>
                    <span className="mt-1 block text-[13px] font-medium text-white/75">{cat.label}</span>
                  </span>
                </motion.button>
              );
            })}

          {detailItems &&
            (detailItems.length === 0 ? (
              <p className="px-2 py-10 text-sm text-white/45">Nothing here yet</p>
            ) : (
              detailItems.map((item, i) => (
                <DeviceCard key={item.device.id} item={item} index={i} accent={focusCategory?.accent ?? '#18bcf2'} onOpen={() => onOpenDevice(item)} />
              ))
            ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DeviceCard({ item, index, accent, onOpen }: { item: CategoryDevice; index: number; accent: string; onOpen: () => void }) {
  const ha = useHomeAssistant();
  const lead = item.lead;
  const active = lead.state === 'on' || lead.state === 'playing' || lead.state === 'unlocked' || (lead.entity_id.startsWith('climate.') && lead.state !== 'off');
  const canToggle = isTogglable(lead);

  return (
    <motion.div
      className="flex w-[196px] shrink-0 cursor-pointer flex-col justify-between rounded-3xl border p-4 backdrop-blur-xl transition-colors"
      style={{
        minHeight: 148,
        borderColor: active ? `${accent}55` : 'rgba(255,255,255,0.12)',
        background: active
          ? `linear-gradient(165deg, ${accent}24, rgba(255,255,255,0.05))`
          : 'rgba(255,255,255,0.07)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: active ? `${accent}30` : 'rgba(255,255,255,0.08)', color: active ? accent : 'rgba(255,255,255,0.7)' }}
        >
          <Icon path={domainIcon(lead)} size={22} />
        </span>
        {canToggle && (
          <button
            type="button"
            aria-label={active ? 'Turn off' : 'Turn on'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            style={{ color: active ? accent : 'rgba(255,255,255,0.6)' }}
            onClick={(e) => {
              e.stopPropagation();
              ha.toggleEntity(lead.entity_id, lead.state);
            }}
          >
            <Icon path={mdiPower} size={18} />
          </button>
        )}
      </div>
      <div>
        <span className="block truncate text-[15px] font-medium text-white/90">{item.device.name}</span>
        <span className="block truncate text-[12px] text-white/55">{friendlyState(lead)}</span>
      </div>
    </motion.div>
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
