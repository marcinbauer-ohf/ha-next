'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { HassEntities as HAEntities } from 'home-assistant-js-websocket';
import {
  connect,
  disconnect,
  subscribeToEntities,
  toggleEntity as toggleEntityAction,
  callService as callServiceAction,
  getEntityRegistry as getEntityRegistryAction,
  getDeviceRegistry as getDeviceRegistryAction,
  getAreaRegistry as getAreaRegistryAction,
  getFloorRegistry as getFloorRegistryAction,
  getLabelRegistry as getLabelRegistryAction,
  getConfigEntries as getConfigEntriesAction,
  getCoreConfig as getCoreConfigAction,
  updateCoreConfig as updateCoreConfigAction,
  setAnalyticsPreferences as setAnalyticsPreferencesAction,
  getIntegrationManifests as getIntegrationManifestsAction,
  getEntityHistory as getEntityHistoryAction,
  getStatistics as getStatisticsAction,
  getLogbook as getLogbookAction,
  getAutomationConfig as getAutomationConfigAction,
  createArea as createAreaAction,
  updateArea as updateAreaAction,
  deleteArea as deleteAreaAction,
  reorderAreas as reorderAreasAction,
  createFloor as createFloorAction,
  updateFloor as updateFloorAction,
  deleteFloor as deleteFloorAction,
  reorderFloors as reorderFloorsAction,
  createLabel as createLabelAction,
  updateLabel as updateLabelAction,
  deleteLabel as deleteLabelAction,
  getCurrentUser as getCurrentUserAction,
  subscribeToConnectionStatus,
  isSocketAlive,
  subscribeToRestartPending,
  isRestartPending,
} from '@/lib/homeassistant';
import type { CallServiceParams, EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, FloorRegistryEntry, LabelRegistryEntry, HistoryPoint, StatisticValue, ConfigEntry, IntegrationManifest, LogbookEntry, AutomationConfig, AreaWriteFields, FloorWriteFields, LabelWriteFields, HassUser, HaCoreConfig, CoreConfigWriteFields, AnalyticsPreferences } from '@/lib/homeassistant';
import type { HassEntities, HassEntity } from '@/types';
import { createDemoEntities } from '@/lib/homeassistant/demoEntities';
import { synthesizeHistory } from '@/lib/homeassistant/demoHistory';
import { emitHomePulse, PULSE_COLORS, type PulseColor, type PulseMeta } from '@/lib/homePulseBus';

const LS_URL_KEY = 'ha_url';
const LS_TOKEN_KEY = 'ha_token';
const LS_DEMO_MODE_KEY = 'ha_demo_mode';
const LS_PREVIEW_NON_ADMIN_KEY = 'ha_dev_preview_non_admin';
const EMPTY_ENTITIES: HassEntities = {};

// Demo mode has no real HA connection to ask, so it gets a synthetic admin
// user — keeps today's full-access demo experience unchanged.
const DEMO_USER: HassUser = { id: 'demo-user', name: 'Demo User', is_owner: true, is_admin: true };

type EntityStoreListener = () => void;

