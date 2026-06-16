import {
  createConnection,
  subscribeEntities,
  createLongLivedTokenAuth,
  Connection,
  HassEntities as HAEntities,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from 'home-assistant-js-websocket';
import type { HassConfig, CallServiceParams, EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, FloorRegistryEntry, LabelRegistryEntry, HistoryPoint, ConfigEntry, IntegrationManifest, LogbookEntry, AutomationConfig } from './types';

let connection: Connection | null = null;
let entitySubscription: (() => void) | null = null;
// Captured on connect so REST endpoints (no WS equivalent) can authenticate.
let restUrl: string | null = null;
let restToken: string | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connect(config: HassConfig): Promise<Connection> {
  if (connection) {
    return connection;
  }

  const auth = createLongLivedTokenAuth(config.url, config.token);

  try {
    connection = await createConnection({ auth });
    restUrl = config.url.replace(/\/$/, '');
    restToken = config.token;
    return connection;
  } catch (error) {
    if (error === ERR_CANNOT_CONNECT) {
      throw new Error('Unable to connect to Home Assistant. Check your URL.');
    }
    if (error === ERR_INVALID_AUTH) {
      throw new Error('Invalid authentication. Check your access token.');
    }
    throw error;
  }
}

export function disconnect(): void {
  if (entitySubscription) {
    entitySubscription();
    entitySubscription = null;
  }
  if (connection) {
    connection.close();
    connection = null;
  }
  restUrl = null;
  restToken = null;
}

export function getConnection(): Connection | null {
  return connection;
}

/** The running Home Assistant version, reported during the auth handshake. Null until connected. */
export function getHaVersion(): string | null {
  return connection?.haVersion ?? null;
}

export async function waitForConnection(
  timeoutMs = 1500,
  pollIntervalMs = 50
): Promise<Connection | null> {
  if (connection) {
    return connection;
  }

  const deadline = Date.now() + timeoutMs;

  while (!connection && Date.now() < deadline) {
    await delay(pollIntervalMs);
  }

  return connection;
}

export function subscribeToEntities(
  callback: (entities: HAEntities) => void
): () => void {
  if (!connection) {
    throw new Error('Not connected to Home Assistant');
  }

  if (entitySubscription) {
    entitySubscription();
  }

  entitySubscription = subscribeEntities(connection, callback);
  return entitySubscription;
}

export async function callService(params: CallServiceParams): Promise<void> {
  if (!connection) {
    throw new Error('Not connected to Home Assistant');
  }

  const { domain, service, serviceData, target } = params;

  await connection.sendMessagePromise({
    type: 'call_service',
    domain,
    service,
    service_data: serviceData,
    target,
  });
}

export async function toggleEntity(entityId: string, currentState?: string): Promise<void> {
  const [domain] = entityId.split('.');

  const toggleDomains = ['light', 'switch', 'fan', 'input_boolean', 'media_player', 'automation', 'script'];

  if (toggleDomains.includes(domain)) {
    await callService({ domain, service: 'toggle', target: { entity_id: entityId } });
  } else if (domain === 'cover') {
    await callService({ domain: 'cover', service: 'toggle', target: { entity_id: entityId } });
  } else if (domain === 'lock') {
    const service = currentState === 'locked' ? 'unlock' : 'lock';
    await callService({ domain: 'lock', service, target: { entity_id: entityId } });
  }
}

export interface HaPanel {
  component_name: string;
  config: Record<string, unknown> | null;
  config_panel_domain?: string;
  icon: string | null;
  title: string | null;
  url_path: string;
}

export interface HaDashboard {
  id: string;
  title: string;
  show_in_sidebar: boolean;
  require_admin: boolean;
  icon?: string;
  url_path: string;
  mode: string;
}

export async function getEntityRegistry(): Promise<EntityRegistryEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<EntityRegistryEntry[]>({ type: 'config/entity_registry/list' }) ?? [];
  } catch {
    return [];
  }
}

