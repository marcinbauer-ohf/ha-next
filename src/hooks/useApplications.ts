'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  mdiChartAreaspline,
  mdiChip,
  mdiFileDocumentEditOutline,
  mdiFolderNetworkOutline,
  mdiHomeAutomation,
  mdiMicrophoneMessage,
  mdiMusic,
  mdiPackageVariant,
  mdiServerNetwork,
  mdiShieldCheckOutline,
  mdiVideoOutline,
} from '@mdi/js';
import { getAddonCatalog, type SupervisorAddon } from '@/lib/homeassistant/connection';
import { useHomeAssistant } from './useHomeAssistant';

// ─────────────────────────────────────────────────────────────────────────────
// Applications = Home Assistant add-ons, in user language. Real data comes from
// Supervisor (/addons for what's installed and running, /store for the
// catalogue). Container / Core installs have no Supervisor, so those calls come
// back empty and we show the demo catalogue instead — never a mix of the two.
// ─────────────────────────────────────────────────────────────────────────────

export type ApplicationCategory =
  | 'Voice & AI'
  | 'Media'
  | 'Network'
  | 'Security'
  | 'Tools'
  | 'Data & charts'
  | 'Home automation'
  | 'Other';

export interface ApplicationSummary {
  /** add-on slug — stable drill-down id */
  slug: string;
  name: string;
  /** One-line "what it does", shown under the name everywhere. */
  tagline: string;
  category: ApplicationCategory;
  icon: string;
  accent: string;
  installed: boolean;
  running: boolean;
  version: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  /** Starts with your home. */
  startOnBoot: boolean;
  /** Has its own screen, opened from the sidebar (add-on ingress). */
  hasOwnScreen: boolean;
  /** Ships with Home Assistant rather than a community repository. */
  official: boolean;
  /** Supervisor stage — experimental / deprecated apps get a warning chip. */
  stage: string;
  source: string;
  url?: string;
  description: string;
  /** Synthetic row; real rows come from Supervisor. */
  demo: boolean;
}

const CATEGORY_META: Record<ApplicationCategory, { icon: string; accent: string }> = {
  'Voice & AI': { icon: mdiMicrophoneMessage, accent: '#14b8a6' },
  Media: { icon: mdiMusic, accent: '#ec4899' },
  Network: { icon: mdiServerNetwork, accent: '#0ea5e9' },
  Security: { icon: mdiShieldCheckOutline, accent: '#ef4444' },
  Tools: { icon: mdiFileDocumentEditOutline, accent: '#f59e0b' },
  'Data & charts': { icon: mdiChartAreaspline, accent: '#8b5cf6' },
  'Home automation': { icon: mdiHomeAutomation, accent: '#2aa361' },
  Other: { icon: mdiPackageVariant, accent: '#64748b' },
};

// Slug → category for the add-ons people actually run. Anything unknown lands
// in "Other" with the generic package icon.
const SLUG_CATEGORY: Record<string, ApplicationCategory> = {
  configurator: 'Tools', ssh: 'Tools', samba: 'Tools', 'file_editor': 'Tools', studio_code_server: 'Tools',
  mosquitto: 'Network', duckdns: 'Network', nginx_proxy: 'Network', adguard: 'Network', cloudflared: 'Network',
  zigbee2mqtt: 'Home automation', esphome: 'Home automation', nodered: 'Home automation', zwave_js_ui: 'Home automation',
  influxdb: 'Data & charts', grafana: 'Data & charts', mariadb: 'Data & charts',
  whisper: 'Voice & AI', piper: 'Voice & AI', openwakeword: 'Voice & AI',
  frigate: 'Security', motioneye: 'Security',
  music_assistant: 'Media', plex: 'Media', jellyfin: 'Media',
};

function categoryOf(slug: string): ApplicationCategory {
  const key = Object.keys(SLUG_CATEGORY).find((k) => slug.endsWith(k));
  return key ? SLUG_CATEGORY[key] : 'Other';
}

// Icons that beat the category default for a few recognisable apps.
const SLUG_ICON: Record<string, string> = {
  frigate: mdiVideoOutline,
  esphome: mdiChip,
  samba: mdiFolderNetworkOutline,
};

function iconOf(slug: string, category: ApplicationCategory): string {
  const key = Object.keys(SLUG_ICON).find((k) => slug.endsWith(k));
  return key ? SLUG_ICON[key] : CATEGORY_META[category].icon;
}

