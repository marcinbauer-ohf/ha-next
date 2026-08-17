'use client';

import { useSyncExternalStore } from 'react';
import type { HassEntity } from '@/lib/homeassistant/types';
import { friendlyName } from '@/lib/homeassistant/entityHelpers';
import type { SelectChipOption } from '@/components/ui/SelectChip';

// ─────────────────────────────────────────────────────────────────────────────
// Energy setup — which of the home's sensors the energy dialog reads. Guessing
// is not good enough here: a house with a dozen smart plugs has a dozen "power"
// sensors and no whole-home meter, so the highest reading is whatever appliance
// happens to be running. The user picks once (any number of sensors per slot,
// summed), we keep it in localStorage, and every surface agrees.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnergyConfig {
  /** Power sensors summed into "right now" (W/kW). */
  power: string[];
  /** Today's-energy sensors summed into "used today" (kWh). */
  today: string[];
  /** Solar produced today (kWh). */
  solar: string[];
  /** Sent back to the grid today (kWh). */
  exported: string[];
  /** Home-battery charge sensor (%). */
  battery: string;
  /** What a kWh costs. 0 = no price set, so no cost is shown. */
  price: number;
}

const LS_KEY = 'ha_energy_config_v1';

const EMPTY: EnergyConfig = { power: [], today: [], solar: [], exported: [], battery: '', price: 0 };

const listeners = new Set<() => void>();

// useSyncExternalStore compares snapshots by identity, so the parse is cached
// against the raw string — re-parsing per render would loop forever.
let cache: { raw: string | null; value: EnergyConfig } = { raw: null, value: EMPTY };

function readConfig(): EnergyConfig {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LS_KEY);
  } catch {
    return EMPTY; // private mode
  }
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  if (raw) {
    try {
      value = { ...EMPTY, ...(JSON.parse(raw) as Partial<EnergyConfig>) };
    } catch {
      /* corrupt entry — treat as unset */
    }
  }
  cache = { raw, value };
  return value;
}

function serverConfig(): EnergyConfig {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Live energy setup (SSR-safe, same-tab + cross-tab). */
export function useEnergyConfig(): EnergyConfig {
  return useSyncExternalStore(subscribe, readConfig, serverConfig);
}

/** Merge a patch into the stored setup. */
export function setEnergyConfig(patch: Partial<EnergyConfig>): void {
  const next = { ...readConfig(), ...patch };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* private mode — non-fatal */
  }
  listeners.forEach((l) => l());
}

/** Enough picked to show something real. Otherwise the dialog opens in setup. */
export function isEnergyConfigured(config: EnergyConfig): boolean {
  return config.power.length > 0 || config.today.length > 0;
}

// ── Picking sensors ──────────────────────────────────────────────────────────

export type EnergySensorKind = 'power' | 'energy' | 'battery';

function matchesKind(entity: HassEntity, kind: EnergySensorKind): boolean {
  if (!entity.entity_id.startsWith('sensor.')) return false;
  const deviceClass = entity.attributes.device_class as string | undefined;
  const unit = ((entity.attributes.unit_of_measurement as string | undefined) ?? '').toLowerCase();
  if (kind === 'power') return deviceClass === 'power' && (unit === 'w' || unit === 'kw');
  if (kind === 'energy') return deviceClass === 'energy' && (unit === 'wh' || unit === 'kwh');
  return deviceClass === 'battery' && unit === '%';
}

/**
 * Sensors the user can pick for one slot. Friendly names repeat across a home
 * ("Switch Power" on every room's plug), so a duplicated label gets its
 * entity id appended — otherwise the picker offers six identical rows.
 */
export function energySensorChoices(
  entities: Record<string, HassEntity>,
  kind: EnergySensorKind,
): SelectChipOption[] {
  const list = Object.values(entities).filter((e) => matchesKind(e, kind));
  const counts = new Map<string, number>();
  for (const e of list) {
    const name = friendlyName(e);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return list
    .map((e) => {
      const name = friendlyName(e);
      const objectId = e.entity_id.slice(e.entity_id.indexOf('.') + 1).replace(/_/g, ' ');
      return { id: e.entity_id, label: (counts.get(name) ?? 0) > 1 ? `${name} — ${objectId}` : name };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

// A whole-home meter names itself after the grid connection, not a device — the
// only guess worth making. Everything else the user picks; nothing is prefilled
// from a device-level sensor, since a wrong guess reads as a broken dialog.
const GRID_RE = /grid|mains|house|home|total|whole|site/;
const SOLAR_RE = /solar|pv|inverter|produc/;
const TODAY_RE = /today|daily/;

/** A conservative starting point for the setup step (grid/solar names only). */
export function guessEnergyConfig(entities: Record<string, HassEntity>): Partial<EnergyConfig> {
  const hint = (e: HassEntity) => `${e.entity_id} ${friendlyName(e)}`.toLowerCase();
  const of = (kind: EnergySensorKind, re: RegExp, extra?: RegExp) =>
    Object.values(entities)
      .filter((e) => matchesKind(e, kind) && re.test(hint(e)) && (!extra || extra.test(hint(e))))
      .map((e) => e.entity_id);

  const solar = of('energy', SOLAR_RE, TODAY_RE);
  return {
    power: of('power', GRID_RE).filter((id) => !SOLAR_RE.test(id)),
    today: of('energy', TODAY_RE).filter((id) => GRID_RE.test(id) && !SOLAR_RE.test(id)),
    solar,
  };
}

// ── Live readings ────────────────────────────────────────────────────────────

function numeric(entity: HassEntity | undefined): number | null {
  if (!entity) return null;
  const value = parseFloat(entity.state);
  return Number.isFinite(value) ? value : null;
}

function unitOf(entity: HassEntity): string {
  return ((entity.attributes.unit_of_measurement as string | undefined) ?? '').toLowerCase();
}

/** Sum of the given power sensors, in watts (kW readings normalised). Null if none read. */
export function sumWatts(entities: (HassEntity | undefined)[]): number | null {
  let total = 0;
  let seen = false;
  for (const e of entities) {
    const value = numeric(e);
    if (value === null) continue;
    seen = true;
    total += unitOf(e!).startsWith('kw') ? value * 1000 : value;
  }
  return seen ? total : null;
}

/** Sum of the given energy sensors, in kWh (Wh readings normalised). Null if none read. */
export function sumKwh(entities: (HassEntity | undefined)[]): number | null {
  let total = 0;
  let seen = false;
  for (const e of entities) {
    const value = numeric(e);
    if (value === null) continue;
    seen = true;
    total += unitOf(e!) === 'wh' ? value / 1000 : value;
  }
  return seen ? total : null;
}
