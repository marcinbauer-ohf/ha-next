'use client';

import {
  mdiAlphaDBox,
  mdiCellphone,
  mdiCloud,
  mdiCog,
  mdiInformation,
  mdiPalette,
  mdiShieldAccount,
  mdiViewDashboard,
} from '@mdi/js';

export type SettingsSlug =
  | 'interface'
  | 'dashboards'
  | 'cloud'
  | 'mobile-app'
  | 'system'
  | 'about'
  | 'security'
  | 'developer';

export interface SettingsNavLink {
  slug: SettingsSlug;
  icon: string;
  label: string;
  description: string;
}

export interface SettingsNavSection {
  title: string;
  items: SettingsNavLink[];
}

export const settingsQuickActions: SettingsNavLink[] = [
  {
    slug: 'security',
    icon: mdiShieldAccount,
    label: 'Security',
    description: 'Sessions, approvals, and trusted access',
  },
  {
    slug: 'developer',
    icon: mdiAlphaDBox,
    label: 'Dev Tools',
    description: 'Preview flags, mocks, and diagnostics',
  },
];

export const settingsNavSections: SettingsNavSection[] = [
  {
    title: 'User Interface',
    items: [
      {
        slug: 'interface',
        icon: mdiPalette,
        label: 'Theme and Display',
        description: 'Theme preset, mode, and background',
      },
      {
        slug: 'dashboards',
        icon: mdiViewDashboard,
        label: 'Dashboards',
        description: 'Default landing page and room layout',
      },
    ],
  },
  {
    title: 'Connection and App',
    items: [
      {
        slug: 'cloud',
        icon: mdiCloud,
        label: 'Home Assistant Cloud',
        description: 'Remote access, backups, and voice',
      },
      {
        slug: 'mobile-app',
        icon: mdiCellphone,
        label: 'Companion App',
        description: 'Devices, notifications, and sensors',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        slug: 'system',
        icon: mdiCog,
        label: 'General Settings',
        description: 'Behavior, automation, and services',
      },
      {
        slug: 'about',
        icon: mdiInformation,
        label: 'About Home Assistant',
        description: 'Version, build details, and release notes',
      },
    ],
  },
];

export function getSettingsHref(slug: SettingsSlug): string {
  return `/settings/${slug}`;
}

export function isSettingsSlug(value: string): value is SettingsSlug {
  return [
    'interface',
    'dashboards',
    'cloud',
    'mobile-app',
    'system',
    'about',
    'security',
    'developer',
  ].includes(value);
}
