import {
  createConnection,
  subscribeEntities,
  createLongLivedTokenAuth,
  Connection,
  HassEntities as HAEntities,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from 'home-assistant-js-websocket';
import type { HassConfig, CallServiceParams, EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, HistoryPoint } from './types';

let connection: Connection | null = null;
let entitySubscription: (() => void) | null = null;

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
}

export function getConnection(): Connection | null {
  return connection;
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

export async function getAreaRegistry(): Promise<AreaRegistryEntry[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    return await conn.sendMessagePromise<AreaRegistryEntry[]>({ type: 'config/area_registry/list' }) ?? [];
  } catch {
    return [];
  }
}

export async function getEntityHistory(entityId: string, hoursBack = 24): Promise<HistoryPoint[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 3600 * 1000);
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
