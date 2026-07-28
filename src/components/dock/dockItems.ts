'use client';

import {
  mdiAccountCircle,
  mdiBell,
  mdiCalendarClock,
  mdiChartLine,
  mdiFormatListChecks,
  mdiHomeVariant,
  mdiLightningBolt,
  mdiMapMarker,
  mdiPlayCircle,
  mdiShieldLockOutline,
  mdiTextBox,
  mdiUpdate,
  mdiViewDashboard,
  mdiViewGridOutline,
  mdiWrench,
} from '@mdi/js';
import { settingsNavSections, categoryAccents } from '@/components/profile/settingsNavigation';
import type { HaPanel } from '@/lib/homeassistant';

/** Anything the user can pin to the dock: an HA page, a dashboard, or an app. */
export interface DockItem {
  /** Stable pin key — `page:<slug>`, `dash:<url_path>` or `app:<url_path>`. */
  id: string;
  label: string;
  category: string;
  description?: string;
  /** MDI path, for the bundled settings-nav icons (rendered by <Icon>). */
  icon?: string;
  /** `mdi:name` string straight from HA, for panels (rendered by <MdiIcon>). */
  mdiName?: string;
  /** Path on the HA instance (e.g. `/config/areas`), for embedding or opening. */
  path?: string;
  /** Render the user's picture instead of an icon tile (the profile row). */
  avatar?: boolean;
}

/**
 * How the overlay was opened. `menu` = browsing from the hamburger, so the
 * category list stays alongside the content; `page` = a pinned dock item or
 * search hit, where the content gets the whole surface on its own.
 */
export type MenuMode = 'menu' | 'page';

export interface DockCategory {
  title: string;
  accent: string;
  items: DockItem[];
}

/**
 * Pulled out of the generated sections and placed by hand below: the "You" card
 * (profile, security), Home Center at the very top, and Cloud on its own.
 */
const LIFTED_SLUGS = new Set(['profile', 'notifications', 'home-center', 'cloud']);

export const HOME_CENTER_ID = 'page:home-center';
export const NOTIFICATIONS_ID = 'page:notifications';

/**
 * What Home Center collects. Notifications has no page of its own on the
 * instance, so it renders from the live `persistent_notification.*` entities;
 * the other two are real HA pages.
 */
export const HOME_CENTER_ITEMS: DockItem[] = [
  {
    id: NOTIFICATIONS_ID,
    label: 'Notifications',
    description: 'Active notifications from your home',
    icon: mdiBell,
    category: 'Home Center',
  },
  {
    id: 'page:updates',
    label: 'Updates',
    description: 'Available updates for integrations and add-ons',
    icon: mdiUpdate,
    path: '/config/updates',
    category: 'Home Center',
  },
  {
    id: 'page:repairs',
    label: 'Repairs',
    description: 'Suggested fixes for your setup',
    icon: mdiWrench,
    path: '/config/repairs',
    category: 'Home Center',
  },
];

/**
 * Account-level things, first card in the menu, with Home Center leading it —
 * it's the landing page, so it's also the first thing in the list.
 */
export const HOME_CENTER_ITEM: DockItem = {
  id: HOME_CENTER_ID,
  label: 'Home Center',
  description: 'Notifications, updates and repairs',
  icon: mdiHomeVariant,
  category: 'You',
};

const YOU_CATEGORY: DockCategory = {
  title: 'You',
  accent: '#8b5cf6',
  items: [
    HOME_CENTER_ITEM,
    {
      id: 'page:profile',
      label: 'Profile',
      description: 'Your account, language and dashboard preferences',
      icon: mdiAccountCircle,
      path: '/profile',
      category: 'You',
      avatar: true,
    },
    {
      id: 'page:security',
      label: 'Security',
      description: 'Password, two-factor and active sessions',
      icon: mdiShieldLockOutline,
      path: '/profile/security',
      category: 'You',
    },
  ],
};

/** Nabu Casa Cloud, lifted out of the top section into a card of its own. */
const CLOUD_CATEGORY: DockCategory = {
  title: 'Cloud',
  accent: '#18bcf2',
  items: settingsNavSections
    .flatMap((section) => section.items)
    .filter((item) => item.slug === 'cloud')
    .map((item) => ({
      id: `page:${item.slug}`,
      label: item.label,
      description: item.description,
      icon: item.icon,
      path: item.haPath,
      category: 'Cloud',
    })),
};

/**
 * Drill-in for the HA apps (Energy, Map, History…). They live behind a single
 * "My Home" row rather than as their own card: the list is unbounded, and a
 * settings menu isn't the place to enumerate it.
 */
export const APPLICATIONS_ID = 'page:applications';

const APPLICATIONS_ITEM: DockItem = {
  id: APPLICATIONS_ID,
  label: 'Applications',
  description: 'Energy, map, history and the rest of your Home Assistant apps',
  icon: mdiViewGridOutline,
  category: 'My Home',
};

/**
 * Every HA settings page and sub-page, grouped the way the settings nav already
 * groups them, with the "You" card first. The prototype-tools section is
 * dropped; it isn't a real HA page.
 */
