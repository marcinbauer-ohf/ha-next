'use client';

import { useRef, useState } from 'react';

interface SparklineProps {
  points: number[];
  on: boolean;
  gradientId: string;
  small?: boolean;
  /** Render as step function — best for boolean (on/off) data */
  stepped?: boolean;
  /** Called with nearest data-point index on hover, null on leave */
  onHover?: (index: number | null) => void;
  /**
   * Externally driven hover, for when the pointer target is something bigger
   * than the chart (a whole dashboard card). Overrides the svg's own tracking:
   * the crosshair and marker follow this index instead of the mouse.
   */
  hoverIndex?: number | null;
  /** Stretch to fill parent height instead of fixed intrinsic height */
  fillHeight?: boolean;
  /** Mark the latest value with a small dot at the end of the line */
  endDot?: boolean;
  /**
   * Keep the stroke at its given px width regardless of how the svg is
   * stretched — needed when rendering far below the intrinsic viewBox size,
   * where the scaled stroke would thin out to subpixel.
   */
  crisp?: boolean;
  /**
   * Per-point horizontal position as a fraction (0..1) of the width — use to
   * place points on a real time axis instead of evenly by index. Must be the
   * same length as `points` and monotonically increasing.
   */
  xFractions?: number[];
  /** Override the accent as an "R,G,B" triple (e.g. "139,92,246"). Defaults to
   *  the on/off green/grey. The `on` opacity treatment still applies. */
  rgb?: string;
  /**
   * Optional min/max envelope (long-term statistics): per-point lower and
   * upper bounds, same length as `points`. Rendered as a soft band behind the
   * mean line; the y-scale stretches to contain it.
   */
  bandLow?: number[];
  bandHigh?: number[];
}

export function Sparkline({ points, on, gradientId, small, stepped, onHover, hoverIndex, fillHeight, endDot, crisp, xFractions, rgb, bandLow, bandHigh }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Index of the data point under the cursor; drives both the crosshair line
  // and the marker dot that rides the line as the pointer moves.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 3) return null;

  const W = 280;
  const H = small ? 32 : 56;
  const pad = small ? 1 : 4;
  const hasBand = !!bandLow && !!bandHigh && bandLow.length === points.length && bandHigh.length === points.length;
  const min = Math.min(...points, ...(hasBand ? bandLow! : []));
  const max = Math.max(...points, ...(hasBand ? bandHigh! : []));
  const range = max - min || 1;

  const useTimeAxis = !!xFractions && xFractions.length === points.length;
  const xOf = (i: number) => (useTimeAxis ? xFractions![i] : i / (points.length - 1)) * W;
  const yOf = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const coords = points.map((v, i) => ({ x: xOf(i), y: yOf(v) }));

  const line = stepped
    ? coords.reduce((p, pt, i) => {
        if (i === 0) return `M${pt.x},${pt.y}`;
        return `${p} H${pt.x} V${pt.y}`;
      }, '')
    : coords.reduce((p, pt, i) => {
        if (i === 0) return `M${pt.x},${pt.y}`;
        const prev = coords[i - 1];
        const cx = (prev.x + pt.x) / 2;
        return `${p} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
      }, '');

  const area = `${line} L${W},${H} L0,${H} Z`;

  // Min→max envelope: upper bound left-to-right, lower bound back, closed.
  // Smoothed with the same midpoint-bezier treatment as the mean line.
  const bandPath = hasBand
    ? (() => {
        const smooth = (vals: number[], reverse: boolean) => {
          const idx = vals.map((_, i) => i);
          if (reverse) idx.reverse();
          let d = '';
          for (let k = 0; k < idx.length; k++) {
            const i = idx[k];
            const x = xOf(i);
            const y = yOf(vals[i]);
            if (k === 0) { d += `${reverse ? 'L' : 'M'}${x},${y}`; continue; }
            const pi = idx[k - 1];
            const px = xOf(pi);
            const py = yOf(vals[pi]);
            const cx = (px + x) / 2;
            d += ` C${cx},${py} ${cx},${y} ${x},${y}`;
          }
          return d;
        };
        return `${smooth(bandHigh!, false)} ${smooth(bandLow!, true)} Z`;
      })()
    : null;

  // Line color — same for stroke and fill, just different opacity
  const r = rgb ?? (on ? '34,197,94' : '120,120,120');
  const stroke = `rgba(${r},${on ? 0.85 : 0.45})`;
  const fillTop = `rgba(${r},0.12)`;

  function scrubTo(clientX: number) {
    if (!svgRef.current || !onHover) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    // Nearest point by x — works for both index- and time-spaced axes.
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const dist = Math.abs(coords[i].x - relX);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    setHoverIdx(best);
    onHover(best);
  }

  function endScrub() {
    setHoverIdx(null);
    onHover?.(null);
  }

  // Controlled when a `hoverIndex` is passed, self-tracking otherwise.
  const activeIdx = hoverIndex !== undefined ? hoverIndex : hoverIdx;
  const hoverPt = activeIdx !== null && activeIdx !== undefined ? coords[activeIdx] : null;

  const svg = (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={fillHeight ? 'block w-full h-full' : 'block w-full'}
      style={fillHeight ? undefined : { height: H }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      {bandPath && <path d={bandPath} fill={`rgba(${r},0.14)`} />}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} stroke={stroke} strokeWidth={small ? '1' : '1.5'} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect={crisp ? 'non-scaling-stroke' : undefined} />

      {/* Hover crosshair — vertical line tracking the nearest point */}
      {hoverPt && (
        <line x1={hoverPt.x} y1={0} x2={hoverPt.x} y2={H}
          stroke={stroke} strokeWidth="1" strokeDasharray="3 2" />
      )}

      {onHover && (
        // Pointer events, not mouse events: a finger scrubs the chart the way a
        // cursor does. `pan-y` leaves a vertical swipe to the panel's scroll
        // while a horizontal drag reads the curve, and the pointer capture keeps
        // it reading after the finger slides off the chart's own box.
        <rect x={0} y={0} width={W} height={H} fill="transparent"
          data-sheet-drag="none"
          style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
          onPointerDown={(e) => {
            try { (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId); } catch { /* stale pointer */ }
            scrubTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || e.buttons > 0) scrubTo(e.clientX);
          }}
          onPointerUp={(e) => { if (e.pointerType !== 'mouse') endScrub(); }}
          onPointerCancel={endScrub}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') endScrub(); }}
        />
      )}
    </svg>
  );

  // Overlay layer is needed for the end dot and/or the moving hover dot. HTML
  // dots positioned by percentage — a <circle> would stretch into an ellipse
  // under preserveAspectRatio="none".
  if (!endDot && !onHover && hoverIndex === undefined) return svg;

  const last = coords[coords.length - 1];
  return (
    <div className={fillHeight ? 'relative w-full h-full' : 'relative w-full'} style={fillHeight ? undefined : { height: H }}>
      {svg}
      {/* Latest-value dot — hidden while hovering so the moving dot reads clearly */}
      {endDot && !hoverPt && (
        <div
          aria-hidden
          className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${(last.x / W) * 100}%`, top: `${(last.y / H) * 100}%`, backgroundColor: stroke }}
        />
      )}
      {/* Hover dot — rides the line, sitting on the point under the cursor */}
      {hoverPt && (
        <div
          aria-hidden
          className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none ring-2 ring-surface-default"
          style={{ left: `${(hoverPt.x / W) * 100}%`, top: `${(hoverPt.y / H) * 100}%`, backgroundColor: stroke }}
        />
      )}
    </div>
  );
}
