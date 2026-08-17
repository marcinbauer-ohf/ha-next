'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  mdiAccountMultiple,
  mdiBattery,
  mdiBattery50,
  mdiBatteryAlertVariantOutline,
  mdiCalendarClock,
  mdiCounter,
  mdiDoorOpen,
  mdiHistory,
  mdiHomeThermometerOutline,
  mdiLightbulbGroup,
  mdiLightbulbOff,
  mdiLock,
  mdiShieldHome,
  mdiSnowflake,
  mdiThermometer,
  mdiTune,
  mdiWaterPercent,
  mdiWeatherPartlyCloudy,
  mdiWeatherWindy,
  mdiWhiteBalanceSunny,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { HALoader, ListSection, SectionLabel } from '../ui';
import {
  DetailRows,
  DialogCard,
  DialogFrame,
  DialogHero,
  DialogTiles,
  SetupStep,
  StatsChart,
  type DetailRow,
  type DialogTileSpec,
  type SetupSlot,
} from '../cards/dialogKit';
import { useHomeAssistant, useHomeAssistantEntities, useEntitiesByDomain } from '@/hooks';
import { friendlyName, stateLabel } from '@/lib/homeassistant/entityHelpers';
import { resolveEntityPictureUrl } from '@/lib/utils';
import {
  batteryCandidates,
  batteryEntities,
  batteryLevel,
  climateSensors,
  entityChoices,
  lowBatteryAt,
  humidityCandidates,
  humiditySensors,
  securityCandidates,
  securityEntities,
  setSummaryConfig,
  temperatureCandidates,
  temperatureOf,
  useSummaryConfig,
  weatherCandidates,
  weatherSource,
  type SummaryConfig,
} from '@/lib/summaryConfig';
import { iconForMode, modeEntityChoices, setHomeModeEntityId, useHomeMode, useHomeModeEntityId } from '@/lib/homeMode';
import { daysUntilEmpty, mergeStatistics } from '@/lib/energyStatistics';
import type { HassEntity, LogbookEntry } from '@/lib/homeassistant/types';

// ─────────────────────────────────────────────────────────────────────────────
// A dialog per summary chip — lights, climate, security, weather, mode, people —
// all on the dialog kit's frame, so they're the same object as the device,
// automation and energy dialogs with different contents. Each one that has a
// judgement call behind its figure (which rooms are "the home", which locks are
// "security", which weather entity to believe) carries a setup step behind the
// cog; the ones that don't (lights, people) have nothing to configure.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setup-step plumbing shared by the config-bearing dialogs: a draft of the
 * stored config, toggling within it, and saving. `single` keys hold one id, so
 * picking replaces rather than adds.
 */
type ListKey = { [K in keyof SummaryConfig]: SummaryConfig[K] extends string[] ? K : never }[keyof SummaryConfig];

function useSetupDraft(config: SummaryConfig, single: ListKey[] = []) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SummaryConfig>(config);

  return {
    open,
    draft,
    setDraft,
    start: () => { setDraft(config); setOpen(true); },
    cancel: () => setOpen(false),
    save: () => { setSummaryConfig(draft); setOpen(false); },
    toggle: (key: string, id: string) =>
      setDraft((d) => {
        const slot = key as ListKey;
        const current = d[slot];
        if (single.includes(slot)) return { ...d, [slot]: current.includes(id) ? [] : [id] };
        return { ...d, [slot]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
      }),
  };
}

/** "3 of 12" style qualifier, built once so every dialog phrases it the same. */
function ofLine(count: number, total: number, noun: string): string {
  return `${count} of ${total} ${noun}`;
}

// ── Lights ───────────────────────────────────────────────────────────────────