export const PAGE_CATEGORIES: DockCategory[] = [
  YOU_CATEGORY,
  CLOUD_CATEGORY,
  ...settingsNavSections
    .filter((section) => section.title !== 'Prototype Debugging Tools')
    .map((section) => ({
      title: section.title || 'Overview',
      accent: categoryAccents[section.title] ?? '#18bcf2',
      items: [
        ...section.items
          .filter((item) => !LIFTED_SLUGS.has(item.slug))
          .map((item) => ({
            id: `page:${item.slug}`,
            label: item.label,
            description: item.description,
            icon: item.icon,
            path: item.haPath,
            category: section.title || 'Overview',
          })),
        // Dashboards already has a row here (manage-dashboards); Applications
        // joins it so neither needs a card of its own.
        ...(section.title === 'My Home' ? [APPLICATIONS_ITEM] : []),
      ],
    }))
    .filter((section) => section.items.length > 0),
];

const ALL_PAGES = new Map(
  [...PAGE_CATEGORIES.flatMap((c) => c.items), ...HOME_CENTER_ITEMS].map((i) => [i.id, i]),
);

/** Cards pinned to the top of the mega menu, in this order. */
const MENU_ORDER = ['You', 'Cloud', 'Overview', 'Devices', 'My Home'];

/**
 * Order the menu's cards. Anything not named above keeps its natural position
 * after them — `sort` is stable, so the live Dashboards/Apps cards stay ahead of
 * the remaining settings groups.
 */
export function orderCategories(categories: DockCategory[]): DockCategory[] {
  const rank = (title: string) => {
    const index = MENU_ORDER.indexOf(title);
    return index === -1 ? MENU_ORDER.length : index;
  };
  return [...categories].sort((a, b) => rank(a.title) - rank(b.title));
}

/** Fallback glyphs for the built-in HA panels that report no icon of their own. */
const APP_ICONS: Record<string, string> = {
  energy: mdiLightningBolt,
  map: mdiMapMarker,
  history: mdiChartLine,
  logbook: mdiTextBox,
  calendar: mdiCalendarClock,
  todo: mdiFormatListChecks,
  'media-browser': mdiPlayCircle,
};

/** Panels that duplicate the settings catalog — skip so they aren't listed twice. */
const SKIP_PANELS = new Set(['config', 'developer-tools', 'profile', 'lovelace-dashboards']);

/**
 * Built-in panels HA reports with no title of its own — its frontend labels them
 * from translations, which we can't read, and prettifying the url_path gives
 * "Lovelace" for the default dashboard.
 */
const BUILTIN_TITLES: Record<string, string> = {
  lovelace: 'Home',
  'media-browser': 'Media',
};

function prettify(urlPath: string): string {
  return urlPath.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Split the live `get_panels` response into the two things the dock cares about:
 * the user's real dashboards, and the real HA apps in their sidebar. Both come
 * from the connected instance — this is the user's own home, not sample data.
 */
export function panelsToCategories(panels: Record<string, HaPanel>): DockCategory[] {
  const dashboards: DockItem[] = [];
  const apps: DockItem[] = [];

  for (const panel of Object.values(panels)) {
    if (SKIP_PANELS.has(panel.url_path)) continue;
    const isDashboard = panel.component_name === 'lovelace';
    const item: DockItem = {
      id: `${isDashboard ? 'dash' : 'app'}:${panel.url_path}`,
      label: panel.title || BUILTIN_TITLES[panel.url_path] || prettify(panel.url_path),
      category: isDashboard ? 'Dashboards' : 'Apps',
      mdiName: panel.icon ?? undefined,
      icon: panel.icon ? undefined : APP_ICONS[panel.component_name] ?? mdiViewDashboard,
      path: `/${panel.url_path}`,
    };
    (isDashboard ? dashboards : apps).push(item);
  }

  return [
    ...(dashboards.length ? [{ title: 'Dashboards', accent: '#f59e0b', items: dashboards }] : []),
    ...(apps.length ? [{ title: 'Apps', accent: '#ec4899', items: apps }] : []),
  ];
}

/** Resolve a pinned id back to its item, checking the live panels first. */
export function resolveDockItem(id: string, live: DockItem[]): DockItem | undefined {
  return live.find((d) => d.id === id) ?? ALL_PAGES.get(id);
}

/** Pins the dock starts with, so the proof-of-concept is never empty. */
export const DEFAULT_PINS = ['page:areas', 'page:devices', 'page:automations', 'page:system-logs'];

const PINS_KEY = 'ha_dock_pins_v1';

export function loadPins(): string[] {
  if (typeof window === 'undefined') return DEFAULT_PINS;
  try {
    const raw = window.localStorage.getItem(PINS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as string[]) : DEFAULT_PINS;
  } catch {
    return DEFAULT_PINS;
  }
}

export function savePins(pins: string[]) {
  try {
    window.localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  } catch {
    // Private mode / quota — pins just don't survive the reload.
  }
}

/** Droppable id for the pinned strip; drops elsewhere mean "remove". */
export const DOCK_DROPPABLE_ID = 'dock-strip';

/** The avatar is a fixed asset in /public — see DockBar. */

/**
 * Lovelace-backed items (`dash:`) are a dashboard surface in their own right, so
 * they render as-is straight onto the grey background. Everything else — settings
 * pages and the built-in HA apps, none of which use the Lovelace engine — gets
 * the big white card surface instead.
 */
export function usesLovelace(id: string): boolean {
  return id.startsWith('dash:');
}
