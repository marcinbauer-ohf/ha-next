'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
  ReactNode,
} from 'react';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks/useHomeAssistant';
import { getAddons, getPanels, type HaAddon, type HaPanel, waitForConnection } from '@/lib/homeassistant';
import {
  selectAddonUpdates,
  areAddonUpdatesEqual,
  type AddonUpdateState,
} from '@/lib/homeassistant/selectors';

import {
  subscribeToAppStatusPreview,
  getAppStatusPreviewIndex,
  getAppStatusPreviewVersion,
  previewAppStatus,
} from '@/lib/appStatusPreview';

import type { SidebarShortcut } from '@/lib/sidebarShortcuts';

/**
 * What the Supervisor says about the add-on behind an app panel. Only the
 * states worth interrupting the icon for — a healthy, running, up-to-date
 * add-on carries no status at all.
 */
export interface AppStatus {
  /** `busy` is ours, not the Supervisor's: a command is in flight. */
  kind: 'installing' | 'stopped' | 'error' | 'update' | 'busy';
  /** 0-100 while installing, null when the Supervisor reports no percentage. */
  progress?: number | null;
}

export interface SidebarItem {
  id: string;
  title: string;
  icon: string | null;
  urlPath: string;
  type: 'dashboard' | 'panel';
  isCustom?: boolean;
  isApp?: boolean;
  isPlaceholder?: boolean;
  /** User-defined shortcut (pinned view, action, or link) — see sidebarShortcuts.ts. */
  isShortcut?: boolean;
  shortcut?: SidebarShortcut;
  /** Apps only: add-on health, shown as a marker on the icon's bottom edge. */
  appStatus?: AppStatus;
  /** Apps only: the Supervisor add-on behind this panel, when there is one. */
  addonSlug?: string;
  /** Apps only: the add-on's `update.` entity — what runs the update. */
  updateEntityId?: string;
}

interface SidebarItemsContextType {
  items: SidebarItem[];
  loading: boolean;
  error: string | null;
  /** Re-read add-on state now instead of waiting out the poll. */
  refreshAppStatuses: () => void;
  /**
   * Force an app's status marker — a command in flight shows `busy` until the
   * Supervisor confirms, and demo mode (which has no Supervisor) runs entirely
   * on these. Cleared by the next successful add-on poll.
   */
  setAppStatusOverride: (id: string, status: AppStatus | undefined) => void;
}

const SidebarItemsContext = createContext<SidebarItemsContextType>({
  items: [],
  loading: true,
  error: null,
  refreshAppStatuses: () => {},
  setAppStatusOverride: () => {},
});

const hiddenPanels = new Set([
  'profile',
  'developer-tools',
  'config',
  'lovelace',
  'home',
  'energy',
]);

const appComponents = new Set([
  'iframe',
  'custom',
  'hassio',
  'hacs',
  'esphome',
]);

const baseSidebarItems: SidebarItem[] = [
  {
    id: 'home',
    title: 'Home',
    icon: null,
    urlPath: '/',
    type: 'dashboard',
    isCustom: true,
  },
  {
    id: 'energy',
    title: 'Energy',
    icon: 'mdi:flash',
    urlPath: '/dashboard/energy',
    type: 'dashboard',
    isCustom: true,
    isPlaceholder: true,
  },
];

const demoSidebarItems: SidebarItem[] = [
  {
    id: 'security',
    title: 'Security',
    icon: 'mdi:shield-home',
    urlPath: '/dashboard/security',
    type: 'dashboard',
    isCustom: true,
    isPlaceholder: true,
  },
  {
    id: 'climate',
    title: 'Climate',
    icon: 'mdi:thermometer-lines',
    urlPath: '/dashboard/climate',
    type: 'dashboard',
    isCustom: true,
    isPlaceholder: true,
  },
  {
    id: 'music',
    title: 'Music Assistant',
    // Real add-on logos, same source the integrations list already uses.
    icon: 'https://brands.home-assistant.io/music_assistant/icon.png',
    urlPath: '/panel/music',
    type: 'panel',
    isCustom: true,
    isApp: true,
    isPlaceholder: true,
    appStatus: { kind: 'update' },
    // Demo apps stand in for add-ons so the icon markers AND the right-click
    // actions can be exercised without a Supervisor. Nothing is called on the
    // demo slug — the actions flip the demo status locally instead.
    addonSlug: 'demo_music_assistant',
  },
  {
    id: 'cameras',
    title: 'Frigate',
    icon: 'https://brands.home-assistant.io/frigate/icon.png',
    urlPath: '/panel/cameras',
    type: 'panel',
    isCustom: true,
    isApp: true,
    isPlaceholder: true,
    appStatus: { kind: 'stopped' },
    addonSlug: 'demo_frigate',
  },
];

