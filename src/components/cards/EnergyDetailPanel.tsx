'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  mdiBatteryCharging,
  mdiCashMultiple,
  mdiFlash,
  mdiHomeLightningBoltOutline,
  mdiSolarPower,
  mdiTransmissionTower,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { Dropdown, HALoader, SectionLabel, SegmentedControl } from '../ui';
import { Sparkline } from '../ui/Sparkline';
import {
  DialogCard,
  DialogFrame,
  DialogHero,
  DialogTiles,
  SetupStep,
  type DialogTileSpec,
  type SetupSlot,
} from './dialogKit';
import { PowerAttributionChart } from '../sections/PowerAttributionChart';
import { useEntities, useHomeAssistant, useHomeAssistantEntities } from '@/hooks';
import { useHomeName } from '@/lib/homeName';
import {
  energySensorChoices,
  guessEnergyConfig,
  isEnergyConfigured,
  setEnergyConfig,
  sumKwh,
  sumWatts,
  useEnergyConfig,
  type EnergyConfig,
} from '@/lib/energyConfig';
import { mergeStatistics, type EnergyBucket } from '@/lib/energyStatistics';

// ─────────────────────────────────────────────────────────────────────────────
// Energy more-info — the device dialog's shape applied to the whole house: one
// surface carrying the reading now, the numbers a homeowner actually asks for
// (used today, what it cost, what the sun made, what went back), then the past
// off a hairline. Which sensors feed it is the user's choice, so the dialog
// opens in its setup step until that choice exists (see energyConfig).
//
// Everything historical comes from long-term statistics rather than raw
// history: buckets are aligned to the hour/day across entities, so several
// sensors sum into one series without resampling, and nothing is purged.
// ─────────────────────────────────────────────────────────────────────────────

const POWER_SPANS = [
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: '168', label: '7d' },
];
const DAILY_SPANS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

function fmtPower(watts: number | null): string {
  if (watts === null) return '—';
  return Math.abs(watts) >= 1000 ? (watts / 1000).toFixed(2) : String(Math.round(watts));
}
function powerUnit(watts: number | null): string {
  return watts !== null && Math.abs(watts) >= 1000 ? 'kW' : 'W';
}
function fmtKwh(kwh: number | null): string {
  if (kwh === null) return '—';
  return kwh >= 100 ? kwh.toFixed(0) : kwh.toFixed(kwh >= 10 ? 1 : 2);
}
function fmtDay(ts: number, long = false): string {
  return new Date(ts).toLocaleDateString(undefined, long ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'narrow' });
}
function fmtHour(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric' });
}

/** Per-entity unit → factor onto the canonical unit (W for power, kWh for energy). */
function factorFor(unit: string | undefined): number {
  const u = (unit ?? '').toLowerCase();
  if (u === 'kw') return 1000; // → W
  if (u === 'wh') return 1 / 1000; // → kWh
  return 1;
}

// ── Setup step ───────────────────────────────────────────────────────────────

