import {
  mdiAccessPointNetwork,
  mdiWifi,
  mdiBluetooth,
  mdiZigbee,
  mdiZWave,
  mdiGraphOutline,
  mdiHexagonMultiple,
  mdiUsbPort,
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
  { name: 'E-Bike',         image: '/devices/ebike.png',                manufacturer: 'VanMoof',     model: 'S5',        protocol: 'Bluetooth', protocolIcon: mdiBluetooth },
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

// ─────────────────────────────────────────────────────────────────────────────
// The discovery pile — what the home found and hasn't been told what to do with.
// Home Assistant sorts these three ways: waiting to be set up, set up, and
// ignored ("not mine"). The store overlay shows the first and last; the middle
// one is already the brand's "Already here" check.
//
// The entries themselves come from the connected instance (see
// `subscribeDiscoveryFlows`). What lives here is the *verdict* — which of the
// three answers each one has been given. Kept separate because a real flow is
// read-only from this prototype's side: answering one for real means starting a
// config flow and calling `config_entries/ignore_flow`, which changes the
// person's actual home, so the answer stays local for now.
// ponytail: point setVerdict at flow/start + ignore_flow when the prototype is
// meant to really set things up.
// ─────────────────────────────────────────────────────────────────────────────

export type DiscoveryVerdict = 'waiting' | 'setUp' | 'ignored';

/** A device the home found — from a real discovery flow, or a demo stand-in. */
export interface Discovery {
  /** Flow id when real, a catalogue slug in demo mode. */
  id: string;
  /** The thing's own name, as HA would print it. */
  title: string;
  /** Who makes it, and what it is — the brand, plus a model or category. */
  subtitle: string;
  /** How the home came across it, in plain words. */
  foundBy: string;
  /** Brand domain, for the real logo. */
  domain?: string;
  /** Demo only: the product render. */
  image?: string;
  /** Glyph for the transport it was found over. */
  protocolIcon: string;
  verdict: DiscoveryVerdict;
}

const verdicts = new Map<string, DiscoveryVerdict>();
let verdictVersion = 0;
const verdictListeners = new Set<() => void>();

export function subscribeVerdicts(listener: () => void): () => void {
  verdictListeners.add(listener);
  return () => { verdictListeners.delete(listener); };
}
export const getVerdictVersion = () => verdictVersion;
export const getServerVerdictVersion = () => 0;
export const verdictOf = (id: string): DiscoveryVerdict => verdicts.get(id) ?? 'waiting';

export function setDiscoveryVerdict(id: string, verdict: DiscoveryVerdict): void {
  verdicts.set(id, verdict);
  verdictVersion += 1;
  verdictListeners.forEach((l) => l());
}

// ── Reading a real flow ─────────────────────────────────────────────────────

/** HA's discovery sources, said the way you'd say them out loud. */
const SOURCE_LABEL: Record<string, string> = {
  zeroconf: 'Found on your network',
  dhcp: 'Joined your network',
  ssdp: 'Found on your network',
  homekit: 'Found on your network',
  bluetooth: 'Found over Bluetooth',
  usb: 'Plugged in here',
  mqtt: 'Announced itself to your home',
  hassio: 'Came with an add-on',
  integration_discovery: 'Found by something you already have',
  reauth: 'Needs signing in again',
};

const SOURCE_ICON: Record<string, string> = {
  bluetooth: mdiBluetooth,
  usb: mdiUsbPort,
};

/** Title placeholders worth showing as the name, best first. */
const NAME_KEYS = ['name', 'title', 'hostname', 'model', 'device'];

/**
 * A flow, read as a device. HA's own cards are built the same way — the flow
 * carries whatever the discovery protocol happened to say, so the name is
 * whichever placeholder is there, and the brand fills in for the ones that
 * arrive with nothing at all (a bare `cast` or `roborock` find).
 */
export function discoveryFromFlow(
  flow: { flow_id: string; handler: string; context: { source: string; title_placeholders?: Record<string, string> } },
  brandName?: string,
): Discovery {
  const tp = flow.context.title_placeholders ?? {};
  const brand = brandName ?? flow.handler;
  const named = NAME_KEYS.map((k) => tp[k]).find(Boolean);
  // The extra placeholders that aren't the name are the model or category —
  // exactly what belongs on the second line, after who makes it.
  const extras = Object.entries(tp)
    .filter(([k, v]) => v && v !== named && k !== 'ip_address' && k !== 'serial_number')
    .map(([, v]) => v);
  return {
    id: flow.flow_id,
    title: named ?? brand,
    // No second line when the brand *is* the name — either because the flow
    // arrived with no placeholders at all (`cast`, `mqtt`) or because what it
    // announced itself as is the brand (a stock `WLED`). "WLED / WLED" reads
    // like a bug; the "found by" line carries that card on its own.
    subtitle: [named && named.toLowerCase() !== brand.toLowerCase() ? brand : null, ...extras]
      .filter(Boolean)
      .join(' · '),
    foundBy: SOURCE_LABEL[flow.context.source] ?? 'Found on your network',
    domain: flow.handler,
    protocolIcon: SOURCE_ICON[flow.context.source] ?? mdiAccessPointNetwork,
    verdict: verdictOf(flow.flow_id),
  };
}

// ── Demo mode ───────────────────────────────────────────────────────────────
// Only when there's no instance to ask. Never mixed with real finds: a home that
// is connected shows what it actually found, even when that is nothing.

let demoSeed: DiscoverableDevice[] = [];

const demoId = (d: DiscoverableDevice) =>
  `demo:${d.manufacturer}-${d.model}`.toLowerCase().replace(/[^a-z0-9:]+/g, '-');

/** Four stand-in finds, so the shelf has something to be designed against. */
export function demoDiscoveries(): Discovery[] {
  if (demoSeed.length === 0) demoSeed = pickDiscoveries(4);
  return demoSeed.map((d) => ({
    id: demoId(d),
    title: d.name,
    subtitle: `${d.manufacturer} ${d.model}`,
    foundBy: `Found over ${d.protocol}`,
    image: d.image,
    protocolIcon: d.protocolIcon,
    verdict: verdictOf(demoId(d)),
  }));
}
