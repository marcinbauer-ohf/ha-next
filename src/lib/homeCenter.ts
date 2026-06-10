import {
  mdiBackupRestore,
  mdiBatteryAlertVariantOutline,
  mdiBell,
  mdiDevices,
  mdiUpdate,
  mdiWeb,
  mdiWrench,
} from '@mdi/js';

// The Home Center surfaces (settings page, dashboard clock popup, screensaver)
// all render the same set of status sections in the same configurable order.
// This registry is the single source of truth for that set.
export type HomeCenterSectionId =
  | 'notifications'
  | 'updates'
  | 'repairs'
  | 'issues'
  | 'battery'
  | 'backups'
  | 'connectivity';

export interface HomeCenterSectionDef {
  id: HomeCenterSectionId;
  /** Full label used on cards and the settings editor. */
  label: string;
  /** Tooltip / one-line explanation in the editor. */
  description: string;
  icon: string;
  /** Tailwind colour for the indicator dot/badge when this section has activity. */
  dotClass: string;
  /** Locked sections are always shown and cannot be toggled off. */
  locked?: boolean;
}

// Default display order. Connectivity is locked on and intentionally last —
// it's the "is my home reachable" anchor that should always be present.
export const HOME_CENTER_SECTIONS: HomeCenterSectionDef[] = [
  { id: 'notifications', label: 'Notifications', description: 'Active notifications from your home', icon: mdiBell, dotClass: 'bg-yellow-500' },
  { id: 'updates', label: 'Updates', description: 'Available updates for integrations and add-ons', icon: mdiUpdate, dotClass: 'bg-ha-blue' },
  { id: 'repairs', label: 'Repairs', description: 'Issues Home Assistant suggests you fix', icon: mdiWrench, dotClass: 'bg-orange-500' },
  { id: 'issues', label: 'Offline devices', description: 'Devices that are unavailable or unreachable', icon: mdiDevices, dotClass: 'bg-red-500' },
  { id: 'battery', label: 'Low battery', description: 'Devices running low on battery', icon: mdiBatteryAlertVariantOutline, dotClass: 'bg-amber-500' },
  { id: 'backups', label: 'Backups', description: 'When your home was last backed up', icon: mdiBackupRestore, dotClass: 'bg-green-500' },
  { id: 'connectivity', label: 'Connectivity', description: 'Home Assistant and remote access status', icon: mdiWeb, dotClass: 'bg-green-500', locked: true },
];

export const HOME_CENTER_SECTION_MAP: Record<HomeCenterSectionId, HomeCenterSectionDef> =
  HOME_CENTER_SECTIONS.reduce((acc, section) => {
    acc[section.id] = section;
    return acc;
  }, {} as Record<HomeCenterSectionId, HomeCenterSectionDef>);

export const HOME_CENTER_SECTION_IDS: HomeCenterSectionId[] = HOME_CENTER_SECTIONS.map((s) => s.id);

export const DEFAULT_HOME_CENTER_ORDER: HomeCenterSectionId[] = [...HOME_CENTER_SECTION_IDS];

export function isHomeCenterSectionId(value: string): value is HomeCenterSectionId {
  return HOME_CENTER_SECTION_IDS.includes(value as HomeCenterSectionId);
}

/** Low-battery threshold (percent) below which a device surfaces in the battery section. */
export const LOW_BATTERY_THRESHOLD = 20;

/** Days since last backup beyond which the backup section warns. */
export const STALE_BACKUP_DAYS = 7;

/** Human-friendly "backed up N days ago" label + whether it's overdue. */
export function formatBackupAge(iso: string | null | undefined): { label: string; stale: boolean } {
  if (!iso) return { label: 'No backup found', stale: true };
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { label: 'No backup found', stale: true };
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  const stale = days > STALE_BACKUP_DAYS;
  if (days <= 0) return { label: 'Backed up today', stale };
  if (days === 1) return { label: 'Backed up yesterday', stale };
  return { label: `Backed up ${days} days ago`, stale };
}