function cloneBaseSidebarItems(): SidebarItem[] {
  return baseSidebarItems.map((item) => ({ ...item }));
}

function buildSidebarItemsFromPanels(panels: Record<string, HaPanel>): SidebarItem[] {
  const sidebarItems = cloneBaseSidebarItems();
  const panelEntries = Object.entries(panels);
  const lovelacePanels: [string, HaPanel][] = [];
  const otherPanels: [string, HaPanel][] = [];

  panelEntries.forEach(([key, panel]) => {
    if (hiddenPanels.has(key)) return;

    if (panel.component_name === 'lovelace') {
      lovelacePanels.push([key, panel]);
      return;
    }

    if (panel.title) {
      otherPanels.push([key, panel]);
    }
  });

  lovelacePanels.forEach(([key, panel]) => {
    if (key === 'lovelace') return;

    sidebarItems.push({
      id: key,
      title: panel.title || key,
      icon: panel.icon || 'mdi:view-dashboard-outline',
      urlPath: `/dashboard/${panel.url_path}`,
      type: 'dashboard',
      isPlaceholder: true,
    });
  });

  otherPanels.forEach(([key, panel]) => {
    const isApp = appComponents.has(panel.component_name) ||
      key.includes('_') ||
      panel.component_name.startsWith('custom:');

    sidebarItems.push({
      id: key,
      title: panel.title || key,
      icon: panel.icon || 'mdi:application',
      urlPath: `/panel/${panel.url_path}`,
      type: 'panel',
      isApp,
      isPlaceholder: true,
    });
  });

  return sidebarItems;
}

const normalizeAppKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * An add-on panel's key IS its Supervisor slug (hassio registers the panel with
 * `frontend_url_path = <slug>`), so item.id joins straight onto the add-on list.
 * Indexed by normalized name too, so a panel that was registered under some
 * other path still finds its add-on. Apps that aren't add-ons (HACS,
 * integration panels) simply find nothing.
 */
function indexAddons(addons: HaAddon[]): Record<string, HaAddon> {
  const index: Record<string, HaAddon> = {};
  for (const addon of addons) {
    index[addon.slug] = addon;
    index[normalizeAppKey(addon.name)] ??= addon;
  }
  return index;
}

function resolveAppStatus(addon?: HaAddon, update?: AddonUpdateState): AppStatus | undefined {
  if (update?.installing) return { kind: 'installing', progress: update.percentage };
  if (!addon) return update?.updateAvailable ? { kind: 'update' } : undefined;
  if (addon.state === 'error' || addon.state === 'unknown') return { kind: 'error' };
  if (addon.state !== 'started') return { kind: 'stopped' };
  if (addon.update_available || update?.updateAvailable) return { kind: 'update' };
  return undefined;
}

// Add-ons start and stop rarely and the Supervisor pushes no state events, so a
// slow poll is enough — install *progress* comes from the update entities,
// which are live.
const ADDON_POLL_MS = 60_000;

