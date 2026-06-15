'use client';

import { useEffect, useMemo, useState } from 'react';
import { mdiRobot } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { HALoader } from '../ui';
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

// ── Bucketing ────────────────────────────────────────────────────────────────

/** Counts per hour for the last `hours`, oldest → newest. */
function hourlyCounts(events: LogbookEntry[], hours: number): number[] {
  const nowHour = Math.floor(Date.now() / HOUR_MS);
  const counts = new Array(hours).fill(0);
  for (const e of events) {
    const idx = hours - 1 - (nowHour - Math.floor((e.when * 1000) / HOUR_MS));
    if (idx >= 0 && idx < hours) counts[idx] += 1;
  }
  return counts;
}

function countSince(events: LogbookEntry[], ms: number): number {
  const t = Date.now() - ms;
  return events.filter((e) => e.when * 1000 >= t).length;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Time window + heading for the runs table, given the selected bar. */
function windowFor(selectedHour: number | null): { start: number; end: number; label: string } {
  const now = Date.now();
  if (selectedHour != null) {
    const hour = Math.floor(now / HOUR_MS) - (23 - selectedHour);
    const start = hour * HOUR_MS;
    return { start, end: start + HOUR_MS, label: `Ran ${clock(start)}–${clock(start + HOUR_MS)}` };
  }
  return { start: now - DAY_MS, end: now, label: 'Ran in the last 24h' };
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

function HourTicks({ count }: { count: number }) {
  // Rolling window that ends "now"; label every 6h as hours-ago.
  const labels = [];
  for (let i = 0; i <= count; i += 6) labels.push(i);
  return (
    <div className="relative mt-1 h-3">
      {labels.map((h) => {
        const f = h / count;
        const tx = f < 0.04 ? '0%' : f > 0.96 ? '-100%' : '-50%';
        const label = h === count ? 'now' : `-${count - h}h`;
        return (
          <span key={h} className="absolute top-0 text-[10px] leading-none text-text-tertiary tabular-nums"
            style={{ left: `${f * 100}%`, transform: `translateX(${tx})` }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function BarsView({ events, selected, onSelect }: {
  events: LogbookEntry[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const counts = useMemo(() => hourlyCounts(events, 24), [events]);
  const max = Math.max(1, ...counts);
  return (
    <div>
      <div className="flex h-24 items-end gap-px">
        {counts.map((c, i) => {
          const active = selected === i;
          const dimmed = selected != null && !active;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(active ? null : i)}
              className="group flex h-full flex-1 items-end"
              title={`${c} run${c === 1 ? '' : 's'} · tap to inspect`}
            >
              <div
                className={`w-full rounded-t-sm transition-colors ${
                  active ? 'bg-violet-500' : dimmed ? 'bg-violet-500/30' : 'bg-violet-500/70 group-hover:bg-violet-500'
                }`}
                style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? 3 : 0 }}
              />
            </button>
          );
        })}
      </div>
      <HourTicks count={24} />
    </div>
  );
}

// ── Runs table ─────────────────────────────────────────────────────────────

function RunsTable({ rows, label, selected }: { rows: RanRow[]; label: string; selected: boolean }) {
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
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-ha-3 px-ha-3 py-ha-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ha-lg bg-violet-500/15 text-violet-500">
                <Icon path={mdiRobot} size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{r.name}</span>
              {r.count > 1 && (
                <span className="shrink-0 rounded-full bg-surface-mid px-ha-2 py-0.5 text-[12px] font-semibold tabular-nums text-text-secondary">
                  ×{r.count}
                </span>
              )}
              <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">{clock(r.last * 1000)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Widget ───────────────────────────────────────────────────────────────────

export function AutomationActivityChart() {
  const { automations } = useAutomations();
  const { connected, demoMode, getLogbook } = useHomeAssistant();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [events, setEvents] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = useMemo(() => automations.map((a) => a.id), [automations]);
  const idsKey = ids.join(',');
  const nameById = useMemo(() => new Map(automations.map((a) => [a.id, a.name])), [automations]);

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
    getLogbook(ids, 24).then((rows) => {
      if (cancelled) return;
      setEvents(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, connected, demoMode, getLogbook]);

  const windowTotal = useMemo(() => countSince(events, DAY_MS), [events]);

  const { rows, tableLabel } = useMemo(() => {
    const w = windowFor(selectedHour);
    return { rows: runsInWindow(events, w.start, w.end, nameById), tableLabel: w.label };
  }, [events, selectedHour, nameById]);

  if (automations.length === 0) return null;

  return (
    <div className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-3 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
      <div className="mb-ha-3 flex items-center gap-ha-2">
        <Icon path={mdiRobot} size={16} className="text-violet-500" />
        <span className="text-sm font-semibold text-text-primary">Automation activity</span>
        {!loading && (
          <span className="text-[13px] text-text-tertiary">
            · {windowTotal} run{windowTotal === 1 ? '' : 's'} · 24h
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center"><HALoader size="sm" /></div>
      ) : (
        <>
          <BarsView events={events} selected={selectedHour} onSelect={setSelectedHour} />
          <RunsTable rows={rows} label={tableLabel} selected={selectedHour != null} />
        </>
      )}
    </div>
  );
}
