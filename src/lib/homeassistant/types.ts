import type { HassEntity } from '@/types';

export type { HassEntity };

export interface HassConfig {
  url: string;
  token: string;
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
}

export interface DeviceRegistryEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  area_id: string | null;
  entry_type: string | null;
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
}

export interface FloorRegistryEntry {
  floor_id: string;
  name: string;
  level?: number | null;
  icon?: string | null;
}

export interface HistoryPoint {
  /** State value as string */
  s: string;
  /** Last changed Unix timestamp (seconds) */
  lc?: number;
  /** Last updated Unix timestamp (seconds) */
  lu?: number;
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
