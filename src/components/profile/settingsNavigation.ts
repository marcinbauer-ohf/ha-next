'use client';

import {
  mdiAccountCircle,
  mdiAccountGroup,
  mdiAccountKey,
  mdiAlphaDBox,
  mdiHomeVariant,
  mdiApi,
  mdiBackupRestore,
  mdiBell,
  mdiCalendarClock,
  mdiChartLine,
  mdiChip,
  mdiCodeBraces,
  mdiCodeJson,
  mdiCog,
  mdiDatabase,
  mdiDevices,
  mdiHarddisk,
  mdiLightbulbGroup,
  mdiLightningBolt,
  mdiMap,
  mdiMapMarker,
  mdiMessageText,
  mdiMicrophone,
  mdiNetwork,
  mdiPuzzle,
  mdiRestart,
  mdiRobot,
  mdiScriptText,
  mdiShape,
  mdiSitemap,
  mdiSolarPanel,
  mdiTag,
  mdiTextBox,
  mdiUpdate,
  mdiViewDashboard,
  mdiWeb,
  mdiWrench,
} from '@mdi/js';

export type SettingsSlug =
  | 'home-center'
  // Notifications lives in the System group; updates/repairs/connectivity stay
  // routable but hidden from the sidebar (reached from Home Center).
  | 'notifications'
  | 'updates'
  | 'repairs'
  | 'connectivity'
  // User profile (reached from the profile card, not shown in the sidebar)
  | 'profile'
  // Prototype & debug tools (single consolidated page)
  | 'developer'
  // My Home
  | 'areas'
  | 'zones'
  | 'floors'
  | 'people'
  | 'users'
  // Devices
  | 'integrations'
  | 'devices'
  | 'entities'
  | 'helpers'
  // Automation
  | 'automations'
  | 'scenes'
  | 'scripts'
  | 'blueprints'
  // Voice & AI
  | 'voice-assistants'
  | 'conversation-agents'
  // Energy
  | 'energy-dashboard'
  | 'energy-config'
  // System
  | 'system-general'
  | 'system-network'
  | 'system-storage'
  | 'system-logs'
  | 'system-info'
  | 'backups'
  | 'restart'
  // HA Developer Tools
  | 'dev-states'
  | 'dev-services'
  | 'dev-templates'
  | 'dev-events'
  | 'dev-statistics'
  | 'dev-yaml'
  // Dashboards & Tags
  | 'manage-dashboards'
  | 'tags';

export interface SettingsNavLink {
  slug: SettingsSlug;
  icon: string;
  label: string;
  description: string;
  haPath?: string;
  /**
   * Singular noun for the "Add …" action in the top-bar + menu, e.g. 'Area'.
   * Only set on sections where creating a new item makes sense; absence means
   * the section is not offered in the Add menu.
   */
  addLabel?: string;
}

export interface SettingsNavSection {
  title: string;
  items: SettingsNavLink[];
}

// Colored icon-tile accent per category, keyed by section title (top single-item
// section is ''). Explicit hues — not theme-aware, so they won't adapt to
// eink/fallout etc.; revisit if those themes need their own palette.
export const categoryAccents: Record<string, string> = {
  '': '#18bcf2', // Home Center
  'My Home': '#2aa361',
  Devices: '#18bcf2',
  Automation: '#8b5cf6',
  'Voice & AI': '#14b8a6',
  Energy: '#eab308',
  System: '#64748b',
  'Developer Tools': '#6366f1',
  'Dashboards & Tags': '#ec4899',
  'Prototype Debugging Tools': '#f97316',
};