export function SidebarItemsProvider({ children }: { children: ReactNode }) {
  const { connected, demoMode, demoEmpty } = useHomeAssistant();
  const addonUpdates = useHomeAssistantSelector(selectAddonUpdates, areAddonUpdatesEqual);
  const [addons, setAddons] = useState<Record<string, HaAddon>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AppStatus | undefined>>({});
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applyResult = (nextItems: SidebarItem[], nextError: string | null = null) => {
      if (cancelled) return;
      setItems(nextItems);
      setError(nextError);
      setLoading(false);
    };

    const fetchItems = async () => {
      setLoading(true);
      setError(null);

      // The emptied demo is a fresh install: the stock panels are there, but the
      // extra dashboards and add-on panels nobody has created yet are not.
      if (demoMode) {
        applyResult(
          demoEmpty
            ? cloneBaseSidebarItems()
            : [...cloneBaseSidebarItems(), ...demoSidebarItems.map((item) => ({ ...item }))],
        );
        return;
      }

      if (!connected) {
        applyResult(cloneBaseSidebarItems());
        return;
      }

      try {
        const activeConnection = await waitForConnection();

        if (cancelled) return;

        if (!activeConnection) {
          applyResult(cloneBaseSidebarItems());
          return;
        }

        const panels = await getPanels();
        applyResult(
          panels && typeof panels === 'object'
            ? buildSidebarItemsFromPanels(panels)
            : cloneBaseSidebarItems()
        );
      } catch (err) {
        if (err instanceof Error && err.message === 'Not connected to Home Assistant') {
          applyResult(cloneBaseSidebarItems());
          return;
        }

        console.error('Failed to fetch sidebar items:', err);
        applyResult(
          cloneBaseSidebarItems(),
          err instanceof Error ? err.message : 'Failed to fetch'
        );
      }
    };

    fetchItems();

    return () => {
      cancelled = true;
    };
  }, [connected, demoMode, demoEmpty]);

  useEffect(() => {
    if (!connected || demoMode) return;
    void refreshTick; // a start/stop command re-runs the poll immediately

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const list = await getAddons();
        if (cancelled) return;
        setAddons(indexAddons(list));
        // Fresh truth from the Supervisor outranks any in-flight guess.
        setStatusOverrides((prev) => (Object.keys(prev).length ? {} : prev));
      } catch {
        // Core-only install or non-admin user: no add-ons to report, ever.
        // Stop polling rather than retry a call that can't start succeeding.
        return;
      }
      timer = setTimeout(poll, ADDON_POLL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [connected, demoMode, refreshTick]);

  const setAppStatusOverride = useCallback(
    (id: string, status: AppStatus | undefined) =>
      setStatusOverrides((prev) => ({ ...prev, [id]: status })),
    []
  );

  /** Re-poll now — the Supervisor takes a moment to report a start/stop. */
  const refreshAppStatuses = useCallback(() => setRefreshTick((tick) => tick + 1), []);

  // Debug-tools preview: paints chosen states onto every app icon so the
  // markers can be seen without stopping a real add-on. Off by default.
  // Subscribe to the version, not the index: the fake install's percentage
  // climbs while the index sits still, and the badge has to see each step.
  const previewVersion = useSyncExternalStore(
    subscribeToAppStatusPreview,
    getAppStatusPreviewVersion,
    () => 0
  );
  const previewIndex = getAppStatusPreviewIndex();

  const itemsWithStatus = useMemo(() => {
    let appPosition = 0;
    return items.map((item) => {
      if (!item.isApp) return item;
      const position = appPosition++;
      const addon = addons[item.id] ?? addons[normalizeAppKey(item.title)];
      const update = addonUpdates[addon?.slug ?? item.id];
      // Identity first (the context menu needs it in every state), status after:
      // debug preview > in-flight command > baked demo state > the Supervisor.
      const app = addon
        ? { ...item, addonSlug: addon.slug, updateEntityId: update?.entityId }
        : { ...item };
      if (previewIndex > 0) {
        return { ...app, appStatus: previewAppStatus(previewIndex, position) };
      }
      if (item.id in statusOverrides) {
        return { ...app, appStatus: statusOverrides[item.id] };
      }
      if (item.appStatus) return app;
      const appStatus = resolveAppStatus(addon, update);
      if (!addon && !appStatus) return item;
      return { ...app, appStatus };
    });
  }, [items, addons, addonUpdates, previewIndex, previewVersion, statusOverrides]);

  const value = useMemo(
    () => ({ items: itemsWithStatus, loading, error, refreshAppStatuses, setAppStatusOverride }),
    [itemsWithStatus, loading, error, refreshAppStatuses, setAppStatusOverride]
  );

  return <SidebarItemsContext.Provider value={value}>{children}</SidebarItemsContext.Provider>;
}

export function useSidebarItemsContext() {
  return useContext(SidebarItemsContext);
}
