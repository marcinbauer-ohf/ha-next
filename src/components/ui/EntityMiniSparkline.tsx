'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only fetch history once the card is near/in the viewport. The home dashboard
  // mounts every card at once, so eagerly fetching all sparklines would fire
  // dozens of history requests up front and freeze the page on a real instance.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getEntityHistory(entityId, 24).then(history => {
      if (cancelled) return;
      const raw = history
        .map(p => {
          if (p.s === 'on') return 1;
          if (p.s === 'off') return 0;
          return parseFloat(p.s);
        })
        .filter(v => Number.isFinite(v));
      setPoints(raw.length >= 3 ? bucket(raw, 32) : []);
    });
    return () => { cancelled = true; };
  }, [entityId, visible]);

  // Reserve a measurable element so the IntersectionObserver has a target,
  // but stay invisible until real data arrives (no layout jump).
  if (!points || points.length < 3) return <div ref={containerRef} aria-hidden className="h-0" />;

  const isBoolean = points.every(v => v === 0 || v === 1);
  const gradientId = `csp-${entityId.replace(/\W/g, '-')}`;

  return (
    <div className="w-full overflow-hidden opacity-55 pointer-events-none">
      <Sparkline points={points} on={false} gradientId={gradientId} small stepped={isBoolean} />
    </div>
  );
}
