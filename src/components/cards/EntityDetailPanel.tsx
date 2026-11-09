'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { mdiPencilOutline, mdiStar, mdiStarOutline, mdiCogOutline, mdiInformationOutline, mdiRobotOutline, mdiOpenInNew } from '@mdi/js';
import { clsx } from 'clsx';
import { Button, CircularProgress, Icon, IconBadge, IconButton, iconButtonClass, ListSection, RollingNumericValue, SectionLabel, SegmentedControl, Dropdown, HALoader, ToggleSwitch } from '../ui';
import { DialogFrame, DetailRows, GroupLabel } from './dialogKit';
import { StateTimeline, type StateSegment } from '../ui/StateTimeline';
import { Sparkline } from '../ui/Sparkline';
import { DomainControls } from './DeviceControls';
import { DeviceThumbnailPicker, type DeviceThumbnailPickerProps } from './DeviceThumbnailPicker';
import { useDebugFlags } from '@/contexts';
import { useEntity, useHomeAssistant, peekEntities } from '@/hooks/useHomeAssistant';
import { useDeviceInfo } from '@/hooks/useDevices';
import { useIdleMarquee } from '@/hooks/useIdleMarquee';
import { stateParts } from '@/lib/homeassistant/entityHelpers';
import { READING } from '@/lib/utils';
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

