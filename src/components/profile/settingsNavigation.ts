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
  mdiLayers,
  mdiLightbulbGroup,
  mdiLightningBolt,
  mdiMap,
  mdiMapMarker,
  mdiMessageText,
  mdiMicrophone,
  mdiNetwork,
  mdiPalette,
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
  // Home Center sub-pages (routable, not shown in the settings sidebar)
  | 'notifications'
  | 'updates'
  | 'repairs'
  | 'connectivity'
  // User profile (reached from the profile card, not shown in the sidebar)
  | 'profile'
  // Prototype tools
  | 'dashboards'
  | 'theme-layout'
  | 'task-bar'
  | 'maintenance'
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
}

export interface SettingsNavSection {
  title: string;
  items: SettingsNavLink[];
}

export const settingsNavSections: SettingsNavSection[] = [
  {
    title: '',
    items: [
      { slug: 'home-center', icon: mdiHomeVariant, label: 'Home Center', description: 'Status, notifications, updates and connectivity' },
    ],
  },
  {
    title: 'My Home',
    items: [
      { slug: 'areas', icon: mdiMap, label: 'Areas', description: 'Rooms and spaces in your home', haPath: '/config/areas' },
      { slug: 'zones', icon: mdiMapMarker, label: 'Zones', description: 'Geographic zones for presence detection', haPath: '/config/zones' },
      { slug: 'floors', icon: mdiLayers, label: 'Floors', description: 'Organize areas across floors', haPath: '/config/areas' },
      { slug: 'people', icon: mdiAccountGroup, label: 'People', description: 'Household members and presence tracking', haPath: '/config/people' },
      { slug: 'users', icon: mdiAccountKey, label: 'Users', description: 'User accounts and permissions', haPath: '/config/users' },
    ],
  },
  {
    title: 'Devices',
    items: [
      { slug: 'integrations', icon: mdiPuzzle, label: 'Integrations', description: 'Connected services and platforms', haPath: '/config/integrations' },
      { slug: 'devices', icon: mdiDevices, label: 'Devices', description: 'All registered devices', haPath: '/config/devices' },
      { slug: 'entities', icon: mdiShape, label: 'Entities', description: 'Individual data points and controls', haPath: '/config/entities' },
      { slug: 'helpers', icon: mdiWrench, label: 'Helpers', description: 'Virtual entities and input helpers', haPath: '/config/helpers' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { slug: 'automations', icon: mdiRobot, label: 'Automations', description: 'Rules that control your home automatically', haPath: '/config/automation' },
      { slug: 'scenes', icon: mdiLightbulbGroup, label: 'Scenes', description: 'Saved device states applied at once', haPath: '/config/scene' },
      { slug: 'scripts', icon: mdiScriptText, label: 'Scripts', description: 'Reusable sequences of actions', haPath: '/config/script' },
      { slug: 'blueprints', icon: mdiSitemap, label: 'Blueprints', description: 'Community automation templates', haPath: '/config/blueprint' },
    ],
  },
  {
    title: 'Voice & AI',
    items: [
      { slug: 'voice-assistants', icon: mdiMicrophone, label: 'Voice Assistants', description: 'Assist pipelines and wake words', haPath: '/config/voice-assistants' },
      { slug: 'conversation-agents', icon: mdiMessageText, label: 'Conversation Agents', description: 'AI agents and conversation config', haPath: '/config/voice-assistants' },
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
      { slug: 'backups', icon: mdiBackupRestore, label: 'Backups', description: 'Create, restore, and manage backups', haPath: '/config/backup' },
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
      { slug: 'manage-dashboards', icon: mdiViewDashboard, label: 'Dashboards', description: 'Create and manage Lovelace dashboards', haPath: '/config/lovelace/dashboards' },
      { slug: 'tags', icon: mdiTag, label: 'Tags', description: 'NFC tags and QR codes for automations', haPath: '/config/tags' },
    ],
  },
  {
    title: 'Prototype Debugging Tools',
    items: [
      { slug: 'dashboards', icon: mdiViewDashboard, label: 'Dashboards', description: 'Device card layout and entity configuration' },
      { slug: 'theme-layout', icon: mdiPalette, label: 'Theme and Display', description: 'Theme, color mode, background, immersive mode, and screensaver' },
      { slug: 'task-bar', icon: mdiUpdate, label: 'Task Bar Activities', description: 'Release notes, media, timers, cameras, and printer mocks' },
      { slug: 'maintenance', icon: mdiCog, label: 'Maintenance', description: 'Connection mode, demo data, and layout reset' },
      { slug: 'developer', icon: mdiAlphaDBox, label: 'Developer Tools', description: 'Preview flags, mocks, and diagnostics' },
    ],
  },
];

// Home Center sub-pages. Routable (so /settings/<slug> resolves) but intentionally
// kept out of settingsNavSections so they don't appear in the settings sidebar —
// they are reached from the Home Center page's section links.
export const hiddenSettingsLinks: SettingsNavLink[] = [
  { slug: 'notifications', icon: mdiBell, label: 'Notifications', description: 'Active notifications from your home' },
  { slug: 'updates', icon: mdiUpdate, label: 'Updates', description: 'Available updates for integrations and add-ons' },
  { slug: 'repairs', icon: mdiDevices, label: 'Issues', description: 'Offline and unavailable devices' },
  { slug: 'connectivity', icon: mdiWeb, label: 'Connectivity', description: 'Home Assistant and remote access status' },
  { slug: 'profile', icon: mdiAccountCircle, label: 'Profile', description: 'Your account, language, and dashboard preferences', haPath: '/profile' },
];

export const allSettingsLinks: SettingsNavLink[] = [
  ...settingsNavSections.flatMap(s => s.items),
  ...hiddenSettingsLinks,
];

export function getSettingsHref(slug: SettingsSlug): string {
  return `/settings/${slug}`;
}

export function isSettingsSlug(value: string): value is SettingsSlug {
  return allSettingsLinks.some(item => item.slug === value);
}
