'use client';

interface SparklineProps {
  points: number[];
  on: boolean;
  gradientId: string;
  small?: boolean;
}

export function Sparkline({ points, on, gradientId, small }: SparklineProps) {
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
  const stroke = on ? 'rgba(34,197,94,0.9)' : 'rgba(120,120,120,0.5)';
  const fill0 = on ? 'rgba(34,197,94,0.25)' : 'rgba(120,120,120,0.12)';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill0} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} stroke={stroke} strokeWidth={small ? '1' : '1.5'} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
