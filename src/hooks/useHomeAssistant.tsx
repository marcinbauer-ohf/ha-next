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
} from '@/lib/homeassistant';
import type { CallServiceParams } from '@/lib/homeassistant';
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
  toggleEntity: (entityId: string) => Promise<void>;
  callService: (params: CallServiceParams) => Promise<void>;
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

function resetEntityStore(): void {
  if (!hasEntities(liveEntitiesStore) && !hasEntities(mockEntitiesStore)) return;
  liveEntitiesStore = EMPTY_ENTITIES;
  mockEntitiesStore = EMPTY_ENTITIES;
  mergedEntitiesStore = EMPTY_ENTITIES;
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

    setHaUrl(storedUrl);
    setHaToken(storedToken);
    setDemoMode(storedDemoMode);
    setConfigured(storedDemoMode || (!!storedUrl && !!storedToken));
    setLiveEntities(EMPTY_ENTITIES);
    setMockEntities(storedDemoMode ? createDemoEntities() : EMPTY_ENTITIES);
    setHydrated(true);
  }, []);

  const doConnect = useCallback(async (url: string, token: string) => {
    setConnecting(true);
    setError(null);

    try {
      await connect({ url, token });
      setConnected(true);

      subscribeToEntities((newEntities: HAEntities) => {
        setLiveEntities(newEntities as unknown as HassEntities);
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
    localStorage.removeItem(LS_URL_KEY);
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_DEMO_MODE_KEY);
    disconnect();
    setHaUrl('');
    setHaToken('');
    setDemoMode(false);
    setConfigured(false);
    setConnected(false);
    setError(null);
    resetEntityStore();
    hasAutoConnected.current = false;
  }, []);

  const reconnect = useCallback(async () => {
    disconnect();
    setConnected(false);
    setLiveEntities(EMPTY_ENTITIES);
    if (haUrl && haToken) {
      await doConnect(haUrl, haToken);
    }
  }, [haUrl, haToken, doConnect]);

  const toggleEntity = useCallback(async (entityId: string) => {
    try {
      await toggleEntityAction(entityId);
    } catch (err) {
      console.error('Failed to toggle entity:', err);
    }
  }, []);

  const callService = useCallback(async (params: CallServiceParams) => {
    try {
      await callServiceAction(params);
    } catch (err) {
      console.error('Failed to call service:', err);
    }
  }, []);

  const setMockEntity = useCallback((entityId: string, entity: HassEntity | null) => {
    updateMockEntityInStore(entityId, entity);
  }, []);

  // Auto-connect once on page load if credentials exist in localStorage
  useEffect(() => {
    if (configured && haUrl && haToken && !hasAutoConnected.current) {
      hasAutoConnected.current = true;
      doConnect(haUrl, haToken).catch(() => {});
    }
    return () => {
      disconnect();
      resetEntityStore();
    };
  }, [configured, haUrl, haToken, doConnect, demoMode]);

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