interface HomeAssistantContextValue {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  haUrl: string;
  configured: boolean;
  demoMode: boolean;
  hydrated: boolean;
  currentUser: HassUser | null;
  /** Single source of truth for gating admin-only UI — never true for a real non-admin user. */
  isAdmin: boolean;
  previewAsNonAdmin: boolean;
  setPreviewAsNonAdmin: (value: boolean) => void;
  toggleEntity: (entityId: string, currentState?: string) => Promise<void>;
  callService: (params: CallServiceParams) => Promise<void>;
  getEntityRegistry: () => Promise<EntityRegistryEntry[]>;
  getDeviceRegistry: () => Promise<DeviceRegistryEntry[]>;
  getAreaRegistry: () => Promise<AreaRegistryEntry[]>;
  getFloorRegistry: () => Promise<FloorRegistryEntry[]>;
  getLabelRegistry: () => Promise<LabelRegistryEntry[]>;
  createArea: (fields: AreaWriteFields) => Promise<AreaRegistryEntry>;
  updateArea: (areaId: string, fields: AreaWriteFields) => Promise<AreaRegistryEntry>;
  deleteArea: (areaId: string) => Promise<void>;
  reorderAreas: (areaIds: string[]) => Promise<void>;
  createFloor: (fields: FloorWriteFields) => Promise<FloorRegistryEntry>;
  updateFloor: (floorId: string, fields: FloorWriteFields) => Promise<FloorRegistryEntry>;
  deleteFloor: (floorId: string) => Promise<void>;
  reorderFloors: (floorIds: string[]) => Promise<void>;
  createLabel: (fields: LabelWriteFields) => Promise<LabelRegistryEntry>;
  updateLabel: (labelId: string, fields: LabelWriteFields) => Promise<LabelRegistryEntry>;
  deleteLabel: (labelId: string) => Promise<void>;
  getConfigEntries: () => Promise<ConfigEntry[]>;
  getCoreConfig: () => Promise<HaCoreConfig | null>;
  updateCoreConfig: (fields: CoreConfigWriteFields) => Promise<void>;
  setAnalyticsPreferences: (preferences: AnalyticsPreferences) => Promise<void>;
  getIntegrationManifests: () => Promise<IntegrationManifest[]>;
  getEntityHistory: (entityId: string, hoursBack?: number) => Promise<HistoryPoint[]>;
  getStatistics: (entityId: string, hoursBack: number, period: '5minute' | 'hour' | 'day') => Promise<StatisticValue[]>;
  getLogbook: (entityId: string | string[], hoursBack?: number) => Promise<LogbookEntry[]>;
  getAutomationConfig: (numericId: string) => Promise<AutomationConfig | null>;
  reconnect: () => Promise<void>;
  saveCredentials: (url: string, token: string) => Promise<void>;
  enableDemoMode: () => void;
  clearCredentials: () => void;
  setMockEntity: (entityId: string, entity: HassEntity | null) => void;
}

const HomeAssistantContext = createContext<HomeAssistantContextValue | null>(null);

let liveEntitiesStore: HassEntities = EMPTY_ENTITIES;
let mockEntitiesStore: HassEntities = EMPTY_ENTITIES;
let mergedEntitiesStore: HassEntities = EMPTY_ENTITIES;
const entityStoreListeners = new Set<EntityStoreListener>();

interface HomeAssistantProviderProps {
  children: ReactNode;
}

function hasEntities(entities: HassEntities): boolean {
  return Object.keys(entities).length > 0;
}

function subscribeToEntityStore(listener: EntityStoreListener): () => void {
  entityStoreListeners.add(listener);
  return () => {
    entityStoreListeners.delete(listener);
  };
}

function notifyEntityStoreListeners(): void {
  entityStoreListeners.forEach((listener) => listener());
}

function recomputeMergedEntities(): void {
  mergedEntitiesStore = hasEntities(mockEntitiesStore)
    ? { ...liveEntitiesStore, ...mockEntitiesStore }
    : liveEntitiesStore;
}

function setLiveEntities(nextEntities: HassEntities): void {
  liveEntitiesStore = nextEntities;
  recomputeMergedEntities();
  notifyEntityStoreListeners();
}

function setMockEntities(nextEntities: HassEntities): void {
  mockEntitiesStore = nextEntities;
  recomputeMergedEntities();
  notifyEntityStoreListeners();
}

/**
 * Stage extra entities in the mock store and return a remover. Used by the
 * benchmark rig (/dev/entity-matrix) to mount synthetic entities for the
 * duration of one page — services targeting them resolve locally (see
 * isMockEntity), so they behave the same whether or not HA is connected.
 */
export function injectMockEntities(entities: HassEntities): () => void {
  setMockEntities({ ...mockEntitiesStore, ...entities });
  return () => {
    const next = { ...mockEntitiesStore };
    for (const id of Object.keys(entities)) delete next[id];
    setMockEntities(next);
  };
}

/** Mock entities never reach the wire, connected or not. */
function isMockEntity(entityId: string): boolean {
  return entityId in mockEntitiesStore;
}

function updateMockEntityInStore(entityId: string, entity: HassEntity | null): void {
  if (entity === null) {
    if (!(entityId in mockEntitiesStore)) return;

    const nextMockEntities = { ...mockEntitiesStore };
    delete nextMockEntities[entityId];
    setMockEntities(nextMockEntities);
    return;
  }

  setMockEntities({
    ...mockEntitiesStore,
    [entityId]: entity,
  });
}

// ── Demo-mode interactivity ──────────────────────────────────────────────────
// The sample home must respond to taps — a silently inert demo reads as broken
// and is the fastest way to lose a first-time visitor's trust. Toggles and the
// common on/off services mutate the mock store locally; the entity-store
// listeners (cards, pulse wallpaper, activity views) react exactly as they
// would to a real state change.

