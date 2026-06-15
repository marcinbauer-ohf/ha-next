'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { mdiInformationOutline } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { SegmentedControl } from '../ui/SegmentedControl';
import { getEntityHistory } from '@/lib/homeassistant/connection';
import { entityDomain, friendlyName, domainIcon } from '@/lib/homeassistant/entityHelpers';
import { useEnergyMetrics, useDevices, type HassDevice } from '@/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Power attribution — the whole-home meter power curve as a base, with each
// mains-powered controllable device's on/off history laid on the SAME time
// axis. Selecting a device shades the spans where it was on, over the power
// curve, making "this is on → it adds to the draw" legible. Per-device watts
// are ESTIMATED from how the meter average shifts between the device's on and
// off spans (no per-device meters in this instance), so they're labelled ≈.
// ─────────────────────────────────────────────────────────────────────────────

// Mains actuators worth attributing — they draw from the grid meter when on.
const POWER_DOMAINS = new Set([
  'light', 'switch', 'fan', 'climate', 'media_player', 'vacuum', 'water_heater',
  'humidifier', 'cover', 'input_boolean', 'siren', 'valve',
]);

// A device could move the power line if it's a mains actuator OR it exposes a
// power sensor (definitive proof it draws measurable watts). Battery-class
// sensors never qualify — they don't pull from the grid meter.
function couldContribute(device: HassDevice): boolean {
  if (!device.primaryEntity) return false;
  if (POWER_DOMAINS.has(entityDomain(device.primaryEntity))) return true;
  return device.entities.some(e => {
    const dc = e.attributes.device_class as string | undefined;
    return e.entity_id.startsWith('sensor.') && (dc === 'power' || dc === 'energy' || dc === 'current');
  });
}

const ACTIVE_STATES = new Set([
  'on', 'open', 'playing', 'heat', 'heating', 'cool', 'cooling', 'cleaning',
  'running', 'active', 'home', 'auto', 'drying', 'fan_only',
]);
function isActive(state: string): boolean {
  const s = state.toLowerCase();
  if (ACTIVE_STATES.has(s)) return true;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0;
}

type Interval = [number, number];

// Reconstruct on/off spans from a state history, clamped to [startTs, endTs].
function buildOnIntervals(
  history: { s: string; lc?: number; lu?: number }[],
  startTs: number,
  endTs: number,
): Interval[] {
  const pts = history
    .map(p => ({ t: p.lc ?? p.lu ?? 0, on: isActive(p.s) }))
    .filter(p => p.t > 0)
    .sort((a, b) => a.t - b.t);
  if (!pts.length) return [];
  const out: Interval[] = [];
  let state = pts[0].on;
  let segStart = startTs;
  for (const p of pts) {
    if (p.on !== state) {
      if (state) out.push([segStart, p.t]);
      state = p.on;
      segStart = p.t;
    }
  }
  if (state) out.push([segStart, endTs]);
  return out
    .map(([s, e]) => [Math.max(s, startTs), Math.min(e, endTs)] as Interval)
    .filter(([s, e]) => e > s);
}

// ≈ watts a device adds: mean meter draw during its on-spans minus during its
// off-spans. Null when it was never both on and off in the window.
function estimateContribution(meter: { t: number; w: number }[], on: Interval[]): number | null {
  let onSum = 0, onN = 0, offSum = 0, offN = 0;
  const inOn = (t: number) => on.some(([s, e]) => t >= s && t < e);
  for (const p of meter) {
    if (inOn(p.t)) { onSum += p.w; onN++; } else { offSum += p.w; offN++; }
  }
  if (!onN || !offN) return null;
  return onSum / onN - offSum / offN;
}

