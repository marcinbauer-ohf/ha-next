import {
  createConnection,
  subscribeEntities,
  createLongLivedTokenAuth,
  Connection,
  HassEntities as HAEntities,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from 'home-assistant-js-websocket';
import type { HassConfig, HaCoreConfig, CallServiceParams, EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, FloorRegistryEntry, LabelRegistryEntry, HistoryPoint, StatisticValue, ConfigEntry, IntegrationManifest, LogbookEntry, AutomationConfig, HassUser } from './types';

let connection: Connection | null = null;
let entitySubscription: (() => void) | null = null;
// Captured on connect so REST endpoints (no WS equivalent) can authenticate.
let restUrl: string | null = null;
let restToken: string | null = null;
let currentUser: HassUser | null = null;

// ── Socket liveness ───────────────────────────────────────────────────────────
// home-assistant-js-websocket reconnects on its own, but React never learns the
// socket died — the provider's `connected` flag only reflects the initial
// connect. This store bridges the Connection's ready/disconnected events to
// subscribers so overlays (e.g. the "system updating" screen) can react to a
// live instance going away mid-session (OS/Supervisor/Core restart) and coming
// back. `alive` is the WS transport state, not "have we ever connected".
type ConnectionStatusListener = (alive: boolean) => void;
const connectionStatusListeners = new Set<ConnectionStatusListener>();
let socketAlive = false;

function setSocketAlive(alive: boolean): void {
  if (socketAlive === alive) return;
  socketAlive = alive;
  connectionStatusListeners.forEach((listener) => listener(alive));
}

export function subscribeToConnectionStatus(listener: ConnectionStatusListener): () => void {
  connectionStatusListeners.add(listener);
  return () => {
    connectionStatusListeners.delete(listener);
  };
}

export function isSocketAlive(): boolean {
  return socketAlive;
}

// ── Restart pending ───────────────────────────────────────────────────────────
// HA fires a `homeassistant_stop` bus event when it is shutting down or
// restarting (including the `homeassistant.restart` service and Settings →
// System → Restart). Unlike a bare socket drop, this is an explicit signal that
// the instance is going away on purpose — so the "restarting" overlay can take
// over even when no OS/Supervisor/Core update preceded it, without firing on
// ordinary network blips. Cleared when the socket comes back `ready`.
type RestartPendingListener = (pending: boolean) => void;
const restartPendingListeners = new Set<RestartPendingListener>();
let restartPending = false;

function setRestartPending(pending: boolean): void {
  if (restartPending === pending) return;
  restartPending = pending;
  restartPendingListeners.forEach((listener) => listener(pending));
}

export function subscribeToRestartPending(listener: RestartPendingListener): () => void {
  restartPendingListeners.add(listener);
  return () => {
    restartPendingListeners.delete(listener);
  };
}

export function isRestartPending(): boolean {
  return restartPending;
}

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
    setSocketAlive(true);
    // The Connection object persists across the library's internal reconnects,
    // so listeners attached once here cover every socket drop/revive.
    connection.addEventListener('ready', () => {
      setSocketAlive(true);
      // Back online → whatever restart was pending has completed.
      setRestartPending(false);
    });
    connection.addEventListener('disconnected', () => setSocketAlive(false));
    // Explicit restart/shutdown signal from the HA event bus. Fire-and-forget:
    // the sub rides the persistent Connection across the library's reconnects.
    void connection.subscribeEvents(() => setRestartPending(true), 'homeassistant_stop');
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
  currentUser = null;
  setSocketAlive(false);
  setRestartPending(false);
}

export function getConnection(): Connection | null {
  return connection;
}

/** Base HTTP URL of the connected instance (for REST-served assets like TTS audio). */
export function getRestUrl(): string | null {
  return restUrl;
}

