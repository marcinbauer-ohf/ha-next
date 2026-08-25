'use client';

import { useEffect, useMemo, useState } from 'react';
import { mdiRobot, mdiChevronRight } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { Dropdown, HALoader, IconButton, SectionLabel } from '../ui';
import { useAutomations, type AutomationSummary } from '@/hooks';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import type { LogbookEntry } from '@/lib/homeassistant';

// ─────────────────────────────────────────────────────────────────────────────
// Automation activity — hourly bars of when automations ran over the last 24h,
// from one logbook fetch (all automation entities). Tapping a bar filters the
// table below to the automations that ran in that hour. Real data on a live
// connection; demo mode synthesises a plausible day (never mixed).
// ─────────────────────────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// ── How far back the bars go ─────────────────────────────────────────────────
// Same three spans as every other history in the app (see StatsChart), but a
// day of hourly bars and a month of hourly bars are not the same chart: past
// 24h the buckets become days, or you get 720 hairlines nobody can hit.
interface Span {
  value: string;
  label: string;
  /** Hours of logbook to fetch. */
  hours: number;
  /** Width of one bar. */
  bucketMs: number;
  /** How many bars. */
  buckets: number;
}

const SPANS: Span[] = [
  { value: '24', label: '24 hours', hours: 24, bucketMs: HOUR_MS, buckets: 24 },
  { value: '168', label: '7 days', hours: 168, bucketMs: DAY_MS, buckets: 7 },
  { value: '720', label: '30 days', hours: 720, bucketMs: DAY_MS, buckets: 30 },
];

const SPAN_OPTIONS = SPANS.map((s) => ({ value: s.value, label: s.label }));

const spanFor = (value: string): Span => SPANS.find((s) => s.value === value) ?? SPANS[0];

// ── Per-automation colours ───────────────────────────────────────────────────
// Categorical palette (mid-tone, readable on surface bg in light + dark). Each
// automation gets a stable colour by its position; the stacked bars and the runs
// table both use it, so a colour visually links a segment to its automation.

const PALETTE = [
  '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#6366f1',
  '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#06b6d4', '#d946ef',
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** color(key) / order(key) for automation keys, from a stable id ordering. */
interface Palette { color: (key: string) => string; order: (key: string) => number }

function buildPalette(ids: string[]): Palette {
  const index = new Map(ids.map((id, i) => [id, i]));
  return {
    color: (key) => PALETTE[(index.get(key) ?? hashKey(key)) % PALETTE.length],
    order: (key) => index.get(key) ?? 1_000 + hashKey(key) % 1_000,
  };
}

// ── Bucketing ────────────────────────────────────────────────────────────────

interface HourBucket { total: number; segs: [string, number][] }

/** Per-automation counts per bucket over the span, oldest → newest. */
function breakdown(events: LogbookEntry[], span: Span): HourBucket[] {
  const nowBucket = Math.floor(Date.now() / span.bucketMs);
  const maps = Array.from({ length: span.buckets }, () => new Map<string, number>());
  for (const e of events) {
    const idx = span.buckets - 1 - (nowBucket - Math.floor((e.when * 1000) / span.bucketMs));
    if (idx < 0 || idx >= span.buckets) continue;
    const key = e.entity_id ?? e.name ?? 'unknown';
    maps[idx].set(key, (maps[idx].get(key) ?? 0) + 1);
  }
  return maps.map((m) => {
    let total = 0;
    for (const c of m.values()) total += c;
    return { total, segs: [...m.entries()] };
  });
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const day = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** Time window + heading for the runs table, given the selected bar. */
function windowFor(selected: number | null, span: Span): { start: number; end: number; label: string } {
  const now = Date.now();
  if (selected != null) {
    const bucket = Math.floor(now / span.bucketMs) - (span.buckets - 1 - selected);
    const start = bucket * span.bucketMs;
    const end = start + span.bucketMs;
    return {
      start,
      end,
      label: span.bucketMs === HOUR_MS ? `Ran ${clock(start)}–${clock(end)}` : `Ran on ${day(start)}`,
    };
  }
  return { start: now - span.hours * HOUR_MS, end: now, label: `Ran in the last ${span.label}` };
}

interface RanRow { key: string; name: string; count: number; last: number }

/** Group events in [start, end) by automation, most-active first. */
function runsInWindow(events: LogbookEntry[], start: number, end: number, nameById: Map<string, string>): RanRow[] {
  const map = new Map<string, RanRow>();
  for (const e of events) {
    const tms = e.when * 1000;
    if (tms < start || tms >= end) continue;
    const key = e.entity_id ?? e.name ?? 'unknown';
    const row = map.get(key) ?? { key, name: nameById.get(key) ?? e.name ?? key, count: 0, last: 0 };
    row.count += 1;
    if (e.when > row.last) row.last = e.when;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last - a.last);
}

// ── Demo synthesis (only when not connected) ─────────────────────────────────

function buildDemoEvents(autos: AutomationSummary[]): LogbookEntry[] {
  if (autos.length === 0) return [];
  // A plausible week: more runs in morning/evening, fewer overnight.
  const out: LogbookEntry[] = [];
  const now = Date.now();
  const hourWeight = (h: number) => (h >= 6 && h <= 9) || (h >= 17 && h <= 22) ? 0.9 : h >= 0 && h <= 5 ? 0.08 : 0.35;
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      if (Math.random() < hourWeight(h) * 0.6) {
        const a = autos[Math.floor(Math.random() * autos.length)];
        const when = now - d * DAY_MS - (23 - h) * HOUR_MS - Math.floor(Math.random() * HOUR_MS);
        out.push({ when: when / 1000, entity_id: a.id, name: a.name, message: 'has been triggered' });
      }
    }
  }
  return out;
}

