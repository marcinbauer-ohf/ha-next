'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { mdiClose, mdiPencilOutline, mdiPower, mdiInformation, mdiInformationOutline, mdiStar, mdiStarOutline, mdiCogOutline, mdiChevronRight } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon, ListSection, RollingNumericValue, SegmentedControl, Dropdown, HALoader, ToggleSwitch } from '../ui';
import { StateTimeline, type StateSegment } from '../ui/StateTimeline';
import { Sparkline } from '../ui/Sparkline';
import { DomainControls } from './DeviceControls';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import type { HistoryPoint, StatisticValue } from '@/lib/homeassistant/types';

// ── Graph config types ────────────────────────────────────────────────────────

const TIME_SPANS = [
  { value: '1h',  label: '1h',  hours: 1 },
  { value: '6h',  label: '6h',  hours: 6 },
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d',  label: '7d',  hours: 168 },
  { value: '30d', label: '30d', hours: 720 },
] as const;
type TimeSpan = typeof TIME_SPANS[number]['value'];

// Spans at or beyond this use long-term statistics instead of raw history —
// the recorder purges raw states after ~10 days, so 7d/30d raw fetches come
// back partial (or empty) on real instances. Statistics live forever.
const STATS_THRESHOLD_HOURS = 168;

const AGGREGATIONS = [
  { value: 'auto',   label: 'Auto' },
  { value: 'raw',    label: 'Raw' },
  { value: 'hourly', label: 'Avg/h' },
  { value: 'daily',  label: 'Avg/d' },
] as const;
type Aggregation = typeof AGGREGATIONS[number]['value'];

// Plausible "other" state for demo non-numeric history, so the timeline shows
// realistic labels instead of a single flat band.
const STATE_COUNTERPART: Record<string, string> = {
  on: 'off', off: 'on',
  open: 'closed', closed: 'open',
  playing: 'paused', paused: 'playing', idle: 'playing',
  home: 'not_home', not_home: 'home',
  locked: 'unlocked', unlocked: 'locked',
  detected: 'clear', clear: 'detected',
  heat: 'off', cool: 'off', heating: 'idle', cooling: 'idle',
  armed_home: 'disarmed', armed_away: 'disarmed', disarmed: 'armed_away',
};

function applyAggregation(
  data: { value: number; ts: number | null }[],
  aggregation: Aggregation,
  hours: number,
): { value: number; ts: number | null }[] {
  const mode = aggregation === 'auto'
    ? (hours <= 24 ? 'raw' : hours <= 48 ? 'hourly' : 'daily')
    : aggregation;

  if (mode === 'raw') return data;

  const bucketSec = mode === 'daily' ? 86400 : 3600;
  const nowSec = Date.now() / 1000;
  const startSec = nowSec - hours * 3600;
  const buckets = new Map<number, number[]>();

  for (const pt of data) {
    const t = pt.ts ?? nowSec;
    const b = Math.floor((t - startSec) / bucketSec);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push(pt.value);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([b, vals]) => ({
      value: vals.reduce((s, v) => s + v, 0) / vals.length,
      ts: startSec + b * bucketSec + bucketSec / 2,
    }));
}

// Vertical time-axis ticks across the chart's [startMs, endMs] domain. Grid
// granularity follows the selected span — hourly for ≤24h, daily for 7d — so
// each tick marks a real time boundary (local time). Only a readable subset
// gets a text label; the rest are bare gridlines.
interface TimeTick { f: number; label: string; labeled: boolean }

