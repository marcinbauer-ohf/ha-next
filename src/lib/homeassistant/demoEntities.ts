import type { HassEntities, HassEntity } from '@/types';
import type { AreaRegistryEntry, FloorRegistryEntry } from './types';

// ── Demo home layout ────────────────────────────────────────────────────────
// Demo mode has no registries (those come from a live HA connection), so the
// sample home ships its own floors/areas plus an entity→area map. useDevices
// substitutes these when running on demo data so the dashboard can demonstrate
// area grouping, floor tabs, and room pages without a real instance.

export const DEMO_FLOORS: FloorRegistryEntry[] = [
  { floor_id: 'ground_floor', name: 'Ground Floor', level: 0 },
  { floor_id: 'upstairs', name: 'Upstairs', level: 1 },
];

export const DEMO_AREAS: AreaRegistryEntry[] = [
  { area_id: 'living_room', name: 'Living Room', floor_id: 'ground_floor' },
  { area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground_floor' },
  { area_id: 'outside', name: 'Outside', floor_id: 'ground_floor' },
  { area_id: 'office', name: 'Office', floor_id: 'upstairs' },
  { area_id: 'bedroom', name: 'Bedroom', floor_id: 'upstairs' },
];

const DEMO_ENTITY_AREAS: Record<string, string> = {
  'light.living_room_main': 'living_room',
  'media_player.simulated': 'living_room',
  'climate.home': 'living_room',
  'vacuum.downstairs': 'living_room',

  'light.kitchen_pendants': 'kitchen',
  'switch.coffee_station': 'kitchen',
  'cover.kitchen_blinds': 'kitchen',
  'sensor.washer_status': 'kitchen',

  'light.office_desk': 'office',
  'media_player.simulated_office': 'office',
  'sensor.printer_simulated': 'office',
  'switch.grow_light': 'office',

  'light.bedroom_lamp': 'bedroom',
  'climate.bedroom': 'bedroom',
  'media_player.simulated_display': 'bedroom',

  'lock.front_door': 'outside',
  'binary_sensor.camera_simulated': 'outside',
  'binary_sensor.camera_simulated_garage': 'outside',
  'sensor.outdoor_temperature': 'outside',
  'sensor.outdoor_humidity': 'outside',
  'sensor.pool_controller': 'outside',
};

export function demoAreaForEntity(entityId: string): string | undefined {
  return DEMO_ENTITY_AREAS[entityId];
}

function createEntity(
  entityId: string,
  state: string,
  attributes: HassEntity['attributes'],
  timestamp: string
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: timestamp,
    last_updated: timestamp,
  };
}

