'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  mdiCast,
  mdiHomeAssistant,
  mdiLightbulbGroup,
  mdiPuzzle,
  mdiServerNetwork,
  mdiSpeaker,
  mdiWeatherPartlyCloudy,
  mdiZigbee,
} from '@mdi/js';
import { useHomeAssistant, useHomeAssistantEntities, useHomeAssistantSelector, peekEntities } from './useHomeAssistant';
import { DEMO_AREAS, DEMO_FLOORS, demoAreaForEntity } from '@/lib/homeassistant/demoEntities';
import type { EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, FloorRegistryEntry, ConfigEntry, IntegrationManifest } from '@/lib/homeassistant/types';
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
  // Entity-level area overrides (config/entity_registry/list includes area_id).
  // Used to give a device an area when the device itself has none — common when
  // the user assigns the area on the entity rather than the device.
  const entityArea = new Map<string, string>();
  for (const e of entityReg) {
    if (e.device_id && !e.disabled_by && !e.hidden_by) {
      entityToDevice.set(e.entity_id, e.device_id);
    }
    if (e.area_id) entityArea.set(e.entity_id, e.area_id);
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
      // Prefer the device's own area; otherwise inherit from an entity that has
      // one (primary entity first), so devices placed only at the entity level
      // still show their area on the dashboard.
      const areaId = d.area_id
        ?? sorted.map((e) => entityArea.get(e.entity_id)).find(Boolean)
        ?? undefined;
      return {
        id: d.id,
        name: d.name_by_user ?? d.name ?? friendlyName(sorted[0]) ?? d.id,
        manufacturer: d.manufacturer ?? undefined,
        model: d.model ?? undefined,
        areaId,
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

// withDemoAreas: entity-built devices only carry demo area ids when running on
// demo data (not connected) — a live fallback must not inherit the sample layout.
function buildFromEntities(allEntities: HassEntities, withDemoAreas: boolean): HassDevice[] {
  const devices: HassDevice[] = [];
  const sensors: HassEntity[] = [];

  for (const entity of Object.values(allEntities)) {
    const domain = entity.entity_id.split('.')[0];
    // Diagnostics stay out of the dashboard: standalone battery sensors feed
    // the Home Center, and demo data can opt entities out explicitly.
    if (entity.attributes.dashboard_hidden === true) continue;
    if (domain === 'sensor' && entity.attributes.device_class === 'battery') continue;
    if (SINGLE_DOMAINS.has(domain)) {
      devices.push({
        id: entity.entity_id,
        name: friendlyName(entity),
        areaId: withDemoAreas ? demoAreaForEntity(entity.entity_id) : undefined,
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
      areaId: withDemoAreas ? sorted.map((e) => demoAreaForEntity(e.entity_id)).find(Boolean) : undefined,
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

// ── Shared device-build cache ───────────────────────────────────────────────
// Building the device tree is O(entities + devices·log) and several components
// mount useDevices()/useDeviceStructure() at once (e.g. the settings page mounts
// two). Without sharing, each rebuilds independently on every entity-store tick.
// Cache the last build keyed on input identity so concurrent consumers in the
// same tick share a single build (and a single array reference).

let devicesCache: {
  connected: boolean;
  entityReg: EntityRegistryEntry[];
  deviceReg: DeviceRegistryEntry[];
  allEntities: HassEntities;
  devices: HassDevice[];
} | null = null;

function buildDevicesCached(
  connected: boolean,
  entityReg: EntityRegistryEntry[],
  deviceReg: DeviceRegistryEntry[],
  allEntities: HassEntities,
): HassDevice[] {
  if (
    devicesCache &&
    devicesCache.connected === connected &&
    devicesCache.entityReg === entityReg &&
    devicesCache.deviceReg === deviceReg &&
    devicesCache.allEntities === allEntities
  ) {
    return devicesCache.devices;
  }

  const devices = connected && entityReg.length > 0 && deviceReg.length > 0
    ? buildFromRegistry(entityReg, deviceReg, allEntities)
    : buildFromEntities(allEntities, !connected);

  devicesCache = { connected, entityReg, deviceReg, allEntities, devices };
  return devices;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDevices(): { devices: HassDevice[]; areas: Map<string, string>; areaReg: AreaRegistryEntry[]; floors: FloorRegistryEntry[]; loading: boolean } {
  const { connected, demoMode, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry } = useHomeAssistant();
  const allEntities = useHomeAssistantEntities();

  const { entityReg, deviceReg, areaReg: liveAreaReg, floorReg, loading: regLoading } = useSyncExternalStore(
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

  // Demo mode has no live registries — substitute the sample home's layout so
  // area grouping, floor tabs, and room pages work on demo data.
  const useDemoLayout = demoMode && !connected;
  const areaReg = useDemoLayout ? DEMO_AREAS : liveAreaReg;
  const floorRegEffective = useDemoLayout ? DEMO_FLOORS : floorReg;

  const devices = useMemo<HassDevice[]>(
    () => buildDevicesCached(connected, entityReg, deviceReg, allEntities),
    [connected, entityReg, deviceReg, allEntities],
  );

  // area_id → area_name, ordered as returned by HA
  const areas = useMemo<Map<string, string>>(
    () => new Map(areaReg.map((a) => [a.area_id, a.name])),
    [areaReg],
  );

  // floors sorted by level
  const floors = useMemo<FloorRegistryEntry[]>(
    () => [...floorRegEffective].sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    [floorRegEffective],
  );

  return {
    devices,
    areas,
    areaReg,
    floors,
    loading: connected && regLoading,
  };
}

// ── Integrations (settings master-detail example) ───────────────────────────
// An "integration" in HA is a config-entry platform (hue, mqtt, zha…). The entity
// registry carries `platform` per entity, so we derive the integration list from
// real data by grouping the registry — no extra WebSocket calls. When we are NOT
// on a live instance (demo mode / no registry) we fall back to a curated demo
// list rather than mixing fabricated rows into a real home.

export interface IntegrationDevice {
  id: string;
  name: string;
  model?: string;
}

export type IntegrationStatus = 'active' | 'disabled' | 'ignored';

/** Metadata flags surfaced as badge icons (mirrors HA's Integrations page). */
export interface IntegrationFlags {
  /** Not shipped with HA core (custom_components / HACS). */
  custom: boolean;
  /** iot_class cloud_* — relies on an internet/cloud connection. */
  cloud: boolean;
  /** iot_class local_* — talks to the device over the local network. */
  local: boolean;
  /** A config entry is in an error/retry state and needs attention. */
  hasError: boolean;
}

export interface IntegrationSummary {
  /** platform key, e.g. "hue" — stable drill-down id */
  id: string;
  name: string;
  icon: string;
  /** Coarse category used for grouping (Lighting, Media, Network, …). */
  category: string;
  status: IntegrationStatus;
  flags: IntegrationFlags;
  deviceCount: number;
  entityCount: number;
  /** "Demo" rows are synthetic; real rows are derived from the live registry. */
  demo: boolean;
  devices: IntegrationDevice[];
}

// Config-entry states that mean "needs attention".
const ERROR_ENTRY_STATES = new Set(['setup_error', 'setup_retry', 'migration_error', 'failed_unload']);

// Known platforms → friendlier label, thematic icon, and grouping category.
// Anything not listed falls back to a title-cased platform key, the generic
// puzzle-piece icon, and the "Other" category.
const INTEGRATION_META: Record<string, { label: string; icon: string; category: string }> = {
  hue: { label: 'Philips Hue', icon: mdiLightbulbGroup, category: 'Lighting' },
  lifx: { label: 'LIFX', icon: mdiLightbulbGroup, category: 'Lighting' },
  mqtt: { label: 'MQTT', icon: mdiServerNetwork, category: 'Network' },
  cast: { label: 'Google Cast', icon: mdiCast, category: 'Media' },
  sonos: { label: 'Sonos', icon: mdiSpeaker, category: 'Media' },
  zha: { label: 'Zigbee Home Automation', icon: mdiZigbee, category: 'Network' },
  zwave_js: { label: 'Z-Wave', icon: mdiServerNetwork, category: 'Network' },
  met: { label: 'Met.no', icon: mdiWeatherPartlyCloudy, category: 'Weather' },
  homeassistant: { label: 'Home Assistant Core', icon: mdiHomeAssistant, category: 'System' },
};

function integrationLabel(platform: string): string {
  return INTEGRATION_META[platform]?.label ?? toTitle(platform);
}

function integrationIcon(platform: string): string {
  return INTEGRATION_META[platform]?.icon ?? mdiPuzzle;
}

function integrationCategory(platform: string): string {
  return INTEGRATION_META[platform]?.category ?? 'Other';
}

const DEMO_INTEGRATIONS: IntegrationSummary[] = [
  {
    id: 'hue', name: 'Philips Hue', icon: mdiLightbulbGroup, category: 'Lighting', status: 'active', flags: { custom: false, cloud: false, local: true, hasError: false }, deviceCount: 8, entityCount: 14, demo: true,
    devices: [
      { id: 'hue-1', name: 'Living Room Ceiling', model: 'Hue White Ambiance' },
      { id: 'hue-2', name: 'Kitchen Strip', model: 'Hue Lightstrip Plus' },
      { id: 'hue-3', name: 'Bedroom Lamp', model: 'Hue Go' },
      { id: 'hue-4', name: 'Hallway Spot', model: 'Hue GU10' },
    ],
  },
  {
    id: 'lifx', name: 'LIFX', icon: mdiLightbulbGroup, category: 'Lighting', status: 'active', flags: { custom: false, cloud: false, local: true, hasError: false }, deviceCount: 3, entityCount: 5, demo: true,
    devices: [
      { id: 'lifx-1', name: 'Studio Beam', model: 'LIFX Beam' },
      { id: 'lifx-2', name: 'Desk Bulb', model: 'LIFX Mini' },
    ],
  },
  {
    id: 'mqtt', name: 'MQTT', icon: mdiServerNetwork, category: 'Network', status: 'active', flags: { custom: false, cloud: false, local: true, hasError: false }, deviceCount: 12, entityCount: 30, demo: true,
    devices: [
      { id: 'mqtt-1', name: 'Bridge', model: 'Zigbee2MQTT' },
      { id: 'mqtt-2', name: 'Front Door Sensor', model: 'Aqara MCCGQ11LM' },
      { id: 'mqtt-3', name: 'Garage Motion', model: 'Aqara RTCGQ11LM' },
    ],
  },
  {
    id: 'cast', name: 'Google Cast', icon: mdiCast, category: 'Media', status: 'active', flags: { custom: false, cloud: false, local: true, hasError: true }, deviceCount: 4, entityCount: 4, demo: true,
    devices: [
      { id: 'cast-1', name: 'Living Room TV', model: 'Chromecast' },
      { id: 'cast-2', name: 'Office Display', model: 'Nest Hub' },
    ],
  },
  {
    id: 'zha', name: 'Zigbee Home Automation', icon: mdiZigbee, category: 'Network', status: 'active', flags: { custom: false, cloud: false, local: true, hasError: false }, deviceCount: 9, entityCount: 22, demo: true,
    devices: [
      { id: 'zha-1', name: 'Coordinator', model: 'SkyConnect' },
      { id: 'zha-2', name: 'Patio Plug', model: 'Innr SP 220' },
    ],
  },
  {
    id: 'sonos', name: 'Sonos', icon: mdiSpeaker, category: 'Media', status: 'disabled', flags: { custom: false, cloud: false, local: true, hasError: false }, deviceCount: 5, entityCount: 10, demo: true,
    devices: [
      { id: 'sonos-1', name: 'Kitchen', model: 'Sonos One' },
      { id: 'sonos-2', name: 'Living Room', model: 'Sonos Arc' },
    ],
  },
  {
    id: 'met', name: 'Met.no', icon: mdiWeatherPartlyCloudy, category: 'Weather', status: 'ignored', flags: { custom: false, cloud: true, local: false, hasError: false }, deviceCount: 0, entityCount: 6, demo: true,
    devices: [],
  },
  {
    id: 'hacs', name: 'HACS', icon: mdiPuzzle, category: 'System', status: 'active', flags: { custom: true, cloud: true, local: false, hasError: false }, deviceCount: 1, entityCount: 4, demo: true,
    devices: [
      { id: 'hacs-1', name: 'HACS', model: 'Home Assistant Community Store' },
    ],
  },
];

function buildIntegrationsFromRegistry(
  entityReg: EntityRegistryEntry[],
  devices: HassDevice[],
  configEntries: ConfigEntry[],
  manifests: IntegrationManifest[],
): IntegrationSummary[] {
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const platformDeviceIds = new Map<string, Set<string>>();
  const platformEntityCount = new Map<string, number>();

  for (const e of entityReg) {
    if (e.disabled_by || e.hidden_by || !e.platform) continue;
    platformEntityCount.set(e.platform, (platformEntityCount.get(e.platform) ?? 0) + 1);
    if (e.device_id) {
      if (!platformDeviceIds.has(e.platform)) platformDeviceIds.set(e.platform, new Set());
      platformDeviceIds.get(e.platform)!.add(e.device_id);
    }
  }

  // Config entries are the source of truth for which integrations exist — they
  // include disabled and ignored ones, which have no (live) entities and would
  // otherwise be invisible. Group them by domain so one row represents a domain.
  const entriesByDomain = new Map<string, ConfigEntry[]>();
  for (const ce of configEntries) {
    if (!entriesByDomain.has(ce.domain)) entriesByDomain.set(ce.domain, []);
    entriesByDomain.get(ce.domain)!.push(ce);
  }

  // Manifests carry the badge flags (custom / cloud / local).
  const manifestByDomain = new Map(manifests.map((m) => [m.domain, m]));

  // Union: every domain that has a config entry OR live entities (covers
  // YAML-only integrations like `sun`/`met` that have no config entry).
  const domains = new Set<string>([...entriesByDomain.keys(), ...platformEntityCount.keys()]);

  const statusRank = { active: 0, disabled: 1, ignored: 2 };

  return [...domains]
    .map((domain) => {
      const entries = entriesByDomain.get(domain) ?? [];
      const hasActive = entries.some((e) => e.source !== 'ignore' && !e.disabled_by);
      const hasDisabled = entries.some((e) => Boolean(e.disabled_by));
      const hasIgnored = entries.some((e) => e.source === 'ignore');
      // No config entry but has entities ⇒ active (YAML integration).
      const status: IntegrationStatus =
        entries.length === 0 || hasActive ? 'active' : hasDisabled ? 'disabled' : hasIgnored ? 'ignored' : 'active';

      const manifest = manifestByDomain.get(domain);
      const iot = manifest?.iot_class ?? '';
      const flags: IntegrationFlags = {
        // is_built_in === false marks a custom integration; absent manifest ⇒ assume built-in.
        custom: manifest ? manifest.is_built_in === false : false,
        cloud: iot.startsWith('cloud_'),
        local: iot.startsWith('local_'),
        hasError: entries.some((e) => ERROR_ENTRY_STATES.has(e.state)),
      };

      const deviceIds = platformDeviceIds.get(domain) ?? new Set<string>();
      const integDevices: IntegrationDevice[] = [...deviceIds]
        .map((id) => deviceById.get(id))
        .filter((d): d is HassDevice => Boolean(d))
        .map((d) => ({ id: d.id, name: d.name, model: d.model }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: domain,
        name: manifest?.name ?? integrationLabel(domain),
        icon: integrationIcon(domain),
        category: integrationCategory(domain),
        status,
        flags,
        deviceCount: deviceIds.size,
        entityCount: platformEntityCount.get(domain) ?? 0,
        demo: false,
        devices: integDevices,
      };
    })
    // Active first, then by size — so disabled/ignored sink to the bottom of the
    // flat list but are still grouped correctly when grouping by status.
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        b.deviceCount - a.deviceCount ||
        b.entityCount - a.entityCount ||
        a.name.localeCompare(b.name),
    );
}

// ── Shared integrations-data store (config entries + manifests) ─────────────
// Fetched lazily (only useIntegrations needs it) and shared so remounts/repeat
// navigations don't refire the WebSocket calls. Both lists are fetched together
// since the Integrations view needs them in tandem.

interface IntegrationsData {
  configEntries: ConfigEntry[];
  manifests: IntegrationManifest[];
}

const EMPTY_INTEGRATIONS_DATA: IntegrationsData = { configEntries: [], manifests: [] };
let integrationsDataStore: IntegrationsData = EMPTY_INTEGRATIONS_DATA;
let integrationsDataLoaded = false;
let integrationsDataInFlight: Promise<void> | null = null;
const integrationsDataListeners = new Set<() => void>();

function subscribeToIntegrationsData(listener: () => void): () => void {
  integrationsDataListeners.add(listener);
  return () => { integrationsDataListeners.delete(listener); };
}
function getIntegrationsDataSnapshot(): IntegrationsData { return integrationsDataStore; }
function getServerIntegrationsDataSnapshot(): IntegrationsData { return EMPTY_INTEGRATIONS_DATA; }

function loadIntegrationsData(
  getConfigEntries: () => Promise<ConfigEntry[]>,
  getManifests: () => Promise<IntegrationManifest[]>,
): Promise<void> {
  if (integrationsDataInFlight) return integrationsDataInFlight;
  if (integrationsDataLoaded) return Promise.resolve();
  integrationsDataInFlight = Promise.all([getConfigEntries(), getManifests()])
    .then(([configEntries, manifests]) => {
      integrationsDataStore = { configEntries, manifests };
      integrationsDataLoaded = true;
      integrationsDataListeners.forEach((l) => l());
    })
    .catch(() => {})
    .finally(() => { integrationsDataInFlight = null; });
  return integrationsDataInFlight;
}

function resetIntegrationsData(): void {
  integrationsDataInFlight = null;
  if (integrationsDataLoaded || integrationsDataStore !== EMPTY_INTEGRATIONS_DATA) {
    integrationsDataStore = EMPTY_INTEGRATIONS_DATA;
    integrationsDataLoaded = false;
    integrationsDataListeners.forEach((l) => l());
  }
}

export function useIntegrations(): { integrations: IntegrationSummary[]; loading: boolean } {
  const { connected, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry, getConfigEntries, getIntegrationManifests } = useHomeAssistant();

  const { entityReg, deviceReg, loading: regLoading } = useSyncExternalStore(
    subscribeToRegistry,
    getRegistrySnapshot,
    getServerRegistrySnapshot,
  );
  const { configEntries, manifests } = useSyncExternalStore(
    subscribeToIntegrationsData,
    getIntegrationsDataSnapshot,
    getServerIntegrationsDataSnapshot,
  );

  // Structure-only: re-derive when the entity set changes, not on state ticks.
  const entityCount = useHomeAssistantSelector((e) => Object.keys(e).length);

  useEffect(() => {
    if (!connected) {
      resetRegistry();
      resetIntegrationsData();
      return;
    }
    loadRegistry({ getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry });
    loadIntegrationsData(getConfigEntries, getIntegrationManifests);
  }, [connected, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry, getConfigEntries, getIntegrationManifests]);

  const integrations = useMemo<IntegrationSummary[]>(() => {
    const live = connected && (entityReg.length > 0 || configEntries.length > 0);
    if (!live) return DEMO_INTEGRATIONS;
    const devices = buildDevicesCached(connected, entityReg, deviceReg, peekEntities());
    return buildIntegrationsFromRegistry(entityReg, devices, configEntries, manifests);
    // peekEntities() is read non-reactively; entityCount gates re-derivation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, entityReg, deviceReg, configEntries, manifests, entityCount]);

  return { integrations, loading: connected && regLoading };
}

// ── Structure-only hook ─────────────────────────────────────────────────────
// Same shape as useDevices(), but does NOT re-render on entity STATE ticks — it
// only re-derives when the registry or the set of entity keys changes. Use this
// from views that need device structure/membership (counts, config callbacks)
// but never display live entity state — e.g. the settings page. Subscribing
// those large components to the entity store made them re-render ~6×/sec under a
// live HA feed, freezing navigation. The entity count is a cheap signal that
// changes only when entities appear/disappear, not when a value updates.
export function useDeviceStructure(): { devices: HassDevice[]; areas: Map<string, string>; areaReg: AreaRegistryEntry[]; floors: FloorRegistryEntry[]; loading: boolean } {
  const { connected, demoMode, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry } = useHomeAssistant();

  const { entityReg, deviceReg, areaReg: liveAreaReg, floorReg, loading: regLoading } = useSyncExternalStore(
    subscribeToRegistry,
    getRegistrySnapshot,
    getServerRegistrySnapshot,
  );

  const useDemoLayout = demoMode && !connected;
  const areaReg = useDemoLayout ? DEMO_AREAS : liveAreaReg;
  const floorRegEffective = useDemoLayout ? DEMO_FLOORS : floorReg;

  // Cheap structural signal — re-derive devices only when the entity set changes.
  const entityCount = useHomeAssistantSelector((e) => Object.keys(e).length);

  useEffect(() => {
    if (!connected) {
      resetRegistry();
      return;
    }
    loadRegistry({ getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry });
  }, [connected, getEntityRegistry, getDeviceRegistry, getAreaRegistry, getFloorRegistry]);

  const devices = useMemo<HassDevice[]>(
    () => buildDevicesCached(connected, entityReg, deviceReg, peekEntities()),
    // peekEntities() is read non-reactively; entityCount gates re-derivation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected, entityReg, deviceReg, entityCount],
  );

  const areas = useMemo<Map<string, string>>(
    () => new Map(areaReg.map((a) => [a.area_id, a.name])),
    [areaReg],
  );

  const floors = useMemo<FloorRegistryEntry[]>(
    () => [...floorRegEffective].sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    [floorRegEffective],
  );

  return {
    devices,
    areas,
    areaReg,
    floors,
    loading: connected && regLoading,
  };
}