// Raw points for a day, hourly means for two, daily beyond — picked from the
// span, never by hand: nobody opens a thermostat to choose an averaging window.
function applyAggregation(
  data: { value: number; ts: number | null }[],
  hours: number,
): { value: number; ts: number | null }[] {
  const mode = hours <= 24 ? 'raw' : hours <= 48 ? 'hourly' : 'daily';

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
// gets a text label — and only those draw a gridline; the rest are kept so the
// labels land on real boundaries.
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

function formatHeld(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 1) return 'Just now';
  if (m < 60) return `For ${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `For ${h}h ${m % 60}m` : `For ${h}h`;
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
  /** Extra facts about the state — see `stateExtras`. Card-only for now. */
  details?: string[];
  /** A light's current colour, as a CSS colour. Card-only for now. */
  dotColor?: string;
  /** Registry entity_category — 'diagnostic' entities list under their own heading. */
  category?: string;
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
  /**
   * Card thumbnail override + the auto candidate. Passing this puts the image
   * picker in the settings (cog) view; omit it where card config isn't available.
   */
  thumbnailPicker?: DeviceThumbnailPickerProps;
  /** Which hero arrangement to draw — see `HERO_LAYOUTS`. */
  heroLayout?: HeroLayout;
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

/**
 * True while the pointer is over the region spread with `props`, and for a beat
 * after it leaves — so a click released just outside the region still counts as
 * belonging to it.
 */
function useHoverGuard(delay = 400) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return {
    active,
    props: {
      onPointerEnter: () => {
        if (timer.current) clearTimeout(timer.current);
        setActive(true);
      },
      onPointerLeave: () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setActive(false), delay);
      },
    },
  };
}

/**
 * Ways to lay out the hero — the block that carries the reading and the
 * control. Swappable while the design is being settled; the rig
 * (/dev/entity-matrix) offers all four.
 */
export const HERO_LAYOUTS = [
  { value: 'surface', label: 'Surface' },
  { value: 'plain', label: 'Plain' },
  { value: 'band', label: 'Band' },
  { value: 'display', label: 'Display' },
] as const;
export type HeroLayout = typeof HERO_LAYOUTS[number]['value'];

export function EntityDetailBody({ entity, thumbnail, headerName, historyView = 'full', showControls = true, showHero = true, heroLayout = 'band', pastTab: pastTabProp, onPastTabChange, afterHero }: {
  entity: PanelEntity;
  thumbnail?: string | null;
  /**
   * Title already shown above (the device name). The hero drops its own name
   * label when it would just repeat it — single-entity devices, mostly.
   */
  headerName?: string;
  /**
   * 'full' — chart / state timeline with span + aggregation pickers (history view)
   * 'none' — no history at all (skips the fetch). What the controls view uses:
   *          the past lives behind the History tab, never on the first screen.
   */
  historyView?: 'full' | 'none';
  /** Domain controls (brightness, setpoint, transport…) — off in the history view */
  showControls?: boolean;
  /**
   * Product render, name, big value and the toggle. Off in the history view,
   * which is only the chart, its span controls and the log.
   */
  showHero?: boolean;
  /** Which hero arrangement to draw — see `HERO_LAYOUTS`. */
  heroLayout?: HeroLayout;
  /** Chart-or-log, when the owner drives it; uncontrolled if omitted. */
  pastTab?: 'history' | 'log';
  onPastTabChange?: (view: 'history' | 'log') => void;
  /** Sits between the hero and its controls — the device's entity chips. */
  afterHero?: React.ReactNode;
}) {
  const { getEntityHistory, getStatistics, connected, demoMode, haUrl } = useHomeAssistant();
  const { hideCardImagesEnabled } = useDebugFlags();
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
  // Scrubbing the chart leftwards walks back in time, so the digits roll *down*
  // to meet you (and up going forwards) — the readout moves with your hand
  // instead of always flicking the same way.
  const [scrubDirection, setScrubDirection] = useState<'up' | 'down'>('up');
  const lastHoverIndex = useRef<number | null>(null);
  const handleChartHover = (index: number | null) => {
    if (index != null && lastHoverIndex.current != null && index !== lastHoverIndex.current) {
      setScrubDirection(index < lastHoverIndex.current ? 'down' : 'up');
    }
    lastHoverIndex.current = index;
    setHoveredIndex(index);
  };
  // The state under the cursor on the timeline (the categorical counterpart of
  // `hoveredIndex` on the chart) — both feed the hero, so scrubbing the past
  // shows what the entity read then, not what it reads now.
  const [hoveredSeg, setHoveredSeg] = useState<{ state: string; ts: number } | null>(null);
  // Chart or log — the two ways to read the same past, toggled in place. The
  // owner can drive it instead (the dialog keeps the choice across tab
  // switches); uncontrolled everywhere else.
  const [ownPastTab, setOwnPastTab] = useState<'history' | 'log'>('history');
  const pastTab = pastTabProp ?? ownPastTab;
  const setPastTab = onPastTabChange ?? setOwnPastTab;
  // The hero is one giant tap-to-toggle target sitting right above the sliders,
  // swatches and the graph. While the pointer is on one of those — and for a
  // beat after it leaves, so a drag released over the hero doesn't count — the
  // hero disarms: no click, no pointer cursor. Two guards, not one: the past
  // block also disarms the switch itself (you're reading a moment that isn't
  // now, so a click there would set the future from the past), while hovering
  // a slider must leave the switch usable.
  const controlGuard = useHoverGuard();
  const pastGuard = useHoverGuard();
  const nearControl = controlGuard.active || pastGuard.active;

  const [timeSpan, setTimeSpan] = useState<TimeSpan>('24h');

  const hours = TIME_SPANS.find(t => t.value === timeSpan)?.hours ?? 24;

  useEffect(() => {
    if (historyView === 'none') return;
    setIsHistoryLoading(true);
    setHoveredIndex(null);
    setHoveredSeg(null);
    setStats(null);
    const base = parseFloat(entity.state);
    const nowSec = Date.now() / 1000;
    const spanSec = hours * 3600;
    const statsPeriod = hours > 200 ? 'day' : 'hour';

    // Raw history without a connection is synthesised by the provider (so the
    // card sparkline and this chart draw the same curve); only the statistics
    // shape — mean plus a min/max band — still has to be faked here.
    if ((demoMode || !connected) && !isNaN(base) && hours >= STATS_THRESHOLD_HOURS) {
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
  }, [entity.entityId, hours, connected, demoMode, historyView]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const historyData = statsActive ? statsData! : applyAggregation(rawHistoryData, hours);
  const numericPoints = historyData.map(d => d.value);
  const hasBand = statsActive && statsData!.every(d => d.low != null && d.high != null);
  const bandLow = hasBand ? statsData!.map(d => d.low as number) : undefined;
  const bandHigh = hasBand ? statsData!.map(d => d.high as number) : undefined;

  const { xFractions, ticks: timeTicks } = computeChartAxis(historyData, hours);
  // The time labels under the plot — shared by the line chart and the state
  // timeline, which draw the same window.
  const tickLabels = timeTicks.some(t => t.labeled) && (
    <div className="relative mt-1.5 h-4 w-full shrink-0">
      {timeTicks.filter(t => t.labeled).map((t, i) => {
        const tx = t.f < 0.04 ? '0%' : t.f > 0.96 ? '-100%' : '-50%';
        return (
          <span
            key={i}
            className="absolute top-0 whitespace-nowrap text-xs leading-4 tabular-nums text-text-tertiary"
            style={{ left: `${t.f * 100}%`, transform: `translateX(${tx})` }}
          >
            {t.label}
          </span>
        );
      })}
    </div>
  );

  const sparklineId = `edp-${entity.entityId.replace(/\./g, '-')}`;
  // Numeric-ness comes from the *stored* state, never from the label: a label
  // can carry a unit, a currency code or "1 h 12 min", and re-parsing that is
  // how a duration ends up rendered as "1" with an "s" glued on. The formatted
  // value comes from stateParts, so the hero, the card and the row agree.
  const storedEntity = useEntity(entity.entityId);
  const valueParts = storedEntity ? stateParts(storedEntity) : { text: entity.state, unit: entity.unit };
  const rawNumeric = parseFloat(storedEntity?.state ?? entity.state);
  const isNumeric = !isNaN(rawNumeric);
  const heroUnit = storedEntity ? valueParts.unit : entity.unit;
  const numericDisplay = isNumeric ? valueParts.text : entity.state;
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

  // A reading with a known range is a position on a scale, not just a figure —
  // draw it as one. Percentages carry their range implicitly; number/input_number
  // (and anything else with min/max attributes) state theirs. Everything else has
  // no scale to sit on and stays a plain figure.
  const gaugeFraction = (() => {
    if (!isNumeric) return null;
    const attrs = storedEntity?.attributes as Record<string, unknown> | undefined;
    const attrNum = (k: string) => (typeof attrs?.[k] === 'number' ? (attrs[k] as number) : null);
    const min = attrNum('min') ?? (heroUnit === '%' ? 0 : null);
    const max = attrNum('max') ?? (heroUnit === '%' ? 100 : null);
    if (min === null || max === null || max <= min) return null;
    const value = hoveredData ? hoveredData.value : rawNumeric;
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  })();

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
  // How long the current state has held — "for 2h 14m" under the hero. Only
  // when the history actually saw it begin; a state older than the window (or
  // the no-history fallback band) says nothing rather than guessing.
  const lastSeg = timeline.segs[timeline.segs.length - 1];
  const heldFor = showTimeline && lastSeg && lastSeg.start > timeline.startTs + 1
    ? formatHeld(timeline.endTs - lastSeg.start)
    : null;

  // Newest first, capped — a chatty sensor can hold hundreds of runs in 24h and
  // nobody scrolls past the last few dozen.
  const logEntries = [...timeline.segs].reverse().slice(0, 40);

  // Scrubbing the past: the hero reads the hovered moment rather than now, and
  // its timestamp says which moment (in the accent, so "this is not live" is
  // obvious at a glance). Numeric entities scrub the chart, everything else
  // scrubs the state timeline — same treatment either way.
  const scrubbedState = hoveredSeg ? hoveredSeg.state.replace(/_/g, ' ') : null;
  const scrubTime = hoveredData?.ts
    ? formatHoverTime(hoveredData.ts) + (hoveredBand ? ` · ${hoveredBand.low!.toFixed(1)}–${hoveredBand.high!.toFixed(1)}` : '')
    : hoveredSeg ? formatHoverTime(hoveredSeg.ts) : null;
  /**
   * Timestamp shared by every layout — mounted only while a moment is being
   * scrubbed, never as a reserved slot, and it fades up on arrival so landing on
   * the chart reads as the moment appearing rather than the hero jumping.
   * Callers pin it out of flow (or ride it on the value's own baseline row),
   * so it comes and goes without nudging the reading or the icon.
   */
  const stampNode = (className?: string) => scrubTime ? (
    <span className={clsx('ha-scrub-stamp-in shrink-0 whitespace-nowrap text-xs font-semibold leading-none text-ha-blue', className)}>
      {scrubTime}
    </span>
  ) : null;

  // Whole hero is one tappable card: product thumb + name + switch + state. Any
  // click on it toggles (the ToggleSwitch stops propagation, so it fires once).
  const canToggle = !!(entity.toggleable && entity.onToggle && !entity.entityPicture) && !nearControl;
  const nameIsDuplicate = !!headerName && headerName.trim().toLowerCase() === entity.name.trim().toLowerCase();
  // Same flag the device card reads: images off means no product render here
  // either, so the dialog matches the cards it was opened from.
  const showThumb = !hideCardImagesEnabled && !!thumbnail && thumb.ok && !entity.entityPicture;
  // Two-column hero (big product render | state or controls) whenever there's a
  // thumbnail. No surface behind it — the render carries the visual weight.
  // The value always sits on its own surface — in the dialog it floats over the
  // device render, so it needs a ground of its own to stay legible. Translucent
  // + blurred rather than opaque, so the render still reads through it. The
  // surface stays neutral whatever the state: the switch and the reading already
  // say "on", and a green wash under them only shouted it.
  const cardBg = showThumb
    ? (canToggle ? 'cursor-pointer' : '')
    : clsx(
        'bg-surface-default/85 backdrop-blur-md',
        canToggle && 'hover:bg-surface-low/90 active:bg-surface-mid/90 cursor-pointer',
      );

  // ── Hero pieces ────────────────────────────────────────────────────────────
  // Every layout below is a different arrangement of the same two things: the
  // control (if the entity has one) and the reading. Written once here so a new
  // layout is a wrapper, not a copy of the whole hero.

  /** The switch — or, for a toggleable entity with no handler, a state glyph. */
  const renderControl = (size: 'sm' | 'md' | 'lg' | 'xl') => {
    if (!entity.toggleable || entity.entityPicture) return null;
    // Scrubbing the past disarms the switch: the reading beside it is a past one,
    // and it stays disarmed for a beat after the pointer leaves the graph so a
    // click that started as a scrub doesn't land as a toggle.
    if (entity.onToggle) return <ToggleSwitch on={entity.active} onToggle={entity.onToggle} size={size} disabled={pastGuard.active} />;
    const box = size === 'xl' ? 'w-20 h-20' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
    return (
      <div className={clsx(
        'shrink-0 rounded-full flex items-center justify-center',
        box,
        entity.active ? 'bg-green-500/20 text-green-500' : 'bg-surface-mid text-text-secondary',
      )}>
        <Icon path={entity.icon} size={size === 'xl' ? 34 : size === 'lg' ? 28 : 20} />
      </div>
    );
  };

  /**
   * The reading. `gauge` draws a ranged value as an arc (only the layouts with
   * the room ask for it); `align` decides whether long text centres or runs from
   * the left. Text states use the card's marquee — per-character rolling digits
   * eat the spaces and turn a firmware build into one run-on word.
   * `xl` is the display hero's: 34/600 with tight tracking, unit 15 secondary,
   * and a word set at the same size as a figure would be.
   */
  const renderReading = (opts: { scale: 'sm' | 'md' | 'lg' | 'xl'; gauge?: boolean; align?: 'center' | 'left' }) => {
    const { scale, gauge, align = 'center' } = opts;
    // The reading is the sheet's headline — bigger than the device title above
    // it, which steps down to make room. 32 on a phone, 40 from lg.
    const numberClass = scale === 'xl' ? 'text-[32px] lg:text-[40px] leading-tight tracking-tight' : scale === 'lg' ? 'text-3xl' : scale === 'md' ? 'text-2xl' : 'text-lg';
    const unitClass = scale === 'xl' ? 'text-sm ml-1' : scale === 'lg' ? 'text-base ml-2' : 'text-sm ml-1';
    // Mono for a figure, sans for anything else — the one rule, from one regex.
    const mono = READING.test(displayValue) && 'font-mono';
    if (gauge && gaugeFraction !== null) {
      return (
        <CircularProgress
          progress={gaugeFraction}
          size={showThumb ? 108 : 116}
          strokeWidth={8}
          className={entity.active ? 'text-green-500' : 'text-ha-blue'}
          trackClassName="text-surface-low"
        >
          <span className="flex items-baseline">
            <RollingNumericValue value={displayValue} direction={scrubDirection} className={clsx('text-2xl font-semibold text-text-primary', mono)} />
            {heroUnit && <span className={clsx('text-sm ml-1 text-text-secondary', mono)}>{heroUnit}</span>}
          </span>
        </CircularProgress>
      );
    }
    if (isNumeric && heroUnit) {
      return (
        <span className={clsx('flex min-w-0 items-baseline', align === 'center' ? 'justify-center' : 'justify-start')}>
          <RollingNumericValue value={displayValue} direction={scrubDirection} className={clsx('font-semibold text-text-primary', mono, numberClass)} />
          <span className={clsx('text-text-secondary', mono, unitClass)}>{heroUnit}</span>
        </span>
      );
    }
    // A word, not a figure: "Heat", "Docked", "On". Mono is for readings; a
    // word set in mono reads as log output (the rows below draw the same line).
    return (
      <span className={clsx(
        'ha-card-marquee block w-full truncate font-semibold tracking-tight capitalize text-text-primary',
        numberClass,
        align === 'center' && 'text-center',
      )}>
        <span data-marquee>{scrubbedState ?? displayValue}</span>
      </span>
    );
  };

  // The span, built once: it sits in the history header on a desktop and under
  // the graph on a phone, where the header has no room beside the toggle.
  // On the 32 tier beside the History/Log switch: the shared pill is 38 tall,
  // so its trigger is pinned to h-8 from out here (child variants out-rank the
  // trigger's own padding without touching the component).
  const spanPicker = (
    <Dropdown
      className="shrink-0 [&>button]:h-8 [&>button>span]:h-full [&>button>span]:py-0 [&>button>span]:text-xs"
      options={TIME_SPANS.map(t => ({ value: t.value, label: t.label }))}
      value={timeSpan}
      onChange={v => setTimeSpan(v as TimeSpan)}
    />
  );

  // Whole hero is one tappable target wherever it can toggle.
  const tapProps = canToggle
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': `Toggle ${entity.name}`,
        onClick: entity.onToggle,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entity.onToggle!(); }
        },
      }
    : {};

  return (
    <div className="shrink-0 flex flex-col items-center gap-ha-2 overflow-hidden">
      {showHero && entity.entityPicture && (
        // Camera feed / media artwork shown as its own block at the top, so the
        // status value and history graph below it are no longer overlaid on the
        // image (which obscured the feed).
        <div className="w-full rounded-ha-xl overflow-hidden bg-surface-low aspect-video">
          <img src={entity.entityPicture} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col items-center gap-ha-4 w-full">
        {/* The reading and its switch stand on the panel's own ground, above
            everything else — the main control is the biggest thing in the
            dialog, not a row inside the settings panel. What you can *set*
            (and what it did) stays on the surface below. */}
        {showHero && (heroLayout === 'surface' || heroLayout === 'plain') ? (
        /* ── Surface / Plain ── the value centred in its own column, the render
           (when there is one) beside it. 'plain' is the same arrangement with
           the panel behind the value taken away. */
        <div
          {...tapProps}
          className={clsx(
            'relative w-full rounded-ha-2xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60',
            showThumb
              ? 'grid grid-cols-2 items-stretch gap-4'
              : 'flex flex-col items-center gap-1.5 px-4 py-3',
            heroLayout === 'plain' ? (canToggle ? 'cursor-pointer' : '') : cardBg,
          )}
        >
          {/* When the reading last moved — the question every glance at a value
              eventually asks. Corner of the surface, out of the value's way. */}
          {stampNode('pointer-events-none absolute right-3 top-2')}
          {showThumb && (
            <img
              src={thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb(t => ({ ...t, ok: false }))}
              className="h-40 md:h-52 w-full object-contain select-none pointer-events-none"
            />
          )}

          <div className={clsx(
            'flex min-w-0 flex-col items-center gap-2',
            showThumb ? 'h-full justify-center px-ha-3 py-ha-4' : 'w-full',
          )}>
          {/* Wordy states (Unavailable, Playing, Cloudy, Docked…) lead with the
              entity's own glyph — without a render or an arc the column is
              otherwise text floating in space. */}
          {!isNumeric && !showThumb && gaugeFraction === null && !entity.toggleable && (
            <Icon path={entity.icon} size={32} className="text-text-tertiary" />
          )}

          {/* Focused entity name — labels the value below so it's clear which
              entity is shown, especially after switching via "On this device".
              Skipped when the header above already says exactly this. */}
          {!nameIsDuplicate && (
            <span className={clsx('max-w-full truncate text-sm font-medium text-text-secondary', !showThumb && 'text-center')}>
              {entity.name}
            </span>
          )}

          {/* Fixed height so the hero doesn't jump between a tall toggle and a
              shorter text value when switching entities. */}
          <div className="flex w-full flex-col items-center justify-center gap-1.5 min-h-[64px]">
            {renderControl('xl')}
            <div className={clsx('flex w-full min-w-0 flex-col gap-1', showThumb && !entity.toggleable ? 'items-start' : 'items-center')}>
              {renderReading({ scale: 'lg', gauge: true })}
            </div>
          </div>
          </div>
        </div>
        ) : showHero && heroLayout === 'band' ? (
        /* ── Band ── one row: what it is on the left, what it reads in the
           middle, what you can do about it on the right. The shortest hero
           there is — it gives the height back to the controls and the graph. */
        <div
          {...tapProps}
          className={clsx(
            'relative flex w-full items-center gap-ha-3 rounded-ha-2xl px-ha-3 py-ha-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60',
            cardBg,
          )}
        >
          {showThumb ? (
            <img
              src={thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb(t => ({ ...t, ok: false }))}
              className="h-16 w-16 shrink-0 select-none object-contain pointer-events-none"
            />
          ) : (
            <Icon path={entity.icon} size={28} className="shrink-0 text-text-tertiary" />
          )}
          {/* What it is, then what it says — the label reads first and the value
              lands under it, the way a caption sits over its figure. Both centred
              in the band: the icon holds the left, the control the right. */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            {!nameIsDuplicate && (
              <span className="max-w-full truncate text-xs font-medium text-text-tertiary">{entity.name}</span>
            )}
            {/* The scrubbed moment fades in centred under the reading, out of
                flow, so it can't nudge the value off centre while you scrub.
                `inset-x-0 text-center` rather than a translate — the animation
                owns `transform`.
                `w-full`, not shrink-to-fit: a text reading is drawn in a
                `.ha-card-marquee` box, which is an inline-size *container* and
                so contributes nothing to its parent's intrinsic width — a
                content-sized wrapper collapses to zero and the state vanishes. */}
            <span className="relative flex w-full min-w-0 items-baseline justify-center">
              {renderReading({ scale: 'md', align: 'center' })}
              {stampNode('absolute inset-x-0 top-full pt-0.5 text-center')}
            </span>
          </div>
          {renderControl('md')}
        </div>
        ) : showHero && heroLayout === 'display' ? (
        /* ── Display ── one tactile surface: a tinted badge says what it is and
           whether it's on, the state is the biggest type on the sheet with how
           long it has held underneath, and the switch sits at the thumb's edge.
           The whole surface is the tap target; on, it lifts like its card. */
        <div
          {...tapProps}
          className={clsx(
            'relative flex w-full items-center gap-ha-2 rounded-ha-2xl bg-surface-low py-2 pl-2 pr-3 outline-none transition-[background-color,box-shadow,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ha-blue/60',
            canToggle && 'cursor-pointer hover:bg-surface-mid/60 active:scale-[0.99] motion-reduce:active:scale-100',
            entity.toggleable && entity.active && 'ha-lift',
          )}
        >
          {showThumb ? (
            <img
              src={thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb(t => ({ ...t, ok: false }))}
              className="h-10 w-10 shrink-0 select-none object-contain pointer-events-none"
            />
          ) : (
            // One column down the sheet: area, device, entity, reading. The
            // header is a 48px button, then `gap-ha-2`, then the words — so the
            // hero is 8px of padding + a 40px badge (the same 48), then the same
            // gap, and its words start on the header's left edge.
            <IconBadge
              icon={entity.icon}
              size={40}
              tone={entity.state === 'unavailable' ? 'warning' : entity.toggleable && entity.active ? 'success' : 'default'}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {!nameIsDuplicate && (
              <span className="truncate text-[15px] font-semibold leading-5 text-text-secondary">{entity.name}</span>
            )}
            {/* flex-1, not content-sized — see the band hero above: a marquee
                box has no intrinsic width to size a wrapper from. */}
            <span className="flex min-w-0 items-baseline">
              <span className="flex min-w-0 flex-1 items-baseline">
                {renderReading({ scale: 'xl', align: 'left' })}
              </span>
            </span>
            {/* One quiet line under the state: the moment under your finger
                while scrubbing, otherwise how long it has been this way. */}
            {scrubTime
              ? stampNode('leading-4')
              : heldFor && <span className="truncate text-xs leading-4 text-text-secondary">{heldFor}</span>}
          </div>
          {/* The 44px switch is the desktop hero's; a phone takes the 38. */}
          {entity.onToggle && <span className="contents lg:hidden">{renderControl('lg')}</span>}
          {entity.onToggle && <span className="hidden lg:contents">{renderControl('xl')}</span>}
        </div>
        ) : showHero ? null : (
          // History view — the same surface, type and stacking as the hero, so
          // scrubbing the chart reads as the hero's value moving through time
          // rather than a different component taking over.
          <div className="flex w-full flex-col items-center gap-1 rounded-ha-2xl bg-surface-default/85 px-4 py-4 backdrop-blur-md">
            <span className="flex max-w-full items-baseline">
              <RollingNumericValue
                value={displayValue}
                direction={scrubDirection}
                className={clsx('font-bold font-mono text-text-primary', isNumeric ? 'text-4xl' : 'text-2xl capitalize')}
              />
              {isNumeric && heroUnit && <span className="ml-2 font-mono text-lg text-text-secondary">{heroUnit}</span>}
            </span>
            <span className={clsx(
              'text-[13px] font-semibold uppercase tracking-wider transition-colors',
              hoveredIndex !== null ? 'text-text-secondary' : 'text-ha-blue',
            )}>
              {timeLabel}
            </span>
          </div>
        )}

        {afterHero}

        {/* Everything you can set, plus what it did — one surface, hairline
            divided. Hidden when every slot in it is empty — a bare on/off
            switch has no settings and no history to show, and must not leave an
            empty grey box under its hero. (`:empty` on the surface itself isn't
            enough: the controls wrapper is always mounted, just blank.) */}
        <div className="flex w-full flex-col gap-ha-4 [&:not(:has(>*:not(:empty)))]:hidden">
        {/* Domain controls — brightness/color, setpoint, position, transport…
            Rendered only for domains that have setters beyond on/off. Grouped on
            one surface so "everything you can set" reads as a single panel
            instead of a stack of loose rows. Deliberately excludes the on/off
            hero above it: that's the device's state, not one of its settings. */}
        {showControls && (
          <div data-controls {...controlGuard.props} className="w-full empty:hidden [&>*]:w-full">
            <DomainControls entityId={entity.entityId} />
          </div>
        )}

        {/* History — numeric line/area, else a state-duration timeline. Fixed
            min-height so numeric chart, timeline, loader and the empty case all
            reserve the same space (no jump when switching entities). */}
        {historyView === 'full' && (
        // The past shares the device's surface — a hairline separates "now" from
        // "before" instead of a second panel. Chart and log are two readings of
        // the same data, so one toggle swaps them in a fixed slot: flipping
        // between them must not move anything below.
        <div {...pastGuard.props} className="flex w-full flex-col gap-ha-3 border-t border-surface-mid pt-ha-4">
        {/* Header row: what you're reading on the left, the way out to Home
            Assistant on the right. */}
        <div className="flex w-full items-center gap-ha-2">
          <SegmentedControl
            segments={[{ value: 'history', label: 'History' }, { value: 'log', label: 'Log' }]}
            value={pastTab}
            onChange={v => setPastTab(v as 'history' | 'log')}
            // 32 tier: `!` because the track's own h-10 sits on the same element.
            className="!h-8 [&>button]:text-xs"
          />
          {/* The span (and the way out to the full history) belongs to both
              readings — the log covers the same window the chart draws. Only the
              aggregation is chart-only: a log has nothing to average. */}
          {!isHistoryLoading && (pastTab === 'log' || (isNumeric && hasChart) || showTimeline) && (
            <div className="ml-auto flex items-center gap-ha-2">
              {/* Span and aggregation are the same kind of question — "what am I
                  looking at" — so they're the same kind of control: two pills,
                  not a five-button track competing with the chart. A phone has
                  no room for them beside the toggle, so there they sit under the
                  graph (see below) and only the chevron stays up here. */}
              <div className="hidden md:flex items-center gap-ha-2">{spanPicker}</div>
              {/* Going further back than 30d lives in Home Assistant's own
                  history page (which can compare and export); hidden in demo,
                  where there's no instance to link to. */}
              {haUrl && (
                <a
                  href={`${haUrl}/history?entity_id=${encodeURIComponent(entity.entityId)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="All history in Home Assistant"
                  aria-label="All history in Home Assistant"
                  className={iconButtonClass({ size: 'sm', shape: 'square', filled: true })}
                >
                  <Icon path={mdiOpenInNew} size={20} />
                </a>
              )}
            </div>
          )}
        </div>
        {/* One box for both readings, and each one *fills* it: a chart stretches
            to the full height, a state timeline's bar does too. Anything less
            left a band of dead grey under a short reading. */}
        <div className="flex h-[144px] lg:h-[164px] w-full flex-col overflow-hidden">
        {pastTab === 'history' && <>
        {/* The chart sits on a surface of its own, one step down from the
            dialog: a plot with an edge reads as a figure, where a line drawn
            straight on the sheet read as decoration. 12px inset all round. */}
        <div className="flex min-h-0 w-full flex-1 flex-col justify-center rounded-ha-xl bg-surface-low p-3">
        {isHistoryLoading ? (
          <div className="w-full flex flex-1 items-center justify-center">
            <HALoader size="sm" />
          </div>
        ) : isNumeric && hasChart ? (
          <div className="flex min-h-0 w-full flex-1 flex-col">
            <div className="relative flex min-h-0 w-full flex-1 items-center">
              {/* A baseline and a line per labelled tick, nothing else: the
                  curve is the figure, the grid only says when. */}
              {timeTicks.filter(t => t.labeled).map((t, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="absolute top-0 bottom-0 w-px bg-text-primary/[0.06]"
                  style={{ left: `${t.f * 100}%` }}
                />
              ))}
              {/* 2px line in the state's own tint, at full strength; the fill
                  and band under it keep their old fade. `crisp` pins the stroke
                  to screen pixels; the line is the svg's last path, and a CSS
                  width outranks the attribute Sparkline sets. */}
              <div className="relative h-full w-full border-b border-text-primary/[0.12] [&_svg>path:last-of-type]:stroke-2 [&_svg>path:not(:last-of-type)]:opacity-80">
                <Sparkline
                  points={numericPoints}
                  on={entity.active ?? false}
                  gradientId={sparklineId}
                  stepped={isBoolean}
                  onHover={handleChartHover}
                  xFractions={xFractions}
                  bandLow={bandLow}
                  bandHigh={bandHigh}
                  fillHeight
                  crisp
                />
              </div>
            </div>
            {tickLabels}
          </div>
        ) : showTimeline ? (
          <StateTimeline segments={timeline.segs} startTs={timeline.startTs} endTs={timeline.endTs} onHover={setHoveredSeg} fill axis={tickLabels} />
        ) : null}
        </div>

        </>}

        {/* Log — every state this entity has been in over the span, newest
            first. Built from the same history the chart draws, so it needs no
            second fetch and never disagrees with the graph.
            ponytail: state changes only; who/what triggered them needs
            logbook/get_events — add that when someone asks "why did it turn on". */}
        {pastTab === 'log' && (
          // Scrolls inside the fixed slot — a two-line log and a fifty-line one
          // take exactly as much room as the chart did.
          <div className="min-h-0 w-full flex-1 overflow-y-auto scrollbar-hide">
            <ListSection>
              {isHistoryLoading || logEntries.length === 0 ? (
                <div className="px-ha-4 py-ha-3 text-sm text-text-tertiary">
                  {isHistoryLoading ? 'Loading…' : 'Nothing recorded in this span'}
                </div>
              ) : logEntries.map((seg, i) => (
                <div key={`${seg.start}-${i}`} className="flex items-baseline justify-between gap-ha-3 px-ha-4 py-ha-2">
                  <span className="min-w-0 flex-1 truncate text-sm capitalize text-text-primary">
                    {seg.state.replace(/_/g, ' ')}
                  </span>
                  {/* A time, not a measurement — sans with even figures, so
                      "Just now" and "14:05" share one face down the column. */}
                  <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                    {formatHoverTime(seg.start)}
                  </span>
                </div>
              ))}
            </ListSection>
          </div>
        )}
        </div>
        {/* Phone: the pickers live under the graph. Reserved height either way so
            the surface is the same size whichever reading is on screen. */}
        {!isHistoryLoading && (pastTab === 'log' || (isNumeric && hasChart) || showTimeline) && (
          <div className="flex md:hidden w-full items-center gap-ha-2">{spanPicker}</div>
        )}
        </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Details — what HA's device page prints ───────────────────────────────────

