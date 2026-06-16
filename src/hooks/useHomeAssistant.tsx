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
  getIntegrationManifests as getIntegrationManifestsAction,
  getEntityHistory as getEntityHistoryAction,
  getLogbook as getLogbookAction,
  getAutomationConfig as getAutomationConfigAction,
  createArea as createAreaAction,
  updateArea as updateAreaAction,
  deleteArea as deleteAreaAction,
  createFloor as createFloorAction,
  updateFloor as updateFloorAction,
  deleteFloor as deleteFloorAction,
  createLabel as createLabelAction,
  updateLabel as updateLabelAction,
  deleteLabel as deleteLabelAction,
} from '@/lib/homeassistant';
import type { CallServiceParams, EntityRegistryEntry, DeviceRegistryEntry, AreaRegistryEntry, FloorRegistryEntry, LabelRegistryEntry, HistoryPoint, ConfigEntry, IntegrationManifest, LogbookEntry, AutomationConfig, AreaWriteFields, FloorWriteFields, LabelWriteFields } from '@/lib/homeassistant';
import type { HassEntities, HassEntity } from '@/types';
import { createDemoEntities } from '@/lib/homeassistant/demoEntities';

const LS_URL_KEY = 'ha_url';
const LS_TOKEN_KEY = 'ha_token';
const LS_DEMO_MODE_KEY = 'ha_demo_mode';
const EMPTY_ENTITIES: HassEntities = {};

type EntityStoreListener = () => void;

interface HomeAssistantContextValue {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  haUrl: string;
  configured: boolean;
  demoMode: boolean;
  hydrated: boolean;
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
  createFloor: (fields: FloorWriteFields) => Promise<FloorRegistryEntry>;
  updateFloor: (floorId: string, fields: FloorWriteFields) => Promise<FloorRegistryEntry>;
  deleteFloor: (floorId: string) => Promise<void>;
  createLabel: (fields: LabelWriteFields) => Promise<LabelRegistryEntry>;
  updateLabel: (labelId: string, fields: LabelWriteFields) => Promise<LabelRegistryEntry>;
  deleteLabel: (labelId: string) => Promise<void>;
  getConfigEntries: () => Promise<ConfigEntry[]>;
  getIntegrationManifests: () => Promise<IntegrationManifest[]>;
  getEntityHistory: (entityId: string, hoursBack?: number) => Promise<HistoryPoint[]>;
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
  const hasAutoConnected = useRef(false);

  // Load credentials from localStorage on mount
  useEffect(() => {
    const storedUrl = localStorage.getItem(LS_URL_KEY) || '';
    const storedToken = localStorage.getItem(LS_TOKEN_KEY) || '';
    const storedDemoMode = localStorage.getItem(LS_DEMO_MODE_KEY) === '1';
    const hasStoredCredentials = !!storedUrl && !!storedToken;
    const shouldUseDemoMode = storedDemoMode || !hasStoredCredentials;

    if (!storedDemoMode && !hasStoredCredentials) {
      localStorage.setItem(LS_DEMO_MODE_KEY, '1');
    }

    setHaUrl(storedUrl);
    setHaToken(storedToken);
    setDemoMode(shouldUseDemoMode);
    setConfigured(shouldUseDemoMode || hasStoredCredentials);
    setLiveEntities(EMPTY_ENTITIES);
    setMockEntities(shouldUseDemoMode ? createDemoEntities() : EMPTY_ENTITIES);
    setHydrated(true);
  }, []);