function fromAddon(addon: SupervisorAddon, installedState?: SupervisorAddon): ApplicationSummary {
  const category = categoryOf(addon.slug);
  const installed = Boolean(installedState ?? addon.version ?? addon.installed);
  return {
    slug: addon.slug,
    name: addon.name,
    tagline: addon.description ?? '',
    category,
    icon: iconOf(addon.slug, category),
    accent: CATEGORY_META[category].accent,
    installed,
    running: (installedState?.state ?? addon.state) === 'started',
    version: installedState?.version ?? addon.version ?? null,
    latestVersion: addon.version_latest ?? null,
    updateAvailable: Boolean(installedState?.update_available ?? addon.update_available),
    startOnBoot: (installedState?.boot ?? addon.boot) === 'auto',
    hasOwnScreen: Boolean(installedState?.ingress ?? addon.ingress),
    official: (addon.repository ?? '') === 'core',
    stage: addon.stage ?? 'stable',
    source: (addon.repository ?? '') === 'core' ? 'Home Assistant' : (addon.repository ?? 'Community'),
    url: addon.url,
    description: addon.description ?? '',
    demo: false,
  };
}

function demoApp(
  slug: string,
  name: string,
  tagline: string,
  category: ApplicationCategory,
  extra: Partial<ApplicationSummary> = {},
): ApplicationSummary {
  return {
    slug,
    name,
    tagline,
    category,
    icon: iconOf(slug, category),
    accent: CATEGORY_META[category].accent,
    installed: false,
    running: false,
    version: null,
    latestVersion: '1.0.0',
    updateAvailable: false,
    startOnBoot: true,
    hasOwnScreen: true,
    official: true,
    stage: 'stable',
    source: 'Home Assistant',
    description: tagline,
    demo: true,
    ...extra,
  };
}

// The demo catalogue — shown only when there is no Supervisor to ask.
const DEMO_CATALOG: ApplicationSummary[] = [
  demoApp('core_configurator', 'File editor', 'Edit the files behind your home, right in the browser.', 'Tools', { installed: true, running: true, version: '5.8.0' }),
  demoApp('core_ssh', 'Terminal & SSH', 'A terminal into your home, for when you need one.', 'Tools', { installed: true, running: true, version: '9.14.0' }),
  demoApp('core_mosquitto', 'Mosquitto broker', 'The message broker devices talk to over MQTT.', 'Network', { installed: true, running: true, version: '6.5.1' }),
  demoApp('esphome', 'ESPHome Device Builder', 'Build and update your own sensors and switches.', 'Home automation', { installed: true, running: false, version: '2024.9.1', latestVersion: '2024.11.0', updateAvailable: true, official: false, source: 'ESPHome' }),
  demoApp('a0d7b954_nodered', 'Node-RED', 'Wire up flows when an automation needs more room.', 'Home automation', { installed: true, running: true, version: '18.1.0', official: false, source: 'Community add-ons' }),
  demoApp('core_samba', 'Samba share', 'Reach your configuration folder from your computer.', 'Tools', { installed: true, running: false, version: '12.3.1', hasOwnScreen: false }),
  demoApp('zigbee2mqtt', 'Zigbee2MQTT', 'Bring Zigbee devices in without their own hub.', 'Home automation', { official: false, source: 'Zigbee2MQTT' }),
  demoApp('adguard', 'AdGuard Home', 'Block ads and trackers for everything on your network.', 'Network', { official: false, source: 'Community add-ons' }),
  demoApp('frigate', 'Frigate', 'Watch your cameras and tell people from parcels.', 'Security', { official: false, source: 'Frigate NVR', stage: 'experimental' }),
  demoApp('music_assistant', 'Music Assistant', 'One library for every speaker in the house.', 'Media', { official: false, source: 'Music Assistant' }),
  demoApp('core_whisper', 'Whisper', 'Turns what you say into text, on your own hardware.', 'Voice & AI'),
  demoApp('core_piper', 'Piper', 'Gives your home a voice, without the cloud.', 'Voice & AI'),
  demoApp('core_openwakeword', 'openWakeWord', 'Listens for the wake word and nothing else.', 'Voice & AI'),
  demoApp('a0d7b954_influxdb', 'InfluxDB', 'Keeps the long history your charts are drawn from.', 'Data & charts', { official: false, source: 'Community add-ons' }),
  demoApp('a0d7b954_grafana', 'Grafana', 'Build the dashboards your data deserves.', 'Data & charts', { official: false, source: 'Community add-ons' }),
  demoApp('core_duckdns', 'Duck DNS', 'A free address for reaching home from outside.', 'Network'),
  demoApp('core_mariadb', 'MariaDB', 'A sturdier database once your history grows.', 'Data & charts'),
  demoApp('motioneye', 'motionEye', 'Simple recording for older cameras.', 'Security', { official: false, source: 'Community add-ons', stage: 'deprecated' }),
];