export function LightsDetail({ onClose }: { onClose: () => void }) {
  const lights = useEntitiesByDomain('light');
  const { toggleEntity, callService } = useHomeAssistant();

  const on = lights.filter((e) => e.state === 'on');
  // What's on reads first — it's the thing you opened this to turn off.
  const rows: DetailRow[] = useMemo(() => (
    [...lights]
      .sort((a, b) => Number(b.state === 'on') - Number(a.state === 'on') || friendlyName(a).localeCompare(friendlyName(b)))
      .map((e) => ({
        id: e.entity_id,
        icon: e.state === 'on' ? mdiLightbulbGroup : mdiLightbulbOff,
        label: friendlyName(e),
        state: e.state === 'on' && typeof e.attributes.brightness === 'number'
          ? `${Math.round((e.attributes.brightness as number) / 2.55)}%`
          : stateLabel(e),
        active: e.state === 'on',
        onToggle: () => toggleEntity(e.entity_id, e.state),
      }))
  ), [lights, toggleEntity]);

  return (
    <DialogFrame eyebrow="Lights" title={on.length > 0 ? 'Some lights are on' : 'All lights are off'} onClose={onClose}>
      <DialogCard>
        <DialogHero
          icon={mdiLightbulbGroup}
          iconClass={on.length > 0 ? 'text-yellow-500' : 'text-text-tertiary'}
          highlight={on.length > 0 ? 'bg-yellow-500/15' : undefined}
          value={String(on.length)}
          unit="on"
          meta={ofLine(on.length, lights.length, 'lights')}
        />
        {on.length > 0 && (
          <button
            type="button"
            onClick={() => callService({ domain: 'light', service: 'turn_off', target: { entity_id: on.map((e) => e.entity_id) } })}
            className="flex h-12 w-full items-center justify-center gap-ha-2 rounded-ha-xl bg-surface-default text-sm font-semibold text-text-primary transition-colors hover:bg-surface-mid active:scale-[0.99]"
          >
            <Icon path={mdiLightbulbOff} size={18} className="text-ha-blue" />
            Turn them all off
          </button>
        )}
      </DialogCard>
      <DetailRows title="Every light" rows={rows} empty="This home has no lights yet." />
    </DialogFrame>
  );
}

// ── Climate ──────────────────────────────────────────────────────────────────

