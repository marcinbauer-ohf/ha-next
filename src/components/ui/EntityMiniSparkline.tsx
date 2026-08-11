'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { Sparkline } from './Sparkline';

/** Accent the curve takes while the card is being scrubbed (--ha-color-blue). */
const HOVER_RGB = '24,188,242';

export interface MiniSparklinePoint {
  value: number;
  ts: number | null;
}

interface EntityMiniSparklineProps {
  entityId: string;
  /** Inline-row variant — fixed 56×16 footprint, no hover. Box is reserved
   * up front so the row doesn't shift when history arrives. */
  tiny?: boolean;
  /** Called with the hovered data point (value + timestamp), null on leave */
  onHover?: (point: MiniSparklinePoint | null) => void;
  /**
   * Track the pointer over this element instead of over the chart itself. A
   * dashboard card's graph is a 40px strip along the bottom edge — hunting for
   * it with the mouse is fiddly, so the card hands its own box over and the
   * whole card scrubs the curve.
   */
  hoverTarget?: React.RefObject<HTMLElement | null>;
}

// Bucket raw readings into ~N evenly-spaced averaged samples (mid-slice timestamp).
function bucket(pts: MiniSparklinePoint[], target: number): MiniSparklinePoint[] {
  if (pts.length <= target) return pts;
  const size = Math.ceil(pts.length / target);
  const out: MiniSparklinePoint[] = [];
  for (let i = 0; i < pts.length; i += size) {
    const slice = pts.slice(i, i + size);
    out.push({
      value: slice.reduce((a, b) => a + b.value, 0) / slice.length,
      ts: slice[Math.floor(slice.length / 2)].ts,
    });
  }
  return out;
}

export function EntityMiniSparkline({ entityId, tiny, onHover, hoverTarget }: EntityMiniSparklineProps) {
  // Through the provider, not the raw connection: that's what makes the sample
  // home and staged (mock) entities draw a curve instead of nothing.
  const { getEntityHistory } = useHomeAssistant();
  const [points, setPoints] = useState<MiniSparklinePoint[] | null>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHoverIdx = useRef<number | null>(null);

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
          const value = p.s === 'on' ? 1 : p.s === 'off' ? 0 : parseFloat(p.s);
          return { value, ts: p.lc ?? p.lu ?? null };
        })
        .filter(p => Number.isFinite(p.value));
      setPoints(raw.length >= 3 ? bucket(raw, 32) : []);
    });
    return () => { cancelled = true; };
  }, [entityId, visible, getEntityHistory]);

  // Index under the pointer while the card (not the chart) is being tracked —
  // drives the crosshair, the marker and the "this graph is live" highlight.
  const [cardHoverIdx, setCardHoverIdx] = useState<number | null>(null);
  const emit = useCallback((idx: number | null) => {
    if (idx === lastHoverIdx.current) return;
    lastHoverIdx.current = idx;
    setCardHoverIdx(idx);
    onHover?.(idx === null || !points ? null : points[idx]);
  }, [onHover, points]);

  useEffect(() => {
    const el = hoverTarget?.current;
    if (!el || !points || points.length < 3) return;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      emit(Math.round(f * (points.length - 1)));
    };
    const leave = () => emit(null);
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [hoverTarget, points, emit]);

  const hasData = !!points && points.length >= 3;
  const isBoolean = hasData && points.every(p => p.value === 0 || p.value === 1);
  const gradientId = `${tiny ? 'tsp' : 'csp'}-${entityId.replace(/\W/g, '-')}`;

  // Row variant: the box itself is the observer target and stays mounted, so
  // sibling layout (right-aligned state) never jumps when data arrives.
  if (tiny) {
    return (
      <div ref={containerRef} aria-hidden className="w-14 h-4 shrink-0 opacity-55 pointer-events-none">
        {hasData && (
          <Sparkline
            points={points.map(p => p.value)}
            on={false}
            gradientId={gradientId}
            small
            stepped={isBoolean}
            fillHeight
            crisp
            endDot
          />
        )}
      </div>
    );
  }

  // Reserve a measurable element so the IntersectionObserver has a target,
  // but stay invisible until real data arrives (no layout jump).
  if (!hasData) return <div ref={containerRef} aria-hidden className="h-0" />;

  // Forward index changes only — Sparkline fires per mousemove, the card
  // re-renders on every callback
  const handleHover = onHover
    ? (idx: number | null) => {
        if (idx === lastHoverIdx.current) return;
        lastHoverIdx.current = idx;
        onHover(idx === null ? null : points[idx]);
      }
    : undefined;

  // Card-tracked: the chart itself takes no pointer events (the card owns them)
  // and lights up — full opacity, in the accent — while it's being scrubbed, so
  // it's obvious which graph the readout above belongs to.
  const tracked = !!hoverTarget;
  const lit = tracked && cardHoverIdx !== null;
  return (
    <div className={clsx(
      'w-full transition-opacity duration-150',
      lit ? 'opacity-100' : 'opacity-55',
      tracked || !onHover ? 'pointer-events-none' : '',
    )}>
      <Sparkline
        points={points.map(p => p.value)}
        on={false}
        gradientId={gradientId}
        small
        stepped={isBoolean}
        onHover={tracked ? undefined : handleHover}
        hoverIndex={tracked ? cardHoverIdx : undefined}
        rgb={lit ? HOVER_RGB : undefined}
        endDot
      />
    </div>
  );
}
