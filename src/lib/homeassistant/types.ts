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
