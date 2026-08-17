'use client';

import { useSyncExternalStore } from 'react';
import type { HassEntity } from '@/lib/homeassistant/types';
import { friendlyName } from '@/lib/homeassistant/entityHelpers';
import type { SelectChipOption } from '@/components/ui/SelectChip';
import { LOW_BATTERY_THRESHOLD } from '@/lib/homeCenter';

// ─────────────────────────────────────────────────────────────────────────────
// What each summary chip counts. Unlike energy — where a guess is meaningless
// and setup is a gate (see energyConfig) — these all have a sane default, so
// the config narrows an answer that already works: which rooms count as "the
// home's temperature" (the default average includes the fridge and the garden),
// which locks and doors are "security", which weather entity to believe.
//
// Empty list / empty string = "use the default", so an unconfigured home is
// exactly what it was before, and clearing a slot goes back to it.
// ─────────────────────────────────────────────────────────────────────────────

export interface SummaryConfig {
  /** Temperature sensors that count as the home's climate. */
  climate: string[];
  /** Humidity sensors shown alongside them. */
  humidity: string[];
  /** Locks, doors, windows and alarm panels that count as security. */
  security: string[];
  /** Which weather entity to read (id, not a list). */
  weather: string[];
  /** Battery sensors worth tracking. Empty = every battery the home reports. */
  battery: string[];
  /** Percent at or below which a battery counts as low. */
  batteryLow: number;
}

/**
 * The threshold a home starts on. A Zigbee sensor at 20% lasts months and a
 * doorbell camera at 20% dies tomorrow, so it's a knob, not a constant — this
 * is only where it starts. Shared with the Home Center's low-battery section.
 */
export const DEFAULT_BATTERY_LOW = LOW_BATTERY_THRESHOLD;

const LS_KEY = 'ha_summary_config_v1';

const EMPTY: SummaryConfig = { climate: [], humidity: [], security: [], weather: [], battery: [], batteryLow: DEFAULT_BATTERY_LOW };

const listeners = new Set<() => void>();

// Parsed value cached against the raw string — useSyncExternalStore compares
// snapshots by identity, so re-parsing per render would loop.
let cache: { raw: string | null; value: SummaryConfig } = { raw: null, value: EMPTY };

function readConfig(): SummaryConfig {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LS_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  if (raw) {
    try {
      value = { ...EMPTY, ...(JSON.parse(raw) as Partial<SummaryConfig>) };
    } catch {
      /* corrupt entry — treat as unset */
    }
  }
  cache = { raw, value };
  return value;
}

function serverConfig(): SummaryConfig {
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

/** Live summary setup (SSR-safe, same-tab + cross-tab). */
export function useSummaryConfig(): SummaryConfig {
  return useSyncExternalStore(subscribe, readConfig, serverConfig);
}

export function setSummaryConfig(patch: Partial<SummaryConfig>): void {
  const next = { ...readConfig(), ...patch };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* private mode — non-fatal */
  }
  listeners.forEach((l) => l());
}

// ── Picker options ───────────────────────────────────────────────────────────

/**
 * Entities as picker options. Friendly names repeat across a home ("Temperature"
 * on every room's sensor), so a duplicated label gets its entity id appended —
 * otherwise the picker offers six identical rows.
 */
