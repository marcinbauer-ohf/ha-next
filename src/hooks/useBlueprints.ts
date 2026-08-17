'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  mdiAccountGroupOutline,
  mdiBellOutline,
  mdiLightbulbOnOutline,
  mdiRemote,
  mdiThermostat,
  mdiWrenchClock,
} from '@mdi/js';
import { getBlueprints, type BlueprintListItem } from '@/lib/homeassistant/connection';
import { useHomeAssistant } from './useHomeAssistant';

// ─────────────────────────────────────────────────────────────────────────────
// Blueprints — ready-made automations you fill in the blanks on. The installed
// list is real (blueprint/list over the websocket); the store is a curated
// catalogue, because Home Assistant has no blueprint index to query — importing
// one is a URL, so the store's job is to be the browsable front for that.
// ─────────────────────────────────────────────────────────────────────────────

export type BlueprintCategory = 'Lighting' | 'Presence' | 'Notifications' | 'Remotes' | 'Climate' | 'Maintenance';

export interface BlueprintSummary {
  /** Registry path for installed ones, catalogue id otherwise. */
  id: string;
  name: string;
  tagline: string;
  category: BlueprintCategory;
  icon: string;
  accent: string;
  author: string;
  domain: 'automation' | 'script';
  installed: boolean;
  sourceUrl?: string;
  description?: string;
}

const CATEGORY_META: Record<BlueprintCategory, { icon: string; accent: string }> = {
  Lighting: { icon: mdiLightbulbOnOutline, accent: '#f59e0b' },
  Presence: { icon: mdiAccountGroupOutline, accent: '#2aa361' },
  Notifications: { icon: mdiBellOutline, accent: '#18bcf2' },
  Remotes: { icon: mdiRemote, accent: '#8b5cf6' },
  Climate: { icon: mdiThermostat, accent: '#ef4444' },
  Maintenance: { icon: mdiWrenchClock, accent: '#64748b' },
};

function make(
  id: string,
  name: string,
  tagline: string,
  category: BlueprintCategory,
  author: string,
  extra: Partial<BlueprintSummary> = {},
): BlueprintSummary {
  return {
    id,
    name,
    tagline,
    category,
    icon: CATEGORY_META[category].icon,
    accent: CATEGORY_META[category].accent,
    author,
    domain: 'automation',
    installed: false,
    ...extra,
  };
}

// Curated catalogue — the blueprints people reach for first.
const CATALOG: BlueprintSummary[] = [
  make('homeassistant/motion_light.yaml', 'Motion-activated light', 'Turn a light on when there is movement, off when there is none.', 'Lighting', 'Home Assistant', {
    description: 'Pick a motion sensor and a light. The light comes on when movement starts and goes off again after the wait you choose.',
  }),
  make('homeassistant/notify_leaving_zone.yaml', 'Notify when someone leaves a zone', 'A message the moment someone heads out.', 'Presence', 'Home Assistant', {
    description: 'Choose a person and a zone, and get a notification on the device you pick whenever they leave it.',
  }),
  make('community/low_battery.yaml', 'Low battery warning', 'Hear about flat batteries before the sensor goes quiet.', 'Maintenance', 'Community', {
    description: 'Checks every battery in your home on a schedule and sends one message listing whatever is below the level you set.',
  }),
  make('community/sunset_lights.yaml', 'Lights at sunset', 'Bring the house up as the light goes down.', 'Lighting', 'Community'),
  make('community/wake_up_light.yaml', 'Wake-up light', 'A slow sunrise in the bedroom before the alarm.', 'Lighting', 'Community'),
  make('community/leaving_home.yaml', 'Everything off when the last person leaves', 'One tidy-up when the house empties.', 'Presence', 'Community'),
  make('community/hue_dimmer.yaml', 'Philips Hue dimmer switch', 'All four buttons, mapped the way you want.', 'Remotes', 'Community'),
  make('community/ikea_remote.yaml', 'IKEA five-button remote', 'Put an IKEA remote in charge of anything.', 'Remotes', 'Community'),
  make('community/doorbell_announce.yaml', 'Doorbell announcement', 'Say it out loud on the speakers you choose.', 'Notifications', 'Community'),
  make('community/washer_done.yaml', 'Washing machine finished', 'A nudge when the cycle ends, and again if you ignore it.', 'Notifications', 'Community'),
  make('community/thermostat_schedule.yaml', 'Heating schedule', 'A temperature per part of the day, without the fiddling.', 'Climate', 'Community'),
  make('community/window_open_heating.yaml', 'Pause heating on an open window', 'Stop warming the street.', 'Climate', 'Community'),
];