function EnergySetup({ config, onDone, onClose }: { config: EnergyConfig; onDone: () => void; onClose: () => void }) {
  const entities = useHomeAssistantEntities();
  const powerOptions = useMemo(() => energySensorChoices(entities, 'power'), [entities]);
  const energyOptions = useMemo(() => energySensorChoices(entities, 'energy'), [entities]);
  const batteryOptions = useMemo(() => energySensorChoices(entities, 'battery'), [entities]);

  // Start from what's stored; a first run starts from the one guess worth
  // making (grid- and solar-named sensors) so the common case is one tap.
  const [draft, setDraft] = useState<EnergyConfig>(() =>
    isEnergyConfigured(config) ? config : { ...config, ...guessEnergyConfig(entities) },
  );

  const slots: SetupSlot[] = [
    {
      key: 'power',
      title: 'Power right now',
      hint: 'Live draw. A whole-home meter if you have one, otherwise the plugs you care about.',
      icon: mdiFlash,
      options: powerOptions,
      selected: draft.power,
    },
    {
      key: 'today',
      title: 'Used today',
      hint: 'A sensor that resets each day and counts up in kWh.',
      icon: mdiHomeLightningBoltOutline,
      options: energyOptions,
      selected: draft.today,
    },
    {
      key: 'solar',
      title: 'Made by solar today',
      hint: "Optional. Today's production, in kWh.",
      icon: mdiSolarPower,
      options: energyOptions,
      selected: draft.solar,
    },
    {
      key: 'exported',
      title: 'Sent back today',
      hint: 'Optional. What went out to the grid instead of being used, in kWh.',
      icon: mdiTransmissionTower,
      options: energyOptions,
      selected: draft.exported,
    },
    {
      key: 'battery',
      title: 'Home battery',
      hint: 'Optional. Its charge level.',
      icon: mdiBatteryCharging,
      options: batteryOptions,
      selected: draft.battery ? [draft.battery] : [],
    },
  ];

  const toggle = (key: string, id: string) =>
    setDraft((d) => {
      // The battery is one sensor, not a sum — picking replaces.
      if (key === 'battery') return { ...d, battery: d.battery === id ? '' : id };
      const slot = key as 'power' | 'today' | 'solar' | 'exported';
      return { ...d, [slot]: d[slot].includes(id) ? d[slot].filter((x) => x !== id) : [...d[slot], id] };
    });

  return (
    <SetupStep
      eyebrow="Energy"
      intro="Tell us which of your meters and plugs to read. Pick more than one and we add them up."
      slots={slots}
      onToggle={toggle}
      onSave={() => { setEnergyConfig(draft); onDone(); }}
      onClose={onClose}
      canSave={draft.power.length > 0 || draft.today.length > 0}
      saveLabel="Show my energy"
      blockedLabel="Pick a power or daily sensor"
    >
      <div className="flex w-full items-center gap-ha-3 rounded-ha-2xl bg-surface-default p-ha-3">
        <Icon path={mdiCashMultiple} size={20} className="shrink-0 text-text-tertiary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Price per kWh</p>
          <p className="mt-0.5 text-xs text-text-secondary">Optional. Leave at 0 to hide costs.</p>
        </div>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={draft.price || ''}
          placeholder="0"
          onChange={(e) => setDraft((d) => ({ ...d, price: parseFloat(e.target.value) || 0 }))}
          className="w-20 shrink-0 rounded-ha-xl bg-surface-low px-ha-3 py-2 text-right font-mono text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60"
        />
      </div>
    </SetupStep>
  );
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/** Per-day totals as bars — the shape of a week, scrubbable like the chart. */
function DailyBars({
  data,
  hovered,
  onHover,
}: {
  data: EnergyBucket[];
  hovered: number | null;
  onHover: (index: number | null) => void;
}) {
  const peak = Math.max(...data.map((d) => d.value), 0.001);
  const labelEvery = data.length > 10 ? Math.ceil(data.length / 7) : 1;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1" onPointerLeave={() => onHover(null)}>
      <div className="flex min-h-0 w-full flex-1 items-end gap-[3px]">
        {data.map((d, i) => (
          <button
            key={d.ts}
            type="button"
            aria-label={`${fmtDay(d.ts, true)}: ${fmtKwh(d.value)} kWh`}
            onPointerEnter={() => onHover(i)}
            onFocus={() => onHover(i)}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <span
              className={clsx(
                'block w-full rounded-t-ha-sm transition-colors',
                hovered === i ? 'bg-amber-500' : 'bg-amber-500/60',
              )}
              style={{ height: `${Math.max(2, (d.value / peak) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex w-full gap-[3px]">
        {data.map((d, i) => (
          <span key={d.ts} className="min-w-0 flex-1 truncate text-center text-[10px] leading-none text-text-tertiary">
            {i % labelEvery === 0 ? fmtDay(d.ts) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EnergyDetailPanel({ onClose }: { onClose: () => void }) {
  const config = useEnergyConfig();
  const { getStatistics, getCoreConfig } = useHomeAssistant();
  const homeName = useHomeName();
  const [setup, setSetup] = useState(() => !isEnergyConfigured(config));

  const powerEntities = useEntities(config.power);
  const todayEntities = useEntities(config.today);
  const solarEntities = useEntities(config.solar);
  const exportedEntities = useEntities(config.exported);
  const [battery] = useEntities(config.battery ? [config.battery] : []);

  const watts = sumWatts(powerEntities);
  const kwhToday = sumKwh(todayEntities);
  const solarToday = sumKwh(solarEntities);
  const exportedToday = sumKwh(exportedEntities);
  const batteryPct = battery ? parseFloat(battery.state) : NaN;

  // The home's currency, for the cost line. One read; falls back to a bare
  // figure if the instance doesn't say (or we're not connected).
  const [currency, setCurrency] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCoreConfig().then((core) => { if (!cancelled) setCurrency(core?.currency ?? null); });
    return () => { cancelled = true; };
  }, [getCoreConfig]);

  const fmtMoney = (amount: number) => {
    if (!currency) return amount.toFixed(2);
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  const [tab, setTab] = useState<'power' | 'daily'>('power');
  const [powerHours, setPowerHours] = useState('24');
  const [dailyDays, setDailyDays] = useState('7');
  const [breakdown, setBreakdown] = useState(false);
  const [series, setSeries] = useState<EnergyBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  // Ids and unit factors of whichever series the current tab needs. Keyed as a
  // string so the fetch doesn't restart every time a live reading ticks.
  const chartIds = tab === 'power' ? config.power : config.today;
  const chartEntities = tab === 'power' ? powerEntities : todayEntities;
  const factors = chartEntities.map((e) => factorFor(e?.attributes.unit_of_measurement as string | undefined));
  const factorKey = factors.join(',');
  const idKey = chartIds.join(',');

  useEffect(() => {
    const ids = idKey ? idKey.split(',') : [];
    const unitFactors = factorKey ? factorKey.split(',').map(Number) : [];
    if (ids.length === 0) { setSeries([]); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setHovered(null);

    const days = Number(dailyDays);
    // Daily totals difference the meter sum, so fetch one bucket more than we
    // draw and drop the oldest — it has nothing to be differenced against.
    const hoursBack = tab === 'power' ? Number(powerHours) : (days + 1) * 24;
    const period = tab === 'power' ? 'hour' : 'day';

    Promise.all(ids.map((id) => getStatistics(id, hoursBack, period))).then((perEntity) => {
      if (cancelled) return;
      const merged = mergeStatistics(perEntity, unitFactors, tab === 'power' ? 'mean' : 'change');
      setSeries(tab === 'power' ? merged : merged.slice(-days));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tab, powerHours, dailyDays, idKey, factorKey, getStatistics]);

  if (setup) return <EnergySetup config={config} onDone={() => setSetup(false)} onClose={onClose} />;

  const hoveredBucket = hovered !== null ? series[hovered] ?? null : null;
  // With no power sensor picked, today's total is the headline instead of a live
  // draw nobody measures — and then it doesn't repeat itself in the line below.
  const headlineIsToday = watts === null && kwhToday !== null;
  // Scrubbing the past moves the big reading, exactly like the device dialog:
  // the hero shows the moment under your finger, stamped so it's clearly not now.
  const heroValue = hoveredBucket
    ? (tab === 'power' ? fmtPower(hoveredBucket.value) : fmtKwh(hoveredBucket.value))
    : headlineIsToday ? fmtKwh(kwhToday) : fmtPower(watts);
  const heroUnit = hoveredBucket
    ? (tab === 'power' ? powerUnit(hoveredBucket.value) : 'kWh')
    : headlineIsToday ? 'kWh' : powerUnit(watts);
  const heroStamp = hoveredBucket
    ? (tab === 'power' ? fmtHour(hoveredBucket.ts) : fmtDay(hoveredBucket.ts, true))
    : null;

  const metaLine = [
    !headlineIsToday && kwhToday !== null && `${fmtKwh(kwhToday)} kWh today`,
    headlineIsToday && 'used today',
    kwhToday !== null && config.price > 0 && fmtMoney(kwhToday * config.price),
    solarToday !== null && `${fmtKwh(solarToday)} kWh solar`,
  ].filter(Boolean).join(' ・ ') || 'Live draw';

  const points = series.map((b) => b.value);
  const xFractions = series.length > 1
    ? series.map((b) => (b.ts - series[0].ts) / (series[series.length - 1].ts - series[0].ts || 1))
    : [];
  const dailyTotal = series.reduce((sum, b) => sum + b.value, 0);

  const tiles: DialogTileSpec[] = [
    ...(kwhToday !== null ? [{ label: 'Used today', value: fmtKwh(kwhToday), unit: 'kWh', icon: mdiHomeLightningBoltOutline }] : []),
    ...(kwhToday !== null && config.price > 0 ? [{ label: 'Cost today', value: fmtMoney(kwhToday * config.price), icon: mdiCashMultiple }] : []),
    ...(solarToday !== null ? [{ label: 'Solar today', value: fmtKwh(solarToday), unit: 'kWh', icon: mdiSolarPower }] : []),
    ...(exportedToday !== null ? [{ label: 'Sent back', value: fmtKwh(exportedToday), unit: 'kWh', icon: mdiTransmissionTower }] : []),
    ...(Number.isFinite(batteryPct) ? [{ label: 'Battery', value: String(Math.round(batteryPct)), unit: '%', icon: mdiBatteryCharging }] : []),
  ];

  return (
    <DialogFrame
      eyebrow="Energy"
      title={homeName || 'Your home'}
      onClose={onClose}
      onConfigure={() => setSetup(true)}
    >
      {/* One surface: what the house draws, the numbers that follow from it,
          and the past off a hairline — the device dialog's arrangement. */}
      <DialogCard>
            <DialogHero
              icon={mdiFlash}
              iconClass="text-amber-500"
              value={heroValue}
              unit={heroUnit}
              meta={metaLine}
              stamp={heroStamp}
            />

            {/* The numbers a homeowner asks for, in the order they ask them. */}
            <DialogTiles tiles={tiles} />

            {/* The past. Hourly average draw, or a day-by-day total — two ways
                to read the same house, in one fixed slot. */}
            <div className="flex w-full flex-col gap-ha-1 border-t border-surface-mid pt-ha-2">
              <div className="flex w-full items-center gap-ha-2">
                <SegmentedControl
                  segments={[{ value: 'power', label: 'Power' }, { value: 'daily', label: 'Daily' }]}
                  value={tab}
                  onChange={(v) => { setTab(v as 'power' | 'daily'); setHovered(null); }}
                  className="text-xs"
                />
                <div className="ml-auto flex items-center gap-ha-2">
                  {tab === 'power' ? (
                    <Dropdown className="shrink-0" options={POWER_SPANS} value={powerHours} onChange={setPowerHours} />
                  ) : (
                    <Dropdown className="shrink-0" options={DAILY_SPANS} value={dailyDays} onChange={setDailyDays} />
                  )}
                </div>
              </div>

              <div className="flex h-[150px] w-full flex-col overflow-hidden lg:h-[200px]">
                {loading ? (
                  <div className="flex h-full items-center justify-center"><HALoader size="sm" /></div>
                ) : points.length < (tab === 'power' ? 3 : 1) ? (
                  <div className="flex h-full items-center justify-center px-ha-4 text-center text-sm text-text-tertiary">
                    {chartIds.length === 0
                      ? 'No sensor picked for this yet — open the settings above.'
                      : 'Home Assistant hasn’t recorded enough of this yet.'}
                  </div>
                ) : tab === 'power' ? (
                  <div className="min-h-0 w-full flex-1 opacity-90">
                    <Sparkline
                      points={points}
                      on
                      rgb="245,158,11"
                      gradientId="energy-power"
                      xFractions={xFractions}
                      onHover={setHovered}
                      fillHeight
                    />
                  </div>
                ) : (
                  <DailyBars data={series} hovered={hovered} onHover={setHovered} />
                )}
              </div>

              {tab === 'daily' && !loading && series.length > 0 && (
                <p className="text-center text-[11px] font-medium text-text-tertiary">
                  {fmtKwh(dailyTotal)} kWh over {series.length} days ・ {fmtKwh(dailyTotal / series.length)} kWh a day
                  {config.price > 0 && ` ・ ${fmtMoney(dailyTotal * config.price)} total`}
                </p>
              )}
            </div>
      </DialogCard>

      {/* Which devices moved the line — the whole-home curve with each
              device's on-spans laid over it. Only meaningful once a live power
              sensor is picked, and only fetched when asked for: it reads the
              history of every device that could draw power. */}
      {powerEntities[0] && (
        <div className="w-full">
          <SectionLabel inset>Where it goes</SectionLabel>
          <div className="mt-ha-2 rounded-ha-2xl bg-surface-low p-ha-2">
            {breakdown ? (
              <PowerAttributionChart meter={powerEntities[0]} />
            ) : (
              <button
                type="button"
                onClick={() => setBreakdown(true)}
                className="flex h-12 w-full items-center justify-center gap-ha-2 rounded-ha-xl bg-surface-default text-sm font-semibold text-text-primary transition-colors hover:bg-surface-mid active:scale-[0.99]"
              >
                <Icon path={mdiHomeLightningBoltOutline} size={18} className="text-ha-blue" />
                Match it to your devices
              </button>
            )}
          </div>
        </div>
      )}
    </DialogFrame>
  );
}
