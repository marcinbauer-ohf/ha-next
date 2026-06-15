'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/** One stretch of time the entity held a single state. `start`/`end` are unix seconds. */
export interface StateSegment {
  state: string;
  start: number;
  end: number;
}

// Semantic buckets so common on/off-style states read consistently; anything
// else gets a stable per-state hue (e.g. fan speeds, hvac modes, alarm states).
const ACTIVE = new Set([
  'on', 'open', 'opening', 'playing', 'home', 'active', 'detected', 'motion',
  'occupied', 'occupancy', 'present', 'unlocked', 'heat', 'heating', 'cool',
  'cooling', 'running', 'cleaning', 'charging', 'wet', 'triggered', 'alarm', 'true', '1',
]);
const IDLE = new Set([
  'off', 'closed', 'closing', 'idle', 'away', 'not_home', 'locked', 'clear',
  'paused', 'standby', 'disarmed', 'stopped', 'docked', 'dry', 'false', '0', 'none',
]);

function stateColor(stateRaw: string): string {
  const s = stateRaw.toLowerCase();
  if (s === 'unavailable' || s === 'unknown' || s === '') return 'rgb(245 158 11 / 0.45)'; // amber, faint
  if (ACTIVE.has(s) || s.startsWith('armed')) return 'rgb(34 197 94)';       // green
  if (IDLE.has(s)) return 'rgb(120 120 120 / 0.5)';                          // neutral grey
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;   // stable hue
  return `hsl(${h} 60% 55%)`;
}

const prettyState = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function fmtDur(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

const fmtClock = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const TARGET_CELL_PX = 7; // aim for ~7px cells; cell count adapts to width

/**
 * History viz for non-numeric entities — a heatmap of equal-width time buckets,
 * each coloured by the state that dominated that slice. Fixed-width cells keep
 * it readable no matter how many state changes occur (a duration-segment bar
 * collapses to sub-pixel slivers when an entity flaps), and a per-state legend
 * sums total time. The categorical analogue of the numeric sparkline.
 */
export function StateTimeline({ segments, startTs, endTs }: { segments: StateSegment[]; startTs: number; endTs: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const span = Math.max(1, endTs - startTs);
  const cellCount = Math.min(256, Math.max(16, Math.round((width || 320) / TARGET_CELL_PX)));
  const cellDur = span / cellCount;

  // Dominant state per cell — the state with the most overlap in that bucket.
  const cells = useMemo(() => {
    const out: (string | null)[] = [];
    for (let c = 0; c < cellCount; c++) {
      const cs = startTs + c * cellDur;
      const ce = cs + cellDur;
      let best: string | null = null;
      let bestDur = 0;
      const acc = new Map<string, number>();
      for (const seg of segments) {
        const overlap = Math.min(ce, seg.end) - Math.max(cs, seg.start);
        if (overlap <= 0) continue;
        const d = (acc.get(seg.state) ?? 0) + overlap;
        acc.set(seg.state, d);
        if (d > bestDur) { bestDur = d; best = seg.state; }
      }
      out.push(best);
    }
    return out;
  }, [segments, startTs, cellDur, cellCount]);

  // Legend — total time per state across the window.
  const legend = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of segments) totals.set(s.state, (totals.get(s.state) ?? 0) + (s.end - s.start));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [segments]);

  const hoverState = hover !== null ? cells[hover] : null;
  const hoverLabel = hover !== null && hoverState
    ? `${fmtClock(startTs + hover * cellDur)} · ${prettyState(hoverState)}`
    : '';

  return (
    <div className="w-full">
      <div
        ref={ref}
        className="flex w-full h-9 gap-px rounded-ha-lg overflow-hidden"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="State history heatmap"
      >
        {cells.map((state, i) => (
          <div
            key={i}
            className="h-full flex-1 bg-surface-low transition-[filter] hover:brightness-125"
            style={state ? { backgroundColor: stateColor(state) } : undefined}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </div>

      {/* Hover readout — reserves height so the layout doesn't jump */}
      <div className="h-4 mt-1 text-center text-[11px] font-medium text-text-secondary truncate">
        {hoverLabel}
      </div>

      {/* Legend: total time per state */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-0.5">
        {legend.map(([state, dur]) => (
          <span key={state} className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stateColor(state) }} />
            <span className="truncate">{prettyState(state)}</span>
            <span className="text-text-secondary font-medium tabular-nums">{fmtDur(dur)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