// ── Installed blueprints (real) + prototype-local imports ───────────────────
// ponytail: import is local-only; wire to the `blueprint/import` websocket
// command when the prototype should write to the real config.

let installedStore: BlueprintListItem[] = [];
let installedLoaded = false;
let inFlight: Promise<void> | null = null;
/** Added during this session — from the store or pasted as a link. */
const imported: BlueprintSummary[] = [];
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getVersion = () => version;
const getServerVersion = () => 0;

function bump(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function load(): Promise<void> {
  if (inFlight) return inFlight;
  if (installedLoaded) return Promise.resolve();
  inFlight = getBlueprints()
    .then((list) => {
      installedStore = list;
      installedLoaded = true;
      bump();
    })
    .catch(() => {})
    .finally(() => { inFlight = null; });
  return inFlight;
}

/** Guess a category from the name so real blueprints get a tile colour too. */
function categoryFor(name: string): BlueprintCategory {
  const n = name.toLowerCase();
  if (/light|lamp|brightness|dim/.test(n)) return 'Lighting';
  if (/zone|presence|arriv|leav|person/.test(n)) return 'Presence';
  if (/notif|alert|announce|message/.test(n)) return 'Notifications';
  if (/remote|button|switch|dimmer/.test(n)) return 'Remotes';
  if (/heat|cool|thermo|temperature|climate/.test(n)) return 'Climate';
  return 'Maintenance';
}

function fromRegistry(item: BlueprintListItem): BlueprintSummary {
  const category = categoryFor(item.name);
  return {
    id: item.path,
    name: item.name,
    tagline: item.description?.split('\n')[0] ?? 'Ready-made automation.',
    category,
    icon: CATEGORY_META[category].icon,
    accent: CATEGORY_META[category].accent,
    author: item.author ?? 'Home Assistant',
    domain: item.domain,
    installed: true,
    sourceUrl: item.sourceUrl,
    description: item.description,
  };
}

/** "…/t/motion-activated-light/12345" → "Motion activated light". */
function nameFromUrl(url: string): string {
  const slug = url.split('?')[0].replace(/\/+$/, '').split('/').filter((p) => !/^\d+$/.test(p)).pop() ?? 'Imported blueprint';
  const words = slug.replace(/[-_]+/g, ' ').replace(/\.(yaml|yml)$/i, '').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Imported blueprint';
}

export function useBlueprints(): {
  blueprints: BlueprintSummary[];
  catalog: BlueprintSummary[];
  loading: boolean;
  importBlueprint: (id: string) => void;
  importFromUrl: (url: string) => void;
} {
  const { connected } = useHomeAssistant();
  const v = useSyncExternalStore(subscribe, getVersion, getServerVersion);

  useEffect(() => {
    if (!connected) return;
    load();
  }, [connected]);

  const { blueprints, catalog } = useMemo(() => {
    const live = installedStore.map(fromRegistry);
    const ids = new Set([...live.map((b) => b.id), ...imported.map((b) => b.id)]);
    const cat = CATALOG.map((b) => (ids.has(b.id) ? { ...b, installed: true } : b));
    // Installed = what the home really has, plus anything added this session.
    return { blueprints: [...live, ...imported.filter((b) => !live.some((l) => l.id === b.id))], catalog: cat };
    // `v` is the reactive handle on the module store above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const importBlueprint = useCallback((id: string) => {
    const item = CATALOG.find((b) => b.id === id);
    if (!item || imported.some((b) => b.id === id)) return;
    imported.push({ ...item, installed: true });
    bump();
  }, []);

  const importFromUrl = useCallback((url: string) => {
    if (imported.some((b) => b.id === url)) return;
    imported.push({
      id: url,
      name: nameFromUrl(url),
      tagline: 'Added from a link.',
      category: 'Maintenance',
      icon: CATEGORY_META.Maintenance.icon,
      accent: CATEGORY_META.Maintenance.accent,
      author: 'Imported',
      domain: 'automation',
      installed: true,
      sourceUrl: url,
    });
    bump();
  }, []);

  return { blueprints, catalog, loading: connected && !installedLoaded, importBlueprint, importFromUrl };
}
