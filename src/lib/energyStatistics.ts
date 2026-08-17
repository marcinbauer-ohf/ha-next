import type { StatisticValue } from './homeassistant/types';

// ─────────────────────────────────────────────────────────────────────────────
// Turning long-term statistics into one series. Kept dependency-free so it can
// be exercised on its own (see the check at the bottom of this file).
// ─────────────────────────────────────────────────────────────────────────────

export interface EnergyBucket {
  /** Bucket start, Unix milliseconds. */
  ts: number;
  value: number;
}

/**
 * One series totalled across several sensors. Statistics buckets are aligned to
 * the hour/day for every entity, so summing by bucket start needs no
 * resampling.
 *
 * `mean` reads each bucket's average (power). `change` differences the
 * cumulative meter sum, which is how "energy used in this bucket" is derived —
 * the oldest bucket has no predecessor and drops out, so callers fetch one
 * bucket more than they draw.
 */
export function mergeStatistics(
  perEntity: StatisticValue[][],
  /** Per-entity multiplier onto the canonical unit (W for power, kWh for energy). */
  factors: number[],
  kind: 'mean' | 'change',
): EnergyBucket[] {
  const totals = new Map<number, number>();
  const add = (ts: number, value: number) => totals.set(ts, (totals.get(ts) ?? 0) + value);

  perEntity.forEach((buckets, i) => {
    const factor = factors[i] ?? 1;
    if (kind === 'mean') {
      for (const b of buckets) {
        const value = b.mean ?? b.state;
        if (value != null) add(b.start, value * factor);
      }
      return;
    }
    let previous: number | null = null;
    for (const b of buckets) {
      const cumulative = b.sum ?? b.state;
      if (cumulative == null) continue;
      // A meter reset (or a swapped sensor) makes the sum drop — skip that step
      // rather than booking a negative day.
      if (previous !== null && cumulative >= previous) add(b.start, (cumulative - previous) * factor);
      previous = cumulative;
    }
  });

  return [...totals.entries()].sort((a, b) => a[0] - b[0]).map(([ts, value]) => ({ ts, value }));
}

/**
 * Days until a battery reads 0%, from its recent daily levels: the least-squares
 * drain rate, extrapolated from the newest reading. Null when it isn't draining
 * (flat, or recharged inside the window) or there's too little history — a
 * forecast off a swing is worse than none.
 */
export function daysUntilEmpty(points: EnergyBucket[]): number | null {
  if (points.length < 4) return null;
  const day = 86_400_000;
  const t0 = points[0].ts;
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    const x = (p.ts - t0) / day;
    sx += x; sy += p.value; sxx += x * x; sxy += x * p.value;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const perDay = (n * sxy - sx * sy) / denom;
  if (perDay > -0.05) return null; // steady, or on its way back up
  return Math.max(0, points[n - 1].value / -perDay);
}

// Self-check: `node --experimental-strip-types src/lib/energyStatistics.ts`.
// `NODE_ENV` is always defined in a Next bundle, so this block is stripped from
// the app build; kept import-free so nothing follows it into the client either.
if (process.env.NODE_ENV === undefined) {
  const bucket = (start: number, fields: Partial<StatisticValue>): StatisticValue =>
    ({ start, end: start + 3600_000, ...fields });
  const same = (label: string, got: EnergyBucket[], want: EnergyBucket[]) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    }
  };

  // change: per-bucket deltas, oldest bucket dropped, entities summed, Wh → kWh.
  same('change', mergeStatistics(
    [
      [bucket(0, { sum: 10 }), bucket(1, { sum: 12 }), bucket(2, { sum: 15 })],
      [bucket(1, { sum: 1000 }), bucket(2, { sum: 1500 })],
    ],
    [1, 1 / 1000],
    'change',
  ), [{ ts: 1, value: 2 }, { ts: 2, value: 3.5 }]);

  // change: a meter reset contributes nothing instead of a negative day.
  same('reset', mergeStatistics(
    [[bucket(0, { sum: 90 }), bucket(1, { sum: 0 }), bucket(2, { sum: 4 })]],
    [1],
    'change',
  ), [{ ts: 2, value: 4 }]);

  // mean: a kW sensor normalised to W and summed with a W one in the same bucket.
  same('mean', mergeStatistics(
    [[bucket(0, { mean: 1.5 })], [bucket(0, { mean: 200 })]],
    [1000, 1],
    'mean',
  ), [{ ts: 0, value: 1700 }]);

  // daysUntilEmpty: a steady 1%/day drain runs out in "latest reading" days.
  const dayMs = 86_400_000;
  const series = (values: number[]): EnergyBucket[] => values.map((value, i) => ({ ts: i * dayMs, value }));
  const near = (label: string, got: number | null, want: number | null) => {
    if (got === null || want === null ? got !== want : Math.abs(got - want) > 0.01) {
      throw new Error(`${label}: got ${got}, want ${want}`);
    }
  };
  near('drain', daysUntilEmpty(series([20, 19, 18, 17])), 17);
  near('flat', daysUntilEmpty(series([50, 50, 50, 50])), null);
  near('charging', daysUntilEmpty(series([30, 40, 60, 90])), null);
  near('short history', daysUntilEmpty(series([90, 80, 70])), null);

  console.log('energyStatistics: ok');
}
