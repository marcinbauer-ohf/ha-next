'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

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

/** Paint one cell: solid when it held a single state, hard-stop gradient when it flapped. */
function cellStyle(parts: { state: string; from: number; to: number }[]): CSSProperties | undefined {
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return { backgroundColor: stateColor(parts[0].state) };
  // Two stops per part (start + end at the same colour) so transitions are edges, not blends.
  const stops = parts.flatMap(p => {
    const c = stateColor(p.state);
    return [`${c} ${(p.from * 100).toFixed(2)}%`, `${c} ${(p.to * 100).toFixed(2)}%`];
  });
  return { backgroundImage: `linear-gradient(to right, ${stops.join(',')})` };
}

const TARGET_CELL_PX = 7; // aim for ~7px cells; cell count adapts to width

/**
 * History viz for non-numeric entities — a heatmap of equal-width time buckets,
 * each coloured by the state that dominated that slice. Fixed-width cells keep
 * it readable no matter how many state changes occur (a duration-segment bar
 * collapses to sub-pixel slivers when an entity flaps), and a per-state legend
 * sums total time. The categorical analogue of the numeric sparkline.
 */
export function StateTimeline({ segments, startTs, endTs, compact, fill, onHover }: {
  segments: StateSegment[];
  startTs: number;
  endTs: number;
  /** Strip variant — bar only, no hover readout or legend (used inline under a value). */
  compact?: boolean;
  /** Stretch the bar to fill the height it's given instead of the fixed 36px. */
  fill?: boolean;
  /**
   * The state under the cursor and when it held — lets the hero show what the
   * entity read at that moment instead of what it reads now.
   */
  onHover?: (hit: { state: string; ts: number } | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

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

  // Every state a cell contains, in time order — a cell that flapped is painted
  // as a hard-stop gradient rather than collapsing to whichever state won it.
  const cells = useMemo(() => {
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const out: { state: string; from: number; to: number }[][] = [];
    for (let c = 0; c < cellCount; c++) {
      const cs = startTs + c * cellDur;
      const ce = cs + cellDur;
      const parts: { state: string; from: number; to: number }[] = [];
      for (const seg of sorted) {
        if (seg.end <= cs) continue;
        if (seg.start >= ce) break;
        const from = (Math.max(cs, seg.start) - cs) / cellDur;
        const to = (Math.min(ce, seg.end) - cs) / cellDur;
        const prev = parts[parts.length - 1];
        if (prev && prev.state === seg.state) prev.to = to;   // merge touching repeats
        else parts.push({ state: seg.state, from, to });
      }
      out.push(parts);
    }
    return out;
  }, [segments, startTs, cellDur, cellCount]);

  // Legend — total time per state across the window.
  const legend = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of segments) totals.set(s.state, (totals.get(s.state) ?? 0) + (s.end - s.start));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [segments]);

  // Touch scrubbing: the cells only ever listened for mouseenter, so a finger
  // read nothing. One handler on the bar maps x straight to a timestamp — and
  // since cells are no longer single-state, the readout resolves by time, not cell.
  const scrubTo = (clientX: number) => {
    const el = ref.current;
    if (!el || !onHover) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(0.999, Math.max(0, (clientX - r.left) / r.width));
    const ts = startTs + f * span;
    const seg = segments.find(s => ts >= s.start && ts < s.end);
    onHover(seg ? { state: seg.state, ts } : null);
  };

  return (
    <div className={fill ? 'flex h-full w-full flex-col' : 'w-full'}>
      <div
        ref={ref}
        // Both variants are 36px: compact is the dialog's 24h strip, which sits
        // in the 48px control row and should fill it, not float inside it.
        className={fill ? 'flex min-h-0 w-full flex-1 gap-px rounded-ha-lg overflow-hidden' : 'flex w-full gap-px rounded-ha-lg overflow-hidden h-9'}
        data-sheet-drag="none"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* stale pointer */ }
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' && e.buttons === 0) return;
          scrubTo(e.clientX);
        }}
        onPointerUp={() => onHover?.(null)}
        onPointerCancel={() => onHover?.(null)}
        onMouseLeave={() => onHover?.(null)}
        role="img"
        aria-label="State history heatmap"
      >
        {cells.map((parts, i) => (
          <div
            key={i}
            className="h-full flex-1 bg-surface-low transition-[filter] hover:brightness-125"
            style={cellStyle(parts)}
          />
        ))}
      </div>

      {/* Legend: total time per state */}
      {!compact && <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-0.5">
        {legend.map(([state, dur]) => (
          <span key={state} className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stateColor(state) }} />
            <span className="truncate">{prettyState(state)}</span>
            <span className="text-text-secondary font-medium tabular-nums">{fmtDur(dur)}</span>
          </span>
        ))}
      </div>}
    </div>
  );
}