/**
 * One term and its definition, on the same 48 row as the entity lists: the
 * term in the primary ink, what it is in secondary on the right. Baseline-
 * aligned, so a value that wraps (a long serial, a URL) hangs off the term's
 * first line instead of centring against it. Mono only for a reading.
 */
/** Readings, plus anything read as a code — ids, serials, versions, addresses
 *  ("light.kitchen", "SN-4F2A", "v2.1.0"): a dot, slash, colon or underscore
 *  inside a token, or a run of digits and capitals. Words stay in the sans. */
const CODE = /[._/:]\S|^[A-Z0-9-]{4,}$/;

function InfoRow({ label, value }: { label: string; value: string }) {
  const mono = READING.test(value) || CODE.test(value);
  return (
    <div className="flex min-h-12 items-baseline justify-between gap-4 px-ha-4 py-[13px]">
      <span className="shrink-0 text-sm text-text-primary">{label}</span>
      <span className={clsx('min-w-0 text-right text-sm text-text-secondary', mono ? 'font-mono tabular-nums break-all' : 'break-words')}>{value}</span>
    </div>
  );
}

// Attributes already shown elsewhere in the dialog, or pure plumbing — the rest
// (ink levels, sun elevation, playlists, firmware fields…) is what a user opens
// the attributes list for.
const ATTRIBUTE_BLOCKLIST = new Set([
  'friendly_name', 'icon', 'entity_picture', 'device_class', 'state_class',
  'unit_of_measurement', 'supported_features', 'supported_color_modes',
  'attribution', 'editable', 'entity_category', 'dashboard_hidden',
  'suggested_display_precision', 'display_precision', 'options',
  'hvac_modes', 'preset_modes', 'fan_modes', 'swing_modes', 'available_modes',
  'operation_list', 'fan_speed_list', 'source_list', 'sound_mode_list',
  'effect_list', 'available_tones', 'activity_list', 'event_types',
]);

