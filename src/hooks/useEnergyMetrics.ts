'use client';

import { useMemo } from 'react';
import { useHomeAssistantSelector } from './useHomeAssistant';
import type { HassEntity } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Energy metrics — derive a whole-home power picture from live entities. The
// prototype's instances expose a single grid/mains power sensor (W) plus a
// daily energy total (kWh); this hook finds them heuristically and normalises
// units so widgets can render without per-instance config.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnergyMetrics {
  /** Whole-home power sensor (instantaneous draw), or null if none found. */
  meter: HassEntity | null;
  /** Live total draw in watts (kW sensors normalised to W). */
  watts: number | null;
  /** Daily cumulative energy sensor (kWh), or null. */
  energyToday: HassEntity | null;
  /** Energy used so far today, in kWh. */
  kwhToday: number | null;
  /** Every power sensor seen — fallback / future per-device attribution. */
  powerSensors: HassEntity[];
}

// Whole-home meters name themselves after the grid connection, not a device.
const GRID_KEYWORDS = ['grid', 'mains', 'main', 'house', 'home', 'total', 'whole', 'site', 'consumption', 'load'];
const TODAY_KEYWORDS = ['today', 'daily', 'day'];

function num(e: HassEntity): number {
  const v = parseFloat(e.state);
  return Number.isFinite(v) ? v : NaN;
}

function unit(e: HassEntity): string {
  return ((e.attributes.unit_of_measurement as string | undefined) ?? '').toLowerCase();
}

function nameHint(e: HassEntity): string {
  return `${e.entity_id} ${(e.attributes.friendly_name as string | undefined) ?? ''}`.toLowerCase();
}

// Stable module-scope selector — caching keys on identity, so it must never be
// re-created per render (see selector-identity memory).
function selectEnergySensors(entities: Record<string, HassEntity>): HassEntity[] {
  const out: HassEntity[] = [];
  for (const e of Object.values(entities)) {
    if (!e.entity_id.startsWith('sensor.')) continue;
    const dc = e.attributes.device_class as string | undefined;
    if (dc === 'power' || dc === 'energy') out.push(e);
  }
  return out;
}

// Recompute downstream only when the set or any reading actually changes —
// snapshot identity flips on every unrelated entity update otherwise.
function energySensorsEqual(a: HassEntity[], b: HassEntity[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].entity_id !== b[i].entity_id || a[i].state !== b[i].state) return false;
  }
  return true;
}

export function useEnergyMetrics(): EnergyMetrics {
  const sensors = useHomeAssistantSelector(selectEnergySensors, energySensorsEqual);

  return useMemo<EnergyMetrics>(() => {
    const powerSensors = sensors.filter(e => (e.attributes.device_class as string) === 'power');
    const energySensors = sensors.filter(e => (e.attributes.device_class as string) === 'energy');

    // Pick the whole-home meter: prefer a grid/mains-named sensor; among ties
    // (or with no name hint) the highest live reading — the house total is
    // almost always larger than any single circuit.
    const wattsOf = (e: HassEntity) => {
      const v = num(e);
      if (!Number.isFinite(v)) return NaN;
      return unit(e).startsWith('kw') ? v * 1000 : v;
    };
    const named = powerSensors.filter(e => GRID_KEYWORDS.some(k => nameHint(e).includes(k)));
    const pool = named.length ? named : powerSensors;
    const meter = pool.reduce<HassEntity | null>((best, e) => {
      const w = wattsOf(e);
      if (!Number.isFinite(w)) return best;
      return !best || w > wattsOf(best) ? e : best;
    }, null);
    const watts = meter ? wattsOf(meter) : null;

    // Daily energy total: prefer a today/daily-named kWh sensor.
    const kwh = energySensors.filter(e => unit(e).includes('kwh') || unit(e) === 'wh');
    const todayNamed = kwh.filter(e => TODAY_KEYWORDS.some(k => nameHint(e).includes(k)));
    const energyToday = (todayNamed[0] ?? kwh[0]) ?? null;
    const kwhToday = energyToday
      ? (unit(energyToday) === 'wh' ? num(energyToday) / 1000 : num(energyToday))
      : null;

    return {
      meter,
      watts: Number.isFinite(watts as number) ? (watts as number) : null,
      energyToday,
      kwhToday: Number.isFinite(kwhToday as number) ? (kwhToday as number) : null,
      powerSensors,
    };
  }, [sensors]);
}
