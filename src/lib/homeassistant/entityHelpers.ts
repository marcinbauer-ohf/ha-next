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
  mdiCctv,
} from '@mdi/js';
import type { HassEntity } from '@/types';
import { mdiIconByName } from './mdiIconByName';

export function entityDomain(entity: HassEntity): string {
  return entity.entity_id.split('.')[0];
}

export function friendlyName(entity: HassEntity): string {
  const name = entity.attributes.friendly_name as string | undefined;
  if (name) return name;
  // No name from the integration — HA falls back to the humanised object id
  // rather than showing a raw `sensor.foo_bar` in the UI.
  const objectId = entity.entity_id.split('.')[1] ?? entity.entity_id;
  return objectId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

// ── State formatting ─────────────────────────────────────────────────────────
// Everything the card, the entity list and the dialog hero show routes through
// stateLabel, so the domain-specific wording and number formatting live here
// rather than in each surface.

/** on/off wording per binary_sensor device_class — HA's own phrasing. */
const BINARY_WORDS: Record<string, [on: string, off: string]> = {
  battery: ['Low', 'Normal'],
  battery_charging: ['Charging', 'Not charging'],
  carbon_monoxide: ['Detected', 'Clear'],
  cold: ['Cold', 'Normal'],
  connectivity: ['Connected', 'Disconnected'],
  door: ['Open', 'Closed'],
  garage_door: ['Open', 'Closed'],
  gas: ['Detected', 'Clear'],
  heat: ['Hot', 'Normal'],
  light: ['Detected', 'No light'],
  lock: ['Unlocked', 'Locked'],
  moisture: ['Wet', 'Dry'],
  motion: ['Detected', 'Clear'],
  moving: ['Moving', 'Stopped'],
  occupancy: ['Detected', 'Clear'],
  opening: ['Open', 'Closed'],
  plug: ['Plugged in', 'Unplugged'],
  power: ['Detected', 'No power'],
  presence: ['Home', 'Away'],
  problem: ['Problem', 'OK'],
  running: ['Running', 'Not running'],
  safety: ['Unsafe', 'Safe'],
  smoke: ['Detected', 'Clear'],
  sound: ['Detected', 'Clear'],
  tamper: ['Tampered', 'Clear'],
  update: ['Update available', 'Up-to-date'],
  vibration: ['Detected', 'Clear'],
  window: ['Open', 'Closed'],
};

/** Domains whose state IS a timestamp (last press / last fire / last activation). */
const TIMESTAMP_DOMAINS = new Set(['button', 'input_button', 'event', 'scene']);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}|$)/;

