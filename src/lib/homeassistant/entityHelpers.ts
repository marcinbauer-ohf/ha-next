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
  mdiSofaOutline,
  mdiTelevisionClassic,
  mdiShieldHome,
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

/**
 * Best-guess product thumbnail for an entity, keyed off domain + device_class
 * with entity_id / friendly_name keyword refinement. Returns a path under
 * /public/devices, or null when no good match exists (caller falls back to the
 * mdi domain icon). Files are dropped in by hand — the card hides the image and
 * reverts to the icon if a referenced PNG is missing.
 */
export function deviceThumbnail(entity: HassEntity): string | null {
  const domain = entityDomain(entity);
  const dc = entity.attributes.device_class as string | undefined;
  const hint = `${entity.entity_id} ${friendlyName(entity)}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => hint.includes(w));
  const hasWord = (w: string) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(hint);
  const img = (name: string) => `/devices/${name}.png`;

  // Appliance / infrastructure devices — matched by name keyword regardless of
  // domain, since these surface under many domains (sensor, switch,
  // device_tracker, update, event…) rather than a dedicated one. Checked before
  // the domain switch so a "Washing machine power" switch still gets the washer.
  if (has('washing machine', 'washer')) return img('washing_machine');
  if (has('dishwasher')) return img('dishwasher');
  if (has('fridge', 'refrigerator', 'freezer')) return img('fridge');
  if (has('air purifier', 'purifier', 'humidifier', 'dehumidifier')) return img('air_purifier');
  if (has('3d printer', 'octoprint') || hasWord('printer')) return img('printer_3d');
  if (hasWord('ups') || has('uninterruptible', 'battery backup')) return img('ups');
  if (has('inverter', 'solar')) return img('inverter');
  if (has('ev charger', 'wallbox', 'charge point') || hasWord('ev')) return img('ev_charger');
  if (has('laptop', 'macbook', 'notebook')) return img('laptop');
  if (has('tablet', 'ipad')) return img('wall_tablet');
  if (has('router', 'mesh', 'access point')) return img('wifi_router');
  if (has('zigbee')) return img('zigbee_coordinator');
  if (has('z-wave', 'zwave')) return img('zwave_controller');
  // Guard media_player: "Nest Hub" / "HomePod hub" are displays/speakers, not network hubs.
  if (domain !== 'media_player' && has('hub', 'bridge', 'gateway', 'coordinator')) return img('hub');
  if (has('nfc', 'rfid') || domain === 'tag') return img('nfc_tag');
  if (has('locator', 'tracker', 'airtag', 'tile')) return img('tracker');
  if (has('smartwatch', 'wearable') || hasWord('watch')) return img('smartwatch');
  // Phones — the HA companion app surfaces as device_tracker + battery/etc.
  // sensors named after the phone. Checked after tablet/watch so "Pixel Tablet"
  // and "Galaxy Watch" still match those.
  if (has('iphone', 'smartphone', 'pixel', 'oneplus') || hasWord('phone')) return img('smartphone');
  if (has('irrigation', 'sprinkler')) return img('irrigation_controller');
  if (has('doorbell', 'door bell')) return img('doorbell');

  switch (domain) {
    case 'vacuum':
    case 'lawn_mower':
      return img('robot_vacuum');

    case 'humidifier':
      return img('air_purifier');

    case 'valve':
      return img('water_valve');

    case 'button':
    case 'event':
      return img('button');
    case 'light':
      if (has('strip', 'led', 'ribbon')) return img('led_strip');
      if (has('gu10', 'spot', 'spotlight')) return img('bulb_gu10');
      if (has('dimmer')) return img('dimmer');
      return img('bulb_e27');

    case 'switch':
      if (has('powerstrip', 'power_strip', 'power strip')) return img('power_strip');
      if (has('relay', 'module', 'inline')) return img('relay_module');
      if (dc === 'outlet' || has('plug', 'outlet', 'socket')) {
        return has('eu', 'schuko', 'type-f') ? img('smart_plug_eu') : img('smart_plug_us');
      }
      if (has('strip')) return img('power_strip');
      if (has('dimmer')) return img('dimmer');
      return img('wall_switch');

    case 'fan':
      return img('ceiling_fan');

    case 'climate':
      if (has('trv', 'valve', 'radiator')) return img('radiator_valve');
      if (hasWord('ac') || has('aircon', 'air condition', 'air-condition')) return img('ac_controller');
      return img('thermostat');

    case 'lock':
      return img('lock');

    case 'camera':
      if (has('doorbell', 'bell')) return img('doorbell');
      if (has('bullet', 'outdoor')) return img('camera_bullet');
      return img('camera_dome');

    case 'media_player':
      if (has('apple tv', 'appletv', 'shield', 'chromecast', 'google tv', 'roku', 'fire tv', 'firetv', 'streamer', 'set-top', 'set top')) return img('streaming_box');
      if (has('nest hub', 'echo show', 'smart display', 'smart clock') || hasWord('display')) return img('smart_display');
      if (dc === 'tv' || has('television', 'webos', 'bravia', 'android tv', 'samsung tv', 'lg tv') || hasWord('tv')) return img('tv');
      if (dc === 'receiver' || has('soundbar', 'sound bar', 'beam', 'arc', 'home theater', 'home theatre', 'av receiver', 'avr')) return img('soundbar');
      return img('speaker');

    case 'alarm_control_panel':
      return img('keypad');

    case 'siren':
      return img('siren');

    case 'binary_sensor':
      if (dc === 'vibration' || dc === 'tamper' || has('vibration', 'vibrate', 'tamper')) return img('vibration_sensor');
      if (dc === 'sound' || has('glass break', 'glass-break', 'glassbreak')) return img('glass_break');
      if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') return img('motion_sensor');
      if (dc === 'door' || dc === 'window' || dc === 'garage_door' || dc === 'opening') return img('contact_sensor');
      if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide') return img('smoke_detector');
      if (dc === 'moisture') return img('leak_sensor');
      return null;

    case 'sensor':
      if (dc === 'pm25' || dc === 'pm10' || dc === 'pm1' || dc === 'aqi' || dc === 'carbon_dioxide' || dc === 'carbon_monoxide' || dc === 'volatile_organic_compounds' || dc === 'volatile_organic_compounds_parts' || dc === 'nitrogen_dioxide' || dc === 'nitrogen_monoxide' || dc === 'ozone' || dc === 'sulphur_dioxide' || dc === 'formaldehyde' || has('air quality', 'pm2.5', 'pm25', 'co2', 'voc')) return img('air_quality');
      if (dc === 'illuminance' || has('lux', 'illuminance', 'light level')) return img('lux_sensor');
      if (dc === 'power' || dc === 'energy' || dc === 'current' || dc === 'voltage' || has('clamp', 'ct clamp', 'energy meter')) return img('energy_meter');
      if (dc === 'moisture' || has('soil')) return img('soil_sensor');
      if (dc === 'humidity' || dc === 'temperature') return img('temp_humidity_sensor');
      return null;

    default:
      return null;
  }
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

export type DeviceCategory = 'security' | 'entertainment' | 'climate' | 'lighting' | 'sensors';

export const CATEGORY_ORDER: DeviceCategory[] = [
  'security', 'entertainment', 'climate', 'lighting', 'sensors',
];

export const CATEGORY_TITLES: Record<DeviceCategory, string> = {
  security: 'Security',
  entertainment: 'Entertainment',
  climate: 'Climate',
  lighting: 'Lighting',
  sensors: 'Sensors',
};

const SECURITY_BINARY_CLASSES = new Set([
  'door', 'garage_door', 'window', 'motion', 'occupancy', 'presence',
  'smoke', 'gas', 'safety', 'tamper', 'lock',
]);
const SECURITY_COVER_CLASSES = new Set(['garage', 'door', 'gate']);

/** Map a single entity to a semantic device category (domain + device_class rules). */
export function entityCategory(entity: HassEntity): DeviceCategory {
  const domain = entityDomain(entity);
  const dc = entity.attributes.device_class as string | undefined;

  // Security
  if (domain === 'lock' || domain === 'alarm_control_panel' || domain === 'camera') return 'security';
  if (domain === 'cover' && dc && SECURITY_COVER_CLASSES.has(dc)) return 'security';
  if (domain === 'binary_sensor' && dc && SECURITY_BINARY_CLASSES.has(dc)) return 'security';

  // Entertainment
  if (domain === 'media_player') return 'entertainment';

  // Climate
  if (domain === 'climate' || domain === 'fan') return 'climate';
  if (domain === 'sensor' && (dc === 'temperature' || dc === 'humidity')) return 'climate';

  // Lighting
  if (domain === 'light' || domain === 'switch') return 'lighting';

  // Everything else
  return 'sensors';
}

/** Generic icon for an area/room section (areas carry no icon in the registry). */
export const AREA_ICON = mdiSofaOutline;

/** Representative icon for a device-type (domain) section header. */
export function domainTypeIcon(domain: string): string {
  switch (domain) {
    case 'light': return mdiLightbulb;
    case 'switch': return mdiToggleSwitchOutline;
    case 'climate': return mdiThermometer;
    case 'media_player': return mdiTelevisionClassic;
    case 'fan': return mdiFan;
    case 'lock': return mdiLock;
    case 'cover': return mdiGarage;
    case 'vacuum': return mdiRobot;
    case 'binary_sensor': return mdiMotionSensor;
    case 'sensor': return mdiGauge;
    default: return mdiDevices;
  }
}

/** Icon for a semantic category section. */
export const CATEGORY_ICONS: Record<DeviceCategory, string> = {
  security: mdiShieldHome,
  entertainment: mdiTelevisionClassic,
  climate: mdiThermometer,
  lighting: mdiLightbulb,
  sensors: mdiGauge,
};
