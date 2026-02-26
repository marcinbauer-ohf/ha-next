'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { getPanels, type HaPanel } from '@/lib/homeassistant';

export interface SidebarItem {
  id: string;
  title: string;
  icon: string | null;
  urlPath: string;
  type: 'dashboard' | 'panel';
  isCustom?: boolean;
  isApp?: boolean;
}

interface SidebarItemsContextType {
  items: SidebarItem[];
  loading: boolean;
  error: string | null;
}

const SidebarItemsContext = createContext<SidebarItemsContextType>({
  items: [],
  loading: true,
  error: null,
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
  },
  {
    id: 'climate',
    title: 'Climate',
    icon: 'mdi:thermometer-lines',
    urlPath: '/dashboard/climate',
    type: 'dashboard',
    isCustom: true,
  },
  {
    id: 'music',
    title: 'Music',
    icon: 'mdi:music',
    urlPath: '/panel/music',
    type: 'panel',
    isCustom: true,
    isApp: true,
  },
  {
    id: 'cameras',
    title: 'Cameras',
    icon: 'mdi:cctv',
    urlPath: '/panel/cameras',
    type: 'panel',
    isCustom: true,
    isApp: true,
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
    });
  });

  return sidebarItems;
}

export function SidebarItemsProvider({ children }: { children: ReactNode }) {
  const { connected, demoMode } = useHomeAssistant();
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

      if (demoMode) {
        applyResult([
          ...cloneBaseSidebarItems(),
          ...demoSidebarItems.map((item) => ({ ...item })),
        ]);
        return;
      }

      if (!connected) {
        applyResult(cloneBaseSidebarItems());
        return;
      }

      try {
        // Small delay to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 300));

        // Fetch panels
        const panels = await getPanels();
        applyResult(
          panels && typeof panels === 'object'
            ? buildSidebarItemsFromPanels(panels)
            : cloneBaseSidebarItems()
        );
      } catch (err) {
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
  }, [connected, demoMode]);

  return (
    <SidebarItemsContext.Provider value={{ items, loading, error }}>
      {children}
    </SidebarItemsContext.Provider>
  );
}

export function useSidebarItemsContext() {
  return useContext(SidebarItemsContext);
}
