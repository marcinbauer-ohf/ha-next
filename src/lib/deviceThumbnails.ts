/**
 * Catalogue of the product-render thumbnails in `/public/devices`, grouped for
 * display. Shared by the design-system gallery and the device-card edit panel's
 * thumbnail picker. `deviceThumbnail()` in entityHelpers derives one
 * automatically per entity; this list is the manual-override menu.
 *
 * `file` is the basename (no dir, no extension). Use `deviceThumbnailPath()` to
 * turn it into the `/devices/<file>.png` src the card consumes.
 */
export interface DeviceThumbnailOption {
  file: string;
  label: string;
}

export interface DeviceThumbnailGroup {
  group: string;
  items: DeviceThumbnailOption[];
}

export const deviceThumbnailPath = (file: string) => `/devices/${file}.png`;

export const DEVICE_THUMBNAIL_GROUPS: DeviceThumbnailGroup[] = [
  {
    group: 'Lighting & switches',
    items: [
      { file: 'bulb_e27', label: 'Bulb E27' },
      { file: 'bulb_gu10', label: 'Bulb GU10' },
      { file: 'led_strip', label: 'LED strip' },
      { file: 'dimmer', label: 'Dimmer' },
      { file: 'wall_switch', label: 'Wall switch' },
      { file: 'smart_plug_us', label: 'Smart plug US' },
      { file: 'smart_plug_eu', label: 'Smart plug EU' },
      { file: 'power_strip', label: 'Power strip' },
      { file: 'relay_module', label: 'Relay module' },
    ],
  },
  {
    group: 'Climate',
    items: [
      { file: 'thermostat', label: 'Thermostat' },
      { file: 'ac_controller', label: 'AC controller' },
      { file: 'radiator_valve', label: 'Radiator valve (TRV)' },
      { file: 'ceiling_fan', label: 'Ceiling fan' },
      { file: 'air_purifier', label: 'Air purifier' },
    ],
  },
  {
    group: 'Security & sensors',
    items: [
      { file: 'camera_dome', label: 'Dome camera' },
      { file: 'camera_bullet', label: 'Bullet camera' },
      { file: 'doorbell', label: 'Video doorbell' },
      { file: 'lock', label: 'Deadbolt lock' },
      { file: 'keypad', label: 'Security keypad' },
      { file: 'siren', label: 'Siren' },
      { file: 'motion_sensor', label: 'Motion sensor' },
      { file: 'contact_sensor', label: 'Contact sensor' },
      { file: 'glass_break', label: 'Glass-break sensor' },
      { file: 'vibration_sensor', label: 'Vibration sensor' },
      { file: 'smoke_detector', label: 'Smoke / CO detector' },
      { file: 'leak_sensor', label: 'Leak sensor' },
      { file: 'temp_humidity_sensor', label: 'Temp / humidity' },
      { file: 'air_quality', label: 'Air quality' },
      { file: 'lux_sensor', label: 'Lux sensor' },
      { file: 'soil_sensor', label: 'Soil moisture' },
      { file: 'energy_meter', label: 'Energy meter' },
    ],
  },
  {
    group: 'Media',
    items: [
      { file: 'tv', label: 'TV' },
      { file: 'streaming_box', label: 'Streaming box' },
      { file: 'soundbar', label: 'Soundbar' },
      { file: 'speaker', label: 'Speaker' },
      { file: 'smart_display', label: 'Smart display' },
    ],
  },
  {
    group: 'Appliances & infrastructure',
    items: [
      { file: 'robot_vacuum', label: 'Robot vacuum' },
      { file: 'washing_machine', label: 'Washing machine' },
      { file: 'dishwasher', label: 'Dishwasher' },
      { file: 'fridge', label: 'Fridge' },
      { file: 'water_valve', label: 'Water valve' },
      { file: 'irrigation_controller', label: 'Irrigation controller' },
      { file: 'ev_charger', label: 'EV charger' },
      { file: 'ebike', label: 'E-bike' },
      { file: 'inverter', label: 'Solar inverter' },
      { file: 'ups', label: 'UPS' },
      { file: 'printer_3d', label: '3D printer' },
      { file: 'wifi_router', label: 'Wi-Fi / mesh router' },
      { file: 'hub', label: 'Hub / bridge' },
      { file: 'zigbee_coordinator', label: 'Zigbee coordinator' },
      { file: 'zwave_controller', label: 'Z-Wave controller' },
      { file: 'button', label: 'Smart button' },
      { file: 'nfc_tag', label: 'NFC / RFID tag' },
      { file: 'tracker', label: 'Locator / tracker' },
      { file: 'smartwatch', label: 'Smartwatch' },
      { file: 'smartphone', label: 'Smartphone' },
      { file: 'laptop', label: 'Laptop' },
      { file: 'wall_tablet', label: 'Wall tablet' },
    ],
  },
];