export function ClimateDetail({ onClose }: { onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const config = useSummaryConfig();
  const setup = useSetupDraft(config);

  const sensors = climateSensors(entities, config);
  const humidity = humiditySensors(entities, config);

  const readings = sensors.map((e) => ({ entity: e, value: temperatureOf(e) })).filter((r) => !isNaN(r.value));
  const average = readings.length > 0 ? readings.reduce((sum, r) => sum + r.value, 0) / readings.length : null;
  const unit = (sensors[0]?.attributes.unit_of_measurement as string | undefined) ?? '°';
  const warmest = readings.reduce<typeof readings[number] | null>((best, r) => (!best || r.value > best.value ? r : best), null);
  const coolest = readings.reduce<typeof readings[number] | null>((best, r) => (!best || r.value < best.value ? r : best), null);
  const humidityAvg = humidity.length > 0
    ? humidity.reduce((sum, e) => sum + parseFloat(e.state), 0) / humidity.length
    : null;

  if (setup.open) {
    const slots: SetupSlot[] = [
      {
        key: 'climate',
        title: 'Rooms that count',
        hint: 'Which thermometers make up "the home". Leave empty and we use every indoor one.',
        icon: mdiThermometer,
        options: entityChoices(temperatureCandidates(entities)),
        selected: setup.draft.climate,
      },
      {
        key: 'humidity',
        title: 'Humidity',
        hint: 'Optional. Shown next to the temperature.',
        icon: mdiWaterPercent,
        options: entityChoices(humidityCandidates(entities)),
        selected: setup.draft.humidity,
      },
    ];
    return (
      <SetupStep
        eyebrow="Climate"
        intro="A home is full of thermometers that aren't rooms — the freezer, the car, the garden. Pick the ones you mean."
        slots={slots}
        onToggle={setup.toggle}
        onSave={setup.save}
        onClose={onClose}
      />
    );
  }

  const tiles: DialogTileSpec[] = [
    ...(warmest ? [{ label: 'Warmest', value: warmest.value.toFixed(1), unit, icon: mdiWhiteBalanceSunny }] : []),
    ...(coolest ? [{ label: 'Coolest', value: coolest.value.toFixed(1), unit, icon: mdiSnowflake }] : []),
    ...(humidityAvg !== null ? [{ label: 'Humidity', value: humidityAvg.toFixed(0), unit: '%', icon: mdiWaterPercent }] : []),
    { label: 'Rooms', value: String(readings.length), icon: mdiHomeThermometerOutline },
  ];

  const rows: DetailRow[] = [...readings]
    .sort((a, b) => b.value - a.value)
    .map((r) => ({
      id: r.entity.entity_id,
      icon: mdiThermometer,
      label: friendlyName(r.entity),
      state: `${r.value.toFixed(1)}${unit}`,
    }));

  return (
    <DialogFrame eyebrow="Climate" title="How warm it is" onClose={onClose} onConfigure={setup.start}>
      <DialogCard>
        <DialogHero
          icon={mdiThermometer}
          iconClass="text-ha-blue"
          value={average !== null ? average.toFixed(1) : '—'}
          unit={unit}
          meta={[
            warmest && coolest && `${coolest.value.toFixed(1)}–${warmest.value.toFixed(1)}${unit} across the home`,
            humidityAvg !== null && `${humidityAvg.toFixed(0)}% humidity`,
          ].filter(Boolean).join(' ・ ') || 'Average of every room'}
        />
        <DialogTiles tiles={tiles} />
        {sensors.length > 0 && <StatsChart ids={sensors.map((e) => e.entity_id)} unit={unit} label="Average, over time" />}
      </DialogCard>
      <DetailRows title="Room by room" rows={rows} empty="No thermometers picked — open the settings above." />
    </DialogFrame>
  );
}

// ── Security ─────────────────────────────────────────────────────────────────

const OPEN_STATES = new Set(['on', 'open', 'unlocked', 'opening', 'triggered', 'pending']);

export function SecurityDetail({ onClose }: { onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const config = useSummaryConfig();
  const setup = useSetupDraft(config);
  const { toggleEntity, callService } = useHomeAssistant();

  const watched = securityEntities(entities, config);
  const locks = watched.filter((e) => e.entity_id.startsWith('lock.'));
  const openings = watched.filter((e) => e.entity_id.startsWith('binary_sensor.'));
  const alarms = watched.filter((e) => e.entity_id.startsWith('alarm_control_panel.'));
  const unlocked = locks.filter((e) => e.state !== 'locked');
  const open = openings.filter((e) => OPEN_STATES.has(e.state));
  const allSecure = unlocked.length === 0 && open.length === 0;

  if (setup.open) {
    const slots: SetupSlot[] = [{
      key: 'security',
      title: 'What to watch',
      hint: 'Locks, doors, windows and alarm panels. Leave empty to watch all of them.',
      icon: mdiShieldHome,
      options: entityChoices(securityCandidates(entities)),
      selected: setup.draft.security,
      emptyHint: 'This home has no locks, door sensors or alarm panels.',
    }];
    return (
      <SetupStep
        eyebrow="Security"
        intro="Not every door matters the same. Pick the ones you want counted."
        slots={slots}
        onToggle={setup.toggle}
        onSave={setup.save}
        onClose={onClose}
      />
    );
  }

  const tiles: DialogTileSpec[] = [
    ...(locks.length > 0 ? [{ label: 'Locked', value: `${locks.length - unlocked.length}/${locks.length}`, icon: mdiLock }] : []),
    ...(openings.length > 0 ? [{ label: 'Open', value: `${open.length}/${openings.length}`, icon: mdiDoorOpen }] : []),
    ...(alarms.length > 0 ? [{ label: 'Alarm', value: stateLabel(alarms[0]), icon: mdiShieldHome }] : []),
  ];

  const rows: DetailRow[] = [...watched]
    .sort((a, b) => {
      const openness = (e: HassEntity) => Number(OPEN_STATES.has(e.state));
      return openness(b) - openness(a) || friendlyName(a).localeCompare(friendlyName(b));
    })
    .map((e) => ({
      id: e.entity_id,
      icon: e.entity_id.startsWith('lock.') ? mdiLock : e.entity_id.startsWith('alarm_control_panel.') ? mdiShieldHome : mdiDoorOpen,
      label: friendlyName(e),
      state: stateLabel(e),
      active: e.entity_id.startsWith('lock.') ? e.state === 'locked' : OPEN_STATES.has(e.state),
      // Only locks can be set from here: a door sensor reports, it doesn't obey,
      // and an alarm panel needs a code, so both stay read-only.
      onToggle: e.entity_id.startsWith('lock.') ? () => toggleEntity(e.entity_id, e.state) : undefined,
    }));

  return (
    <DialogFrame
      eyebrow="Security"
      title={allSecure ? 'Everything is shut' : open.length > 0 ? 'Something is open' : 'Something is unlocked'}
      onClose={onClose}
      onConfigure={setup.start}
    >
      <DialogCard>
        <DialogHero
          icon={mdiShieldHome}
          iconClass={allSecure ? 'text-green-500' : 'text-amber-500'}
          highlight={allSecure ? 'bg-green-500/15' : 'bg-amber-500/15'}
          value={allSecure ? 'Secure' : String(unlocked.length + open.length)}
          unit={allSecure ? undefined : 'to close'}
          meta={[
            locks.length > 0 && ofLine(locks.length - unlocked.length, locks.length, 'locks locked'),
            openings.length > 0 && `${open.length} open`,
          ].filter(Boolean).join(' ・ ') || 'Nothing being watched'}
        />
        {unlocked.length > 0 && (
          <button
            type="button"
            onClick={() => callService({ domain: 'lock', service: 'lock', target: { entity_id: unlocked.map((e) => e.entity_id) } })}
            className="flex h-12 w-full items-center justify-center gap-ha-2 rounded-ha-xl bg-surface-default text-sm font-semibold text-text-primary transition-colors hover:bg-surface-mid active:scale-[0.99]"
          >
            <Icon path={mdiLock} size={18} className="text-ha-blue" />
            Lock everything
          </button>
        )}
        <DialogTiles tiles={tiles} />
      </DialogCard>
      <DetailRows title="Doors and locks" rows={rows} empty="Nothing picked — open the settings above." />
    </DialogFrame>
  );
}

// ── Weather ──────────────────────────────────────────────────────────────────

interface ForecastEntry {
  datetime?: string;
  condition?: string;
  temperature?: number;
  templow?: number;
}

export function WeatherDetail({ onClose }: { onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const config = useSummaryConfig();
  const setup = useSetupDraft(config, ['weather']);

  const weather = weatherSource(entities, config);

  if (setup.open) {
    const slots: SetupSlot[] = [{
      key: 'weather',
      title: 'Where to get the weather',
      hint: 'Homes often end up with several forecasts. Pick the one you trust.',
      icon: mdiWeatherPartlyCloudy,
      options: entityChoices(weatherCandidates(entities)),
      selected: setup.draft.weather,
      emptyHint: 'No weather service is set up in Home Assistant yet.',
    }];
    return (
      <SetupStep
        eyebrow="Weather"
        intro="Pick which forecast this reads."
        slots={slots}
        onToggle={setup.toggle}
        onSave={setup.save}
        onClose={onClose}
      />
    );
  }

  if (!weather) {
    return (
      <DialogFrame eyebrow="Weather" title="No forecast" onClose={onClose} onConfigure={setup.start}>
        <p className="rounded-ha-2xl bg-surface-low px-ha-4 py-ha-4 text-center text-sm text-text-tertiary">
          Home Assistant has no weather service set up yet.
        </p>
      </DialogFrame>
    );
  }

  const attrs = weather.attributes as Record<string, unknown>;
  const num = (key: string) => (typeof attrs[key] === 'number' ? (attrs[key] as number) : null);
  const unit = (attrs.temperature_unit as string | undefined) ?? '°';
  const temperature = num('temperature');

  const tiles: DialogTileSpec[] = [
    ...(num('apparent_temperature') !== null ? [{ label: 'Feels like', value: num('apparent_temperature')!.toFixed(0), unit, icon: mdiThermometer }] : []),
    ...(num('humidity') !== null ? [{ label: 'Humidity', value: num('humidity')!.toFixed(0), unit: '%', icon: mdiWaterPercent }] : []),
    ...(num('wind_speed') !== null ? [{ label: 'Wind', value: num('wind_speed')!.toFixed(0), unit: (attrs.wind_speed_unit as string) ?? '', icon: mdiWeatherWindy }] : []),
    ...(num('pressure') !== null ? [{ label: 'Pressure', value: num('pressure')!.toFixed(0), unit: (attrs.pressure_unit as string) ?? '', icon: mdiTune }] : []),
  ];

  // Some integrations still publish the forecast as an attribute; the modern
  // ones serve it over a subscription instead, and then there's simply no list
  // to show rather than a broken one.
  const forecast = Array.isArray(attrs.forecast) ? (attrs.forecast as ForecastEntry[]).slice(0, 7) : [];
  const rows: DetailRow[] = forecast.map((f, i) => ({
    id: f.datetime ?? String(i),
    icon: mdiWeatherPartlyCloudy,
    label: f.datetime
      ? new Date(f.datetime).toLocaleDateString(undefined, { weekday: 'long' })
      : (f.condition ?? '').replace(/_/g, ' '),
    state: [f.temperature != null && `${Math.round(f.temperature)}${unit}`, f.templow != null && `${Math.round(f.templow)}${unit}`]
      .filter(Boolean).join(' / '),
  }));

  return (
    <DialogFrame eyebrow="Weather" title={friendlyName(weather)} onClose={onClose} onConfigure={setup.start}>
      <DialogCard>
        <DialogHero
          icon={mdiWeatherPartlyCloudy}
          iconClass="text-ha-blue"
          value={temperature !== null ? temperature.toFixed(0) : stateLabel(weather)}
          unit={temperature !== null ? unit : undefined}
          meta={weather.state.replace(/[_-]/g, ' ')}
        />
        <DialogTiles tiles={tiles} />
      </DialogCard>
      {rows.length > 0 && <DetailRows title="Next few days" rows={rows} />}
    </DialogFrame>
  );
}

// ── Home mode ────────────────────────────────────────────────────────────────

export function ModeDetail({ onClose }: { onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const entityId = useHomeModeEntityId();
  const homeMode = useHomeMode();
  const { getLogbook } = useHomeAssistant();

  const [setupOpen, setSetupOpen] = useState(false);
  const [draft, setDraft] = useState(entityId);
  const [events, setEvents] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) { setLoading(false); return; }
    let cancelled = false;
    getLogbook(entityId).then((rows) => {
      if (cancelled) return;
      setEvents([...rows].sort((a, b) => b.when - a.when).slice(0, 10));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entityId, getLogbook]);

  if (setupOpen) {
    const slots: SetupSlot[] = [{
      key: 'mode',
      title: 'Which helper holds the mode',
      hint: 'A dropdown helper like Home / Away / Night.',
      icon: mdiTune,
      options: modeEntityChoices(entities).map((c) => ({ id: c.entityId, label: c.label })),
      selected: draft ? [draft] : [],
      emptyHint: 'Create a dropdown helper in Home Assistant (Settings → Devices & services → Helpers) to use this.',
    }];
    return (
      <SetupStep
        eyebrow="Mode"
        intro="The home's mode is read from one of your helpers — this only shows it. Changing what each mode does stays with your automations."
        slots={slots}
        onToggle={(_key, id) => setDraft((d) => (d === id ? '' : id))}
        onSave={() => { setHomeModeEntityId(draft); setSetupOpen(false); }}
        onClose={onClose}
      />
    );
  }

  const options = homeMode?.options ?? [];
  const rows: DetailRow[] = options.map((option) => ({
    id: option,
    icon: iconForMode(option),
    label: option,
    state: option === homeMode?.current ? 'Now' : '',
    active: option === homeMode?.current,
  }));

  return (
    <DialogFrame
      eyebrow="Mode"
      title={homeMode ? homeMode.current : 'Not set up'}
      onClose={onClose}
      onConfigure={() => { setDraft(entityId); setSetupOpen(true); }}
    >
      <DialogCard>
        <DialogHero
          icon={homeMode?.icon ?? mdiTune}
          iconClass="text-violet-500"
          highlight="bg-violet-500/15"
          value={homeMode?.current ?? '—'}
          meta={options.length > 0 ? `One of ${options.length} modes` : 'Pick a helper in the settings above'}
        />
      </DialogCard>
      {rows.length > 0 && <DetailRows title="Every mode" rows={rows} />}
      <div className="w-full">
        <SectionLabel inset>Recent changes</SectionLabel>
        <div className="mt-ha-2">
          <ListSection>
            {loading ? (
              <div className="flex h-16 items-center justify-center"><HALoader size="sm" /></div>
            ) : events.length === 0 ? (
              <p className="px-ha-4 py-ha-3 text-sm text-text-tertiary">Nothing recorded in the last week.</p>
            ) : events.map((e, i) => (
              <div key={`${e.when}-${i}`} className="flex items-center gap-ha-3 px-ha-4 py-ha-2">
                <Icon path={mdiHistory} size={16} className="shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-sm capitalize text-text-primary">
                  {e.state?.replace(/_/g, ' ') ?? e.message ?? 'Changed'}
                </span>
                <span className="shrink-0 font-mono text-xs text-text-tertiary">
                  {new Date(e.when * 1000).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </ListSection>
        </div>
      </div>
    </DialogFrame>
  );
}

// ── Batteries ────────────────────────────────────────────────────────────────

// Only the emptiest few get a statistics round-trip: a home can have forty
// battery sensors, and the ones at 90% are not the question being asked.
// ponytail: fixed cap, make it a "forecast everything" toggle if anyone asks.
const FORECAST_LIMIT = 8;

/** Days-until-empty per entity, from a fortnight of daily levels. Missing = not draining. */
function useBatteryForecast(ids: string[]): Record<string, number> {
  const { getStatistics } = useHomeAssistant();
  const [days, setDays] = useState<Record<string, number>>({});

  // Keyed as a string so a live percentage tick doesn't restart the fetch.
  const idKey = ids.join(',');
  useEffect(() => {
    const list = idKey ? idKey.split(',') : [];
    if (list.length === 0) return;
    let cancelled = false;
    Promise.all(list.map((id) => getStatistics(id, 14 * 24, 'day'))).then((perEntity) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      perEntity.forEach((buckets, i) => {
        const left = daysUntilEmpty(mergeStatistics([buckets], [1], 'mean'));
        if (left !== null) next[list[i]] = left;
      });
      setDays(next);
    });
    return () => { cancelled = true; };
  }, [idKey, getStatistics]);

  return days;
}

function fmtDaysLeft(days: number): string {
  if (days < 1) return 'today';
  if (days < 14) return `${Math.round(days)} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

function batteryIcon(level: number, low: number): string {
  if (level <= low) return mdiBatteryAlertVariantOutline;
  return level <= 50 ? mdiBattery50 : mdiBattery;
}

export function BatteryDetail({ onClose }: { onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const config = useSummaryConfig();
  const setup = useSetupDraft(config);

  const low = lowBatteryAt(config);
  const readings = batteryEntities(entities, config)
    .map((e) => ({ entity: e, level: batteryLevel(e) }))
    .filter((r) => !isNaN(r.level))
    .sort((a, b) => a.level - b.level);

  const flat = readings.filter((r) => r.level <= low);
  const average = readings.length > 0 ? readings.reduce((sum, r) => sum + r.level, 0) / readings.length : null;
  const forecast = useBatteryForecast(readings.slice(0, FORECAST_LIMIT).map((r) => r.entity.entity_id));

  if (setup.open) {
    const slots: SetupSlot[] = [{
      key: 'battery',
      title: 'Batteries that matter',
      hint: 'Leave empty and we watch every battery your home reports.',
      icon: mdiBattery,
      options: entityChoices(batteryCandidates(entities)),
      selected: setup.draft.battery,
      emptyHint: 'Nothing in this home reports a battery level yet.',
    }];
    return (
      <SetupStep
        eyebrow="Batteries"
        intro="Which batteries you want counted, and when one counts as low."
        slots={slots}
        onToggle={setup.toggle}
        onSave={setup.save}
        onClose={onClose}
      >
        <div className="flex w-full items-center gap-ha-3 rounded-ha-2xl bg-surface-default p-ha-3">
          <Icon path={mdiBatteryAlertVariantOutline} size={20} className="shrink-0 text-text-tertiary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Low below</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              A door sensor at 20% lasts months; a camera at 20% dies tomorrow. Set what worries you.
            </p>
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            value={setup.draft.batteryLow}
            onChange={(e) => setup.setDraft((d) => ({ ...d, batteryLow: parseInt(e.target.value, 10) || 0 }))}
            className="w-20 shrink-0 rounded-ha-xl bg-surface-low px-ha-3 py-2 text-right font-mono text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60"
          />
        </div>
      </SetupStep>
    );
  }

  const tiles: DialogTileSpec[] = [
    ...(readings.length > 0 ? [{ label: 'Lowest', value: String(Math.round(readings[0].level)), unit: '%', icon: mdiBatteryAlertVariantOutline }] : []),
    ...(average !== null ? [{ label: 'Average', value: average.toFixed(0), unit: '%', icon: mdiBattery50 }] : []),
    { label: 'Low', value: String(flat.length), icon: mdiBatteryAlertVariantOutline },
    { label: 'Tracked', value: String(readings.length), icon: mdiCounter },
  ];

  // The part worth opening this for: not what's low now, but what runs out
  // first. A cell at 30% shedding a percent a day beats one sitting at 22%.
  const running = readings
    .filter((r) => forecast[r.entity.entity_id] !== undefined)
    .sort((a, b) => forecast[a.entity.entity_id] - forecast[b.entity.entity_id])
    .map((r) => ({
      id: r.entity.entity_id,
      icon: mdiCalendarClock,
      label: friendlyName(r.entity),
      state: fmtDaysLeft(forecast[r.entity.entity_id]),
      active: forecast[r.entity.entity_id] < 14,
    }));

  const rows: DetailRow[] = readings.map((r) => ({
    id: r.entity.entity_id,
    icon: batteryIcon(r.level, low),
    label: friendlyName(r.entity),
    state: `${Math.round(r.level)}%`,
    active: r.level <= low,
  }));

  const soonest = running[0];

  return (
    <DialogFrame
      eyebrow="Batteries"
      title={readings.length === 0 ? 'Nothing to watch' : flat.length === 0 ? 'All healthy' : flat.length === 1 ? 'One is low' : `${flat.length} are low`}
      onClose={onClose}
      onConfigure={setup.start}
    >
      <DialogCard>
        <DialogHero
          icon={readings.length > 0 ? batteryIcon(readings[0].level, low) : mdiBattery}
          iconClass={flat.length > 0 ? 'text-amber-500' : 'text-green-500'}
          highlight={flat.length > 0 ? 'bg-amber-500/15' : undefined}
          value={readings.length > 0 ? String(Math.round(readings[0].level)) : '—'}
          unit={readings.length > 0 ? '%' : undefined}
          meta={[
            readings.length > 0 && `lowest of ${readings.length}`,
            flat.length > 0 && `${flat.length} below ${low}%`,
            soonest && `${soonest.label} runs out in ${soonest.state}`,
          ].filter(Boolean).join(' ・ ') || 'No batteries picked — open the settings above'}
        />
        <DialogTiles tiles={tiles} />
        {readings.length > 0 && (
          <StatsChart ids={readings.slice(0, FORECAST_LIMIT).map((r) => r.entity.entity_id)} unit="%" label="Emptiest batteries, over time" />
        )}
      </DialogCard>
      {running.length > 0 && (
        <DetailRows title="Runs out first" rows={running} />
      )}
      <DetailRows title="Every battery" rows={rows} empty="Nothing in this home reports a battery level." />
    </DialogFrame>
  );
}

// ── People ───────────────────────────────────────────────────────────────────

export function PeopleDetail({ onClose }: { onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const { haUrl } = useHomeAssistant();

  const people = useMemo(
    () => Object.values(entities).filter((e) => e.entity_id.startsWith('person.')),
    [entities],
  );
  // Overlapping zones make a person's state a zone name, so home is decided by
  // in_zones — never by `state === 'home'` (see isPersonHome in selectors).
  const isHome = (e: HassEntity) =>
    e.state === 'home' ||
    (Array.isArray(e.attributes.in_zones) &&
      (e.attributes.in_zones as string[]).some((z) => String(z).toLowerCase().replace(/^zone\./, '') === 'home'));

  const home = people.filter(isHome);
  const away = people.filter((e) => !isHome(e));

  const rows: DetailRow[] = [...home, ...away].map((e) => ({
    id: e.entity_id,
    label: friendlyName(e),
    state: isHome(e) ? 'Home' : stateLabel(e),
    active: isHome(e),
    picture: resolveEntityPictureUrl(haUrl, e.attributes.entity_picture as string | undefined) ?? undefined,
    initials: friendlyName(e).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  }));

  return (
    <DialogFrame eyebrow="People" title={home.length === people.length ? 'Everyone is home' : home.length === 0 ? 'Nobody is home' : 'Some are home'} onClose={onClose}>
      <DialogCard>
        <DialogHero
          icon={mdiAccountMultiple}
          iconClass="text-ha-blue"
          value={String(home.length)}
          unit="home"
          meta={away.length > 0 ? `${away.map(friendlyName).join(', ')} away` : ofLine(home.length, people.length, 'people')}
        />
      </DialogCard>
      <DetailRows title="Everyone" rows={rows} empty="No people are set up in Home Assistant yet." />
    </DialogFrame>
  );
}