export async function getDeviceRegistry(): Promise<DeviceRegistryEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<DeviceRegistryEntry[]>({ type: 'config/device_registry/list' }) ?? [];
  } catch {
    return [];
  }
}

export async function getConfigEntries(): Promise<ConfigEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<ConfigEntry[]>({ type: 'config_entries/get' }) ?? [];
  } catch {
    return [];
  }
}

export async function getIntegrationManifests(): Promise<IntegrationManifest[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<IntegrationManifest[]>({ type: 'manifest/list' }) ?? [];
  } catch {
    return [];
  }
}

export async function getAreaRegistry(): Promise<AreaRegistryEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<AreaRegistryEntry[]>({ type: 'config/area_registry/list' }) ?? [];
  } catch {
    return [];
  }
}

export async function getFloorRegistry(): Promise<FloorRegistryEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<FloorRegistryEntry[]>({ type: 'config/floor_registry/list' }) ?? [];
  } catch {
    return [];
  }
}

export async function getLabelRegistry(): Promise<LabelRegistryEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<LabelRegistryEntry[]>({ type: 'config/label_registry/list' }) ?? [];
  } catch {
    return [];
  }
}

// ── Registry writes ─────────────────────────────────────────────────────────
// All require a live connection (callers guard on demo/connected upstream).
// `undefined` fields are dropped so we never overwrite with null unintentionally;
// pass an explicit null to clear an optional field (e.g. unassign a floor).

function requireConnection(): Connection {
  if (!connection) throw new Error('Not connected to Home Assistant');
  return connection;
}

/** Drop keys whose value is `undefined` (but keep explicit `null`). */
function pruneUndefined(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export interface AreaWriteFields {
  name?: string;
  floor_id?: string | null;
  icon?: string | null;
  picture?: string | null;
  aliases?: string[];
  labels?: string[];
}

export async function createArea(fields: AreaWriteFields): Promise<AreaRegistryEntry> {
  return requireConnection().sendMessagePromise<AreaRegistryEntry>({
    type: 'config/area_registry/create',
    ...pruneUndefined(fields),
  });
}

export async function updateArea(areaId: string, fields: AreaWriteFields): Promise<AreaRegistryEntry> {
  return requireConnection().sendMessagePromise<AreaRegistryEntry>({
    type: 'config/area_registry/update',
    area_id: areaId,
    ...pruneUndefined(fields),
  });
}

export async function deleteArea(areaId: string): Promise<void> {
  await requireConnection().sendMessagePromise({ type: 'config/area_registry/delete', area_id: areaId });
}

export interface FloorWriteFields {
  name?: string;
  level?: number | null;
  icon?: string | null;
  aliases?: string[];
}

export async function createFloor(fields: FloorWriteFields): Promise<FloorRegistryEntry> {
  return requireConnection().sendMessagePromise<FloorRegistryEntry>({
    type: 'config/floor_registry/create',
    ...pruneUndefined(fields),
  });
}

export async function updateFloor(floorId: string, fields: FloorWriteFields): Promise<FloorRegistryEntry> {
  return requireConnection().sendMessagePromise<FloorRegistryEntry>({
    type: 'config/floor_registry/update',
    floor_id: floorId,
    ...pruneUndefined(fields),
  });
}

export async function deleteFloor(floorId: string): Promise<void> {
  await requireConnection().sendMessagePromise({ type: 'config/floor_registry/delete', floor_id: floorId });
}

export interface LabelWriteFields {
  name?: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
}

export async function createLabel(fields: LabelWriteFields): Promise<LabelRegistryEntry> {
  return requireConnection().sendMessagePromise<LabelRegistryEntry>({
    type: 'config/label_registry/create',
    ...pruneUndefined(fields),
  });
}

export async function updateLabel(labelId: string, fields: LabelWriteFields): Promise<LabelRegistryEntry> {
  return requireConnection().sendMessagePromise<LabelRegistryEntry>({
    type: 'config/label_registry/update',
    label_id: labelId,
    ...pruneUndefined(fields),
  });
}

export async function deleteLabel(labelId: string): Promise<void> {
  await requireConnection().sendMessagePromise({ type: 'config/label_registry/delete', label_id: labelId });
}

// History requests are made by every visible sparkline at once. On a real
// instance the home dashboard can mount dozens of cards simultaneously, and an
// unbounded burst of `history_during_period` calls (each returning a large
// payload) floods the socket and freezes the main thread while parsing. Cap the
// number in flight so the dashboard stays responsive.
const HISTORY_MAX_CONCURRENT = 6;
let historyActive = 0;
const historyQueue: Array<() => void> = [];

function acquireHistorySlot(): Promise<void> {
  if (historyActive < HISTORY_MAX_CONCURRENT) {
    historyActive += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    historyQueue.push(() => {
      historyActive += 1;
      resolve();
    });
  });
}