// ── Bars ─────────────────────────────────────────────────────────────────────

function SpanTicks({ span }: { span: Span }) {
  // A rolling window that ends "now". Hours-ago reads well across a day; across
  // weeks it doesn't ("-504h"), so the longer spans count back in days.
  const { buckets, bucketMs } = span;
  const every = bucketMs === HOUR_MS ? 6 : buckets > 10 ? 7 : 1;
  const labels: number[] = [];
  for (let i = 0; i <= buckets; i += every) labels.push(i);
  return (
    <div className="relative mt-1 h-3">
      {labels.map((i) => {
        const f = i / buckets;
        const tx = f < 0.04 ? '0%' : f > 0.96 ? '-100%' : '-50%';
        const back = buckets - i;
        const label = i === buckets ? 'now' : bucketMs === HOUR_MS ? `-${back}h` : `-${back}d`;
        return (
          <span key={i} className="absolute top-0 text-[10px] leading-none text-text-tertiary tabular-nums"
            style={{ left: `${f * 100}%`, transform: `translateX(${tx})` }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function BarsView({ events, span, palette, selected, onSelect, highlightKey }: {
  events: LogbookEntry[];
  span: Span;
  palette: Palette;
  selected: number | null;
  onSelect: (i: number | null) => void;
  highlightKey: string | null;
}) {
  const buckets = useMemo(() => breakdown(events, span), [events, span]);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  return (
    <div>
      {/* Taller than it was: this is the surface's headline chart now, and a
          month of daily bars needs the height to say anything. */}
      <div className="flex h-32 items-end gap-px lg:h-40">
        {buckets.map((b, i) => {
          const active = selected === i;
          const dimmed = selected != null && !active;
          // Fixed vertical order so a given automation always stacks in the same place.
          const segs = [...b.segs].sort((x, y) => palette.order(x[0]) - palette.order(y[0]));
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(active ? null : i)}
              className={`group flex h-full flex-1 flex-col justify-end gap-px transition-opacity ${
                dimmed ? 'opacity-30' : 'opacity-100'
              }`}
              title={`${b.total} run${b.total === 1 ? '' : 's'} · tap to inspect`}
              aria-label={`${b.total} runs, bucket ${i + 1} of ${span.buckets}`}
            >
              {segs.map(([key, c], si) => (
                <div
                  key={key}
                  className={si === 0 ? 'w-full rounded-t-sm transition-opacity' : 'w-full transition-opacity'}
                  style={{
                    height: `${(c / max) * 100}%`,
                    minHeight: 2,
                    background: palette.color(key),
                    // Row selection highlights one automation across every hour.
                    opacity: highlightKey && key !== highlightKey ? 0.15 : 1,
                  }}
                />
              ))}
            </button>
          );
        })}
      </div>
      <SpanTicks span={span} />
    </div>
  );
}

// ── Runs table ─────────────────────────────────────────────────────────────

function RunsTable({ rows, label, selected, palette, highlightKey, onHighlight, onOpen, canOpen }: {
  rows: RanRow[];
  label: string;
  selected: boolean;
  palette: Palette;
  highlightKey: string | null;
  onHighlight: (key: string | null) => void;
  onOpen: (key: string) => void;
  canOpen: (key: string) => boolean;
}) {
  return (
    <div className="mt-ha-4">
      <div className="mb-ha-2 flex items-center justify-between gap-ha-2">
        <p className="text-[13px] font-semibold text-text-secondary">{label}</p>
        <span className="text-[12px] text-text-tertiary">
          {rows.length} automation{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-ha-xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-center text-[13px] text-text-tertiary">
          {selected ? 'No automations ran in this hour.' : 'No automations ran in this period.'}
        </p>
      ) : (
        <div className="max-h-64 divide-y divide-surface-low/40 overflow-y-auto rounded-ha-xl border border-surface-lower">
          {rows.map((r) => {
            const color = palette.color(r.key);
            const active = highlightKey === r.key;
            const openable = canOpen(r.key);
            return (
            <div
              key={r.key}
              className={`flex items-center gap-ha-2 pr-ha-2 transition-colors ${active ? 'bg-surface-low' : ''}`}
            >
              {/* Body toggles the bar highlight for this automation. */}
              <button
                type="button"
                onClick={() => onHighlight(active ? null : r.key)}
                className="flex min-w-0 flex-1 items-center gap-ha-3 rounded-ha-lg px-ha-3 py-ha-2 text-left transition-colors hover:bg-surface-low"
                title="Highlight this automation across the chart"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ha-lg"
                  style={{ background: `${color}26`, color }}
                >
                  <Icon path={mdiRobot} size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{r.name}</span>
                {r.count > 1 && (
                  <span className="shrink-0 rounded-full bg-surface-mid px-ha-2 py-0.5 text-[12px] font-semibold tabular-nums text-text-secondary">
                    ×{r.count}
                  </span>
                )}
                <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">{clock(r.last * 1000)}</span>
              </button>
              {openable && (
                <IconButton icon={mdiChevronRight} label={`Open ${r.name}`} size="sm" tone="quiet" shape="square" onClick={() => onOpen(r.key)} />
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Widget ───────────────────────────────────────────────────────────────────

export function AutomationActivityChart({ onOpenAutomation }: { onOpenAutomation?: (id: string) => void } = {}) {
  const { automations } = useAutomations();
  const { connected, demoMode, getLogbook } = useHomeAssistant();
  const [spanValue, setSpanValue] = useState('24');
  const span = spanFor(spanValue);
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [events, setEvents] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = useMemo(() => automations.map((a) => a.id), [automations]);
  const idsKey = ids.join(',');
  const idSet = useMemo(() => new Set(ids), [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameById = useMemo(() => new Map(automations.map((a) => [a.id, a.name])), [automations]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const palette = useMemo(() => buildPalette(ids), [idsKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (ids.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    if (demoMode && !connected) {
      setEvents(buildDemoEvents(automations));
      setLoading(false);
      return;
    }
    getLogbook(ids, span.hours).then((rows) => {
      if (cancelled) return;
      setEvents(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, connected, demoMode, getLogbook, span.hours]);

  const { rows, tableLabel } = useMemo(() => {
    const w = windowFor(selectedBucket, span);
    return { rows: runsInWindow(events, w.start, w.end, nameById), tableLabel: w.label };
  }, [events, selectedBucket, nameById, span]);

  if (automations.length === 0) return null;

  return (
    <div>
      {/* The period control sits with the chart it changes, like every other
          history in the app (see StatsChart's span dropdown). */}
      <div className="mb-ha-2 flex items-center gap-ha-2">
        <SectionLabel inset>When they ran</SectionLabel>
        <Dropdown
          className="ml-auto shrink-0"
          options={SPAN_OPTIONS}
          value={spanValue}
          onChange={(next) => { setSpanValue(next); setSelectedBucket(null); }}
        />
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center lg:h-40"><HALoader size="sm" /></div>
      ) : (
        <>
          <BarsView
            events={events}
            span={span}
            palette={palette}
            selected={selectedBucket}
            onSelect={setSelectedBucket}
            highlightKey={highlightKey}
          />
          <RunsTable
            rows={rows}
            label={tableLabel}
            selected={selectedBucket != null}
            palette={palette}
            highlightKey={highlightKey}
            onHighlight={setHighlightKey}
            onOpen={(key) => onOpenAutomation?.(key)}
            canOpen={(key) => !!onOpenAutomation && idSet.has(key)}
          />
        </>
      )}
    </div>
  );
}