export function createDemoEntities(now = new Date()): HassEntities {
  const timestamp = now.toISOString();
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const twentyFiveMinutesFromNow = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
  const fortyTwoMinutesFromNow = new Date(now.getTime() + 42 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  return {
    'person.alex': createEntity(
      'person.alex',
      'home',
      {
        friendly_name: 'Alex',
        entity_picture: '/casita.png',
      },
      timestamp
    ),
    'person.sam': createEntity(
      'person.sam',
      'home',
      {
        friendly_name: 'Sam',
      },
      timestamp
    ),
    'person.jules': createEntity(
      'person.jules',
      'not_home',
      {
        friendly_name: 'Jules',
      },
      timestamp
    ),
    'cloud.cloud': createEntity(
      'cloud.cloud',
      'connected',
      {
        friendly_name: 'Home Assistant Cloud',
      },
      timestamp
    ),
    'sensor.energy_today': createEntity(
      'sensor.energy_today',
      '14.8',
      {
        friendly_name: 'Energy Today',
        unit_of_measurement: 'kWh',
        dashboard_hidden: true,
      },
      timestamp
    ),
    'sensor.outdoor_temperature': createEntity(
      'sensor.outdoor_temperature',
      '18.4',
      {
        friendly_name: 'Outdoor Temperature',
        unit_of_measurement: '°C',
        device_class: 'temperature',
      },
      timestamp
    ),
    'sensor.outdoor_humidity': createEntity(
      'sensor.outdoor_humidity',
      '57',
      {
        friendly_name: 'Outdoor Humidity',
        unit_of_measurement: '%',
        device_class: 'humidity',
      },
      timestamp
    ),
    'binary_sensor.remote_ui': createEntity(
      'binary_sensor.remote_ui',
      'on',
      {
        friendly_name: 'Remote UI',
        dashboard_hidden: true,
      },
      timestamp
    ),
    'update.zigbee2mqtt': createEntity(
      'update.zigbee2mqtt',
      'on',
      {
        friendly_name: 'Zigbee2MQTT',
        latest_version: '1.42.1',
      },
      timestamp
    ),
    'update.matter_server': createEntity(
      'update.matter_server',
      'on',
      {
        friendly_name: 'Matter Server',
        latest_version: '6.8.0',
      },
      timestamp
    ),
    'update.home_assistant_release_notes_simulated': createEntity(
      'update.home_assistant_release_notes_simulated',
      'on',
      {
        friendly_name: 'Home Assistant 2026.2.1',
        latest_version: '2026.2.1',
        release_summary: 'Dashboard polish, richer activity cards, and smoother mobile interactions.',
        release_notes: [
          'Improved activity widgets with clearer states.',
          'Faster transitions when opening panels.',
          'Refined spacing for cards on mobile.',
          'Expanded demo data so new sessions feel closer to a live home.',
        ],
      },
      timestamp
    ),
    'media_player.simulated': createEntity(
      'media_player.simulated',
      'playing',
      {
        friendly_name: 'Living Room TV',
        device_class: 'tv',
        media_title: 'Planet Earth III',
        media_artist: 'BBC Earth',
      },
      timestamp
    ),
    'media_player.simulated_office': createEntity(
      'media_player.simulated_office',
      'paused',
      {
        friendly_name: 'Office Speaker',
        media_title: 'Design Review',
        media_artist: 'Lo-fi Session',
      },
      timestamp
    ),
    'media_player.simulated_display': createEntity(
      'media_player.simulated_display',
      'idle',
      {
        friendly_name: 'Bedroom Smart Display',
      },
      timestamp
    ),
    'timer.simulated': createEntity(
      'timer.simulated',
      'active',
      {
        friendly_name: 'Laundry Timer',
        duration: '0:30:00',
        remaining: '0:25:00',
        finishes_at: twentyFiveMinutesFromNow,
      },
      timestamp
    ),
    'timer.simulated_tea': createEntity(
      'timer.simulated_tea',
      'paused',
      {
        friendly_name: 'Tea Timer',
        duration: '0:10:00',
        remaining: '0:06:00',
        finishes_at: tenMinutesFromNow,
      },
      timestamp
    ),
    'binary_sensor.camera_simulated': createEntity(
      'binary_sensor.camera_simulated',
      'on',
      {
        friendly_name: 'Front Door Camera',
        event_type: 'Person detected',
        entity_picture: '/camera_doorbell.png',
      },
      timestamp
    ),
    'binary_sensor.camera_simulated_garage': createEntity(
      'binary_sensor.camera_simulated_garage',
      'on',
      {
        friendly_name: 'Garage Camera',
        event_type: 'Motion detected',
        entity_picture: '/camera_doorbell.png',
      },
      timestamp
    ),
    'sensor.printer_simulated': createEntity(
      'sensor.printer_simulated',
      'printing',
      {
        friendly_name: 'Voron 2.4',
        progress: 63,
        file_name: 'case_mount.stl',
        time_remaining: '00:42:00',
        entity_picture: '/printer_3d.png',
      },
      timestamp
    ),
    'light.living_room_main': createEntity(
      'light.living_room_main',
      'on',
      {
        friendly_name: 'Living Room Main',
        brightness: 204,
        supported_color_modes: ['brightness'],
      },
      timestamp
    ),
    'light.kitchen_pendants': createEntity(
      'light.kitchen_pendants',
      'on',
      {
        friendly_name: 'Kitchen Pendants',
        brightness: 255,
        supported_color_modes: ['brightness'],
      },
      timestamp
    ),
    'light.office_desk': createEntity(
      'light.office_desk',
      'on',
      {
        friendly_name: 'Office Desk Lamp',
        brightness: 176,
        supported_color_modes: ['brightness'],
      },
      timestamp
    ),
    'light.bedroom_lamp': createEntity(
      'light.bedroom_lamp',
      'off',
      {
        friendly_name: 'Bedroom Lamp',
        brightness: 0,
        supported_color_modes: ['brightness'],
      },
      timestamp
    ),
    'switch.coffee_station': createEntity(
      'switch.coffee_station',
      'on',
      {
        friendly_name: 'Coffee Station',
      },
      timestamp
    ),
    'switch.grow_light': createEntity(
      'switch.grow_light',
      'off',
      {
        friendly_name: 'Grow Light',
      },
      timestamp
    ),
    'climate.home': createEntity(
      'climate.home',
      'heat',
      {
        friendly_name: 'Thermostat',
        current_temperature: 22.3,
        temperature: 22,
        hvac_mode: 'heat',
      },
      timestamp
    ),
    'climate.bedroom': createEntity(
      'climate.bedroom',
      'off',
      {
        friendly_name: 'Bedroom Climate',
        current_temperature: 20.1,
        temperature: 19,
        hvac_mode: 'off',
      },
      timestamp
    ),
    'lock.front_door': createEntity(
      'lock.front_door',
      'locked',
      {
        friendly_name: 'Front Door',
      },
      timestamp
    ),
    'cover.kitchen_blinds': createEntity(
      'cover.kitchen_blinds',
      'open',
      {
        friendly_name: 'Kitchen Blinds',
        current_position: 100,
      },
      timestamp
    ),
    'vacuum.downstairs': createEntity(
      'vacuum.downstairs',
      'docked',
      {
        friendly_name: 'Robot Vacuum',
      },
      timestamp
    ),
    'sensor.pool_controller': createEntity(
      'sensor.pool_controller',
      'unavailable',
      {
        friendly_name: 'Pool Controller',
        device_id: 'pool-controller-01',
      },
      timestamp
    ),
    'persistent_notification.demo_ready': createEntity(
      'persistent_notification.demo_ready',
      'notifying',
      {
        title: 'Demo mode enabled',
        friendly_name: 'Demo mode enabled',
        message: 'You are browsing a sample home. Connect your own Home Assistant instance to see your real devices here.',
      },
      timestamp
    ),
    'persistent_notification.low_battery': createEntity(
      'persistent_notification.low_battery',
      'notifying',
      {
        title: 'Low battery warning',
        friendly_name: 'Low battery warning',
        message: 'The patio motion sensor battery is below 15%.',
      },
      timestamp
    ),
    'persistent_notification.front_door': createEntity(
      'persistent_notification.front_door',
      'notifying',
      {
        title: 'Front door left open',
        friendly_name: 'Front door left open',
        message: 'The front door has been open for 12 minutes.',
      },
      timestamp
    ),
    // ── Home Center: low battery sensors ──────────────────────────────────
    'sensor.patio_motion_battery': createEntity(
      'sensor.patio_motion_battery',
      '12',
      {
        friendly_name: 'Patio Motion Battery',
        device_class: 'battery',
        unit_of_measurement: '%',
      },
      timestamp
    ),
    'sensor.front_door_lock_battery': createEntity(
      'sensor.front_door_lock_battery',
      '8',
      {
        friendly_name: 'Front Door Lock Battery',
        device_class: 'battery',
        unit_of_measurement: '%',
      },
      timestamp
    ),
    'sensor.bedroom_remote_battery': createEntity(
      'sensor.bedroom_remote_battery',
      '17',
      {
        friendly_name: 'Bedroom Remote Battery',
        device_class: 'battery',
        unit_of_measurement: '%',
      },
      timestamp
    ),
    'sensor.living_room_thermostat_battery': createEntity(
      'sensor.living_room_thermostat_battery',
      '94',
      {
        friendly_name: 'Living Room Thermostat Battery',
        device_class: 'battery',
        unit_of_measurement: '%',
      },
      timestamp
    ),
    // ── Home Center: repairs (issues HA suggests you fix) ─────────────────
    'repairs.zwave_device_deprecated': createEntity(
      'repairs.zwave_device_deprecated',
      'on',
      {
        friendly_name: 'Z-Wave device no longer supported',
        title: 'Z-Wave device no longer supported',
        severity: 'warning',
        description: 'The "Aeotec MultiSensor 6" uses a deprecated configuration. Re-add it to keep receiving updates.',
      },
      timestamp
    ),
    'repairs.mqtt_certificate_expiring': createEntity(
      'repairs.mqtt_certificate_expiring',
      'on',
      {
        friendly_name: 'MQTT broker certificate expiring',
        title: 'MQTT broker certificate expiring',
        severity: 'critical',
        description: 'The certificate for your MQTT broker expires in 3 days. Renew it to avoid losing connection.',
      },
      timestamp
    ),
    // ── Home Center: backup status ────────────────────────────────────────
    'backup.home_assistant': createEntity(
      'backup.home_assistant',
      'idle',
      {
        friendly_name: 'Home Assistant Backup',
        last_backup: twoDaysAgo,
      },
      timestamp
    ),
    'sensor.washer_status': createEntity(
      'sensor.washer_status',
      'running',
      {
        friendly_name: 'Washer',
      },
      timestamp
    ),
    'sensor.next_alarm': createEntity(
      'sensor.next_alarm',
      '06:45',
      {
        friendly_name: 'Next Alarm',
        dashboard_hidden: true,
      },
      timestamp
    ),
    'calendar.family': createEntity(
      'calendar.family',
      'on',
      {
        friendly_name: 'Family Calendar',
        message: 'Home Assistant design review',
        start_time: fortyTwoMinutesFromNow,
      },
      timestamp
    ),
  };
}
