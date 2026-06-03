import {
  mdiLightbulb,
  mdiLightbulbOutline,
  mdiToggleSwitchOutline,
  mdiToggleSwitchOffOutline,
  mdiThermometer,
  mdiSpeaker,
  mdiTelevision,
  mdiFlash,
  mdiWaterPercent,
  mdiGauge,
  mdiEye,
  mdiDoorOpen,
  mdiDoor,
  mdiMotionSensor,
  mdiShieldCheck,
  mdiDevices,
  mdiWindowOpen,
  mdiWindowClosed,
  mdiFan,
  mdiGarage,
  mdiRobot,
  mdiLock,
  mdiLockOpen,
} from '@mdi/js';
import type { HassEntity } from '@/types';

export function entityDomain(entity: HassEntity): string {
  return entity.entity_id.split('.')[0];
}

export function friendlyName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
}

/** Strip device name prefix from entity name for use in contexts where device is already shown. */
export function entityLabel(entity: HassEntity, deviceName: string): string {
  const name = friendlyName(entity);
  const prefix = deviceName.trim().toLowerCase();
  const lower = name.toLowerCase();
  if (lower.startsWith(prefix)) {
    const stripped = name.slice(deviceName.trim().length).replace(/^[\s\-–—_]+/, '').trim();
    return stripped || name;
  }
  return name;
}

export function stateLabel(entity: HassEntity): string {
  const s = entity.state;
  if (s === 'unavailable') return 'Unavailable';
  if (s === 'unknown') return 'Unknown';
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  return unit ? `${s} ${unit}` : s.charAt(0).toUpperCase() + s.slice(1);
}

export function isOn(entity: HassEntity): boolean {
  const s = entity.state.toLowerCase();
  return s !== 'off' && s !== 'unavailable' && s !== 'unknown' && s !== '0' && s !== 'idle' && s !== 'standby';
}

export const TOGGLEABLE = new Set([
  'light', 'switch', 'fan', 'input_boolean', 'media_player', 'cover', 'lock',
]);

export function domainIcon(entity: HassEntity): string {
  const domain = entityDomain(entity);
  const on = isOn(entity);
  const dc = entity.attributes.device_class as string | undefined;
  if (domain === 'light') return on ? mdiLightbulb : mdiLightbulbOutline;
  if (domain === 'switch') return on ? mdiToggleSwitchOutline : mdiToggleSwitchOffOutline;
  if (domain === 'climate') return mdiThermometer;
  if (domain === 'media_player') {
    const isTV = dc === 'tv' || entity.entity_id.includes('tv');
    return isTV ? mdiTelevision : mdiSpeaker;
  }
  if (domain === 'fan') return mdiFan;
  if (domain === 'lock') return on ? mdiLockOpen : mdiLock;
  if (domain === 'cover') return mdiGarage;
  if (domain === 'vacuum') return mdiRobot;
  if (domain === 'binary_sensor') {
    if (dc === 'door' || dc === 'garage_door') return on ? mdiDoorOpen : mdiDoor;
    if (dc === 'window') return on ? mdiWindowOpen : mdiWindowClosed;
    if (dc === 'motion' || dc === 'occupancy') return mdiMotionSensor;
    if (dc === 'smoke' || dc === 'gas' || dc === 'safety') return mdiShieldCheck;
    return mdiEye;
  }
  if (domain === 'sensor') {
    if (dc === 'temperature') return mdiThermometer;
    if (dc === 'humidity') return mdiWaterPercent;
    if (dc === 'power' || dc === 'energy' || dc === 'voltage' || dc === 'current') return mdiFlash;
    if (dc === 'illuminance') return mdiEye;
    return mdiGauge;
  }
  return mdiDevices;
}

export const SECTION_ORDER = [
  'climate', 'media_player', 'light', 'switch', 'fan',
  'lock', 'cover', 'vacuum', 'binary_sensor', 'sensor',
];

export const SECTION_TITLES: Record<string, string> = {
  climate: 'Climate',
  media_player: 'Media',
  light: 'Lights',
  switch: 'Switches',
  fan: 'Fans',
  lock: 'Locks',
  cover: 'Covers',
  vacuum: 'Vacuums',
  binary_sensor: 'Security & Presence',
  sensor: 'Sensors',
};