/** Slug → sentence: `armed_home` → `Armed home`, `heat_cool` → `Heat cool`. */
function humanizeState(s: string): string {
  const words = s.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `1 h 12 min`-style label for a duration reading in s / min / h. */
function formatDuration(value: number, unit: string): string {
  const seconds = Math.round(unit === 'h' ? value * 3600 : unit === 'min' ? value * 60 : value);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

/** Local date-time for an ISO state (timestamp sensors, button presses, events). */
export function formatTimestampState(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `Today ${time}` : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`;
}

/**
 * The display text for an entity's state, split from the unit that should be
 * typeset separately (the dialog hero renders the unit smaller, cards join the
 * two). One function so a card row, an entity list and the hero can never
 * disagree about rounding or wording.
 *
 * `suggested_display_precision` is what HA's own frontend rounds by — without
 * it a sensor reporting 21.400000001 prints in full.
 */
export function stateParts(entity: HassEntity): { text: string; unit?: string } {
  const s = entity.state;
  if (s === 'unavailable') return { text: 'Unavailable' };
  if (s === 'unknown') return { text: 'Unknown' };

  const a = entity.attributes;
  const domain = entityDomain(entity);
  const deviceClass = a.device_class as string | undefined;
  const unit = a.unit_of_measurement as string | undefined;

  if (domain === 'binary_sensor' && deviceClass && BINARY_WORDS[deviceClass]) {
    return { text: BINARY_WORDS[deviceClass][s === 'on' ? 0 : 1] };
  }
  if ((deviceClass === 'timestamp' || TIMESTAMP_DOMAINS.has(domain)) && ISO_DATE.test(s)) {
    return { text: formatTimestampState(s) };
  }

  const raw = Number(s);
  if (s.trim() === '' || isNaN(raw)) return { text: humanizeState(s) };

  // Durations read as words, so the unit is already inside the text.
  if (deviceClass === 'duration' && unit) return { text: formatDuration(raw, unit) };

  const precision = a.suggested_display_precision ?? a.display_precision;
  const text = typeof precision === 'number' ? raw.toFixed(precision) : String(raw);
  return { text, unit };
}

export function stateLabel(entity: HassEntity): string {
  const { text, unit } = stateParts(entity);
  return unit ? `${text} ${unit}` : text;
}

export function isOn(entity: HassEntity): boolean {
  const s = entity.state.toLowerCase();
  return s !== 'off' && s !== 'unavailable' && s !== 'unknown' && s !== '0' && s !== 'idle' && s !== 'standby';
}

export const TOGGLEABLE = new Set([
  'light', 'switch', 'fan', 'input_boolean', 'media_player', 'cover', 'lock',
  'siren', 'humidifier', 'valve',
]);

/**
 * Press-only domains: one action, no state to hold — the card shows an action
 * button instead of a switch. Single source of truth; every card surface used to
 * keep its own copy of this list, which is how `scene` ended up inert.
 */
export const PRESSABLE = new Set([
  'button', 'input_button', 'script', 'automation', 'scene',
]);

/** Compact "time ago" for a last-changed timestamp (now, 5m, 3h, 2d, 1w). */
function relativeTimeShort(iso: string | undefined): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** Instantaneous power draw in watts from common attribute names, else null. */
function powerWatts(entity: HassEntity): number | null {
  const a = entity.attributes;
  const raw = a.current_power_w ?? a.power ?? a.power_w;
  const n = Number(raw);
  return raw != null && Number.isFinite(n) ? n : null;
}

export interface CornerBadge {
  text: string;
  /** Accessible label / tooltip naming the value. */
  label: string;
}

// Nearest common name for a light's colour. Deliberately coarse — "Warm white"
// and "Purple" is what someone says about a bulb; "#E8B47A" is not.
const HUE_NAMES: Array<[number, string]> = [
  [15, 'Red'], [45, 'Orange'], [70, 'Yellow'], [160, 'Green'],
  [200, 'Teal'], [250, 'Blue'], [290, 'Purple'], [335, 'Pink'], [360, 'Red'],
];

function colorName([r, g, b]: [number, number, number]): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  // Near-greys are whites, told apart by whether red or blue leads.
  if (d < 26) return r > b + 8 ? 'Warm white' : b > r + 8 ? 'Cool white' : 'White';
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return HUE_NAMES.find(([limit]) => h <= limit)![1];
}

export interface StateExtras {
  /** Short facts to append after the state, joined by "・" on the card. */
  details: string[];
  /** A colour worth showing as a dot (a light's current colour). */
  accentRgb?: [number, number, number];
}

/**
 * What else is worth saying about a device beyond "On". A light that is on is
 * really "On ・ Warm white"; a thermostat is "Heat ・ 21°"; a speaker is
 * "Playing ・ Spotify". Deliberately excludes anything the corner badge already
 * shows (brightness, fan speed, position, volume, current temp) so the card
 * never prints the same number twice.
 */
export function stateExtras(entity: HassEntity): StateExtras {
  const domain = entityDomain(entity);
  const a = entity.attributes;
  const details: string[] = [];
  let accentRgb: [number, number, number] | undefined;

  if (entity.state === 'unavailable' || entity.state === 'unknown') return { details };

  switch (domain) {
    case 'light': {
      if (!isOn(entity)) break;
      const rgb = a.rgb_color as [number, number, number] | undefined;
      if (Array.isArray(rgb) && rgb.length === 3) {
        accentRgb = rgb;
        details.push(colorName(rgb));
      }
      const effect = a.effect as string | undefined;
      if (effect && effect.toLowerCase() !== 'none') details.push(humanizeState(effect));
      break;
    }
    case 'media_player': {
      const source = (a.source ?? a.app_name) as string | undefined;
      if (source) details.push(source);
      break;
    }
    case 'climate': {
      const action = a.hvac_action as string | undefined;
      if (action && action !== 'off' && action !== entity.state) details.push(humanizeState(action));
      const target = a.temperature ?? a.target_temp_high;
      if (target != null && Number.isFinite(Number(target))) details.push(`${Math.round(Number(target))}°`);
      break;
    }
    case 'humidifier': {
      const target = a.humidity;
      if (target != null && Number.isFinite(Number(target))) details.push(`${Math.round(Number(target))}%`);
      const mode = a.mode as string | undefined;
      if (mode) details.push(humanizeState(mode));
      break;
    }
    case 'vacuum': {
      const speed = a.fan_speed as string | undefined;
      if (speed) details.push(humanizeState(speed));
      const battery = a.battery_level;
      if (battery != null && Number.isFinite(Number(battery))) details.push(`${Math.round(Number(battery))}%`);
      break;
    }
    case 'water_heater': {
      const op = a.operation_mode as string | undefined;
      if (op && op !== entity.state) details.push(humanizeState(op));
      break;
    }
    case 'fan': {
      const preset = a.preset_mode as string | undefined;
      if (isOn(entity) && preset) details.push(humanizeState(preset));
      break;
    }
    case 'person': {
      const zones = a.in_zones as string[] | undefined;
      if (Array.isArray(zones) && zones.length > 0) details.push(humanizeState(zones[0]));
      break;
    }
  }

  // Two extras is the most a card line can carry before it truncates anyway.
  return { details: details.slice(0, 2), accentRgb };
}

/**
 * The single most useful at-a-glance value for a device card's (freed) top-right
 * corner, derived from the primary entity. Priority:
 *   1. a domain-specific live sub-metric while the device is on
 *      (brightness / fan speed / cover position / current temp / volume),
 *   2. power draw, when the entity reports it,
 *   3. how long ago it last changed.
 * Returns null when none apply.
 */
export function primaryCornerBadge(entity: HassEntity): CornerBadge | null {
  const domain = entityDomain(entity);
  const a = entity.attributes;

  if (isOn(entity)) {
    if (domain === 'light' && a.brightness != null) {
      const pct = Math.round((Number(a.brightness) / 255) * 100);
      if (Number.isFinite(pct)) return { text: `${pct}%`, label: 'Brightness' };
    }
    if (domain === 'fan' && a.percentage != null) {
      const pct = Math.round(Number(a.percentage));
      if (Number.isFinite(pct)) return { text: `${pct}%`, label: 'Fan speed' };
    }
    if (domain === 'cover' && a.current_position != null) {
      const pct = Math.round(Number(a.current_position));
      if (Number.isFinite(pct)) return { text: `${pct}%`, label: 'Position' };
    }
    if (domain === 'climate' && a.current_temperature != null) {
      const t = Math.round(Number(a.current_temperature));
      if (Number.isFinite(t)) return { text: `${t}°`, label: 'Current temperature' };
    }
    if (domain === 'media_player' && a.volume_level != null) {
      const pct = Math.round(Number(a.volume_level) * 100);
      if (Number.isFinite(pct)) return { text: `${pct}%`, label: 'Volume' };
    }
  }

  const watts = powerWatts(entity);
  if (watts != null) {
    const text = watts >= 1000 ? `${(watts / 1000).toFixed(1)} kW` : `${Math.round(watts)} W`;
    return { text, label: 'Power draw' };
  }

  const rel = relativeTimeShort(entity.last_changed);
  if (rel) return { text: rel, label: 'Last changed' };

  return null;
}

/**
 * The entity whose picture should front a device card — a camera snapshot feed
 * first, else a media_player's current artwork. Returns undefined when the
 * device has no such image. Surfaces the feed at the device level so it shows
 * even when the card's primary slot is some other entity (e.g. a motion sensor).
 */
export function deviceFeedEntity(entities: HassEntity[]): HassEntity | undefined {
  const cam = entities.find(e => entityDomain(e) === 'camera' && !!e.attributes.entity_picture);
  if (cam) return cam;
  return entities.find(e => entityDomain(e) === 'media_player' && !!e.attributes.entity_picture);
}

export function domainIcon(entity: HassEntity): string {
  const domain = entityDomain(entity);
  const on = isOn(entity);
  const dc = entity.attributes.device_class as string | undefined;
  // A user's own icon choice (registry / customize) outranks every rule below.
  const override = mdiIconByName(entity.attributes.icon);
  if (override) return override;
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
 * Official brand image for an integration platform — the same artwork Home
 * Assistant's own frontend shows for config entries. Served by the HA brands
 * CDN, keyed by the integration domain from the live registry (e.g. "hue",
 * "met"). Callers must keep an onError fallback: unknown domains 404.
 */
export function integrationBrandIcon(platform: string): string {
  return `https://brands.home-assistant.io/${platform}/icon.png`;
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
  // E-bikes (VanMoof, Cowboy, companion trackers) surface as device_tracker +
  // battery/range sensors + lock. Checked before EV charger and tracker so
  // "E-bike charger" / "Bike tracker" still get the bike render.
  if (has('e-bike', 'ebike', 'bicycle', 'vanmoof') || hasWord('bike')) return img('ebike');
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
  // Cameras also surface as their motion/person binary_sensor (that's what the
  // demo ships), so match the name before the domain switch.
  if (has('camera')) return img(has('bullet', 'outdoor') ? 'camera_bullet' : 'camera_dome');

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
  'camera', 'climate', 'media_player', 'light', 'switch', 'fan',
  'lock', 'cover', 'vacuum', 'binary_sensor', 'sensor',
];

export const SECTION_TITLES: Record<string, string> = {
  camera: 'Cameras',
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
    case 'camera': return mdiCctv;
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