/** state pairs per domain: [primary "on-ish" state, "off-ish" state] */
const DEMO_TOGGLE_STATES: Record<string, [string, string]> = {
  light: ['on', 'off'],
  switch: ['on', 'off'],
  fan: ['on', 'off'],
  input_boolean: ['on', 'off'],
  humidifier: ['on', 'off'],
  siren: ['on', 'off'],
  media_player: ['playing', 'paused'],
  lock: ['locked', 'unlocked'],
  cover: ['open', 'closed'],
};

function setDemoEntityState(entityId: string, nextState: string): void {
  const entity = mergedEntitiesStore[entityId];
  if (!entity || entity.state === nextState) return;
  const now = new Date().toISOString();
  updateMockEntityInStore(entityId, {
    ...entity,
    state: nextState,
    last_changed: now,
    last_updated: now,
  });
}

/** Merge attributes on a mock entity (setter services — brightness, setpoint…). */
function patchDemoEntityAttrs(entityId: string, attrs: Record<string, unknown>): void {
  const entity = mergedEntitiesStore[entityId];
  if (!entity) return;
  updateMockEntityInStore(entityId, {
    ...entity,
    attributes: { ...entity.attributes, ...attrs },
    last_updated: new Date().toISOString(),
  });
}

/**
 * Attribute writes for services that set a value rather than flip on/off —
 * without these a demo slider snaps back to its old position on release.
 */
function demoAttrPatch(
  domain: string,
  service: string,
  d: Record<string, unknown>,
): Record<string, unknown> | null {
  if (domain === 'light' && service === 'turn_on') {
    const p: Record<string, unknown> = {};
    if (d.brightness != null) p.brightness = Number(d.brightness);
    if (d.brightness_pct != null) p.brightness = Math.round(Number(d.brightness_pct) * 2.55);
    if (d.color_temp_kelvin != null) p.color_temp_kelvin = Number(d.color_temp_kelvin);
    if (d.rgb_color != null) p.rgb_color = d.rgb_color;
    return Object.keys(p).length ? p : null;
  }
  if (domain === 'climate' && service === 'set_temperature') return { temperature: Number(d.temperature) };
  if (domain === 'cover' && service === 'set_cover_position') return { current_position: Number(d.position) };
  if (domain === 'fan' && service === 'set_percentage') return { percentage: Number(d.percentage) };
  if (domain === 'media_player' && service === 'volume_set') return { volume_level: Number(d.volume_level) };
  if (domain === 'media_player' && service === 'volume_mute') return { is_volume_muted: !!d.is_volume_muted };
  return null;
}

function serviceTargetIds(params: CallServiceParams): string[] {
  const rawTarget =
    params.target?.entity_id ??
    (params.serviceData?.entity_id as string | string[] | undefined);
  return Array.isArray(rawTarget) ? rawTarget : rawTarget ? [rawTarget] : [];
}

function demoToggleEntity(entityId: string, currentState?: string): void {
  const entity = mergedEntitiesStore[entityId];
  if (!entity) return;
  const pair = DEMO_TOGGLE_STATES[entityId.split('.')[0]];
  if (!pair) return;
  const current = currentState ?? entity.state;
  setDemoEntityState(entityId, current === pair[0] ? pair[1] : pair[0]);
}

/** Best-effort local handling of the common demo services (on/off/toggle…). */
function demoCallService(params: CallServiceParams): void {
  const ids = serviceTargetIds(params);
  const data = (params.serviceData ?? {}) as Record<string, unknown>;
  for (const id of ids) {
    const domain = id.split('.')[0];
    const attrs = demoAttrPatch(domain, params.service, data);
    if (attrs) patchDemoEntityAttrs(id, attrs);
    switch (params.service) {
      case 'turn_on':
        setDemoEntityState(id, DEMO_TOGGLE_STATES[id.split('.')[0]]?.[0] ?? 'on');
        break;
      case 'turn_off':
        setDemoEntityState(id, DEMO_TOGGLE_STATES[id.split('.')[0]]?.[1] ?? 'off');
        break;
      case 'toggle':
        demoToggleEntity(id);
        break;
      case 'lock':
        setDemoEntityState(id, 'locked');
        break;
      case 'unlock':
        setDemoEntityState(id, 'unlocked');
        break;
      case 'open_cover':
        setDemoEntityState(id, 'open');
        break;
      case 'close_cover':
        setDemoEntityState(id, 'closed');
        break;
      case 'media_play':
        setDemoEntityState(id, 'playing');
        break;
      case 'media_pause':
        setDemoEntityState(id, 'paused');
        break;
      case 'media_play_pause':
        demoToggleEntity(id);
        break;
      case 'set_hvac_mode':
        if (typeof data.hvac_mode === 'string') setDemoEntityState(id, data.hvac_mode);
        break;
      case 'set_percentage':
        setDemoEntityState(id, Number(data.percentage) > 0 ? 'on' : 'off');
        break;
      // number / input_number / text / input_text write their value straight
      // into the state, so typing into the box moves the reading in demo too.
      case 'set_value':
        if (data.value != null) setDemoEntityState(id, String(data.value));
        break;
      case 'select_option':
        if (typeof data.option === 'string') setDemoEntityState(id, data.option);
        break;
      default:
        break; // everything else stays display-only in the demo
    }
  }
}

