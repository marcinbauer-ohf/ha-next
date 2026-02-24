'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
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

interface HomeAssistantContextValue {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  entities: HassEntities;
  haUrl: string;
  configured: boolean;
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

interface HomeAssistantProviderProps {
  children: ReactNode;
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
  const [entities, setEntities] = useState<HassEntities>({});
  const [mockEntities, setMockEntities] = useState<HassEntities>({});
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
    setMockEntities(storedDemoMode ? createDemoEntities() : {});
    setHydrated(true);
  }, []);

  const doConnect = useCallback(async (url: string, token: string) => {
    setConnecting(true);
    setError(null);

    try {
      await connect({ url, token });
      setConnected(true);

      subscribeToEntities((newEntities: HAEntities) => {
        setEntities(newEntities as unknown as HassEntities);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnected(false);
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
    setMockEntities({});
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
    setEntities({});
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
    setEntities({});
    setMockEntities({});
    setError(null);
    hasAutoConnected.current = false;
  }, []);

  const reconnect = useCallback(async () => {
    disconnect();
    setConnected(false);
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
    setMockEntities(prev => {
      const next = { ...prev };
      if (entity === null) {
        delete next[entityId];
      } else {
        next[entityId] = entity;
      }
      return next;
    });
  }, []);

  // Sync real and mock entities
  const mergedEntities = (Object.keys(mockEntities).length > 0) 
    ? { ...entities, ...mockEntities } 
    : entities;

  // Auto-connect once on page load if credentials exist in localStorage
  useEffect(() => {
    if (configured && haUrl && haToken && !hasAutoConnected.current) {
      hasAutoConnected.current = true;
      doConnect(haUrl, haToken).catch(() => {});
    }
    return () => { disconnect(); };
  }, [configured, haUrl, haToken, doConnect, demoMode]);

  return (
    <HomeAssistantContext.Provider
      value={{
        connected,
        connecting,
        error,
        entities: mergedEntities,
        haUrl,
        configured,
        hydrated,
        toggleEntity,
        callService,
        reconnect,
        saveCredentials,
        enableDemoMode,
        clearCredentials,
        setMockEntity,
      }}
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

export function useEntity(entityId: string): HassEntity | undefined {
  const { entities } = useHomeAssistant();
  return entities[entityId];
}

export function useEntities(entityIds: string[]): (HassEntity | undefined)[] {
  const { entities } = useHomeAssistant();
  return entityIds.map((id) => entities[id]);
}