function buildTimeTicks(startMs: number, endMs: number, hours: number): TimeTick[] {
  const span = endMs - startMs || 1;
  const kind: 'min15' | 'hour' | 'day' = hours <= 1 ? 'min15' : hours <= 24 ? 'hour' : 'day';
  const hhmm = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const labelFor = (d: Date): string | null => {
    if (kind === 'day') {
      // A month of daily ticks would crowd weekday labels — label Mondays only.
      if (hours > 200) return d.getDay() === 1 ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;
      return d.toLocaleDateString(undefined, { weekday: 'short' });
    }
    // Hourly grid over 24h would crowd labels — keep ticks, label every 6h.
    if (hours > 6 && hours <= 24) return d.getHours() % 6 === 0 ? hhmm(d) : null;
    return hhmm(d);
  };

  const advance = (d: Date) => {
    if (kind === 'day') d.setDate(d.getDate() + 1);
    else if (kind === 'hour') d.setHours(d.getHours() + 1);
    else d.setMinutes(d.getMinutes() + 15);
  };

  const cursor = new Date(startMs);
  if (kind === 'day') cursor.setHours(0, 0, 0, 0);
  else if (kind === 'hour') cursor.setMinutes(0, 0, 0);
  else { cursor.setSeconds(0, 0); cursor.setMinutes(Math.floor(cursor.getMinutes() / 15) * 15); }
  while (cursor.getTime() < startMs) advance(cursor);

  const ticks: TimeTick[] = [];
  let guard = 0;
  while (cursor.getTime() <= endMs && guard++ < 800) {
    const label = labelFor(cursor);
    ticks.push({ f: (cursor.getTime() - startMs) / span, label: label ?? '', labeled: label !== null });
    advance(cursor);
  }
  return ticks;
}

