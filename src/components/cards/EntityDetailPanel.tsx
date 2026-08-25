'use client';

import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { mdiPencilOutline, mdiStar, mdiStarOutline, mdiCogOutline, mdiChevronRight, mdiDotsVertical, mdiDevices, mdiMapMarkerOutline, mdiAccountVoice, mdiRobotOutline, mdiEyeOffOutline, mdiTuneVariant, mdiChartLine, mdiInformation, mdiInformationOutline, mdiOpenInNew, mdiFormatListBulleted } from '@mdi/js';
import { clsx } from 'clsx';
import { CircularProgress, Icon, IconButton, ListSection, RollingNumericValue, SectionLabel, SegmentedControl, Dropdown, HALoader, ToggleSwitch } from '../ui';
import { SheetHeader, SHEET_PAD } from './dialogKit';
import { SummaryCard } from './SummaryCard';
import { ContextMenu } from '../ui/ContextMenu';
import { useToast } from '@/contexts/ToastContext';
import { StateTimeline, type StateSegment } from '../ui/StateTimeline';
import { Sparkline } from '../ui/Sparkline';
import { DomainControls } from './DeviceControls';
import { DeviceThumbnailPicker, type DeviceThumbnailPickerProps } from './DeviceThumbnailPicker';
import { useEntity, useHomeAssistant, peekEntities } from '@/hooks/useHomeAssistant';
import { useDeviceInfo } from '@/hooks/useDevices';
import { useIdleMarquee } from '@/hooks/useIdleMarquee';
import { useEdgeFade } from '@/hooks/useEdgeFade';
import { stateParts } from '@/lib/homeassistant/entityHelpers';
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