// ── Prototype-local mutations ───────────────────────────────────────────────
// Installing and starting are shown end-to-end but never written to Supervisor:
// this is a design prototype, and a mis-fired install is not a mistake you can
// take back from the UI.
// ponytail: swap for supervisor/api POSTs (/addons/<slug>/install|start|stop)
// once the prototype is meant to actually change the system.

interface AppOverride { installed?: boolean; running?: boolean }

const overrides = new Map<string, AppOverride>();
let overridesVersion = 0;
const overrideListeners = new Set<() => void>();

function subscribeOverrides(listener: () => void): () => void {
  overrideListeners.add(listener);
  return () => overrideListeners.delete(listener);
}

const getOverridesVersion = () => overridesVersion;
const getServerOverridesVersion = () => 0;

function patchApp(slug: string, patch: AppOverride): void {
  overrides.set(slug, { ...overrides.get(slug), ...patch });
  overridesVersion += 1;
  overrideListeners.forEach((l) => l());
}

// ── Data store (one Supervisor fetch, shared by every consumer) ─────────────

let addonsStore: { installed: SupervisorAddon[]; store: SupervisorAddon[] } = { installed: [], store: [] };
let addonsLoaded = false;
let addonsInFlight: Promise<void> | null = null;
let addonsVersion = 0;
const addonListeners = new Set<() => void>();

function subscribeAddons(listener: () => void): () => void {
  addonListeners.add(listener);
  return () => addonListeners.delete(listener);
}

const getAddonsVersion = () => addonsVersion;
const getServerAddonsVersion = () => 0;

function loadAddons(): Promise<void> {
  if (addonsInFlight) return addonsInFlight;
  if (addonsLoaded) return Promise.resolve();
  addonsInFlight = getAddonCatalog()
    .then((data) => {
      addonsStore = data;
      addonsLoaded = true;
      addonsVersion += 1;
      addonListeners.forEach((l) => l());
    })
    .catch(() => {})
    .finally(() => { addonsInFlight = null; });
  return addonsInFlight;
}

export interface UseApplications {
  /** Installed applications — the Applications settings list. */
  apps: ApplicationSummary[];
  /** Everything installable — the store. Installed items carry `installed: true`. */
  catalog: ApplicationSummary[];
  loading: boolean;
  /** True when the rows come from a real Supervisor. */
  live: boolean;
  install: (slug: string) => void;
  setRunning: (slug: string, running: boolean) => void;
}

export function useApplications(): UseApplications {
  const { connected, demoEmpty } = useHomeAssistant();

  const addonsV = useSyncExternalStore(subscribeAddons, getAddonsVersion, getServerAddonsVersion);
  const overridesV = useSyncExternalStore(subscribeOverrides, getOverridesVersion, getServerOverridesVersion);

  useEffect(() => {
    if (!connected) return;
    loadAddons();
  }, [connected]);

  const catalog = useMemo<ApplicationSummary[]>(() => {
    const live = connected && addonsStore.store.length > 0;
    const base = live
      ? (() => {
          const installedBySlug = new Map(addonsStore.installed.map((a) => [a.slug, a]));
          const bySlug = new Map<string, ApplicationSummary>();
          for (const addon of addonsStore.store) {
            bySlug.set(addon.slug, fromAddon(addon, installedBySlug.get(addon.slug)));
          }
          // Installed-but-not-in-store (a removed repository) would vanish otherwise.
          for (const addon of addonsStore.installed) {
            if (!bySlug.has(addon.slug)) bySlug.set(addon.slug, fromAddon(addon, addon));
          }
          return [...bySlug.values()];
        })()
      // A brand-new install has an add-on store to browse but nothing installed
      // from it yet — so the emptied demo keeps the catalogue, minus every
      // "you already run this" flag (which is what the sidebar lists).
      : demoEmpty
        ? DEMO_CATALOG.map((app) => ({ ...app, installed: false, running: false, version: null, updateAvailable: false }))
        : DEMO_CATALOG;
    return base.map((app) => {
      const override = overrides.get(app.slug);
      return override ? { ...app, ...override } : app;
    });
    // The two version counters are the reactive handle on the module stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, demoEmpty, addonsV, overridesV]);

  const apps = useMemo(() => catalog.filter((a) => a.installed), [catalog]);

  const install = useCallback((slug: string) => patchApp(slug, { installed: true, running: true }), []);
  const setRunning = useCallback((slug: string, running: boolean) => patchApp(slug, { running }), []);

  return {
    apps,
    catalog,
    loading: connected && !addonsLoaded,
    live: connected && addonsStore.store.length > 0,
    install,
    setRunning,
  };
}