/** The connecting account's identity + role (is_admin/is_owner). Fetched once per connection and cached. */
export async function getCurrentUser(): Promise<HassUser | null> {
  if (currentUser) return currentUser;
  const conn = connection ?? await waitForConnection();
  if (!conn) return null;
  try {
    currentUser = await conn.sendMessagePromise<HassUser>({ type: 'auth/current_user' });
    return currentUser;
  } catch {
    return null;
  }
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

export async function getCoreConfig(): Promise<HaCoreConfig | null> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return null;
  try {
    return await conn.sendMessagePromise<HaCoreConfig>({ type: 'get_config' });
  } catch {
    return null;
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

/**
 * Persist a custom area order (HA 2025.12+). `areaIds` must contain every
 * area exactly once — the registry list order becomes this order.
 */
export async function reorderAreas(areaIds: string[]): Promise<void> {
  await requireConnection().sendMessagePromise({ type: 'config/area_registry/reorder', area_ids: areaIds });
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

/**
 * Persist a custom floor order (HA 2025.12+). `floorIds` must contain every
 * floor exactly once — the registry list order becomes this order.
 */
export async function reorderFloors(floorIds: string[]): Promise<void> {
  await requireConnection().sendMessagePromise({ type: 'config/floor_registry/reorder', floor_ids: floorIds });
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
 * Long-term statistics buckets for one entity. Unlike raw history (purged
 * after ~10 days by default), statistics are kept forever — the only reliable
 * source for 7d/30d spans. Empty when the entity has no state_class (the
 * recorder never aggregated it); callers fall back to raw history.
 */
export async function getStatistics(
  entityId: string,
  hoursBack: number,
  period: '5minute' | 'hour' | 'day',
): Promise<StatisticValue[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 3600 * 1000);
  await acquireHistorySlot();
  try {
    const result = await conn.sendMessagePromise<Record<string, StatisticValue[]>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: [entityId],
      period,
      types: ['mean', 'min', 'max', 'state', 'sum'],
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

// ── Automation traces ────────────────────────────────────────────────────────
// HA keeps the last few runs of every automation as "traces". `trace/list`
// returns run summaries; `trace/get` returns one run's full step data (each
// executed trigger/condition/action node keyed by its config path).

/** One run summary from `trace/list`. */
export interface TraceListItem {
  run_id: string;
  item_id: string;
  timestamp: { start: string; finish: string | null };
  /** finished | failed_conditions | failed_single | failed_max_runs | cancelled | error */
  script_execution: string;
  error?: string;
  last_step?: string;
  /** Plain-language description of what fired the run, e.g. "state of light.x". */
  trigger?: string;
}

/** One executed step within a trace (an entry in the `trace` path dict). */
export interface TraceStepEntry {
  path: string;
  timestamp: string;
  error?: string;
  result?: Record<string, unknown>;
  changed_variables?: Record<string, unknown>;
}

/** Full run detail from `trace/get`: the summary plus per-step data and the
 *  automation config as it was when the run happened. */
export interface AutomationTraceDetail extends TraceListItem {
  trace: Record<string, TraceStepEntry[]>;
  config: AutomationConfig;
}

export async function listAutomationTraces(numericId: string): Promise<TraceListItem[]> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return [];
  try {
    const result = await conn.sendMessagePromise<TraceListItem[]>({
      type: 'trace/list',
      domain: 'automation',
      item_id: numericId,
    });
    return result ?? [];
  } catch {
    return [];
  }
}

export async function getAutomationTrace(numericId: string, runId: string): Promise<AutomationTraceDetail | null> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return null;
  try {
    return await conn.sendMessagePromise<AutomationTraceDetail>({
      type: 'trace/get',
      domain: 'automation',
      item_id: numericId,
      run_id: runId,
    });
  } catch {
    return null;
  }
}

// ── Assist / conversation ────────────────────────────────────────────────────

export interface ConversationResult {
  response: {
    response_type: 'action_done' | 'query_answer' | 'error';
    speech?: { plain?: { speech?: string } };
  };
  conversation_id: string | null;
}

/**
 * Run a natural-language command through the default Assist pipeline. Pass the
 * previous conversation_id to keep multi-turn context. Returns null when not
 * connected (demo mode) — the caller shows its own fallback reply.
 */
export async function processConversation(
  text: string,
  conversationId?: string | null,
): Promise<ConversationResult | null> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return null;
  try {
    return await conn.sendMessagePromise<ConversationResult>({
      type: 'conversation/process',
      text,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    });
  } catch {
    return null;
  }
}

// ── Per-user frontend storage ────────────────────────────────────────────────
// HA's frontend user-data store (the same one the stock frontend uses for
// sidebar order etc.). Keys are namespaced by caller; values are arbitrary JSON.

export async function getUserData<T>(key: string): Promise<T | null> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return null;
  try {
    const result = await conn.sendMessagePromise<{ value: T | null }>({
      type: 'frontend/get_user_data',
      key,
    });
    return result?.value ?? null;
  } catch {
    return null;
  }
}

export async function setUserData(key: string, value: unknown): Promise<boolean> {
  const conn = connection ?? await waitForConnection();
  if (!conn) return false;
  try {
    await conn.sendMessagePromise({ type: 'frontend/set_user_data', key, value });
    return true;
  } catch {
    return false;
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