export const settingsNavSections: SettingsNavSection[] = [
  {
    title: '',
    items: [
      { slug: 'home-center', icon: mdiHomeVariant, label: 'Home Center', description: 'Notifications, updates, repairs, backups and connectivity' },
    ],
  },
  {
    title: 'Prototype Debugging Tools',
    items: [
      { slug: 'developer', icon: mdiAlphaDBox, label: 'Prototype & Debug Tools', description: 'Data, appearance, behavior, and prototyping flags' },
    ],
  },
  {
    title: 'My Home',
    items: [
      { slug: 'areas', icon: mdiMap, label: 'Areas & Floors', description: 'Rooms, spaces, and the floors they sit on', haPath: '/config/areas', addLabel: 'Area' },
      { slug: 'zones', icon: mdiMapMarker, label: 'Zones', description: 'Geographic zones for presence detection', haPath: '/config/zones', addLabel: 'Zone' },
      { slug: 'people', icon: mdiAccountGroup, label: 'People', description: 'Household members and presence tracking', haPath: '/config/people', addLabel: 'Person' },
      { slug: 'users', icon: mdiAccountKey, label: 'Users', description: 'User accounts and permissions', haPath: '/config/users', addLabel: 'User' },
    ],
  },
  {
    title: 'Devices',
    items: [
      { slug: 'integrations', icon: mdiPuzzle, label: 'Integrations', description: 'Connected services and platforms', haPath: '/config/integrations', addLabel: 'Integration' },
      { slug: 'devices', icon: mdiDevices, label: 'Devices', description: 'All registered devices', haPath: '/config/devices', addLabel: 'Device' },
      { slug: 'entities', icon: mdiShape, label: 'Entities', description: 'Individual data points and controls', haPath: '/config/entities' },
      { slug: 'helpers', icon: mdiWrench, label: 'Helpers', description: 'Virtual entities and input helpers', haPath: '/config/helpers', addLabel: 'Helper' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { slug: 'automations', icon: mdiRobot, label: 'Automations', description: 'Rules that control your home automatically', haPath: '/config/automation', addLabel: 'Automation' },
      { slug: 'scenes', icon: mdiLightbulbGroup, label: 'Scenes', description: 'Saved device states applied at once', haPath: '/config/scene', addLabel: 'Scene' },
      { slug: 'scripts', icon: mdiScriptText, label: 'Scripts', description: 'Reusable sequences of actions', haPath: '/config/script', addLabel: 'Script' },
      { slug: 'blueprints', icon: mdiSitemap, label: 'Blueprints', description: 'Community automation templates', haPath: '/config/blueprint', addLabel: 'Blueprint' },
    ],
  },
  {
    title: 'Voice & AI',
    items: [
      { slug: 'voice-assistants', icon: mdiMicrophone, label: 'Voice Assistants', description: 'Assist pipelines and wake words', haPath: '/config/voice-assistants', addLabel: 'Voice Assistant' },
      { slug: 'conversation-agents', icon: mdiMessageText, label: 'Conversation Agents', description: 'AI agents and conversation config', haPath: '/config/voice-assistants', addLabel: 'Conversation Agent' },
    ],
  },
  {
    title: 'Energy',
    items: [
      { slug: 'energy-dashboard', icon: mdiLightningBolt, label: 'Energy Dashboard', description: 'Monitor consumption and generation', haPath: '/energy' },
      { slug: 'energy-config', icon: mdiSolarPanel, label: 'Energy Configuration', description: 'Meters, solar, battery, and pricing', haPath: '/config/energy' },
    ],
  },
  {
    title: 'System',
    items: [
      { slug: 'system-general', icon: mdiCog, label: 'General', description: 'Timezone, language, location, and updates', haPath: '/config/system/general' },
      { slug: 'system-network', icon: mdiNetwork, label: 'Network', description: 'Network interfaces and proxy settings', haPath: '/config/system/network' },
      { slug: 'system-storage', icon: mdiHarddisk, label: 'Storage', description: 'Disk usage and storage management', haPath: '/config/system/storage' },
      { slug: 'system-logs', icon: mdiTextBox, label: 'Logs', description: 'System logs and debug information', haPath: '/config/system/logs' },
      { slug: 'system-info', icon: mdiChip, label: 'System Info', description: 'Hardware, OS, and version details', haPath: '/config/system/info' },
      { slug: 'notifications', icon: mdiBell, label: 'Notifications', description: 'Active notifications from your home' },
      { slug: 'backups', icon: mdiBackupRestore, label: 'Backups', description: 'Create, restore, and manage backups', haPath: '/config/backup', addLabel: 'Backup' },
      { slug: 'restart', icon: mdiRestart, label: 'Restart / Shutdown', description: 'Restart or shut down Home Assistant', haPath: '/config/system/general' },
    ],
  },
  {
    title: 'Developer Tools',
    items: [
      { slug: 'dev-states', icon: mdiDatabase, label: 'States', description: 'View and modify entity states', haPath: '/developer-tools/state' },
      { slug: 'dev-services', icon: mdiApi, label: 'Services', description: 'Manually call any service or action', haPath: '/developer-tools/service' },
      { slug: 'dev-templates', icon: mdiCodeBraces, label: 'Templates', description: 'Test Jinja2 templates', haPath: '/developer-tools/template' },
      { slug: 'dev-events', icon: mdiCalendarClock, label: 'Events', description: 'Fire and listen to HA events', haPath: '/developer-tools/event' },
      { slug: 'dev-statistics', icon: mdiChartLine, label: 'Statistics', description: 'View and adjust long-term statistics', haPath: '/developer-tools/statistics' },
      { slug: 'dev-yaml', icon: mdiCodeJson, label: 'YAML', description: 'Check config and reload components', haPath: '/developer-tools/yaml' },
    ],
  },
  {
    title: 'Dashboards & Tags',
    items: [
      { slug: 'manage-dashboards', icon: mdiViewDashboard, label: 'Dashboards', description: 'Create and manage Lovelace dashboards', haPath: '/config/lovelace/dashboards', addLabel: 'Dashboard' },
      { slug: 'tags', icon: mdiTag, label: 'Tags', description: 'NFC tags and QR codes for automations', haPath: '/config/tags', addLabel: 'Tag' },
    ],
  },
];

// Home Center sub-pages. Routable (so /settings/<slug> resolves) but intentionally
// kept out of settingsNavSections so they don't appear in the settings sidebar —
// they are reached from the Home Center page's section links.
export const hiddenSettingsLinks: SettingsNavLink[] = [
  { slug: 'updates', icon: mdiUpdate, label: 'Updates', description: 'Available updates for integrations and add-ons' },
  { slug: 'repairs', icon: mdiWrench, label: 'Repairs', description: 'Suggested fixes for your setup' },
  { slug: 'connectivity', icon: mdiWeb, label: 'Connectivity', description: 'Home Assistant and remote access status' },
  { slug: 'profile', icon: mdiAccountCircle, label: 'Profile', description: 'Your account, language, and dashboard preferences', haPath: '/profile' },
];

export const allSettingsLinks: SettingsNavLink[] = [
  ...settingsNavSections.flatMap(s => s.items),
  ...hiddenSettingsLinks,
];

// Items offered in the top-bar "+" (AddMenu), derived from the settings nav so
// the two stay in sync. Preserves settings order; carries the section's accent
// hue for the icon tile.
export interface AddableSettingsItem {
  slug: SettingsSlug;
  /** "Add <label>" — singular noun. */
  label: string;
  icon: string;
  accent: string;
}

export const addableSettingsItems: AddableSettingsItem[] = settingsNavSections.flatMap(
  (section) => {
    const accent = categoryAccents[section.title] ?? '#64748b';
    return section.items
      .filter((item) => item.addLabel)
      .map((item) => ({ slug: item.slug, label: item.addLabel!, icon: item.icon, accent }));
  },
);

// Slugs that render real, built-out content rather than the "In production this
// connects to <haPath>" placeholder. Everything else is grayed out in the nav.
// Keep in sync with the dedicated branches in SettingsDetailPage.
const IMPLEMENTED_SETTINGS_SLUGS = new Set<SettingsSlug>([
  'home-center',
  'developer',
  'integrations',
  'devices',
  'areas',
  'automations',
  'notifications',
  'updates',
  'repairs',
  'connectivity',
]);

/** True when the section has its own built-out UI (not just the haPath stub). */
export function settingsHasContent(slug: SettingsSlug): boolean {
  return IMPLEMENTED_SETTINGS_SLUGS.has(slug);
}

export function getSettingsHref(slug: SettingsSlug): string {
  return `/settings/${slug}`;
}

export function isSettingsSlug(value: string): value is SettingsSlug {
  return allSettingsLinks.some(item => item.slug === value);
}