function releaseHistorySlot(): void {
  historyActive -= 1;
  const next = historyQueue.shift();
  if (next) next();
}

export async function getEntityHistory(entityId: string, hoursBack = 24): Promise<HistoryPoint[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 3600 * 1000);
  await acquireHistorySlot();
  try {
    const result = await conn.sendMessagePromise<Record<string, HistoryPoint[]>>({
      type: 'history/history_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: [entityId],
      no_attributes: true,
      significant_changes_only: false,
    });
    return result?.[entityId] ?? [];
  } catch {
    return [];
  } finally {
    releaseHistorySlot();
  }
}

/**
 * Recent logbook events for one entity, newest last. Used to build an
 * automation's run history. Shares the history concurrency slot so a panel
 * opening mid-dashboard-load doesn't add an unbounded socket burst.
 */
export async function getLogbook(entityId: string | string[], hoursBack = 168): Promise<LogbookEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 3600 * 1000);
  await acquireHistorySlot();
  try {
    const result = await conn.sendMessagePromise<LogbookEntry[]>({
      type: 'logbook/get_events',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: Array.isArray(entityId) ? entityId : [entityId],
    });
    return result ?? [];
  } catch {
    return [];
  } finally {
    releaseHistorySlot();
  }
}

/**
 * An automation's stored config (triggers / conditions / actions). There is no
 * WS command for this, so it goes through the REST config endpoint using the
 * credentials captured on connect. Returns null when unavailable (YAML-only
 * automations have no numeric id, the token may lack admin rights, etc.) — the
 * caller falls back to a "flow unavailable" state.
 */
export async function getAutomationConfig(numericId: string): Promise<AutomationConfig | null> {
  if (!restUrl || !restToken) return null;
  try {
    const res = await fetch(`${restUrl}/api/config/automation/config/${numericId}`, {
      headers: { Authorization: `Bearer ${restToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as AutomationConfig;
  } catch {
    return null;
  }
}

export async function getPanels(): Promise<Record<string, HaPanel>> {
  const activeConnection = connection ?? await waitForConnection();

  if (!activeConnection) {
    throw new Error('Not connected to Home Assistant');
  }

  try {
    const result = await activeConnection.sendMessagePromise<Record<string, HaPanel>>({
      type: 'get_panels',
    });
    return result;
  } catch (err) {
    console.error('getPanels error:', err);
    throw err;
  }
}

export async function getDashboards(): Promise<HaDashboard[]> {
  const activeConnection = connection ?? await waitForConnection();

  if (!activeConnection) {
    throw new Error('Not connected to Home Assistant');
  }

  try {
    // Try the standard lovelace/dashboards endpoint
    const result = await activeConnection.sendMessagePromise<HaDashboard[]>({
      type: 'lovelace/dashboards',
    });
    return result;
  } catch (err) {
    console.error('getDashboards error details:', JSON.stringify(err));
    // Return empty array if dashboards API fails (might not be available)
    return [];
  }
}