/** `rgb_color` → `Rgb color`; values flattened to one readable line. */
function formatAttribute(key: string, value: unknown): { label: string; value: string } | null {
  if (value == null || value === '') return null;
  const label = key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  if (Array.isArray(value)) {
    return value.length ? { label, value: value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') } : null;
  }
  if (typeof value === 'object') return { label, value: JSON.stringify(value) };
  if (typeof value === 'boolean') return { label, value: value ? 'Yes' : 'No' };
  return { label, value: String(value) };
}

/**
 * The rest of what HA's device page says, under the entity lists: what else in
 * the home uses this device, who made it and what it runs, the card's image,
 * and the way into the registry settings. It rides the dialog's one scroll —
 * there is no info tab, so nothing about the device is a second place away.
 */
function DeviceDetails({ entity, deviceName, deviceMeta, thumbnailPicker, onNavigate }: {
  entity?: PanelEntity;
  deviceName?: string;
  deviceMeta?: DeviceMeta;
  thumbnailPicker?: DeviceThumbnailPickerProps;
  /** Close the dialog before routing to the settings device page. */
  onNavigate: () => void;
}) {
  const router = useRouter();
  const { isAdmin, connected, getRelated, haUrl } = useHomeAssistant();
  const stored = useEntity(entity?.entityId ?? '');
  // The device's registry record — firmware, serial, the hub it talks through:
  // everything HA's own device page prints that the card never needed.
  const { entry: device, integrationName, viaDeviceName } = useDeviceInfo(deviceMeta?.deviceId);

  // What else in the config points at this device, the way HA's device page
  // lists it. One WS round-trip per device, resolved to names on arrival (the
  // response is entity ids), so the list can't re-render on state ticks.
  const [related, setRelated] = useState<{ label: string; names: string[] }[]>([]);
  useEffect(() => {
    const deviceId = deviceMeta?.deviceId;
    if (!deviceId || !connected) return;
    let cancelled = false;
    (async () => {
      const res = await getRelated('device', deviceId);
      if (cancelled) return;
      const all = peekEntities();
      const nameOf = (id: string) => (all[id]?.attributes.friendly_name as string | undefined) ?? id;
      setRelated(
        ([['automation', 'Automations'], ['scene', 'Scenes'], ['script', 'Scripts']] as const)
          .map(([key, label]) => ({ label, names: (res[key] ?? []).map(nameOf) }))
          .filter(g => g.names.length > 0),
      );
    })();
    // Clearing on the way out (rather than at the top of the effect) keeps one
    // device's automations off the next device's sheet without a render-phase
    // state write.
    return () => { cancelled = true; setRelated([]); };
  }, [deviceMeta?.deviceId, connected, getRelated]);

  // The attributes list HA's more-info has — raw integration data (ink levels,
  // elevation, media metadata), so it stays behind the admin gate.
  const attributeRows = isAdmin && stored
    ? Object.entries(stored.attributes)
        .filter(([key]) => !ATTRIBUTE_BLOCKLIST.has(key))
        .map(([key, value]) => formatAttribute(key, value))
        .filter((row): row is { label: string; value: string } => row !== null)
    : [];
  // Integrations that require credit ask for it here — user-facing, not admin.
  const attribution = stored?.attributes.attribution as string | undefined;

  // The same fields HA's device page lists, in its order, from the registry
  // record (with the card's own meta as the fallback for the two fields it
  // carries). Only what the integration actually filled in shows.
  const deviceRows: { label: string; value: string }[] = [];
  if (deviceName) deviceRows.push({ label: 'Name', value: deviceName });
  if (deviceMeta?.areaName) deviceRows.push({ label: 'Area', value: deviceMeta.areaName });
  const manufacturer = deviceMeta?.manufacturer ?? device?.manufacturer;
  const model = deviceMeta?.model ?? device?.model;
  if (manufacturer) deviceRows.push({ label: 'Manufacturer', value: manufacturer });
  if (model) deviceRows.push({ label: 'Model', value: model });
  if (device?.model_id && device.model_id !== model) deviceRows.push({ label: 'Model number', value: device.model_id });
  if (integrationName) deviceRows.push({ label: 'Integration', value: integrationName });
  if (viaDeviceName) deviceRows.push({ label: 'Connected via', value: viaDeviceName });
  if (device?.sw_version) deviceRows.push({ label: 'Firmware', value: device.sw_version });
  if (device?.hw_version) deviceRows.push({ label: 'Hardware', value: device.hw_version });
  if (device?.serial_number) deviceRows.push({ label: 'Serial number', value: device.serial_number });
  if (attribution) deviceRows.push({ label: 'Data from', value: attribution });
  if (device?.disabled_by) deviceRows.push({ label: 'Status', value: 'Turned off in Home Assistant' });
  if (isAdmin && entity) deviceRows.push({ label: 'Entity ID', value: entity.entityId });
  if (isAdmin && deviceMeta?.deviceId) deviceRows.push({ label: 'Device ID', value: deviceMeta.deviceId });

  const linkRow = 'flex min-h-12 items-center gap-3 px-ha-4 py-1 transition-colors hover:bg-surface-mid';

  return (
    <>
      {/* Automations, scenes and scripts that use this device — named, not
          linked: each one has its own place in Settings to be edited from. */}
      {related.map(group => (
        <ListSection key={group.label} className="pt-ha-1" title={<GroupLabel>{group.label} using this</GroupLabel>}>
          {group.names.map((name, i) => (
            <div key={`${name}-${i}`} className="flex min-h-12 items-center gap-3 px-ha-4 py-1">
              <Icon path={mdiRobotOutline} size={20} className="shrink-0 text-text-tertiary" />
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{name}</span>
            </div>
          ))}
        </ListSection>
      ))}

      {(deviceRows.length > 0 || device?.configuration_url || (haUrl && deviceMeta?.deviceId)) && (
        <ListSection className="pt-ha-1" title={<GroupLabel>About</GroupLabel>}>
          {deviceRows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
          {/* Devices with their own web interface (a printer, a router, a
              bridge) link to it — HA's "Visit device". */}
          {device?.configuration_url && (
            <a href={device.configuration_url} target="_blank" rel="noreferrer" className={linkRow}>
              <span className="flex-1 text-sm text-text-primary">Open this device&apos;s own page</span>
              <Icon path={mdiOpenInNew} size={20} className="shrink-0 text-text-tertiary" />
            </a>
          )}
          {/* HA's own device page — for the actions this dialog doesn't take on
              (delete, disable, download diagnostics, the integration's own
              menu). Hidden in demo, where there is no instance to link to. */}
          {haUrl && deviceMeta?.deviceId && (
            <a href={`${haUrl}/config/devices/device/${encodeURIComponent(deviceMeta.deviceId)}`} target="_blank" rel="noreferrer" className={linkRow}>
              <span className="flex-1 text-sm text-text-primary">Open in Home Assistant</span>
              <Icon path={mdiOpenInNew} size={20} className="shrink-0 text-text-tertiary" />
            </a>
          )}
        </ListSection>
      )}

      {attributeRows.length > 0 && (
        <ListSection className="pt-ha-1" title={<GroupLabel>{entity!.name} attributes</GroupLabel>}>
          {attributeRows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
        </ListSection>
      )}

      {/* Product image for the card — device-scoped, so it sits with the device. */}
      {thumbnailPicker && (
        <div className="pt-ha-1">
          {/* The picker's own row is padded ha-3, so this heading matches that
              rather than the standard `inset` (ha-4) row padding. */}
          <SectionLabel className="px-ha-3 pb-ha-2"><GroupLabel>Image</GroupLabel></SectionLabel>
          <DeviceThumbnailPicker {...thumbnailPicker} />
        </div>
      )}

      {deviceMeta?.deviceId && (
        <div>
          <Button
            variant="neutral"
            icon={mdiCogOutline}
            block
            onClick={() => {
              onNavigate();
              router.push(`/settings/devices?device=${encodeURIComponent(deviceMeta.deviceId!)}`);
            }}
          >
            Device settings
          </Button>
          <p className="px-ha-2 pt-ha-2 text-xs text-text-tertiary">
            Changes here apply everywhere in your home, not just this card.
          </p>
        </div>
      )}
    </>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

/** Domains that report rather than act — HA's device page files them under Sensors. */
const SENSOR_DOMAINS = new Set(['sensor', 'binary_sensor', 'event', 'weather', 'device_tracker']);

/**
 * The device's entities in HA's own four groups: what you can set, what it
 * reports, its settings, and its self-diagnosis. Empty groups drop out, so a
 * plug with one switch and one power reading shows two lists of one.
 */
function groupEntities(entities: PanelEntity[]): { title: string; rows: PanelEntity[]; primary: boolean }[] {
  const groups = { controls: [] as PanelEntity[], sensors: [] as PanelEntity[], config: [] as PanelEntity[], diagnostic: [] as PanelEntity[] };
  for (const e of entities) {
    const key = e.category === 'diagnostic' ? 'diagnostic'
      : e.category === 'config' ? 'config'
      : SENSOR_DOMAINS.has(e.entityId.split('.')[0]) ? 'sensors'
      : 'controls';
    groups[key].push(e);
  }
  // Controls and sensors are what you open the device for; its settings and
  // self-diagnosis are about it, and sit with the rest of the about-ness.
  return [
    { title: 'Controls', rows: groups.controls, primary: true },
    { title: 'Sensors', rows: groups.sensors, primary: true },
    { title: 'Configuration', rows: groups.config, primary: false },
    { title: 'Diagnostic', rows: groups.diagnostic, primary: false },
  ].filter(g => g.rows.length > 0);
}

/**
 * The device's entities as one row of chips under the hero. The first is the
 * device's main entity and stays put; the rest scroll past it. Tap one and its
 * reading, controls and history take over the sheet. Names only — the value is
 * what the hero is for. 40px pills (the chip tier): 20 glyph, 12 inset, 8 to
 * the label; blue marks the one you're looking at.
 */
/** Stable ref: the selected chip scrolls itself into the row when it mounts. */
const revealChip = (el: HTMLElement | null) => el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });

function EntityChips({ entities, selectedId, onSelect }: {
  entities: PanelEntity[];
  selectedId: string;
  onSelect: (entityId: string) => void;
}) {
  // The house scroll treatment, sideways: a fade at whichever end has more.
  const [fade, setFade] = useState({ left: false, right: true });
  const chip = (e: PanelEntity) => {
    const selected = e.entityId === selectedId;
    return (
      <button
        key={e.entityId}
        ref={selected ? revealChip : undefined}
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(e.entityId)}
        className={clsx(
          'flex h-10 shrink-0 items-center gap-2 rounded-full pl-3 pr-3.5 text-[13px] leading-4 transition-colors active:scale-95 motion-reduce:active:scale-100',
          selected ? 'bg-ha-blue/15 text-ha-blue' : 'bg-surface-default text-text-primary hover:bg-surface-low',
        )}
      >
        <Icon path={e.icon} size={20} exact className={selected ? undefined : e.active && e.toggleable ? 'text-green-600' : 'text-text-secondary'} />
        <span className="max-w-[10rem] truncate font-semibold">{e.name}</span>
      </button>
    );
  };
  const [main, ...rest] = entities;
  return (
    <div className="flex w-full items-center gap-2" data-sheet-drag="none">
      {chip(main)}
      <div className="relative min-w-0 flex-1">
        <div
          className="flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide"
          onScroll={(ev) => {
            const el = ev.currentTarget;
            const left = el.scrollLeft > 4;
            const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
            if (left !== fade.left || right !== fade.right) setFade({ left, right });
          }}
        >
          {rest.map(chip)}
        </div>
        <span aria-hidden className={clsx('pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface-lower to-transparent transition-opacity duration-200', fade.left ? 'opacity-100' : 'opacity-0')} />
        <span aria-hidden className={clsx('pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-surface-lower to-transparent transition-opacity duration-200', fade.right ? 'opacity-100' : 'opacity-0')} />
      </div>
    </div>
  );
}

/**
 * One scroll, top to bottom, in order of how often you'll want each thing:
 *
 *   hero + controls   the focused entity — its reading, its switch, its sliders
 *   history           the same entity's past (chart or log), right under it
 *   entity groups     everything else on the device, HA's four groups; tap a
 *                     row and it becomes the hero
 *   used by / about   automations that touch it, who made it, the way out
 *
 * No tabs, no shelf, no fixed height: the frame is as tall as the device has
 * things to say, and the only navigation is scrolling.
 */
export function EntityDetailPanel({
  initialEntityId,
  entities,
  deviceName,
  deviceMeta,
  onClose,
  onEditCard,
  isFavorite,
  onToggleFavorite,
  thumbnailPicker,
  heroLayout = 'display',
}: EntityDetailPanelProps) {
  const [focusedEntityId, setFocusedEntityId] = useState(initialEntityId);
  // Focus the clicked entity whenever a new card is opened (render-time reset,
  // so the first paint of the new device already shows the right hero).
  // Controls up front; everything the HA device page knows sits behind the
  // info button so the dialog opens on what you can do, not on what it is.
  const [showDetails, setShowDetails] = useState(false);
  const [openedId, setOpenedId] = useState(initialEntityId);
  if (openedId !== initialEntityId) { setOpenedId(initialEntityId); setFocusedEntityId(initialEntityId); setShowDetails(false); }
  const focusedEntity = entities.find(e => e.entityId === focusedEntityId) ?? entities[0];

  // Long labels and text states slide their tails into view while the panel is
  // idle — the dashboard's marquee.
  const panelRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  useIdleMarquee(panelRef, true);

  // Picking a row from the lists below swaps the hero and brings it back into
  // view — the thing you just asked for shouldn't change off-screen.
  const focus = (entityId: string) => {
    setFocusedEntityId(entityId);
    setShowDetails(false);
  };

  // Same flag the device card reads: images off means no product render here
  // either, so the dialog matches the cards it was opened from.
  const { hideCardImagesEnabled } = useDebugFlags();
  const thumbnail = hideCardImagesEnabled ? null : deviceMeta?.thumbnail;

  // The chip row: the entity the card opened on first (the device's main one),
  // then what you can set and what it reports. Settings and self-diagnosis
  // stay behind the info button.
  const mainEntity = entities.find(e => e.entityId === initialEntityId) ?? entities[0];
  const chipEntities = entities.length > 1 && mainEntity
    ? [mainEntity, ...groupEntities(entities.filter(e => e !== mainEntity)).filter(g => g.primary).flatMap(g => g.rows)]
    : [];

  // A one-entity device has nothing else on it — the hero is the whole story.
  const groups = entities.length > 1 ? groupEntities(entities) : [];
  const groupRows = (group: { title: string; rows: PanelEntity[] }) => (
    <DetailRows
      key={group.title}
      title={group.title}
      rows={group.rows.map(e => ({
        id: e.entityId,
        icon: e.icon,
        label: e.name,
        state: e.state,
        active: e.active,
        onToggle: e.toggleable && e.onToggle && !e.entityPicture ? e.onToggle : undefined,
        selected: e.entityId === focusedEntity?.entityId,
        onSelect: () => focus(e.entityId),
      }))}
    />
  );

  return (
    <div ref={panelRef} className="contents">
    <DialogFrame
      size="fit"
      // The device is context here; the entity's reading below is the headline.
      quietTitle
      // Where it lives is the eyebrow; the device is the title. The focused
      // entity names itself in the hero.
      eyebrow={deviceMeta?.areaName}
      title={deviceName ?? focusedEntity?.name ?? ''}
      onClose={onClose}
      // Details are a level in, so the way out is a back arrow and the card's
      // own buttons (star, pencil) stay on the level they belong to.
      onBack={showDetails ? () => setShowDetails(false) : undefined}
      action={showDetails ? undefined :
        <>
          {onToggleFavorite && (
            <IconButton
              icon={isFavorite ? mdiStar : mdiStarOutline}
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              size="lg"
              // `!` so the starred amber beats the button's own resting colour
              // whichever order Tailwind emits the two utilities in.
              className={isFavorite ? '!text-amber-500' : undefined}
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
            />
          )}
          {onEditCard && (
            <IconButton icon={mdiPencilOutline} label="Edit card" size="lg" onClick={onEditCard} />
          )}
          <IconButton icon={mdiInformationOutline} label="Device details" size="lg" onClick={() => setShowDetails(true)} />
        </>
      }
    >
      {showDetails ? (<>
        {groups.filter(g => !g.primary).map(groupRows)}
        <DeviceDetails
          entity={focusedEntity}
          deviceName={deviceName}
          deviceMeta={deviceMeta}
          thumbnailPicker={thumbnailPicker}
          onNavigate={onClose}
        />
      </>) : (<>
      {/* One hero, and it is whatever you picked: tap a chip and the reading,
          the switch, the controls and the history above and below all become
          that entity's. The chips stay between the hero and its controls — the
          device's main entity pinned first, the rest scrolling. */}
      {focusedEntity && (
        <div ref={heroRef} className="scroll-mt-ha-2">
          <EntityDetailBody
            key={focusedEntity.entityId}
            entity={focusedEntity}
            thumbnail={thumbnail}
            // The header titles the device, so a single-entity device's hero
            // drops its own name line rather than saying it twice.
            headerName={deviceName}
            historyView="full"
            heroLayout={heroLayout}
            afterHero={chipEntities.length > 1 && (
              <EntityChips entities={chipEntities} selectedId={focusedEntity.entityId} onSelect={focus} />
            )}
          />
        </div>
      )}
      </>)}
    </DialogFrame>
    </div>
  );
}
