'use client';

import { useEffect, useState } from 'react';
import { getEntityHistory } from '@/lib/homeassistant/connection';
import { Sparkline } from './Sparkline';

interface EntityMiniSparklineProps {
  entityId: string;
}

// Bucket raw readings into ~N evenly-spaced averaged samples.
function bucket(values: number[], target: number): number[] {
  if (values.length <= target) return values;
  const size = Math.ceil(values.length / target);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size) {
    const slice = values.slice(i, i + size);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

export function EntityMiniSparkline({ entityId }: EntityMiniSparklineProps) {
  const [points, setPoints] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEntityHistory(entityId, 24).then(history => {
      if (cancelled) return;
      const raw = history
        .map(p => parseFloat(p.s))
        .filter(v => Number.isFinite(v));
      setPoints(raw.length >= 3 ? bucket(raw, 32) : []);
    });
    return () => { cancelled = true; };
  }, [entityId]);

  // Don't render anything until data arrives (no layout jump)
  if (!points || points.length < 3) return null;

  // Stable gradient ID derived from entityId (safe for SVG)
  const gradientId = `csp-${entityId.replace(/\W/g, '-')}`;

  return (
    <div className="w-full overflow-hidden opacity-55 pointer-events-none">
      <Sparkline points={points} on={false} gradientId={gradientId} small />
    </div>
  );
}
