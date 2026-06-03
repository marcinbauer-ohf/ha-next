'use client';

import { useRef, useState } from 'react';

interface SparklineProps {
  points: number[];
  on: boolean;
  gradientId: string;
  small?: boolean;
  /** Called with nearest data-point index on hover, null on leave */
  onHover?: (index: number | null) => void;
}

export function Sparkline({ points, on, gradientId, small, onHover }: SparklineProps) {
  if (points.length < 3) return null;

  const W = 280;
  const H = small ? 32 : 56;
  const pad = small ? 1 : 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }));

  const line = coords.reduce((p, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${p} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  const area = `${line} L${W},${H} L0,${H} Z`;

  // Line color — same for stroke and fill, just different opacity
  const r = on ? '34,197,94' : '120,120,120';
  const stroke = `rgba(${r},${on ? 0.85 : 0.45})`;
  const fillTop = `rgba(${r},0.12)`;

  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if (!svgRef.current || !onHover) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round((relX / W) * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setCursorX(coords[clamped].x);
    onHover(clamped);
  }

  function handleMouseLeave() {
    setCursorX(null);
    onHover?.(null);
  }

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} stroke={stroke} strokeWidth={small ? '1' : '1.5'} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Hover cursor */}
      {cursorX !== null && (
        <line x1={cursorX} y1={0} x2={cursorX} y2={H}
          stroke={stroke} strokeWidth="1" strokeDasharray="3 2" />
      )}

      {onHover && (
        <rect x={0} y={0} width={W} height={H} fill="transparent"
          style={{ cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </svg>
  );
}
