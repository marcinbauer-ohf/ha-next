'use client';

import { useState, useCallback } from 'react';

export type EntitySection = 'primary' | 'secondary' | 'hidden' | 'disabled';

export interface EntitySlot {
  entity_id: string;
  /** Only used for secondary entities on the dashboard card */
  size: 'sm' | 'lg';
  section: EntitySection;
  /** Inline history sparkline on the secondary row (numeric sensors only). Default on; false hides it. */
  chart?: boolean;
}

export interface DeviceCardConfig {
  slots: EntitySlot[];
}

const STORAGE_KEY = 'ha_device_card_configs';

function load(): Record<string, DeviceCardConfig> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function persist(configs: Record<string, DeviceCardConfig>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function useDeviceCardConfig() {
  const [configs, setConfigs] = useState<Record<string, DeviceCardConfig>>(load);

  const getConfig = useCallback(
    (deviceId: string): DeviceCardConfig => {
      const stored = configs[deviceId];
      if (!stored) return { slots: [] };
      // Migrate from old format (entities / extraEntities → slots)
      if (!stored.slots) {
        const old = stored as unknown as { entities?: { entity_id: string; size: 'sm' | 'lg' }[] };
        if (old.entities?.length) {
          return {
            slots: old.entities.map((e, i) => ({
              entity_id: e.entity_id,
              size: e.size,
              section: i === 0 ? 'primary' : 'secondary',
            })),
          };
        }
        return { slots: [] };
      }
      return stored;
    },
    [configs],
  );

  const setConfig = useCallback((deviceId: string, config: DeviceCardConfig) => {
    setConfigs((prev) => {
      const next = { ...prev, [deviceId]: config };
      persist(next);
      return next;
    });
  }, []);

  return { getConfig, setConfig };
}