export function EntityDetailBody({ entity, thumbnail, headerName, historyView = 'full', showControls = true, showHero = true, heroLayout = 'band', pastTab: pastTabProp, onPastTabChange }: {
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
}) {
  const { getEntityHistory, getStatistics, connected, demoMode, haUrl } = useHomeAssistant();
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
  const [aggregation, setAggregation] = useState<Aggregation>('auto');

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

  const historyData = statsActive ? statsData! : applyAggregation(rawHistoryData, aggregation, hours);
  const numericPoints = historyData.map(d => d.value);
  const hasBand = statsActive && statsData!.every(d => d.low != null && d.high != null);
  const bandLow = hasBand ? statsData!.map(d => d.low as number) : undefined;
  const bandHigh = hasBand ? statsData!.map(d => d.high as number) : undefined;

  const { xFractions, ticks: timeTicks } = computeChartAxis(historyData, hours);

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
    <span className={clsx('ha-scrub-stamp-in shrink-0 whitespace-nowrap text-[11px] font-semibold leading-none text-ha-blue', className)}>
      {scrubTime}
    </span>
  ) : null;

  // Whole hero is one tappable card: product thumb + name + switch + state. Any
  // click on it toggles (the ToggleSwitch stops propagation, so it fires once).
  const canToggle = !!(entity.toggleable && entity.onToggle && !entity.entityPicture) && !nearControl;
  const nameIsDuplicate = !!headerName && headerName.trim().toLowerCase() === entity.name.trim().toLowerCase();
  const showThumb = !!thumbnail && thumb.ok && !entity.entityPicture;
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
   */
  const renderReading = (opts: { scale: 'sm' | 'md' | 'lg'; gauge?: boolean; align?: 'center' | 'left' }) => {
    const { scale, gauge, align = 'center' } = opts;
    const numberClass = scale === 'lg' ? 'text-3xl' : scale === 'md' ? 'text-2xl' : 'text-lg';
    const unitClass = scale === 'lg' ? 'text-base ml-2' : 'text-sm ml-1';
    if (entity.toggleable && !entity.entityPicture) {
      return (
        <RollingNumericValue
          value={scrubbedState ?? displayValue}
          className={clsx('font-semibold font-mono capitalize text-text-primary', scale === 'sm' ? 'text-lg' : 'text-2xl')}
        />
      );
    }
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
            <RollingNumericValue value={displayValue} direction={scrubDirection} className="text-2xl font-bold font-mono text-text-primary" />
            {heroUnit && <span className="text-sm font-mono ml-1 text-text-secondary">{heroUnit}</span>}
          </span>
        </CircularProgress>
      );
    }
    if (isNumeric && heroUnit) {
      return (
        <span className={clsx('flex min-w-0 items-baseline', align === 'center' ? 'justify-center' : 'justify-start')}>
          <RollingNumericValue value={displayValue} direction={scrubDirection} className={clsx('font-bold font-mono text-text-primary', numberClass)} />
          <span className={clsx('font-mono text-text-secondary', unitClass)}>{heroUnit}</span>
        </span>
      );
    }
    return (
      <span className={clsx(
        'ha-card-marquee block w-full truncate font-bold font-mono capitalize text-text-primary',
        numberClass,
        align === 'center' && 'text-center',
      )}>
        <span data-marquee>{scrubbedState ?? displayValue}</span>
      </span>
    );
  };

  // Span + aggregation, built once: they sit in the history header on a desktop
  // and under the graph on a phone, where the header has no room beside the
  // History/Log toggle.
  const spanPickers = (
    <>
      <Dropdown
        className="shrink-0"
        options={TIME_SPANS.map(t => ({ value: t.value, label: t.label }))}
        value={timeSpan}
        onChange={v => setTimeSpan(v as TimeSpan)}
      />
      {/* Statistics spans are pre-bucketed by the recorder (hour/day) — the
          aggregation picker only applies to raw history. */}
      {pastTab === 'history' && isNumeric && hasChart && !statsActive && (
        <Dropdown
          className="shrink-0"
          options={AGGREGATIONS.map(a => ({ value: a.value, label: a.label }))}
          value={aggregation}
          onChange={v => setAggregation(v as Aggregation)}
        />
      )}
    </>
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
    <div className={clsx('shrink-0 flex flex-col items-center gap-ha-2 py-ha-2 overflow-hidden', SHEET_PAD)}>
      {showHero && entity.entityPicture && (
        // Camera feed / media artwork shown as its own block at the top, so the
        // status value and history graph below it are no longer overlaid on the
        // image (which obscured the feed).
        <div className="w-full rounded-ha-xl overflow-hidden bg-surface-low aspect-video">
          <img src={entity.entityPicture} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col items-center gap-ha-2 w-full">
        {/* The device, as one card: what it reads, what you can set, and what it
            did — one surface, hairline-divided, so the dialog is a single object
            rather than a stack of panels. */}
        <div className="flex w-full flex-col gap-ha-2 rounded-ha-2xl bg-surface-low p-ha-2">
        {/* Tap-anywhere toggle card — thumb, name, switch and state grouped in one
            surface. Clicking anywhere toggles a controllable entity. */}
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
            {renderControl(showThumb ? 'xl' : 'lg')}
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
        /* ── Display ── no panel at all: the reading is the biggest thing on the
           screen, the name is an eyebrow over it, the render sits behind on the
           right. Type does the work a surface was doing. */
        <div
          {...tapProps}
          className="relative flex w-full items-end justify-between gap-ha-3 py-ha-2 outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {!nameIsDuplicate && (
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{entity.name}</span>
            )}
            <span className="flex min-w-0 items-baseline gap-ha-2">
              {/* flex-1, not content-sized — see the band hero above: a marquee
                  box has no intrinsic width to size a wrapper from. */}
              <span className="flex min-w-0 flex-1 items-baseline gap-ha-2 text-4xl [&_*]:text-inherit">
                {renderReading({ scale: 'lg', align: 'left' })}
              </span>
              {stampNode()}
            </span>
          </div>
          {showThumb && (
            <img
              src={thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb(t => ({ ...t, ok: false }))}
              className="h-28 w-28 shrink-0 select-none object-contain pointer-events-none md:h-36 md:w-36"
            />
          )}
          {renderControl('lg')}
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
        <div {...pastGuard.props} className="flex w-full flex-col gap-ha-1 border-t border-surface-mid pt-ha-2">
        {/* Header row: what you're reading on the left, the way out to Home
            Assistant on the right. */}
        <div className="flex w-full items-center gap-ha-2">
          <SegmentedControl
            segments={[{ value: 'history', label: 'History' }, { value: 'log', label: 'Log' }]}
            value={pastTab}
            onChange={v => setPastTab(v as 'history' | 'log')}
            className="text-xs"
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
              <div className="hidden md:flex items-center gap-ha-2">{spanPickers}</div>
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
                  className="flex h-[38px] w-9 shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary transition-colors hover:text-text-primary"
                >
                  <Icon path={mdiChevronRight} size={18} />
                </a>
              )}
            </div>
          )}
        </div>
        {/* One box for both readings, and each one *fills* it: a chart stretches
            to the full height, a state timeline's bar does too. Anything less
            left a band of dead grey under a short reading. */}
        <div className="flex h-[132px] lg:h-[168px] w-full flex-col overflow-hidden">
        {pastTab === 'history' && <>
        <div className="flex min-h-0 w-full flex-1 flex-col justify-center">
        {isHistoryLoading ? (
          <div className="w-full flex flex-1 items-center justify-center">
            <HALoader size="sm" />
          </div>
        ) : isNumeric && hasChart ? (
          <div className="flex min-h-0 w-full flex-1 flex-col">
            <div className="relative flex min-h-0 w-full flex-1 items-center">
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
                  onHover={handleChartHover}
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
          <StateTimeline segments={timeline.segs} startTs={timeline.startTs} endTs={timeline.endTs} onHover={setHoveredSeg} fill />
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
                  <span className="shrink-0 font-mono text-xs text-text-tertiary">
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
          <div className="flex md:hidden w-full items-center gap-ha-2 pt-ha-1">{spanPickers}</div>
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

// Settings tab — scoped to the *focused* entity (the one in the hero), with the
// device it belongs to as a section underneath. That scoping is what makes the
// cog legible on a multi-entity card: it always configures what you're looking
// at, while the pencil (card scope) decides hero/secondary/hidden.
function EntitySettingsTab({ entity, deviceName, deviceMeta, thumbnailPicker, onNavigate }: {
  entity?: PanelEntity;
  deviceName?: string;
  deviceMeta?: DeviceMeta;
  thumbnailPicker?: DeviceThumbnailPickerProps;
  /** Close the dialog before routing to the settings device page. */
  onNavigate: () => void;
}) {
  const router = useRouter();
  const { isAdmin, connected, getRelated } = useHomeAssistant();
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

  const entityRows: { label: string; value: string }[] = [];
  if (entity) {
    entityRows.push({ label: 'Name', value: entity.name });
    entityRows.push({ label: 'Status', value: entity.unit ? `${entity.state} ${entity.unit}` : entity.state });
    if (deviceMeta?.areaName) entityRows.push({ label: 'Area', value: deviceMeta.areaName });
    // Integrations that require credit ask for it here — user-facing, not admin.
    const attribution = stored?.attributes.attribution as string | undefined;
    if (attribution) entityRows.push({ label: 'Data from', value: attribution });
    if (isAdmin) entityRows.push({ label: 'Entity ID', value: entity.entityId });
  }

  // The attributes list HA's more-info has — raw integration data (ink levels,
  // elevation, media metadata), so it stays behind the admin gate.
  const attributeRows = isAdmin && stored
    ? Object.entries(stored.attributes)
        .filter(([key]) => !ATTRIBUTE_BLOCKLIST.has(key))
        .map(([key, value]) => formatAttribute(key, value))
        .filter((row): row is { label: string; value: string } => row !== null)
    : [];

  // Device section — the same fields HA's device page lists, in its order, from
  // the registry record (with the card's own meta as the fallback for the two
  // fields it carries). Only what the integration actually filled in shows.
  const deviceRows: { label: string; value: string }[] = [];
  if (deviceName) deviceRows.push({ label: 'Name', value: deviceName });
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
  if (device?.disabled_by) deviceRows.push({ label: 'Status', value: 'Turned off in Home Assistant' });
  if (isAdmin && deviceMeta?.deviceId) deviceRows.push({ label: 'Device ID', value: deviceMeta.deviceId });

  return (
    <div className="flex-1 overflow-y-auto px-0 py-ha-2">
      {entityRows.length > 0 && (
        <div className="px-ha-4 mb-ha-4">
          <ListSection title={entity!.name}>
            {entityRows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
          </ListSection>
        </div>
      )}
      {attributeRows.length > 0 && (
        <div className="px-ha-4 mb-ha-4">
          <ListSection title="Attributes">
            {attributeRows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
          </ListSection>
        </div>
      )}
      {deviceRows.length > 0 && (
        <div className="px-ha-4 mb-ha-4">
          <ListSection title="Device">
            {deviceRows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
            {/* Devices with their own web interface (a printer, a router, a
                bridge) link to it — HA's "Visit device". */}
            {device?.configuration_url && (
              <a
                href={device.configuration_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-ha-3 px-ha-4 py-ha-3 transition-colors hover:bg-surface-mid"
              >
                <span className="flex-1 text-sm font-medium text-text-primary">Open this device&apos;s own page</span>
                <Icon path={mdiOpenInNew} size={16} className="shrink-0 text-text-tertiary" />
              </a>
            )}
          </ListSection>
        </div>
      )}
      {/* Automations, scenes and scripts that use this device — named, not
          linked: this is the info sheet, and each one has its own place in
          Settings to be edited from. */}
      {related.map(group => (
        <div key={group.label} className="px-ha-4 mb-ha-4">
          <ListSection title={group.label}>
            {group.names.map((name, i) => (
              <div key={`${name}-${i}`} className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
                <Icon path={mdiRobotOutline} size={18} className="shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{name}</span>
              </div>
            ))}
          </ListSection>
        </div>
      ))}
      {/* Product image for the card — device-scoped, so it sits with the device. */}
      {thumbnailPicker && (
        <div className="px-ha-4 mb-ha-4">
          {/* The picker's own row is padded ha-3, so this heading matches that
              rather than the standard `inset` (ha-4) row padding. */}
          <SectionLabel className="px-ha-3 pb-ha-2">Image</SectionLabel>
          <DeviceThumbnailPicker {...thumbnailPicker} />
        </div>
      )}
      {deviceMeta?.deviceId && (
        <div className="px-ha-4">
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
          <p className="px-ha-2 pt-ha-2 text-xs text-text-tertiary">
            Renaming, icons and area changes apply everywhere in your home — not just this card.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

// The dialog's three views, one per bottom-nav entry. 'main' is where it opens:
// what you can *do* with the device. History (with its log) and the info sheet
// are their own places, so neither crowds the controls.
const PANEL_TABS = [
  { id: 'main' as const, label: 'Controls', icon: mdiTuneVariant },
  { id: 'history' as const, label: 'History', icon: mdiChartLine },
  { id: 'info' as const, label: 'Info', icon: mdiInformationOutline, iconOn: mdiInformation },
];

/**
 * Height of the "On this device" chip row — its 8px top padding, the 40px chips
 * (the dashboard's summary chip) and the 16px padding under it. The hero is sized to the frame minus this, so
 * the row lands exactly on the panel's bottom edge: nothing to scroll, nothing
 * sliced, and every entity the device has is one tap away.
 */
const SHELF_PEEK = 64;

/** Where the panel sits when the hero is "landed": hero fully shown, chip row under it. */
function heroLanding(el: HTMLElement, hero: HTMLElement | null, peek: number): number {
  if (!hero) return 0;
  return Math.max(0, hero.offsetTop + hero.offsetHeight + peek - el.clientHeight);
}

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
  heroLayout = 'band',
}: EntityDetailPanelProps) {
  // 'main' = hero, controls and the 24h band; 'history' = the full chart and its
  // log; 'info' = entity/device details and settings. See PANEL_TABS.
  const [tab, setTab] = useState<(typeof PANEL_TABS)[number]['id']>('main');
  // Which reading the History tab opens on — set by the summary tile you tapped.
  const [pastTab, setPastTab] = useState<'history' | 'log'>('history');
  const [focusedEntityId, setFocusedEntityId] = useState(initialEntityId);
  // Overflow menu anchor (null = closed). Placeholder actions for now — each
  // just confirms itself with a toast so nothing is silently inert.
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  // The chip row's overflow menu (null = closed) — every entity on the device as
  // a plain list, for the ones the row has scrolled out of reach.
  const [listAt, setListAt] = useState<{ x: number; y: number } | null>(null);
  const { showToast } = useToast();
  // A one-entity device has nothing to switch between: no chip row, no menu, and
  // the hero takes the whole frame instead of leaving a gap for a row of one.
  const showShelf = entities.length > 1;
  const shelfPeek = showShelf ? SHELF_PEEK : 0;

  // Focus the clicked entity (and reset tab) whenever a new card is opened
  useEffect(() => {
    setTab('main');
    setFocusedEntityId(initialEntityId);
    setListAt(null);
  }, [initialEntityId]);

  const focusedEntity = entities.find(e => e.entityId === focusedEntityId) ?? entities[0];

  // Long labels and text states slide their tails into view while the panel is
  // idle — the dashboard's marquee, driven from the panel's own scrollport (the
  // device rows live inside it, so one container covers hero and shelf).
  const heroScrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  useIdleMarquee(heroScrollRef, true);
  // The chip row's sideways scroll fades (the app-wide scrollable-list pattern).
  const { ref: chipsRef, onScroll: onChipsScroll, style: chipsFadeStyle } = useEdgeFade(32);

  // Releases the landing pin below — the title's "jump to the list" must not be
  // yanked back by a late resize.
  const releasePin = useRef<() => void>(() => {});

  // Phone: swipe the panel sideways to move between the three places in the nav,
  // in the order the nav shows them. Touch only — a mouse has the nav itself —
  // and native listeners rather than React's, because claiming the gesture needs
  // a non-passive touchmove.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    let from: { x: number; y: number } | null = null;
    let claimed = false;
    const onStart = (e: TouchEvent) => {
      claimed = false;
      const t = e.touches[0];
      // Sliders, charts and timelines own their gesture — the same marker the
      // sheet's own drag-to-dismiss steps around.
      from = e.touches.length === 1 && t && !(e.target as Element | null)?.closest?.('[data-sheet-drag="none"]')
        ? { x: t.clientX, y: t.clientY }
        : null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!from || !t) return;
      const dx = t.clientX - from.x;
      if (!claimed && Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(t.clientY - from.y) * 1.5) claimed = true;
      // Own it once it reads as sideways: stops the panel scrolling under the
      // swipe, and stops the release landing as a tap on whatever it passed over
      // (the hero is one big toggle).
      if (claimed) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const start = from;
      from = null;
      const t = e.changedTouches[0];
      if (!start || !claimed || !t) return;
      claimed = false;
      const dx = t.clientX - start.x;
      if (Math.abs(dx) < 60) return;
      setTab(current => {
        const i = PANEL_TABS.findIndex(p => p.id === current);
        // Ends of the row hold — three places in a fixed order, so wrapping
        // would make "which way is Info" a different answer each time.
        return PANEL_TABS[Math.min(PANEL_TABS.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))].id;
      });
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Opening a device lands you on its hero, with the shut shelf's heading on the
  // bottom edge — the region is bottom-aligned and taller than its box, so
  // without this you get whatever the last scroll position was (usually the
  // device render). Landing is the *bottom of the hero*, never the bottom of the
  // scrollport: the shelf below can be a full-length list.
  //
  // Keyed on the *opened* entity, not the focused one: picking a row from the
  // shelf swaps the hero above but leaves you where you were reading, so the
  // list doesn't scroll out from under the thing you just tapped.
  useEffect(() => {
    const el = heroScrollRef.current;
    if (!el) return;
    const toHero = () => { el.scrollTop = heroLanding(el, heroRef.current, shelfPeek); };
    toHero();
    // History arrives a moment after the switch and grows the region, so one
    // scroll isn't enough — follow the content until it settles, and let go the
    // instant the user takes over.
    const ro = new ResizeObserver(toHero);
    [...el.children].forEach(c => ro.observe(c));
    const stop = () => { ro.disconnect(); el.removeEventListener('wheel', stop); el.removeEventListener('pointerdown', stop); };
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('pointerdown', stop);
    releasePin.current = stop;
    const t = setTimeout(stop, 1200);
    return () => { clearTimeout(t); stop(); };
  }, [initialEntityId, shelfPeek]);

  // Picking a chip never scrolls: it swaps the hero above and leaves the row
  // exactly where it was, so you can run along the device changing focus without
  // the panel moving under your finger.

  // Product render used as the dialog's backdrop. Same render-adjust pattern as
  // the card: a hand-placed PNG that 404s drops out instead of leaving a broken
  // image behind the content.
  // Dropped when the focused entity brings its own image (camera feed, album
  // art, avatar): that picture is the hero's subject, and a stock product render
  // behind it is a second picture of the same device fighting the real one.
  const [backdrop, setBackdrop] = useState<{ src?: string | null; ok: boolean }>({ src: deviceMeta?.thumbnail, ok: true });
  if (backdrop.src !== deviceMeta?.thumbnail) setBackdrop({ src: deviceMeta?.thumbnail, ok: true });
  const showBackdrop = !!deviceMeta?.thumbnail && backdrop.ok && tab === 'main' && !focusedEntity?.entityPicture;

  // Header actions are the most-tapped controls in the dialog and sat at a 30px
  // target with 4px between them. Padded out to ~44px with real gaps so a thumb
  // can't miss (and so the group reads as three separate controls, not a blob).

  // Diagnostics only earn their own heading when there is something else to
  // separate them from — an all-diagnostics device keeps one plain list.
  const allDiagnostics = entities.filter(e => e.category === 'diagnostic');
  const splitDiagnostics = allDiagnostics.length > 0 && allDiagnostics.length < entities.length;
  const mainEntities = splitDiagnostics ? entities.filter(e => e.category !== 'diagnostic') : entities;
  const diagnosticEntities = splitDiagnostics ? allDiagnostics : [];
  // The chip row runs main entities first, diagnostics after — same order the
  // list had, minus the heading a single row has no room for.
  const shelfEntities = [...mainEntities, ...diagnosticEntities];

  return (
    // One height for every device: a fixed frame, not a content-sized box. The
    // hero (or the chart) takes whatever is left after the header, the device
    // list and the switcher, so opening a one-sensor plug and a twelve-entity
    // vacuum gives you the same dialog and the same place to change entity.
    // --panel-shelf-peek: how much of the "On this device" shelf shows without
    // scrolling — its heading plus the top edge of the first row. The hero is
    // sized to the frame minus this, so the shelf always announces itself.
    <div
      ref={panelRef}
      className="h-[min(70dvh,760px)] lg:h-[min(88vh,900px)] flex flex-col overflow-hidden"
      style={{ '--panel-shelf-peek': `${shelfPeek}px` } as CSSProperties}
    >
      {/* Header — the shared one. Where it lives (room ▸ device) is the eyebrow,
          the focused entity is the title, and tapping it jumps to "On this
          device" — the title says which entity you're on, so it's the natural
          handle for "show me the others". */}
      <SheetHeader
        eyebrow={[deviceMeta?.areaName, deviceName].filter(Boolean).join(' ▸ ') || undefined}
        title={focusedEntity?.name ?? deviceName ?? ''}
        onClose={onClose}
        onTitleClick={showShelf ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setListAt({ x: r.left, y: r.bottom }); } : undefined}
        titleHint={showShelf ? 'Show everything on this device' : undefined}
        // Favorite and pencil sit bare; everything rarer (settings included)
        // is behind the overflow dots.
        actions={
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
            {/* Overflow — the less-used contextual actions, HA's more-info menu.
                Settings is not in here any more: it has its own place in the nav. */}
            <IconButton
              icon={mdiDotsVertical}
              label="More options"
              size="lg"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenuAt({ x: r.right - 200, y: r.bottom + 6 });
              }}
              aria-haspopup="menu"
              aria-expanded={!!menuAt}
            />
          </>
        }
      />

      {menuAt && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          onClose={() => setMenuAt(null)}
          actions={[
            { label: 'Device info', icon: mdiDevices },
            { label: 'Move to another room', icon: mdiMapMarkerOutline },
            { label: 'Voice assistants', icon: mdiAccountVoice },
            { label: 'Automations using this', icon: mdiRobotOutline },
            { label: 'Hide from dashboard', icon: mdiEyeOffOutline },
          ].map(a => ({
            ...a,
            onSelect: () => showToast({ title: a.label, subtitle: 'Not wired up yet', icon: a.icon }),
          }))}
        />
      )}

      {listAt && (
        <ContextMenu
          x={listAt.x}
          y={listAt.y}
          onClose={() => setListAt(null)}
          actions={shelfEntities.map((entity, i) => ({
            label: entity.name,
            icon: entity.icon,
            // One divider where the diagnostics start, so the menu still says
            // which readings are the device talking about itself.
            separator: diagnosticEntities.length > 0 && i === mainEntities.length,
            onSelect: () => setFocusedEntityId(entity.entityId),
          }))}
        />
      )}

      {tab === 'info' ? (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <EntitySettingsTab
            entity={focusedEntity}
            deviceName={deviceName}
            deviceMeta={deviceMeta}
            thumbnailPicker={thumbnailPicker}
            onNavigate={onClose}
          />
        </div>
      ) : (
        <>
          {/* Hero / chart — takes every pixel the fixed frame has left over, and
              centres itself in it, so a bare on/off switch and a full climate
              bento both fill the same box. Its own scrollport: that is what the
              device render pins against. */}
          <div ref={heroScrollRef} className="relative flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          {/* The product render is the dialog's backdrop, not a column in the
              hero: a zero-height sticky layer parks it at the top of the
              scrollport, so the content slides over the device as you scroll
              instead of pushing it out of the way. Hidden in the history view,
              which is a chart, not a device portrait. */}
          {showBackdrop && (
            <div className="sticky top-0 z-0 h-0" aria-hidden>
              <img
                src={deviceMeta!.thumbnail!}
                alt=""
                onError={() => setBackdrop(b => ({ ...b, ok: false }))}
                className="pointer-events-none mx-auto h-[190px] w-full max-w-[320px] select-none object-contain px-6 pt-ha-1"
              />
            </div>
          )}

          {/* Big preview — the focused entity (clicked card / row). */}
          {focusedEntity && (
            <div ref={heroRef} className={clsx(
              // Phone: a short hero sits at the *bottom* of its region, next to
              // the list and inside thumb reach, with the device render filling
              // the space above it. Desktop has no reach problem, so it centres.
              // Short of the full height by SHELF_PEEK: that gap is exactly the
              // shut shelf, so its heading and chevron sit on the panel's bottom
              // edge instead of being invisible until you find them.
              'relative z-[2] flex flex-col justify-end',
              'min-h-[calc(100%-var(--panel-shelf-peek))]',
              showBackdrop && 'pt-[116px]',
            )}>
              <EntityDetailBody
                key={focusedEntity.entityId}
                entity={focusedEntity}
                // No thumbnail: the render is the panel's backdrop now.
                thumbnail={null}
                // The header now titles itself with the focused entity, so the
                // hero drops its own name line rather than saying it twice.
                headerName={focusedEntity.name}
                // Controls-first: opening a device shows only what you can *do*
                // with it — no graph, no log, not even a teaser band. The past
                // is one place, the History tab, which keeps the same hero
                // (scrubbing still moves the reading) and gives the chart and
                // its log all the room the controls were using.
                historyView={tab === 'history' ? 'full' : 'none'}
                showControls={tab !== 'history'}
                pastTab={pastTab}
                onPastTabChange={setPastTab}
                heroLayout={heroLayout}
              />
            </div>
          )}

          {/* Every entity on the device, focused one marked — this is what makes
              the card's "one device, many entities" model visible, and it anchors
              what the cog (entity scope) is configuring. It also paints the
              panel's ground so the hero above can inherit it.

              One row of chips — icon and name, nothing else — scrolled sideways
              with the app's edge fades, always in the same place on every device
              and always the same height (SHELF_PEEK), so the hero keeps the rest
              of the frame whether the device has two entities or twenty. The list
              button at the end opens all of them as a menu, for the ones the row
              has pushed out of reach. Holds everything the device still has
              (hidden entities included — only disabling one takes it out, see
              panelEntitiesForDevice). */}
          {showShelf && (
          <div className="relative z-[1] flex items-center gap-ha-2 bg-surface-lower px-ha-4 pb-ha-4 pt-ha-2">
            <div
              ref={chipsRef}
              onScroll={onChipsScroll}
              style={chipsFadeStyle}
              className="flex min-w-0 flex-1 items-center gap-ha-2 overflow-x-auto scrollbar-hide"
            >
              {shelfEntities.map((entity) => {
                // Selected = currently shown in the hero.
                const isSelected = entity.entityId === focusedEntityId;
                return (
                  // The dashboard's summary chip, name only: same pill, same
                  // height, same press — the row reads as the chips at the top
                  // of the home dashboard rather than a second chip style.
                  <SummaryCard
                    key={entity.entityId}
                    compact
                    icon={entity.icon}
                    title={entity.name}
                    color={isSelected ? 'primary' : entity.active && entity.toggleable ? 'success' : 'default'}
                    className={clsx('shrink-0', isSelected && 'ring-2 ring-inset ring-ha-blue')}
                    onClick={() => setFocusedEntityId(entity.entityId)}
                  />
                );
              })}
            </div>
            {/* Opens at the button and gets clamped into the viewport by the menu
                itself, so a bottom-edge anchor rises instead of running off. */}
            <button
              type="button"
              aria-label="All entities on this device"
              aria-expanded={!!listAt}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setListAt(listAt ? null : { x: r.left, y: r.bottom });
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-mid hover:text-text-primary"
            >
              <Icon path={mdiFormatListBulleted} size={18} />
            </button>
          </div>
          )}

          </div>
        </>
      )}

      {/* Bottom nav — the dialog's three places, in the same order every device
          shows them, so "where is the graph" has one answer. Built like the
          app's mobile nav: the same pill (1px gradient edge over a
          surface-default ground, device-matched radius) carrying bare 28px
          glyphs, the current one in the accent with a short underline. */}
      <div className="relative z-[2] shrink-0 bg-surface-lower px-ha-4 pb-ha-4 pt-ha-2">
        <div className="rounded-[var(--mobile-nav-radius)] bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="flex h-14 items-center justify-center gap-ha-7 rounded-[calc(var(--mobile-nav-radius)_-_1px)] bg-surface-default/95 px-ha-8">
            {PANEL_TABS.map(t => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={on}
                  title={t.label}
                  aria-label={t.label}
                  className={clsx(
                    'relative flex h-full items-center justify-center px-ha-2 transition-colors',
                    on ? 'text-ha-blue' : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  <Icon path={on ? (t.iconOn ?? t.icon) : t.icon} size={28} />
                  <span className={clsx(
                    'absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-ha-blue transition-opacity',
                    on ? 'opacity-100' : 'opacity-0',
                  )} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
