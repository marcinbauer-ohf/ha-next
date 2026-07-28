import {
  mdiLightbulbGroup,
  mdiThermostat,
  mdiLightningBolt,
  mdiAccountGroup,
  mdiShieldHome,
  mdiFan,
  mdiPlayCircle,
} from '@mdi/js';
import type { HassEntity } from '@/types';
import type { HassDevice } from '@/hooks/useDevices';

export type SpinCategoryId =
  | 'power'
  | 'presence'
  | 'lights'
  | 'climate'
  | 'security'
  | 'fans'
  | 'media';

export interface SpinCategory {
  id: SpinCategoryId;
  label: string;
  icon: string;
  /** Accent used for glows, active states and the 3D map highlight. */
  accent: string;
  matches: (entity: HassEntity) => boolean;
  /** Whether this entity counts as "active" (lit, playing, unlocked…). */
  isActive: (entity: HassEntity) => boolean;
}

const domain = (e: HassEntity) => e.entity_id.split('.')[0];
const deviceClass = (e: HassEntity) => (e.attributes.device_class as string | undefined) ?? '';

const SECURITY_BINARY = new Set(['door', 'window', 'garage_door', 'opening', 'lock', 'safety', 'tamper']);
const PRESENCE_BINARY = new Set(['motion', 'occupancy', 'presence']);

export const SPIN_CATEGORIES: SpinCategory[] = [
  {
    id: 'lights',
    label: 'Lights',
    icon: mdiLightbulbGroup,
    accent: '#ffd166',
    matches: (e) => domain(e) === 'light',
    isActive: (e) => e.state === 'on',
  },
  {
    id: 'climate',
    label: 'Climate',
    icon: mdiThermostat,
    accent: '#ff9f6b',
    matches: (e) =>
      domain(e) === 'climate' ||
      (domain(e) === 'sensor' && (deviceClass(e) === 'temperature' || deviceClass(e) === 'humidity')),
    isActive: (e) => domain(e) === 'climate' && e.state !== 'off' && e.state !== 'unavailable',
  },
  {
    id: 'power',
    label: 'Power',
    icon: mdiLightningBolt,
    accent: '#18bcf2',
    matches: (e) => domain(e) === 'sensor' && (deviceClass(e) === 'power' || deviceClass(e) === 'energy'),
    isActive: (e) => deviceClass(e) === 'power' && Number.parseFloat(e.state) > 1,
  },
  {
    id: 'presence',
    label: 'Presence',
    icon: mdiAccountGroup,
    accent: '#8be28b',
    matches: (e) =>
      domain(e) === 'person' || (domain(e) === 'binary_sensor' && PRESENCE_BINARY.has(deviceClass(e))),
    isActive: (e) => (domain(e) === 'person' ? e.state === 'home' : e.state === 'on'),
  },
  {
    id: 'security',
    label: 'Security',
    icon: mdiShieldHome,
    accent: '#c792ff',
    matches: (e) =>
      domain(e) === 'lock' ||
      domain(e) === 'alarm_control_panel' ||
      domain(e) === 'camera' ||
      (domain(e) === 'binary_sensor' && SECURITY_BINARY.has(deviceClass(e))),
    isActive: (e) => {
      const d = domain(e);
      if (d === 'lock') return e.state !== 'locked';
      if (d === 'alarm_control_panel') return e.state !== 'disarmed';
      if (d === 'binary_sensor') return e.state === 'on';
      return false;
    },
  },
  {
    id: 'fans',
    label: 'Fans',
    icon: mdiFan,
    accent: '#7fd8d8',
    matches: (e) => domain(e) === 'fan',
    isActive: (e) => e.state === 'on',
  },
  {
    id: 'media',
    label: 'Media',
    icon: mdiPlayCircle,
    accent: '#ff8fb2',
    matches: (e) => domain(e) === 'media_player',
    isActive: (e) => e.state === 'playing',
  },
];

export const SPIN_CATEGORY_MAP = new Map(SPIN_CATEGORIES.map((c) => [c.id, c]));

/** Domains the user can meaningfully toggle from a card. */
const TOGGLABLE = new Set(['light', 'switch', 'fan', 'media_player', 'lock', 'cover', 'climate', 'input_boolean']);

export function isTogglable(entity: HassEntity): boolean {
  return TOGGLABLE.has(domain(entity));
}

/** Devices carrying at least one entity of the category, with that entity picked as the card's lead. */
export interface CategoryDevice {
  device: HassDevice;
  lead: HassEntity;
  categoryEntities: HassEntity[];
}

export function devicesForCategory(devices: HassDevice[], category: SpinCategory): CategoryDevice[] {
  const out: CategoryDevice[] = [];
  for (const device of devices) {
    if (device.isService) continue;
    const matching = device.entities.filter(category.matches);
    if (matching.length === 0) continue;
    // Lead with something controllable when the device has one, else the first match.
    const lead = matching.find(isTogglable) ?? matching[0];
    out.push({ device, lead, categoryEntities: matching });
  }
  return out;
}

/** Area ids that contain at least one entity of the category. */
export function areasForCategory(devices: HassDevice[], category: SpinCategory): Set<string> {
  const ids = new Set<string>();
  for (const device of devices) {
    if (!device.areaId || device.isService) continue;
    if (device.entities.some(category.matches)) ids.add(device.areaId);
  }
  return ids;
}

/** Human state line for an entity, kept jargon-free. */
export function friendlyState(entity: HassEntity): string {
  const d = domain(entity);
  const unit = (entity.attributes.unit_of_measurement as string | undefined) ?? '';
  switch (d) {
    case 'light':
      if (entity.state !== 'on') return 'Off';
      {
        const bri = entity.attributes.brightness as number | undefined;
        return bri ? `On · ${Math.round((bri / 255) * 100)}%` : 'On';
      }
    case 'lock':
      return entity.state === 'locked' ? 'Locked' : 'Unlocked';
    case 'climate': {
      const current = entity.attributes.current_temperature as number | undefined;
      const target = entity.attributes.temperature as number | undefined;
      const mode = entity.state === 'off' ? 'Off' : entity.state.charAt(0).toUpperCase() + entity.state.slice(1);
      if (current != null && target != null) return `${mode} · ${current}° → ${target}°`;
      if (current != null) return `${mode} · ${current}°`;
      return mode;
    }
    case 'person':
      return entity.state === 'home' ? 'Home' : entity.state === 'not_home' ? 'Away' : entity.state;
    case 'media_player':
      if (entity.state === 'playing') {
        const title = entity.attributes.media_title as string | undefined;
        return title ? `Playing · ${title}` : 'Playing';
      }
      return entity.state === 'off' || entity.state === 'standby' ? 'Off' : 'Idle';
    case 'sensor':
      return unit ? `${entity.state} ${unit}` : entity.state;
    case 'binary_sensor': {
      const dc = deviceClass(entity);
      if (dc === 'door' || dc === 'window' || dc === 'garage_door' || dc === 'opening') {
        return entity.state === 'on' ? 'Open' : 'Closed';
      }
      if (PRESENCE_BINARY.has(dc)) return entity.state === 'on' ? 'Detected' : 'Clear';
      return entity.state === 'on' ? 'On' : 'Off';
    }
    default:
      if (entity.state === 'unavailable') return 'Unavailable';
      return entity.state.charAt(0).toUpperCase() + entity.state.slice(1).replaceAll('_', ' ');
  }
}

export function entityName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id.split('.')[1].replaceAll('_', ' ');
}
