'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useHomeAssistant, useHomeAssistantEntities } from './useHomeAssistant';
import type { EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, FloorRegistryEntry } from '@/lib/homeassistant/types';
import type { HassEntities, HassEntity } from '@/types';

const DOMAIN_PRIORITY = [
  'climate', 'media_player', 'light', 'switch', 'fan',
  'cover', 'lock', 'vacuum', 'humidifier', 'alarm_control_panel',
  'number', 'select', 'binary_sensor', 'sensor', 'button', 'event',
];

function domainRank(entityId: string): number {
  const domain = entityId.split('.')[0];
  const rank = DOMAIN_PRIORITY.indexOf(domain);
  return rank === -1 ? 99 : rank;
}

function toTitle(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyName(e: HassEntity): string {
  return (e.attributes.friendly_name as string | undefined) ?? toTitle(e.entity_id.split('.')[1]);
}

export interface HassDevice {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  areaId?: string;
  entities: HassEntity[];
  primaryEntity?: HassEntity;
}

// ── Real-HA device builder (registry-based) ────────────────────────────────

function buildFromRegistry(
  entityReg: EntityRegistryEntry[],
  deviceReg: DeviceRegistryEntry[],
  allEntities: HassEntities,
): HassDevice[] {
  const entityToDevice = new Map<string, string>();
  for (const e of entityReg) {
    if (e.device_id && !e.disabled_by && !e.hidden_by) {
      entityToDevice.set(e.entity_id, e.device_id);
    }
  }

  const deviceEntities = new Map<string, HassEntity[]>();
  for (const entity of Object.values(allEntities)) {
    const deviceId = entityToDevice.get(entity.entity_id);
    if (!deviceId) continue;
    if (!deviceEntities.has(deviceId)) deviceEntities.set(deviceId, []);
    deviceEntities.get(deviceId)!.push(entity);
  }

  return deviceReg
    .filter((d) => deviceEntities.has(d.id) && d.entry_type !== 'service')
    .map((d) => {
      const sorted = (deviceEntities.get(d.id) ?? []).sort(
        (a, b) => domainRank(a.entity_id) - domainRank(b.entity_id),
      );
      return {
        id: d.id,
        name: d.name_by_user ?? d.name ?? friendlyName(sorted[0]) ?? d.id,
        manufacturer: d.manufacturer ?? undefined,
        model: d.model ?? undefined,
        areaId: d.area_id ?? undefined,
        entities: sorted,
        primaryEntity: sorted[0],
      };
    });
}

// ── Demo / fallback device builder (entity-ID-based grouping) ─────────────

// Single-entity domains: each entity is its own synthetic device
const SINGLE_DOMAINS = new Set([
  'light', 'switch', 'climate', 'media_player', 'fan',
  'lock', 'cover', 'vacuum', 'binary_sensor',
]);

function buildFromEntities(allEntities: HassEntities): HassDevice[] {
  const devices: HassDevice[] = [];
  const sensors: HassEntity[] = [];

  for (const entity of Object.values(allEntities)) {
    const domain = entity.entity_id.split('.')[0];
    if (SINGLE_DOMAINS.has(domain)) {
      devices.push({
        id: entity.entity_id,
        name: friendlyName(entity),
        entities: [entity],
        primaryEntity: entity,
      });
    } else if (domain === 'sensor') {
      sensors.push(entity);
    }
  }

  // Group sensors by prefix (strip last _word from entity_id base)
  const sensorMap = new Map<string, HassEntity[]>();
  for (const s of sensors) {
    const base = s.entity_id.replace(/^sensor\./, '');
    const parts = base.split('_');
    const key = parts.length > 1 ? parts.slice(0, -1).join('_') : base;
    if (!sensorMap.has(key)) sensorMap.set(key, []);
    sensorMap.get(key)!.push(s);
  }

  for (const [key, group] of sensorMap.entries()) {
    const sorted = group.sort((a, b) => {
      // Put temperature/humidity first for visual clarity
      const adc = a.attributes.device_class as string | undefined;
      const bdc = b.attributes.device_class as string | undefined;
      if (adc === 'temperature') return -1;
      if (bdc === 'temperature') return 1;
      return 0;
    });
    devices.push({
      id: 'sensor.' + key,
      name: group.length === 1 ? friendlyName(group[0]) : toTitle(key),
      entities: sorted,
      primaryEntity: sorted[0],
    });
  }

  return devices;
}

// ── Shared registry cache ───────────────────────────────────────────────────
// The 4 registries (entity/device/area/floor) change rarely but are large for a
// real HA instance. Multiple components mount useDevices at once (e.g. the
// settings page mounts it twice), so without sharing, every navigation refires
// 4+ WebSocket round-trips and reparses the full entity registry — which is what
// makes switching dashboards / opening settings hang. Fetch once per connection,
// cache at module level, and share via useSyncExternalStore.

interface RegistryStore {
  entityReg: EntityRegistryEntry[];
  deviceReg: DeviceRegistryEntry[];
  areaReg: AreaRegistryEntry[];
  floorReg: FloorRegistryEntry[];
  loading: boolean;
  loaded: boolean;
}

const EMPTY_REGISTRY: RegistryStore = {
  entityReg: [],
  deviceReg: [],
  areaReg: [],
  floorReg: [],
  loading: false,
  loaded: false,
};

let registryStore: RegistryStore = EMPTY_REGISTRY;
let registryInFlight: Promise<void> | null = null;
const registryListeners = new Set<() => void>();

function notifyRegistryListeners(): void {
  registryListeners.forEach((l) => l());
}

function setRegistryStore(next: RegistryStore): void {
  registryStore = next;
  notifyRegistryListeners();
}

function subscribeToRegistry(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => { registryListeners.delete(listener); };
}

function getRegistrySnapshot(): RegistryStore {
  return registryStore;
}

function getServerRegistrySnapshot(): RegistryStore {
  return EMPTY_REGISTRY;
}

interface RegistryGetters {
  getEntityRegistry: () => Promise<EntityRegistryEntry[]>;
  getDeviceRegistry: () => Promise<DeviceRegistryEntry[]>;
  getAreaRegistry: () => Promise<AreaRegistryEntry[]>;
  getFloorRegistry: () => Promise<FloorRegistryEntry[]>;
}

function loadRegistry(getters: RegistryGetters): Promise<void> {
  if (registryInFlight) return registryInFlight;
  if (registryStore.loaded) return Promise.resolve();

  setRegistryStore({ ...registryStore, loading: true });

  registryInFlight = (async () => {
    const [entityReg, deviceReg, areaReg, floorReg] = await Promise.all([
      getters.getEntityRegistry(),
      getters.getDeviceRegistry(),
      getters.getAreaRegistry(),
      getters.getFloorRegistry(),
    ]);
    setRegistryStore({ entityReg, deviceReg, areaReg, floorReg, loading: false, loaded: true });
  })()
    .catch(() => {
      setRegistryStore({ ...registryStore, loading: false });
    })
    .finally(() => {
      registryInFlight = null;
    });

  return registryInFlight;
}

function resetRegistry(): void {
  registryInFlight = null;
  if (registryStore !== EMPTY_REGISTRY) {
    setRegistryStore(EMPTY_REGISTRY);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDevices(): { devices: HassDevice[]; areas: Map<string, string>; areaReg: AreaRegistryEntry[]; floors: FloorRegistryEntry[]; loading: boolean } {
  const { connected, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry } = useHomeAssistant();
  const allEntities = useHomeAssistantEntities();

  const { entityReg, deviceReg, areaReg, floorReg, loading: regLoading } = useSyncExternalStore(
    subscribeToRegistry,
    getRegistrySnapshot,
    getServerRegistrySnapshot,
  );

  useEffect(() => {
    if (!connected) {
      resetRegistry();
      return;
    }
    loadRegistry({ getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry });
  }, [connected, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry]);

  const devices = useMemo<HassDevice[]>(() => {
    if (connected && entityReg.length > 0 && deviceReg.length > 0) {
      return buildFromRegistry(entityReg, deviceReg, allEntities);
    }
    return buildFromEntities(allEntities);
  }, [connected, entityReg, deviceReg, allEntities]);

  // area_id → area_name, ordered as returned by HA
  const areas = useMemo<Map<string, string>>(
    () => new Map(areaReg.map((a) => [a.area_id, a.name])),
    [areaReg],
  );

  // floors sorted by level
  const floors = useMemo<FloorRegistryEntry[]>(
    () => [...floorReg].sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    [floorReg],
  );

  return {
    devices,
    areas,
    areaReg,
    floors,
    loading: connected && regLoading,
  };
}