export function entityChoices(list: HassEntity[]): SelectChipOption[] {
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

// ── What each summary reads ──────────────────────────────────────────────────

type Entities = Record<string, HassEntity>;

const numeric = (e: HassEntity, key?: string) =>
  parseFloat(String(key ? e.attributes[key] ?? e.state : e.state));

/** Every temperature reading in the home — the pool the climate slot picks from. */
export function temperatureCandidates(entities: Entities): HassEntity[] {
  return Object.values(entities).filter(
    (e) =>
      (e.entity_id.startsWith('sensor.') || e.entity_id.startsWith('climate.')) &&
      (e.attributes.device_class === 'temperature' || e.attributes.current_temperature != null) &&
      !isNaN(numeric(e, e.attributes.current_temperature != null ? 'current_temperature' : undefined)),
  );
}

export function humidityCandidates(entities: Entities): HassEntity[] {
  return Object.values(entities).filter(
    (e) => e.entity_id.startsWith('sensor.') && e.attributes.device_class === 'humidity' && !isNaN(numeric(e)),
  );
}

// Freezers, fridges, ovens, the garden and the CPU all report a temperature and
// none of them is "how warm is the house" — the default average excludes them.
const NOT_INDOOR = /outdoor|outside|garden|balcon|terrace|patio|roof|freez|fridge|refriger|oven|grill|bbq|pool|water|cpu|battery|device|charger|car|weather|dew ?point|feels/i;

export function securityCandidates(entities: Entities): HassEntity[] {
  return Object.values(entities).filter((e) => {
    if (e.entity_id.startsWith('lock.') || e.entity_id.startsWith('alarm_control_panel.')) return true;
    if (!e.entity_id.startsWith('binary_sensor.')) return false;
    const deviceClass = e.attributes.device_class as string | undefined;
    return deviceClass === 'door' || deviceClass === 'window' || deviceClass === 'garage_door' || deviceClass === 'opening';
  });
}

export function weatherCandidates(entities: Entities): HassEntity[] {
  return Object.values(entities).filter((e) => e.entity_id.startsWith('weather.'));
}

/**
 * Every battery reading in the home. Integrations that predate device classes
 * only mark themselves with the entity id, so both are accepted — the same pair
 * of tests the Home Center's low-battery section uses.
 */
export function batteryCandidates(entities: Entities): HassEntity[] {
  return Object.values(entities).filter(
    (e) =>
      e.entity_id.startsWith('sensor.') &&
      (e.attributes.device_class === 'battery' || /_battery$/.test(e.entity_id)) &&
      !isNaN(numeric(e)),
  );
}

/** Resolve a configured id list against the store, dropping anything gone. */
function resolve(entities: Entities, ids: string[]): HassEntity[] {
  return ids.map((id) => entities[id]).filter(Boolean) as HassEntity[];
}

/** The sensors the climate chip and dialog read: the picked ones, else indoors. */
export function climateSensors(entities: Entities, config: SummaryConfig): HassEntity[] {
  if (config.climate.length > 0) return resolve(entities, config.climate);
  return temperatureCandidates(entities).filter((e) => !NOT_INDOOR.test(`${e.entity_id} ${friendlyName(e)}`));
}

export function humiditySensors(entities: Entities, config: SummaryConfig): HassEntity[] {
  if (config.humidity.length > 0) return resolve(entities, config.humidity);
  return humidityCandidates(entities).filter((e) => !NOT_INDOOR.test(`${e.entity_id} ${friendlyName(e)}`));
}

/** Locks, doors and alarms the security chip watches: the picked ones, else all. */
export function securityEntities(entities: Entities, config: SummaryConfig): HassEntity[] {
  if (config.security.length > 0) return resolve(entities, config.security);
  return securityCandidates(entities);
}

export function weatherSource(entities: Entities, config: SummaryConfig): HassEntity | undefined {
  return resolve(entities, config.weather)[0] ?? weatherCandidates(entities)[0];
}

/** The batteries the chip and dialog watch: the picked ones, else all of them. */
export function batteryEntities(entities: Entities, config: SummaryConfig): HassEntity[] {
  if (config.battery.length > 0) return resolve(entities, config.battery);
  return batteryCandidates(entities);
}

/** Charge level, 0–100. */
export function batteryLevel(entity: HassEntity): number {
  return numeric(entity);
}

/** The configured low-battery threshold, falling back to the default. */
export function lowBatteryAt(config: SummaryConfig): number {
  return Number.isFinite(config.batteryLow) && config.batteryLow > 0 ? config.batteryLow : DEFAULT_BATTERY_LOW;
}

/** A temperature reading, whichever attribute carries it. */
export function temperatureOf(entity: HassEntity): number {
  return numeric(entity, entity.attributes.current_temperature != null ? 'current_temperature' : undefined);
}
