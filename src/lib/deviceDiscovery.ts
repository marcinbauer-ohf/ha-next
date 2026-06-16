import {
  mdiAccessPointNetwork,
  mdiWifi,
  mdiBluetooth,
  mdiZigbee,
  mdiZWave,
  mdiGraphOutline,
  mdiHexagonMultiple,
} from '@mdi/js';
import type { ToastOptions } from '@/contexts/ToastContext';

type ShowToast = (opts: ToastOptions) => number;

export interface DiscoverableDevice {
  name: string;
  image: string;
  manufacturer: string;
  model: string;
  protocol: string;
  protocolIcon: string;
}

/**
 * Catalogue of fake devices a discovery payload might carry — a product render,
 * a manufacturer/model, and the transport it was found over. Placeholder until
 * wired to real HA discovery / notification events.
 */
export const DISCOVERABLE_DEVICES: DiscoverableDevice[] = [
  { name: 'Motion Sensor',  image: '/devices/motion_sensor.png',        manufacturer: 'Aqara',       model: 'P2',        protocol: 'Zigbee',    protocolIcon: mdiZigbee },
  { name: 'Smart Plug',     image: '/devices/smart_plug_us.png',        manufacturer: 'TP-Link',     model: 'Tapo P110', protocol: 'Wi-Fi',     protocolIcon: mdiWifi },
  { name: 'Door Lock',      image: '/devices/lock.png',                 manufacturer: 'Yale',        model: 'Assure 2',  protocol: 'Matter',    protocolIcon: mdiHexagonMultiple },
  { name: 'Climate Sensor', image: '/devices/temp_humidity_sensor.png', manufacturer: 'SwitchBot',   model: 'Meter',     protocol: 'Bluetooth', protocolIcon: mdiBluetooth },
  { name: 'Light Strip',    image: '/devices/led_strip.png',            manufacturer: 'Govee',       model: 'H6199',     protocol: 'Wi-Fi',     protocolIcon: mdiWifi },
  { name: 'Radiator Valve', image: '/devices/radiator_valve.png',       manufacturer: 'tado°',       model: 'V3+',       protocol: 'Thread',    protocolIcon: mdiGraphOutline },
  { name: 'Dome Camera',    image: '/devices/camera_dome.png',          manufacturer: 'Reolink',     model: 'E1 Pro',    protocol: 'Wi-Fi',     protocolIcon: mdiWifi },
  { name: 'Contact Sensor', image: '/devices/contact_sensor.png',       manufacturer: 'SONOFF',      model: 'SNZB-04',   protocol: 'Zigbee',    protocolIcon: mdiZigbee },
  { name: 'Smart Bulb',     image: '/devices/bulb_e27.png',             manufacturer: 'Philips Hue', model: 'A60',       protocol: 'Zigbee',    protocolIcon: mdiZigbee },
  { name: 'Wall Switch',    image: '/devices/wall_switch.png',          manufacturer: 'Inovelli',    model: 'Blue 2-1',  protocol: 'Z-Wave',    protocolIcon: mdiZWave },
];

/** Announce a single discovered device as a toast. */
export function announceDiscovery(showToast: ShowToast, d: DiscoverableDevice) {
  showToast({
    icon: mdiAccessPointNetwork,
    image: d.image,
    protocolIcon: d.protocolIcon,
    caption: 'New device',
    title: d.name,
    subtitle: `${d.manufacturer} ${d.model} • ${d.protocol} • Strong`,
    // Tap the whole toast to enter setup — no separate button needed.
    onClick: () => {},
    // Left untouched for 20s: dismiss and pulse the status-bar command center so
    // the discovery isn't lost — it lives on in the home's status surface.
    idleDismiss: 20000,
    // Keep it in settings → Notifications after dismissal so it can still be
    // acted on; tapping the toast (enter setup) clears it.
    persist: true,
  });
}

/** Pick `count` distinct random devices from the catalogue. */
export function pickDiscoveries(count: number): DiscoverableDevice[] {
  return [...DISCOVERABLE_DEVICES].sort(() => Math.random() - 0.5).slice(0, count);
}
