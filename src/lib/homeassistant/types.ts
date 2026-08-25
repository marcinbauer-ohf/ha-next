import type { HassEntity } from '@/types';

export type { HassEntity };

export interface HassConfig {
  url: string;
  token: string;
}

/**
 * Home Assistant core configuration (the `get_config` WS result). Only the
 * fields the Home Information page displays are typed here; HA returns more.
 */
export interface HaCoreConfig {
  location_name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  time_zone: string;
  currency: string;
  country: string | null;
  language: string;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
    pressure?: string;
    wind_speed?: string;
    accumulated_precipitation?: string;
  };
  version?: string;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export interface HassServices {
  [domain: string]: {
    [service: string]: {
      name: string;
      description: string;
      fields: Record<string, unknown>;
    };
  };
}

export interface EntityRegistryEntry {
  entity_id: string;
  device_id: string | null;
  /** Entity-level area override. When set, takes precedence over the device's area. */
  area_id: string | null;
  name: string | null;
  original_name: string | null;
  platform: string;
  disabled_by: string | null;
  hidden_by: string | null;
  /** 'config' | 'diagnostic' — set for entities HA keeps out of the main UI. */
  entity_category?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  area_id: string | null;
  entry_type: string | null;
  /* The rest is what HA's own device page prints in its "Device info" card.
     All optional: `config/device_registry/list` has always sent them, but a
     device only fills in what its integration knows. */
  model_id?: string | null;
  sw_version?: string | null;
  hw_version?: string | null;
  serial_number?: string | null;
  /** The hub/bridge this device talks through ("Connected via"). */
  via_device_id?: string | null;
  /** The device's own web UI, if it has one ("Visit device"). */
  configuration_url?: string | null;
  disabled_by?: string | null;
}

/**
 * A Home Assistant config entry (one configured instance of an integration).
 * Source of truth for the Integrations list — unlike the entity registry it
 * includes integrations that are disabled or ignored (which have no live
 * entities). `source: 'ignore'` marks ignored discoveries; `disabled_by` marks
 * a user-disabled entry.
 */
export interface ConfigEntry {
  entry_id: string;
  domain: string;
  title: string;
  source: string;
  state: string;
  disabled_by: string | null;
  reason: string | null;
}

/**
 * An integration's manifest metadata (from `manifest/list`). Carries the flags
 * the Integrations page badges: `is_built_in` (false ⇒ custom integration) and
 * `iot_class` (cloud_* ⇒ relies on the internet, local_* ⇒ local network).
 */
export interface IntegrationManifest {
  domain: string;
  name: string;
  is_built_in: boolean;
  iot_class: string | null;
  integration_type?: string;
  quality_scale?: string;
}

export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  floor_id?: string | null;
  icon?: string | null;
  /** Image URL path (e.g. /api/image/serve/<id>/512x512); upload is phase-2. */
  picture?: string | null;
  aliases?: string[];
  labels?: string[];
  /** The sensor that speaks for this area's temperature (HA 2025.2+). */
  temperature_entity_id?: string | null;
  /** The sensor that speaks for this area's humidity (HA 2025.2+). */
  humidity_entity_id?: string | null;
}

export interface FloorRegistryEntry {
  floor_id: string;
  name: string;
  level?: number | null;
  icon?: string | null;
  aliases?: string[];
}

export interface LabelRegistryEntry {
  label_id: string;
  name: string;
  /** HA color name (e.g. "red", "green") or null. */
  color?: string | null;
  icon?: string | null;
  description?: string | null;
}

export interface HistoryPoint {
  /** State value as string */
  s: string;
  /** Last changed Unix timestamp (seconds) */
  lc?: number;
  /** Last updated Unix timestamp (seconds) */
  lu?: number;
}

/**
 * One long-term statistics bucket from `recorder/statistics_during_period`.
 * Timestamps are Unix milliseconds; mean/min/max are present for measurement
 * sensors, state/sum for metered ones (energy). Fields the recorder didn't
 * compute come back absent.
 */
export interface StatisticValue {
  start: number;
  end: number;
  mean?: number;
  min?: number;
  max?: number;
  state?: number;
  sum?: number;
}

/** A single logbook event row (subset of `logbook/get_events` output we use). */
export interface LogbookEntry {
  /** Unix timestamp (seconds) when the event happened. */
  when: number;
  /** Entity the event is about (e.g. `automation.morning_routine`). */
  entity_id?: string;
  /** Friendly name of the entity the event is about. */
  name?: string;
  /** Human-readable description, e.g. "has been triggered by …". */
  message?: string;
  /** Resulting state, when the event is a state change. */
  state?: string;
  context_id?: string;
}

/**
 * An automation's stored config, as returned by the REST config endpoint.
 * HA renamed the singular keys to plurals in 2024.10 — both are tolerated by
 * the consumers, so they stay optional here.
 */
export interface AutomationConfig {
  alias?: string;
  mode?: string;
  trigger?: unknown;
  triggers?: unknown;
  condition?: unknown;
  conditions?: unknown;
  action?: unknown;
  actions?: unknown;
  [key: string]: unknown;
}

/** Result of the `auth/current_user` WS command — the connecting account's identity + role. */
export interface HassUser {
  id: string;
  name: string;
  is_owner: boolean;
  is_admin: boolean;
}

export interface CallServiceParams {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
}