// Real time axis for the chart: map each point's timestamp onto [start, now]
// so the curve and the ticks share one domain. Kept at module scope so the
// `Date.now()` read stays out of the component's render body.
function computeChartAxis(
  historyData: { value: number; ts: number | null }[],
  hours: number,
): { xFractions: number[]; ticks: TimeTick[] } {
  const endMs = Date.now();
  const startMs = endMs - hours * 3600_000;
  const span = endMs - startMs || 1;
  const xFractions = historyData.map(d => {
    const tMs = d.ts ? d.ts * 1000 : endMs;
    return Math.max(0, Math.min(1, (tMs - startMs) / span));
  });
  return { xFractions, ticks: buildTimeTicks(startMs, endMs, hours) };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PanelEntity {
  entityId: string;
  icon: string;
  name: string;
  state: string;
  active?: boolean;
  toggleable?: boolean;
  pressable?: boolean;
  unit?: string;
  entityPicture?: string;
  onToggle?: () => void;
}

export interface DeviceMeta {
  deviceId?: string;
  manufacturer?: string;
  model?: string;
  areaName?: string;
  /** Product-render thumbnail (same image the dashboard card shows); null = none */
  thumbnail?: string | null;
  allEntities?: { entityId: string; name: string; domain: string }[];
}

export interface EntityDetailPanelProps {
  /** Entity that was clicked — panel starts here, then manages selection internally */
  initialEntityId: string;
  /** ALL visible entities in stable order (primary first, then secondary) */
  entities: PanelEntity[];
  deviceName?: string;
  deviceMeta?: DeviceMeta;
  onClose: () => void;
  onEditCard?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

// ── Detail body — history fetch + render ─────────────────────────────────────

export function formatHoverTime(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 0.5) return 'Just now';
  if (diffH < 24) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diffH < 48) return `Yesterday ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EntityDetailBody({ entity, thumbnail }: { entity: PanelEntity; thumbnail?: string | null }) {
  const { getEntityHistory, getStatistics, connected, demoMode } = useHomeAssistant();
  // Product-render thumbnail, shown inside the tappable hero card. Hidden if the
  // hand-dropped PNG 404s (render-adjust pattern, same as DeviceCardV2).
  const [thumb, setThumb] = useState<{ src?: string | null; ok: boolean }>({ src: thumbnail, ok: true });
  if (thumb.src !== thumbnail) setThumb({ src: thumbnail, ok: true });
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  // Long-term statistics buckets — the data source for 7d/30d spans. Null
  // means "not using statistics" (short span, or the entity has none).
  const [stats, setStats] = useState<StatisticValue[] | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [timeSpan, setTimeSpan] = useState<TimeSpan>('24h');
  const [aggregation, setAggregation] = useState<Aggregation>('auto');

  const hours = TIME_SPANS.find(t => t.value === timeSpan)?.hours ?? 24;

  useEffect(() => {
    setIsHistoryLoading(true);
    setHoveredIndex(null);
    setStats(null);
    const base = parseFloat(entity.state);
    const nowSec = Date.now() / 1000;
    const spanSec = hours * 3600;
    const statsPeriod = hours > 200 ? 'day' : 'hour';

    if (demoMode || !connected) {
      if (!isNaN(base) && hours >= STATS_THRESHOLD_HOURS) {
        // Long spans mirror the live statistics shape: mean + min/max band.
        const bucketMs = (statsPeriod === 'day' ? 24 : 1) * 3600_000;
        const count = Math.min(Math.round((hours * 3600_000) / bucketMs), 192);
        const nowMs = Date.now();
        setStats(Array.from({ length: count }, (_, i) => {
          const start = nowMs - (count - i) * bucketMs;
          const t = i / (count - 1);
          const mean = base + Math.sin(t * Math.PI * 5) * (base * 0.05) + Math.sin(t * Math.PI * 17) * (base * 0.02);
          const spread = Math.abs(base) * (0.04 + 0.03 * Math.abs(Math.sin(t * 13)));
          return { start, end: start + bucketMs, mean, min: mean - spread, max: mean + spread };
        }));
        setIsHistoryLoading(false);
        return;
      }
      const count = Math.min(hours * 4, 192); // ~4 pts/hr, max 192
      let pts: HistoryPoint[];
      if (isNaN(base)) {
        // Non-numeric: alternate between the live state and a plausible
        // counterpart so the state timeline shows realistic labels in demo.
        const cur = entity.state;
        const other = STATE_COUNTERPART[cur.toLowerCase()] ?? (cur.toLowerCase() === 'off' ? 'on' : 'off');
        let s = cur;
        pts = Array.from({ length: count }, (_, i) => {
          if (i > 0 && Math.random() < 0.08) s = s === cur ? other : cur;
          return { s, lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
        });
      } else {
        pts = Array.from({ length: count }, (_, i) => {
          const t = i / (count - 1);
          const v = base + Math.sin(t * Math.PI * 4) * (base * 0.04) + Math.sin(t * Math.PI * 12) * (base * 0.015);
          return { s: v.toFixed(2), lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
        });
      }
      setHistory(pts);
      setIsHistoryLoading(false);
      return;
    }
    setHistory([]);
    let cancelled = false;
    (async () => {
      // Long spans: statistics first (raw history is purged after ~10 days).
      if (hours >= STATS_THRESHOLD_HOURS) {
        const buckets = await getStatistics(entity.entityId, hours, statsPeriod);
        if (cancelled) return;
        if (buckets.filter(b => b.mean != null || b.state != null).length >= 3) {
          setStats(buckets);
          setIsHistoryLoading(false);
          return;
        }
      }
      const pts = await getEntityHistory(entity.entityId, hours);
      if (cancelled) return;
      const b = parseFloat(entity.state);
      if (pts.length < 3 && !isNaN(b)) {
        const count = 48;
        setHistory(Array.from({ length: count }, (_, i) => {
          const t = i / (count - 1);
          return { s: (b + Math.sin(t * Math.PI * 3) * (b * 0.02)).toFixed(2), lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
        }));
      } else {
        setHistory(pts);
      }
      setIsHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entity.entityId, hours, connected, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build parallel arrays: values + timestamps
  const rawHistoryData = history.map(pt => {
    const value = pt.s === 'on' ? 1 : pt.s === 'off' ? 0 : parseFloat(pt.s);
    return isNaN(value) ? null : { value, ts: pt.lc ?? pt.lu ?? null };
  }).filter(Boolean) as { value: number; ts: number | null }[];

  // Statistics buckets → mean series + min/max envelope. Metered entities
  // (energy) have no mean; their state reading stands in and there's no band.
  const statsData = stats
    ?.map(b => {
      const value = b.mean ?? b.state;
      if (value == null || isNaN(value)) return null;
      return { value, ts: (b.start + (b.end - b.start) / 2) / 1000, low: b.min ?? null, high: b.max ?? null };
    })
    .filter(Boolean) as { value: number; ts: number; low: number | null; high: number | null }[] | undefined;
  const statsActive = !!statsData && statsData.length >= 3;

  const historyData = statsActive ? statsData! : applyAggregation(rawHistoryData, aggregation, hours);
  const numericPoints = historyData.map(d => d.value);
  const hasBand = statsActive && statsData!.every(d => d.low != null && d.high != null);
  const bandLow = hasBand ? statsData!.map(d => d.low as number) : undefined;
  const bandHigh = hasBand ? statsData!.map(d => d.high as number) : undefined;

  const { xFractions, ticks: timeTicks } = computeChartAxis(historyData, hours);

  const sparklineId = `edp-${entity.entityId.replace(/\./g, '-')}`;
  const rawNumeric = parseFloat(entity.state);
  const isNumeric = !isNaN(rawNumeric);
  const numericDisplay = isNumeric ? String(rawNumeric) : entity.state;
  // Boolean: all history values are 0 or 1 (on/off binary sensor)
  const isBoolean = numericPoints.length >= 3 && numericPoints.every(v => v === 0 || v === 1);

  const hoveredData = hoveredIndex !== null ? historyData[hoveredIndex] : null;
  const displayValue = hoveredData
    ? (isBoolean
        ? (hoveredData.value === 1 ? 'On' : 'Off')
        : Number.isInteger(hoveredData.value) ? String(hoveredData.value) : hoveredData.value.toFixed(1))
    : (isBoolean ? entity.state : numericDisplay);
  // Hovering a statistics bucket also surfaces its min–max range next to the time.
  const hoveredBand = hasBand && hoveredIndex !== null ? statsData![hoveredIndex] : null;
  const timeLabel = hoveredData
    ? (hoveredData.ts
        ? formatHoverTime(hoveredData.ts) + (hoveredBand ? ` · ${hoveredBand.low!.toFixed(1)}–${hoveredBand.high!.toFixed(1)}` : '')
        : null)
    : 'NOW';

  const hasChart = numericPoints.length >= 3;

  // Non-numeric entities (lights, locks, covers, media, climate modes, doors…)
  // get a state-duration timeline instead of a line chart: contiguous runs of
  // the same state, each segment proportional to its duration.
  const timeline = useMemo(() => {
    const endTs = Date.now() / 1000;
    const startTs = endTs - hours * 3600;
    const pts = history.filter(p => p.lc != null).slice().sort((a, b) => a.lc! - b.lc!);
    const segs: StateSegment[] = [];
    for (let i = 0; i < pts.length; i++) {
      const end = i + 1 < pts.length ? pts[i + 1].lc! : endTs;
      if (end <= startTs) continue;
      const start = Math.max(pts[i].lc!, startTs);
      const prev = segs[segs.length - 1];
      if (prev && prev.state === pts[i].s) prev.end = end;
      else segs.push({ state: pts[i].s, start, end });
    }
    // Fallback — no usable history but we know the current state. Show a single
    // band across the whole window so toggleable entities (lights, switches,
    // locks…) always get a duration timeline instead of an empty slot.
    if (segs.length === 0 && !isNumeric && entity.state) {
      segs.push({ state: entity.state, start: startTs, end: endTs });
    }
    return { segs, startTs, endTs };
  }, [history, hours, isNumeric, entity.state]);
  const showTimeline = !isNumeric && !isHistoryLoading && timeline.segs.length >= 1;

  // Whole hero is one tappable card: product thumb + name + switch + state. Any
  // click on it toggles (the ToggleSwitch stops propagation, so it fires once).
  const canToggle = !!(entity.toggleable && entity.onToggle && !entity.entityPicture);
  const showThumb = !!thumbnail && thumb.ok && !entity.entityPicture;
  const cardBg = canToggle
    ? (entity.active
        ? 'bg-green-500/10 hover:bg-green-500/[0.16] active:bg-green-500/20 cursor-pointer'
        : 'bg-surface-low hover:bg-surface-mid cursor-pointer')
    : showThumb
      ? 'bg-surface-low'
      : '';

  return (
    <div className="shrink-0 flex flex-col items-center gap-3 px-6 py-5 overflow-hidden">
      {entity.entityPicture && (
        // Camera feed / media artwork shown as its own block at the top, so the
        // status value and history graph below it are no longer overlaid on the
        // image (which obscured the feed).
        <div className="w-full rounded-ha-xl overflow-hidden bg-surface-low aspect-video">
          <img src={entity.entityPicture} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Tap-anywhere toggle card — thumb, name, switch and state grouped in one
            surface. Clicking anywhere toggles a controllable entity. */}
        <div
          role={canToggle ? 'button' : undefined}
          tabIndex={canToggle ? 0 : undefined}
          aria-label={canToggle ? `Toggle ${entity.name}` : undefined}
          onClick={canToggle ? entity.onToggle : undefined}
          onKeyDown={canToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entity.onToggle!(); } } : undefined}
          className={clsx('w-full rounded-ha-2xl flex flex-col items-center gap-2 px-4 py-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60', cardBg)}
        >
          {showThumb && (
            <img
              src={thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb(t => ({ ...t, ok: false }))}
              className="h-28 md:h-36 w-auto max-w-[70%] object-contain select-none pointer-events-none"
            />
          )}

          {/* Focused entity name — labels the value/graph below so it's clear which
              entity is shown, especially after switching via "Also on this device"
              (the panel header only carries the device name). */}
          <span className="max-w-full truncate text-center text-sm font-medium text-text-secondary">
            {entity.name}
          </span>

          {/* Fixed height so the hero doesn't jump between a tall toggle and a
              shorter text value when switching entities. */}
          <div className="flex w-full flex-col items-center justify-center gap-2 min-h-[80px]">
          {/* Feed/artwork entities (e.g. a camera) have nothing to toggle — show
              their state, not a control, even if flagged toggleable. */}
          {entity.toggleable && !entity.entityPicture ? (
            <>
              {entity.onToggle ? (
                <ToggleSwitch on={entity.active} onToggle={entity.onToggle} size="lg" />
              ) : (
                <div className={clsx(
                  'w-16 h-16 rounded-full flex items-center justify-center',
                  entity.active ? 'bg-green-500/20 text-green-500' : 'bg-surface-low text-text-secondary',
                )}>
                  <Icon path={entity.icon} size={28} />
                </div>
              )}
              <RollingNumericValue
                value={entity.state}
                className="text-lg font-semibold font-mono capitalize text-text-primary"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-baseline justify-center">
                {isNumeric && entity.unit ? (
                  <>
                    <RollingNumericValue value={displayValue} className="text-4xl font-bold font-mono text-text-primary" />
                    <span className="text-lg font-mono ml-2 text-text-secondary">{entity.unit}</span>
                  </>
                ) : (
                  <RollingNumericValue value={entity.state} className="text-2xl font-bold font-mono capitalize text-text-primary" />
                )}
              </div>
              {/* Time label: "NOW" at rest, timestamp on hover (numeric/boolean only) */}
              {(isNumeric || isBoolean) && (
                <span className={clsx(
                  'text-[13px] font-semibold uppercase tracking-wider transition-colors',
                  hoveredIndex !== null ? 'text-text-secondary' : 'text-ha-blue',
                )}>
                  {timeLabel}
                </span>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Domain controls — brightness/color, setpoint, position, transport…
            Rendered only for domains that have setters beyond on/off. */}
        <DomainControls entityId={entity.entityId} />

        {/* History — numeric line/area, else a state-duration timeline. Fixed
            min-height so numeric chart, timeline, loader and the empty case all
            reserve the same space (no jump when switching entities). */}
        <div className="w-full min-h-[116px] lg:min-h-[140px] flex flex-col justify-center">
        {isHistoryLoading ? (
          <div className="w-full flex items-center justify-center h-14 lg:h-24">
            <HALoader size="sm" />
          </div>
        ) : isNumeric && hasChart ? (
          <div className="w-full">
            <div className="relative w-full flex items-center h-14 lg:h-24">
              {timeTicks.map((t, i) => (
                <div
                  key={i}
                  aria-hidden
                  className={clsx('absolute top-0 bottom-0 w-px', t.labeled ? 'bg-surface-lower' : 'bg-surface-lower/50')}
                  style={{ left: `${t.f * 100}%` }}
                />
              ))}
              <div className="w-full h-full opacity-80 relative">
                <Sparkline
                  points={numericPoints}
                  on={entity.active ?? false}
                  gradientId={sparklineId}
                  stepped={isBoolean}
                  onHover={setHoveredIndex}
                  xFractions={xFractions}
                  bandLow={bandLow}
                  bandHigh={bandHigh}
                  fillHeight
                />
              </div>
            </div>
            {timeTicks.some(t => t.labeled) && (
              <div className="relative w-full h-4 mt-1">
                {timeTicks.filter(t => t.labeled).map((t, i) => {
                  const tx = t.f < 0.04 ? '0%' : t.f > 0.96 ? '-100%' : '-50%';
                  return (
                    <span
                      key={i}
                      className="absolute top-0 text-[10px] leading-none text-text-tertiary whitespace-nowrap tabular-nums"
                      style={{ left: `${t.f * 100}%`, transform: `translateX(${tx})` }}
                    >
                      {t.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ) : showTimeline ? (
          <StateTimeline segments={timeline.segs} startTs={timeline.startTs} endTs={timeline.endTs} />
        ) : null}
        </div>

        {/* Controls — the slot reserves the loaded controls' height up front (they
            only mount once history arrives) so the dialog doesn't grow when the
            chart finishes loading. Numeric entities stack a second (aggregation)
            control on mobile, so they need more room there; one row on desktop. */}
        <div className={clsx('w-full', isNumeric ? 'min-h-[90px] lg:min-h-[46px]' : 'min-h-[46px]')}>
        {!isHistoryLoading && ((isNumeric && hasChart) || showTimeline) && (
          <div className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 pt-1">
            <SegmentedControl
              segments={TIME_SPANS.map(t => ({ value: t.value, label: t.label }))}
              value={timeSpan}
              onChange={v => setTimeSpan(v as TimeSpan)}
              className="text-xs"
            />
            {/* Statistics spans are pre-bucketed by the recorder (hour/day) —
                the aggregation picker only applies to raw history. */}
            {isNumeric && hasChart && !statsActive && (
              <>
                <div className="lg:hidden">
                  <SegmentedControl
                    segments={AGGREGATIONS.map(a => ({ value: a.value, label: a.label }))}
                    value={aggregation}
                    onChange={v => setAggregation(v as Aggregation)}
                    className="text-xs"
                  />
                </div>
                <div className="hidden lg:block">
                  <Dropdown
                    options={AGGREGATIONS.map(a => ({ value: a.value, label: a.label }))}
                    value={aggregation}
                    onChange={v => setAggregation(v as Aggregation)}
                  />
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Info tab ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-ha-4 py-ha-3">
      <span className="text-sm text-text-secondary shrink-0">{label}</span>
      <span className="text-sm text-text-primary text-right font-mono break-all">{value}</span>
    </div>
  );
}

function DeviceInfoTab({ deviceName, deviceMeta, entities, onNavigate }: {
  deviceName?: string;
  deviceMeta?: DeviceMeta;
  entities: PanelEntity[];
  /** Close the dialog before routing to the settings device page. */
  onNavigate: () => void;
}) {
  const router = useRouter();
  const { isAdmin } = useHomeAssistant();
  const rows: { label: string; value: string }[] = [];
  if (deviceName) rows.push({ label: 'Device', value: deviceName });
  if (deviceMeta?.areaName) rows.push({ label: 'Area', value: deviceMeta.areaName });
  if (deviceMeta?.manufacturer) rows.push({ label: 'Manufacturer', value: deviceMeta.manufacturer });
  if (deviceMeta?.model) rows.push({ label: 'Model', value: deviceMeta.model });
  if (deviceMeta?.deviceId) rows.push({ label: 'Device ID', value: deviceMeta.deviceId });

  const allEntities = deviceMeta?.allEntities ?? entities.map(e => ({
    entityId: e.entityId,
    name: e.name,
    domain: e.entityId.split('.')[0],
  }));

  return (
    <div className="flex-1 overflow-y-auto px-0 py-ha-2">
      {deviceMeta?.deviceId && (
        <div className="px-ha-4 mb-ha-4">
          <button
            type="button"
            onClick={() => {
              onNavigate();
              router.push(`/settings/devices?device=${encodeURIComponent(deviceMeta.deviceId!)}`);
            }}
            className="flex w-full items-center gap-ha-3 rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-mid"
          >
            <Icon path={mdiCogOutline} size={20} className="text-text-secondary shrink-0" />
            <span className="flex-1 text-sm font-medium text-text-primary">Open device page</span>
            <Icon path={mdiChevronRight} size={18} className="text-text-tertiary shrink-0" />
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <div className="px-ha-4 mb-ha-4">
          <ListSection>
            {rows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
          </ListSection>
        </div>
      )}
      <div className="px-ha-4">
        <ListSection title={`Controls & sensors (${allEntities.length})`}>
          {allEntities.map(e => (
            <div key={e.entityId} className="flex items-center justify-between gap-4 px-ha-4 py-ha-3">
              <span className="text-sm text-text-primary capitalize">{e.name || e.domain}</span>
              {isAdmin && (
                <span className="text-xs text-text-tertiary font-mono truncate max-w-[55%] text-right">{e.entityId}</span>
              )}
            </div>
          ))}
        </ListSection>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function EntityDetailPanel({
  initialEntityId,
  entities,
  deviceName,
  deviceMeta,
  onClose,
  onEditCard,
  isFavorite,
  onToggleFavorite,
}: EntityDetailPanelProps) {
  const [tab, setTab] = useState<'stats' | 'info'>('stats');
  const [focusedEntityId, setFocusedEntityId] = useState(initialEntityId);

  // Focus the clicked entity (and reset tab) whenever a new card is opened
  useEffect(() => {
    setTab('stats');
    setFocusedEntityId(initialEntityId);
  }, [initialEntityId]);

  const focusedEntity = entities.find(e => e.entityId === focusedEntityId) ?? entities[0];
  // Stable list of the device's other entities — always everything except the
  // main (initial) entity, so a row stays put when selected. Selecting a row
  // focuses it in the hero; selecting it again returns to the main entity.
  const otherEntities = entities.filter(e => e.entityId !== initialEntityId);

  const iconButton = 'p-1.5 rounded-full transition-colors';

  return (
    <div className="h-full flex flex-col">
      {/* Header — area eyebrow over a large device name; actions top-right */}
      <div className="flex items-start justify-between gap-2 px-ha-4 pt-ha-4 pb-ha-2 shrink-0">
        <div className="min-w-0 flex-1">
          {deviceMeta?.areaName && (
            <p className="text-sm text-text-tertiary truncate leading-none mb-0.5">{deviceMeta.areaName}</p>
          )}
          {deviceName && (
            <p className="text-2xl font-bold text-text-primary truncate leading-tight">{deviceName}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 rounded-full bg-surface-low p-0.5">
          {onToggleFavorite && (
            <button
              className={clsx(
                iconButton,
                isFavorite
                  ? 'text-amber-500 hover:bg-surface-mid'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-mid',
              )}
              onClick={onToggleFavorite}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            >
              <Icon path={isFavorite ? mdiStar : mdiStarOutline} size={24} />
            </button>
          )}
          <button
            className={clsx(iconButton, 'text-text-secondary hover:text-text-primary hover:bg-surface-mid')}
            onClick={() => setTab(tab === 'info' ? 'stats' : 'info')}
            title={tab === 'info' ? 'Back to stats' : 'Device info'}
          >
            <Icon path={tab === 'info' ? mdiInformation : mdiInformationOutline} size={24} />
          </button>
          {onEditCard && (
            <button
              className={clsx(iconButton, 'text-text-secondary hover:text-text-primary hover:bg-surface-mid')}
              onClick={onEditCard}
              title="Edit card"
            >
              <Icon path={mdiPencilOutline} size={24} />
            </button>
          )}
          <button
            className={clsx(iconButton, 'text-text-secondary hover:text-text-primary hover:bg-surface-mid')}
            onClick={onClose}
            title="Close"
          >
            <Icon path={mdiClose} size={24} />
          </button>
        </div>
      </div>

      {tab === 'info' ? (
        <DeviceInfoTab deviceName={deviceName} deviceMeta={deviceMeta} entities={entities} onNavigate={onClose} />
      ) : (
        <>
          {/* Big preview — the focused entity (clicked card / row). The product
              thumbnail now lives inside the body's tappable hero card. */}
          {focusedEntity && <EntityDetailBody key={focusedEntity.entityId} entity={focusedEntity} thumbnail={deviceMeta?.thumbnail} />}

          {/* Other entities on the device — click to focus */}
          {otherEntities.length > 0 && (
            <div className="flex-1 overflow-y-auto px-ha-4 pb-ha-4 pt-ha-2 min-h-0">
              <ListSection title="Also on this device">
                {otherEntities.map(entity => {
                  // Selected = currently shown in the hero. Clicking toggles: focus
                  // this entity, or fall back to the main entity when already selected.
                  const isSelected = entity.entityId === focusedEntityId;
                  return (
                  <div
                    key={entity.entityId}
                    onClick={() => setFocusedEntityId(isSelected ? initialEntityId : entity.entityId)}
                    aria-pressed={isSelected}
                    className={clsx(
                      'flex items-center gap-ha-3 px-ha-4 py-ha-2 cursor-pointer transition-colors',
                      isSelected ? 'bg-ha-blue/10' : 'hover:bg-surface-low',
                    )}
                  >
                    <div className={clsx(
                      'w-7 h-7 flex items-center justify-center shrink-0',
                      isSelected ? 'text-ha-blue' : entity.active && entity.toggleable ? 'text-green-500' : 'text-text-tertiary',
                    )}>
                      <Icon path={entity.icon} size={16} />
                    </div>
                    <span className={clsx('flex-1 text-sm truncate', isSelected ? 'font-medium text-ha-blue' : 'text-text-primary')}>
                      {entity.name}
                    </span>
                    {entity.toggleable && entity.onToggle ? (
                      <ToggleSwitch on={entity.active} onToggle={entity.onToggle} />
                    ) : entity.pressable && entity.onToggle ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); entity.onToggle!(); }}
                        className="flex items-center justify-center shrink-0 w-11 h-[26px] rounded-full bg-surface-mid hover:bg-surface-lower transition-colors"
                      >
                        <Icon path={mdiPower} size={12} className="text-text-secondary" />
                      </button>
                    ) : (
                      <RollingNumericValue
                        value={entity.state}
                        className="text-sm font-medium font-mono shrink-0 text-text-secondary"
                      />
                    )}
                  </div>
                  );
                })}
              </ListSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}