function fmtW(w: number): string {
  const a = Math.abs(w);
  if (a >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}
const fmtClock = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

interface DeviceTrace {
  device: HassDevice;
  intervals: Interval[];
  contribution: number | null;
  onFraction: number; // share of window spent on — orders the list when no estimate
}

export function PowerAttributionChart() {
  const { meter } = useEnergyMetrics();
  const { devices } = useDevices();
  const [hours, setHours] = useState(24);
  const [meterSeries, setMeterSeries] = useState<{ t: number; w: number }[]>([]);
  const [traces, setTraces] = useState<DeviceTrace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const meterId = meter?.entity_id;
  const isKw = ((meter?.attributes.unit_of_measurement as string | undefined) ?? '').toLowerCase().startsWith('kw');

  // Every device that could move the power line — no cap, so attribution
  // covers the whole home. The meter is excluded (it isn't a contributor).
  const candidates = useMemo(
    () => devices.filter(d => couldContribute(d) && d.primaryEntity!.entity_id !== meterId),
    [devices, meterId],
  );

  // Live device state ticks every few seconds; depending the fetch on the
  // `candidates` array identity would cancel+restart the (serialised, slot-
  // limited) history requests on every tick and they'd never finish. Key the
  // effect on the stable set of entity ids instead, and read the latest device
  // objects from a ref for labelling.
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const candidateKey = useMemo(
    () => candidates.map(d => d.primaryEntity!.entity_id).sort().join(','),
    [candidates],
  );

  useEffect(() => {
    if (!meterId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - hours * 3600;
    const list = candidatesRef.current;

    (async () => {
      const meterHist = await getEntityHistory(meterId, hours);
      const series = meterHist
        .map(p => ({ t: p.lc ?? p.lu ?? 0, w: parseFloat(p.s) }))
        .filter(p => p.t > 0 && Number.isFinite(p.w))
        .map(p => ({ t: p.t, w: isKw ? p.w * 1000 : p.w }));
      if (!cancelled) setMeterSeries(series); // paint the curve before lanes finish

      const built = await Promise.all(list.map(async (device): Promise<DeviceTrace> => {
        const hist = await getEntityHistory(device.primaryEntity!.entity_id, hours);
        const intervals = buildOnIntervals(hist, startTs, endTs);
        const onSec = intervals.reduce((a, [s, e]) => a + (e - s), 0);
        return {
          device,
          intervals,
          contribution: estimateContribution(series, intervals),
          onFraction: onSec / (hours * 3600),
        };
      }));

      if (cancelled) return;
      built.sort((a, b) =>
        (b.contribution ?? -Infinity) - (a.contribution ?? -Infinity) || b.onFraction - a.onFraction,
      );
      setTraces(built);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [meterId, isKw, hours, candidateKey]);

  // Shared time axis for chart + lanes.
  const endTs = useMemo(() => Math.floor(Date.now() / 1000), [hours, meterSeries]);
  const startTs = endTs - hours * 3600;
  const span = Math.max(1, endTs - startTs);
  const frac = (t: number) => Math.min(1, Math.max(0, (t - startTs) / span));

  const selected = traces.find(t => t.device.id === selectedId) ?? null;

  // Meter area/line path on the shared axis (baseline 0 so bar height = draw).
  const W = 1000, H = 120, pad = 6;
  const peak = meterSeries.reduce((m, p) => Math.max(m, p.w), 0) || 1;
  const path = useMemo(() => {
    if (meterSeries.length < 2) return { line: '', area: '' };
    const coords = meterSeries.map(p => ({
      x: frac(p.t) * W,
      y: H - pad - (p.w / peak) * (H - pad * 2),
    }));
    const line = coords.reduce((acc, c, i) => acc + (i === 0 ? `M${c.x},${c.y}` : ` L${c.x},${c.y}`), '');
    const last = coords[coords.length - 1];
    const area = `${line} L${last.x},${H} L${coords[0].x},${H} Z`;
    return { line, area };
  }, [meterSeries, peak, startTs, span]);

  if (!meter) return null;

  return (
    <div className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between gap-ha-3 mb-ha-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary leading-tight truncate">Power attribution</p>
          <p className="text-[12px] text-text-tertiary leading-tight truncate">{friendlyName(meter)}</p>
        </div>
        <SegmentedControl
          segments={[{ value: '6', label: '6h' }, { value: '24', label: '24h' }]}
          value={String(hours)}
          onChange={v => setHours(Number(v))}
        />
      </div>

      {/* Meter curve + selected-device on-bands. Laid out with the SAME column
          grid as the device lanes below so the chart's x-axis (the middle
          column) lines up exactly with each lane's timeline track. */}
      <div className="grid grid-cols-[6.5rem_1fr_3.75rem] gap-ha-2 items-stretch px-ha-2">
        <div aria-hidden />
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: 132 }}>
            <defs>
              <linearGradient id="pa-meter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(245,158,11,0.22)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            {/* On-bands for the selected device — the spans it contributed */}
            {selected?.intervals.map(([s, e], i) => (
              <rect
                key={i}
                x={frac(s) * W}
                y={0}
                width={Math.max(1, (frac(e) - frac(s)) * W)}
                height={H}
                fill="rgba(34,197,94,0.16)"
              />
            ))}
            {path.area && <path d={path.area} fill="url(#pa-meter)" />}
            {path.line && (
              <path d={path.line} stroke="rgba(245,158,11,0.9)" strokeWidth="1.5" fill="none"
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {/* peak label */}
          <span className="absolute top-0 right-0 text-[11px] text-text-tertiary tabular-nums">{fmtW(peak)} peak</span>
          <div className="flex justify-between text-[11px] text-text-tertiary tabular-nums mt-0.5">
            <span>{fmtClock(startTs)}</span>
            <span>{fmtClock(endTs)}</span>
          </div>
        </div>
        <div aria-hidden />
      </div>

      {/* Device lanes — label | on/off timeline aligned to the chart | ≈ watts */}
      <div className="mt-ha-3 space-y-px">
        {loading && (
          <div className="py-ha-4 text-center text-[13px] text-text-tertiary">Loading device activity…</div>
        )}
        {!loading && traces.length === 0 && (
          <div className="py-ha-4 text-center text-[13px] text-text-tertiary">No controllable devices to attribute.</div>
        )}
        {!loading && traces.map(t => {
          const active = t.device.id === selectedId;
          return (
            <button
              key={t.device.id}
              type="button"
              onClick={() => setSelectedId(active ? null : t.device.id)}
              className={`grid w-full grid-cols-[6.5rem_1fr_3.75rem] items-center gap-ha-2 rounded-ha-lg px-ha-2 py-1.5 text-left transition-colors ${active ? 'bg-green-500/10' : 'hover:bg-surface-low'}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Icon path={domainIcon(t.device.primaryEntity!)} size={14} className={active ? 'text-green-500' : 'text-text-tertiary'} />
                <span className="truncate text-[12px] font-medium text-text-secondary">{t.device.name}</span>
              </span>
              {/* timeline track aligned to the same window as the chart above */}
              <span className="relative h-3.5 rounded-ha-sm bg-surface-low overflow-hidden">
                {t.intervals.map(([s, e], i) => (
                  <span
                    key={i}
                    className="absolute inset-y-0 rounded-ha-sm"
                    style={{
                      left: `${frac(s) * 100}%`,
                      width: `${Math.max(0.5, (frac(e) - frac(s)) * 100)}%`,
                      backgroundColor: active ? 'rgb(34 197 94)' : 'rgb(34 197 94 / 0.45)',
                    }}
                  />
                ))}
              </span>
              <span className="text-right text-[12px] font-semibold tabular-nums text-text-primary">
                {t.contribution != null && t.contribution > 0 ? `≈${fmtW(t.contribution)}` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-ha-3 flex items-start gap-1.5 text-[11px] leading-snug text-text-tertiary">
        <Icon path={mdiInformationOutline} size={13} className="mt-px shrink-0" />
        Per-device watts are estimated from how the whole-home meter shifts while each device is on — not measured. Tap a device to highlight its on-spans on the curve.
      </p>
    </div>
  );
}