  const doConnect = useCallback(async (url: string, token: string) => {
    setConnecting(true);
    setError(null);

    try {
      await connect({ url, token });
      setConnected(true);

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
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnected(false);
      setLiveEntities(EMPTY_ENTITIES);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Save credentials: attempt connection first, only persist on success
  const saveCredentials = useCallback(async (url: string, token: string) => {
    const trimmedUrl = url.replace(/\/+$/, '');
    await doConnect(trimmedUrl, token);
    localStorage.setItem(LS_URL_KEY, trimmedUrl);
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.removeItem(LS_DEMO_MODE_KEY);
    setHaUrl(trimmedUrl);
    setHaToken(token);
    setDemoMode(false);
    setMockEntities(EMPTY_ENTITIES);
    setConfigured(true);
  }, [doConnect]);

  const enableDemoMode = useCallback(() => {
    disconnect();
    localStorage.removeItem(LS_URL_KEY);
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.setItem(LS_DEMO_MODE_KEY, '1');
    setHaUrl('');
    setHaToken('');
    setDemoMode(true);
    setConfigured(true);
    setConnected(false);
    setConnecting(false);
    setError(null);
    setLiveEntities(EMPTY_ENTITIES);
    setMockEntities(createDemoEntities());
    hasAutoConnected.current = false;
  }, []);

  const clearCredentials = useCallback(() => {
    enableDemoMode();
  }, [enableDemoMode]);

  const reconnect = useCallback(async () => {
    disconnect();
    setConnected(false);
    setLiveEntities(EMPTY_ENTITIES);
    if (haUrl && haToken) {
      await doConnect(haUrl, haToken);
    }
  }, [haUrl, haToken, doConnect]);

  const toggleEntity = useCallback(async (entityId: string, currentState?: string) => {
    if (demoMode || !connected) return;
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
    if (demoMode || !connected) return;
    try {
      await callServiceAction(params);
    } catch (err) {
      console.error('Failed to call service:', err instanceof Error ? err.message : err);
    }
  }, []);

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
  const createFloor = useCallback(async (fields: FloorWriteFields) => { assertWritable(); return createFloorAction(fields); }, [assertWritable]);
  const updateFloor = useCallback(async (floorId: string, fields: FloorWriteFields) => { assertWritable(); return updateFloorAction(floorId, fields); }, [assertWritable]);
  const deleteFloor = useCallback(async (floorId: string) => { assertWritable(); return deleteFloorAction(floorId); }, [assertWritable]);
  const createLabel = useCallback(async (fields: LabelWriteFields) => { assertWritable(); return createLabelAction(fields); }, [assertWritable]);
  const updateLabel = useCallback(async (labelId: string, fields: LabelWriteFields) => { assertWritable(); return updateLabelAction(labelId, fields); }, [assertWritable]);
  const deleteLabel = useCallback(async (labelId: string) => { assertWritable(); return deleteLabelAction(labelId); }, [assertWritable]);

  const getConfigEntries = useCallback(() => getConfigEntriesAction(), []);
  const getIntegrationManifests = useCallback(() => getIntegrationManifestsAction(), []);
  const getEntityHistory = useCallback((entityId: string, hoursBack?: number) => getEntityHistoryAction(entityId, hoursBack), []);
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
    doConnect(haUrl, haToken).catch(() => {
      hasAutoConnected.current = false;
    });
  }, [configured, haUrl, haToken, doConnect, demoMode, connected, connecting]);

  const contextValue = useMemo<HomeAssistantContextValue>(() => ({
    connected,
    connecting,
    error,
    haUrl,
    configured,
    demoMode,
    hydrated,
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
    createFloor,
    updateFloor,
    deleteFloor,
    createLabel,
    updateLabel,
    deleteLabel,
    getConfigEntries,
    getIntegrationManifests,
    getEntityHistory,
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
    createFloor,
    updateFloor,
    deleteFloor,
    createLabel,
    updateLabel,
    deleteLabel,
    getConfigEntries,
    getIntegrationManifests,
    getEntityHistory,
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

export function useEntity(entityId: string): HassEntity | undefined {
  return useHomeAssistantSelector(
    (entities) => entities[entityId],
    (previous, next) =>
      previous === next ||
      (
        !!previous &&
        !!next &&
        previous.entity_id === next.entity_id &&
        previous.state === next.state &&
        previous.last_updated === next.last_updated
      )
  );
}

export function useEntities(entityIds: string[]): (HassEntity | undefined)[] {
  return useHomeAssistantSelector(
    (entities) => entityIds.map((id) => entities[id]),
    (previous, next) => {
      if (previous.length !== next.length) return false;
      for (let index = 0; index < previous.length; index += 1) {
        const previousEntity = previous[index];
        const nextEntity = next[index];

        if (previousEntity === nextEntity) continue;
        if (!previousEntity || !nextEntity) return false;
        if (
          previousEntity.entity_id !== nextEntity.entity_id ||
          previousEntity.state !== nextEntity.state ||
          previousEntity.last_updated !== nextEntity.last_updated
        ) {
          return false;
        }
      }
      return true;
    }
  );
}