function getEntityStoreSnapshot(): HassEntities {
  return mergedEntitiesStore;
}

/**
 * Read the current entity store without subscribing. Use from hooks that need
 * the latest entities at a specific moment (a click handler, or a memo keyed on
 * a cheaper signal) but must NOT re-render on every entity-store tick.
 */
export function peekEntities(): HassEntities {
  return mergedEntitiesStore;
}

function getEmptyEntityStoreSnapshot(): HassEntities {
  return EMPTY_ENTITIES;
}

export function HomeAssistantProvider({ children }: HomeAssistantProviderProps) {
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<HassUser | null>(null);
  const [previewAsNonAdmin, setPreviewAsNonAdminState] = useState(false);
  const hasAutoConnected = useRef(false);
  // Bumped whenever the user switches to demo mode; an in-flight saveCredentials
  // from before the switch must not resolve into a live connection afterwards.
  const sessionEpoch = useRef(0);

  // Load credentials from localStorage on mount. Storage can throw wholesale
  // (blocked site data / private mode) — degrade to a session-only demo home
  // instead of crashing the root; the app stays usable, nothing persists.
  useEffect(() => {
    let storedUrl = '';
    let storedToken = '';
    let storedDemoMode = false;
    let storedPreviewNonAdmin = false;
    try {
      storedUrl = localStorage.getItem(LS_URL_KEY) || '';
      storedToken = localStorage.getItem(LS_TOKEN_KEY) || '';
      storedDemoMode = localStorage.getItem(LS_DEMO_MODE_KEY) === '1';
      storedPreviewNonAdmin = localStorage.getItem(LS_PREVIEW_NON_ADMIN_KEY) === '1';
    } catch {
      /* storage unreadable — fall through to demo defaults */
    }
    const hasStoredCredentials = !!storedUrl && !!storedToken;
    const shouldUseDemoMode = storedDemoMode || !hasStoredCredentials;

    if (!storedDemoMode && !hasStoredCredentials) {
      try {
        localStorage.setItem(LS_DEMO_MODE_KEY, '1');
      } catch {
        /* write blocked — demo still runs for this session */
      }
    }

    setHaUrl(storedUrl);
    setHaToken(storedToken);
    setDemoMode(shouldUseDemoMode);
    setConfigured(shouldUseDemoMode || hasStoredCredentials);
    setLiveEntities(EMPTY_ENTITIES);
    setMockEntities(shouldUseDemoMode ? createDemoEntities() : EMPTY_ENTITIES);
    setCurrentUser(shouldUseDemoMode ? DEMO_USER : null);
    setPreviewAsNonAdminState(storedPreviewNonAdmin);
    setHydrated(true);
  }, []);

  const doConnect = useCallback(async (url: string, token: string) => {
    setConnecting(true);
    setError(null);

    try {
      await connect({ url, token });
      setConnected(true);
      getCurrentUserAction().then(setCurrentUser);

      // A live instance pushes a state_changed event per entity — many per
      // second. Propagating each one to React individually re-runs every store
      // selector (some O(all entities)), rebuilds the device tree and re-renders
      // the whole dashboard on every tick, which freezes navigation app-wide.
      //
      // A plain RAF coalesce (~60Hz) still rebuilds the dashboard up to 60×/sec —
      // each rebuild can exceed a frame, so frames back up and taps lag. A home
      // dashboard does not need 60fps state; throttle to ~6-7Hz instead. Leading
      // edge fires immediately so a tap (toggle round-trip) feels instant, then
      // at most one update per THROTTLE_MS, with the latest state flushed at the
      // trailing edge.
      const THROTTLE_MS = 150;
      let pendingEntities: HassEntities | null = null;
      let lastFlush = 0;
      let timer: ReturnType<typeof setTimeout> | 0 = 0;
      const flushPendingEntities = () => {
        timer = 0;
        lastFlush = performance.now();
        if (pendingEntities) {
          setLiveEntities(pendingEntities);
          pendingEntities = null;
        }
      };
      subscribeToEntities((newEntities: HAEntities) => {
        pendingEntities = newEntities as unknown as HassEntities;
        const elapsed = performance.now() - lastFlush;
        if (elapsed >= THROTTLE_MS) {
          if (timer) { clearTimeout(timer); timer = 0; }
          flushPendingEntities();
        } else if (!timer) {
          timer = setTimeout(flushPendingEntities, THROTTLE_MS - elapsed);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t reach your home. Check that Home Assistant is switched on, then try again.');
      setConnected(false);
      setLiveEntities(EMPTY_ENTITIES);
      setCurrentUser(null);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Save credentials: attempt connection first, only persist on success
  const saveCredentials = useCallback(async (url: string, token: string) => {
    const epoch = sessionEpoch.current;
    const trimmedUrl = url.replace(/\/+$/, '');
    await doConnect(trimmedUrl, token);
    if (epoch !== sessionEpoch.current) {
      // The user chose the demo home while this connect was in flight — honor
      // that choice: drop the late connection instead of persisting it.
      disconnect();
      setConnected(false);
      return;
    }
    try {
      localStorage.setItem(LS_URL_KEY, trimmedUrl);
      localStorage.setItem(LS_TOKEN_KEY, token);
      localStorage.removeItem(LS_DEMO_MODE_KEY);
    } catch {
      /* storage blocked — keep the session-only connection running */
    }
    setHaUrl(trimmedUrl);
    setHaToken(token);
    setDemoMode(false);
    setMockEntities(EMPTY_ENTITIES);
    setConfigured(true);
  }, [doConnect]);

  const enableDemoMode = useCallback(() => {
    sessionEpoch.current += 1;
    disconnect();
    try {
      localStorage.removeItem(LS_URL_KEY);
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.setItem(LS_DEMO_MODE_KEY, '1');
    } catch {
      /* storage blocked — demo still applies for this session */
    }
    setHaUrl('');
    setHaToken('');
    setDemoMode(true);
    setConfigured(true);
    setConnected(false);
    setConnecting(false);
    setError(null);
    setLiveEntities(EMPTY_ENTITIES);
    setMockEntities(createDemoEntities());
    setCurrentUser(DEMO_USER);
    hasAutoConnected.current = false;
  }, []);

  const clearCredentials = useCallback(() => {
    enableDemoMode();
  }, [enableDemoMode]);

  const setPreviewAsNonAdmin = useCallback((value: boolean) => {
    localStorage.setItem(LS_PREVIEW_NON_ADMIN_KEY, value ? '1' : '0');
    setPreviewAsNonAdminState(value);
  }, []);

  const reconnect = useCallback(async () => {
    disconnect();
    setConnected(false);
    setLiveEntities(EMPTY_ENTITIES);
    if (haUrl && haToken) {
      await doConnect(haUrl, haToken);
    }
  }, [haUrl, haToken, doConnect]);

  const toggleEntity = useCallback(async (entityId: string, currentState?: string) => {
    if (demoMode || isMockEntity(entityId)) {
      demoToggleEntity(entityId, currentState);
      return;
    }
    if (!connected) return;
    try {
      await toggleEntityAction(entityId, currentState);
    } catch (err) {
      const detail = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? ((err as Record<string, unknown>).message as string | undefined) ?? JSON.stringify(err)
          : String(err);
      console.error(`Failed to toggle ${entityId}:`, detail);
    }
  }, [demoMode, connected]);

  const callService = useCallback(async (params: CallServiceParams) => {
    const ids = serviceTargetIds(params);
    if (demoMode || (ids.length > 0 && ids.every(isMockEntity))) {
      demoCallService(params);
      return;
    }
    if (!connected) return;
    try {
      await callServiceAction(params);
    } catch (err) {
      console.error('Failed to call service:', err instanceof Error ? err.message : err);
    }
  }, [demoMode, connected]);

  const getEntityRegistry = useCallback(() => getEntityRegistryAction(), []);
  const getDeviceRegistry = useCallback(() => getDeviceRegistryAction(), []);
  const getAreaRegistry = useCallback(() => getAreaRegistryAction(), []);
  const getFloorRegistry = useCallback(() => getFloorRegistryAction(), []);
  const getLabelRegistry = useCallback(() => getLabelRegistryAction(), []);

  // Registry writes throw (unlike callService which swallows) so editors can
  // show success/failure. Guarded: demo mode and disconnected state reject —
  // we never fabricate local registry edits when not talking to real HA.
  const assertWritable = useCallback(() => {
    if (demoMode) throw new Error('Editing areas and floors is disabled in demo mode.');
    if (!connected) throw new Error('Not connected to Home Assistant.');
  }, [demoMode, connected]);

  const createArea = useCallback(async (fields: AreaWriteFields) => { assertWritable(); return createAreaAction(fields); }, [assertWritable]);
  const updateArea = useCallback(async (areaId: string, fields: AreaWriteFields) => { assertWritable(); return updateAreaAction(areaId, fields); }, [assertWritable]);
  const deleteArea = useCallback(async (areaId: string) => { assertWritable(); return deleteAreaAction(areaId); }, [assertWritable]);
  const reorderAreas = useCallback(async (areaIds: string[]) => { assertWritable(); return reorderAreasAction(areaIds); }, [assertWritable]);
  const createFloor = useCallback(async (fields: FloorWriteFields) => { assertWritable(); return createFloorAction(fields); }, [assertWritable]);
  const updateFloor = useCallback(async (floorId: string, fields: FloorWriteFields) => { assertWritable(); return updateFloorAction(floorId, fields); }, [assertWritable]);
  const deleteFloor = useCallback(async (floorId: string) => { assertWritable(); return deleteFloorAction(floorId); }, [assertWritable]);
  const reorderFloors = useCallback(async (floorIds: string[]) => { assertWritable(); return reorderFloorsAction(floorIds); }, [assertWritable]);
  const createLabel = useCallback(async (fields: LabelWriteFields) => { assertWritable(); return createLabelAction(fields); }, [assertWritable]);
  const updateLabel = useCallback(async (labelId: string, fields: LabelWriteFields) => { assertWritable(); return updateLabelAction(labelId, fields); }, [assertWritable]);
  const deleteLabel = useCallback(async (labelId: string) => { assertWritable(); return deleteLabelAction(labelId); }, [assertWritable]);

  const getConfigEntries = useCallback(() => getConfigEntriesAction(), []);
  const getCoreConfig = useCallback(() => getCoreConfigAction(), []);
  const updateCoreConfig = useCallback(async (fields: CoreConfigWriteFields) => { assertWritable(); return updateCoreConfigAction(fields); }, [assertWritable]);
  const setAnalyticsPreferences = useCallback(async (preferences: AnalyticsPreferences) => { assertWritable(); return setAnalyticsPreferencesAction(preferences); }, [assertWritable]);
  const getIntegrationManifests = useCallback(() => getIntegrationManifestsAction(), []);
  // History for entities that can't have any on the wire (demo home, offline
  // session, staged mock entities) is synthesised here rather than in each
  // caller, so a card's sparkline and the dialog's chart agree.
  const getEntityHistory = useCallback(async (entityId: string, hoursBack?: number) => {
    const hours = hoursBack ?? 24;
    if (demoMode || !connected || isMockEntity(entityId)) {
      const entity = mergedEntitiesStore[entityId];
      return entity ? synthesizeHistory(entity, hours) : [];
    }
    return getEntityHistoryAction(entityId, hours);
  }, [demoMode, connected]);
  const getStatistics = useCallback((entityId: string, hoursBack: number, period: '5minute' | 'hour' | 'day') => getStatisticsAction(entityId, hoursBack, period), []);
  const getLogbook = useCallback((entityId: string | string[], hoursBack?: number) => getLogbookAction(entityId, hoursBack), []);
  const getAutomationConfig = useCallback((numericId: string) => getAutomationConfigAction(numericId), []);

  const setMockEntity = useCallback((entityId: string, entity: HassEntity | null) => {
    updateMockEntityInStore(entityId, entity);
  }, []);

  // Auto-connect once on page load if credentials exist in localStorage
  useEffect(() => {
    if (demoMode || !configured || !haUrl || !haToken) {
      hasAutoConnected.current = false;
      return;
    }

    if (hasAutoConnected.current || connected || connecting) {
      return;
    }

    hasAutoConnected.current = true;
    // Stays armed even when the attempt fails: clearing it here re-triggers this
    // effect (via the `connecting` dep) and hammers an unreachable instance in a
    // loop, which surfaces as an endless run of connection toasts. One attempt
    // per page load — retrying is the user's call (error toast → Connection
    // settings, or `reconnect()`). The ref re-arms when credentials or demo mode
    // change, in the guard above.
    doConnect(haUrl, haToken).catch(() => {});
  }, [configured, haUrl, haToken, doConnect, demoMode, connected, connecting]);

  const isAdmin = !!currentUser?.is_admin && !previewAsNonAdmin;

  const contextValue = useMemo<HomeAssistantContextValue>(() => ({
    connected,
    connecting,
    error,
    haUrl,
    configured,
    demoMode,
    hydrated,
    currentUser,
    isAdmin,
    previewAsNonAdmin,
    setPreviewAsNonAdmin,
    toggleEntity,
    callService,
    getEntityRegistry,
    getDeviceRegistry,
    getAreaRegistry,
    getFloorRegistry,
    getLabelRegistry,
    createArea,
    updateArea,
    deleteArea,
    reorderAreas,
    createFloor,
    updateFloor,
    deleteFloor,
    reorderFloors,
    createLabel,
    updateLabel,
    deleteLabel,
    getConfigEntries,
    getCoreConfig,
    updateCoreConfig,
    setAnalyticsPreferences,
    getIntegrationManifests,
    getEntityHistory,
    getStatistics,
    getLogbook,
    getAutomationConfig,
    reconnect,
    saveCredentials,
    enableDemoMode,
    clearCredentials,
    setMockEntity,
  }), [
    connected,
    connecting,
    error,
    haUrl,
    configured,
    demoMode,
    hydrated,
    currentUser,
    isAdmin,
    previewAsNonAdmin,
    setPreviewAsNonAdmin,
    toggleEntity,
    callService,
    getEntityRegistry,
    getDeviceRegistry,
    getAreaRegistry,
    getFloorRegistry,
    getLabelRegistry,
    createArea,
    updateArea,
    deleteArea,
    reorderAreas,
    createFloor,
    updateFloor,
    deleteFloor,
    reorderFloors,
    createLabel,
    updateLabel,
    deleteLabel,
    getConfigEntries,
    getCoreConfig,
    updateCoreConfig,
    setAnalyticsPreferences,
    getIntegrationManifests,
    getEntityHistory,
    getStatistics,
    getLogbook,
    getAutomationConfig,
    reconnect,
    saveCredentials,
    enableDemoMode,
    clearCredentials,
    setMockEntity,
  ]);

  return (
    <HomeAssistantContext.Provider
      value={contextValue}
    >
      {children}
    </HomeAssistantContext.Provider>
  );
}

export function useHomeAssistant(): HomeAssistantContextValue {
  const context = useContext(HomeAssistantContext);
  if (!context) {
    throw new Error('useHomeAssistant must be used within a HomeAssistantProvider');
  }
  return context;
}

/**
 * Live WebSocket transport state — flips false when a connected instance goes
 * away mid-session (e.g. an OS/Supervisor/Core update restarts HA) and true
 * again on reconnect. Distinct from the provider's `connected`, which only
 * tracks whether the initial connect succeeded. Always false in demo mode.
 */
export function useConnectionAlive(): boolean {
  return useSyncExternalStore(subscribeToConnectionStatus, isSocketAlive, () => false);
}

export function useRestartPending(): boolean {
  return useSyncExternalStore(subscribeToRestartPending, isRestartPending, () => false);
}

export function useHomeAssistantEntities(): HassEntities {
  return useSyncExternalStore(
    subscribeToEntityStore,
    getEntityStoreSnapshot,
    getEmptyEntityStoreSnapshot
  );
}

export function useHomeAssistantSelector<T>(
  selector: (entities: HassEntities) => T,
  isEqual: (previous: T, next: T) => boolean = Object.is
): T {
  const selectionCacheRef = useRef<{
    selector: (entities: HassEntities) => T;
    snapshot: HassEntities;
    selection: T;
  } | null>(null);
  const serverSelectionCacheRef = useRef<{
    selector: (entities: HassEntities) => T;
    selection: T;
  } | null>(null);

  const getSelectionSnapshot = useCallback(() => {
    const snapshot = getEntityStoreSnapshot();
    const cachedSelection = selectionCacheRef.current;

    if (
      cachedSelection &&
      cachedSelection.selector === selector &&
      Object.is(cachedSelection.snapshot, snapshot)
    ) {
      return cachedSelection.selection;
    }

    const nextSelection = selector(snapshot);

    if (
      cachedSelection &&
      cachedSelection.selector === selector &&
      isEqual(cachedSelection.selection, nextSelection)
    ) {
      selectionCacheRef.current = {
        selector,
        snapshot,
        selection: cachedSelection.selection,
      };
      return cachedSelection.selection;
    }

    selectionCacheRef.current = {
      selector,
      snapshot,
      selection: nextSelection,
    };
    return nextSelection;
  }, [isEqual, selector]);

  const getServerSelectionSnapshot = useCallback(() => {
    const cachedSelection = serverSelectionCacheRef.current;

    if (cachedSelection && cachedSelection.selector === selector) {
      return cachedSelection.selection;
    }

    const nextSelection = selector(EMPTY_ENTITIES);
    serverSelectionCacheRef.current = {
      selector,
      selection: nextSelection,
    };
    return nextSelection;
  }, [selector]);

  return useSyncExternalStore(
    subscribeToEntityStore,
    getSelectionSnapshot,
    getServerSelectionSnapshot
  );
}

// Stable comparators + per-id selector cache: the selector cache above keys on
// function identity, so inline closures would re-select (and re-allocate) on
// every render. The id-keyed maps stay bounded by the entity population.
const isSameEntitySnapshot = (previous: HassEntity | undefined, next: HassEntity | undefined) =>
  previous === next ||
  (
    !!previous &&
    !!next &&
    previous.entity_id === next.entity_id &&
    previous.state === next.state &&
    previous.last_updated === next.last_updated
  );

const areEntityArraysEqual = (previous: (HassEntity | undefined)[], next: (HassEntity | undefined)[]) => {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (!isSameEntitySnapshot(previous[index], next[index])) return false;
  }
  return true;
};

const entitySelectors = new Map<string, (entities: HassEntities) => HassEntity | undefined>();
function selectorForEntity(entityId: string) {
  let selector = entitySelectors.get(entityId);
  if (!selector) {
    selector = (entities) => entities[entityId];
    entitySelectors.set(entityId, selector);
  }
  return selector;
}

const entityListSelectors = new Map<string, (entities: HassEntities) => (HassEntity | undefined)[]>();
function selectorForEntityList(entityIds: string[]) {
  const key = entityIds.join('|');
  let selector = entityListSelectors.get(key);
  if (!selector) {
    const ids = [...entityIds];
    selector = (entities) => ids.map((id) => entities[id]);
    entityListSelectors.set(key, selector);
  }
  return selector;
}

export function useEntity(entityId: string): HassEntity | undefined {
  return useHomeAssistantSelector(selectorForEntity(entityId), isSameEntitySnapshot);
}

export function useEntities(entityIds: string[]): (HassEntity | undefined)[] {
  return useHomeAssistantSelector(selectorForEntityList(entityIds), areEntityArraysEqual);
}

// ── Dev/capture-only bridge ─────────────────────────────────────────────────
// The preview-capture harness (scripts/capture-previews.mjs) records the
// prototype features as GIFs. Two of them — the reactive screensaver ripples
// and the off-screen change hints — need a state change injected to fire, which
// the harness drives through this bridge. It is INERT unless explicitly opted
// in (localStorage `ha-capture-bridge` = '1', set by the harness before load)
// and is dead-code-eliminated from production builds via the NODE_ENV guard, so
// it never ships to users.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  try {
    if (window.localStorage.getItem('ha-capture-bridge') === '1') {
      (window as unknown as { __haCapture?: unknown }).__haCapture = {
        /** Current merged entity store (live + mock) without subscribing. */
        peek: (): HassEntities => mergedEntitiesStore,
        /** Override (or clear, with null) an entity so a card visibly changes. */
        setMock: (entityId: string, entity: HassEntity | null): void =>
          updateMockEntityInStore(entityId, entity),
        /** Spawn a reactive ring ripple of a semantic kind ('on'|'off'|'error'|'alert'|'link'). */
        emitPulse: (kind: PulseMeta['kind'], label = 'Living Room'): void =>
          emitHomePulse(PULSE_COLORS[kind] as PulseColor, { label, kind }),
      };
    }
  } catch {
    // localStorage can throw in locked-down contexts — bridge simply stays off.
  }
}
