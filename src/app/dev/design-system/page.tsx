'use client';

import { useState, useRef } from 'react';
import {
  mdiLightbulb,
  mdiThermometer,
  mdiSpeaker,
  mdiFlash,
  mdiMotionSensor,
  mdiHomeAutomation,
  mdiBed,
  mdiWeatherSunny,
  mdiCheck,
  mdiClose,
  mdiPencil,
  mdiCog,
  mdiPlus,
  mdiChevronRight,
  mdiHome,
  mdiWifi,
  mdiAccount,
  mdiAutoFix,
  mdiAlertCircle,
  mdiCheckCircle,
} from '@mdi/js';
import { useToast } from '@/contexts';
import { Button } from '@/components/ui/Button';
import { HALoader } from '@/components/ui/HALoader';
import { RollingNumericValue } from '@/components/ui/RollingNumericValue';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { AddMenu } from '@/components/ui/AddMenu';
import { Avatar } from '@/components/ui/Avatar';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sparkline } from '@/components/ui/Sparkline';
import { Tooltip } from '@/components/ui/Tooltip';
import { ListSection } from '@/components/ui/ListSection';
import { Icon } from '@/components/ui/Icon';
import { SummaryCard } from '@/components/cards/SummaryCard';
import { EntityCard } from '@/components/cards/EntityCard';
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-ha-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-surface-lower pb-ha-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-ha-2">
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-ha-3 items-start">{children}</div>
    </div>
  );
}

function PropTag({ name, value }: { name: string; value: string }) {
  return (
    <span className="inline-flex gap-1 text-[13px] font-mono bg-surface-mid rounded px-1.5 py-0.5">
      <span className="text-text-tertiary">{name}=</span>
      <span className="text-text-primary">&quot;{value}&quot;</span>
    </span>
  );
}

// ── Sparkline sample data ─────────────────────────────────────────────────────

const SPARK_POINTS = [12, 18, 14, 22, 20, 26, 24, 28, 22, 30, 27, 32, 28, 35, 30];
const SPARK_POINTS_2 = [30, 28, 25, 22, 18, 20, 16, 14, 18, 12, 15, 10, 8, 12, 9];

// ── Color token list ──────────────────────────────────────────────────────────

const SURFACE_TOKENS = [
  { name: 'surface-default', cls: 'bg-surface-default border border-surface-lower' },
  { name: 'surface-low', cls: 'bg-surface-low' },
  { name: 'surface-mid', cls: 'bg-surface-mid' },
  { name: 'surface-lower', cls: 'bg-surface-lower' },
];

const FILL_TOKENS = [
  { name: 'fill-primary-normal', cls: 'bg-fill-primary-normal' },
  { name: 'fill-primary-quiet', cls: 'bg-fill-primary-quiet border border-surface-lower' },
  { name: 'fill-danger-normal', cls: 'bg-fill-danger-normal' },
  { name: 'fill-success-normal', cls: 'bg-fill-success-normal' },
  { name: 'yellow-95', cls: 'bg-yellow-95' },
];

const BRAND_TOKENS = [
  { name: 'ha-blue', cls: 'bg-ha-blue' },
  { name: 'green-500', cls: 'bg-green-500' },
  { name: 'yellow-500', cls: 'bg-yellow-500' },
];

const TEXT_TOKENS = [
  { name: 'text-primary', cls: 'text-text-primary' },
  { name: 'text-secondary', cls: 'text-text-secondary' },
  { name: 'text-tertiary', cls: 'text-text-tertiary' },
  { name: 'text-disabled', cls: 'text-text-disabled' },
];

// ── Device thumbnails ────────────────────────────────────────────────────────
// Product renders shown on device cards, mapped by deviceThumbnail() off
// domain + device_class + name keyword. Files live in /public/devices.

const DEVICE_THUMBS: { group: string; items: { file: string; label: string }[] }[] = [
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
    group: 'Appliances & infrastructure (new)',
    items: [
      { file: 'robot_vacuum', label: 'Robot vacuum' },
      { file: 'washing_machine', label: 'Washing machine' },
      { file: 'dishwasher', label: 'Dishwasher' },
      { file: 'fridge', label: 'Fridge' },
      { file: 'water_valve', label: 'Water valve' },
      { file: 'irrigation_controller', label: 'Irrigation controller' },
      { file: 'ev_charger', label: 'EV charger' },
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
      { file: 'laptop', label: 'Laptop' },
      { file: 'wall_tablet', label: 'Wall tablet' },
    ],
  },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [seg, setSeg] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();

  return (
    <div className="min-h-screen bg-surface-lower overflow-y-auto">
      <div className="max-w-4xl mx-auto px-ha-4 py-ha-8 space-y-ha-8">

        {/* Header */}
        <div>
          <a href="/" className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-ha-3 transition-colors">
            <Icon path={mdiChevronRight} size={12} className="rotate-180" />
            Back to app
          </a>
          <h1 className="text-2xl font-bold text-text-primary">Design System</h1>
          <p className="text-sm text-text-secondary mt-ha-1">
            Living reference — all UI components, tokens, and variants.
          </p>
        </div>

        {/* ── Colors ──────────────────────────────────────────────────────────── */}
        <Section title="Colors">
          <Row label="Surface">
            {SURFACE_TOKENS.map(t => (
              <div key={t.name} className="space-y-ha-1">
                <div className={`w-16 h-10 rounded-ha-lg ${t.cls}`} />
                <p className="text-[13px] font-mono text-text-tertiary">{t.name}</p>
              </div>
            ))}
          </Row>
          <Row label="Fill">
            {FILL_TOKENS.map(t => (
              <div key={t.name} className="space-y-ha-1">
                <div className={`w-16 h-10 rounded-ha-lg ${t.cls}`} />
                <p className="text-[13px] font-mono text-text-tertiary">{t.name}</p>
              </div>
            ))}
          </Row>
          <Row label="Brand">
            {BRAND_TOKENS.map(t => (
              <div key={t.name} className="space-y-ha-1">
                <div className={`w-16 h-10 rounded-ha-lg ${t.cls}`} />
                <p className="text-[13px] font-mono text-text-tertiary">{t.name}</p>
              </div>
            ))}
          </Row>
          <Row label="Text">
            {TEXT_TOKENS.map(t => (
              <div key={t.name} className={`text-sm font-medium ${t.cls}`}>{t.name}</div>
            ))}
          </Row>
        </Section>

        {/* ── Typography ──────────────────────────────────────────────────────── */}
        <Section title="Typography">
          <div className="space-y-ha-2 bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower">
            {[
              { label: 'text-2xl font-bold', cls: 'text-2xl font-bold', sample: 'Heading 2XL' },
              { label: 'text-xl font-semibold', cls: 'text-xl font-semibold', sample: 'Heading XL' },
              { label: 'text-lg font-semibold', cls: 'text-lg font-semibold', sample: 'Heading LG' },
              { label: 'text-base font-medium', cls: 'text-base font-medium', sample: 'Body Base' },
              { label: 'text-sm', cls: 'text-sm', sample: 'Body SM — secondary text, descriptions' },
              { label: 'text-xs', cls: 'text-xs text-text-secondary', sample: 'Caption XS — labels, captions, metadata' },
              { label: 'text-[13px] font-mono', cls: 'text-[13px] font-mono text-text-tertiary', sample: 'MONO 10 — token labels, code badges' },
            ].map(r => (
              <div key={r.label} className="flex items-baseline gap-ha-4">
                <span className={`flex-1 text-text-primary ${r.cls}`}>{r.sample}</span>
                <code className="text-[13px] font-mono text-text-tertiary shrink-0">{r.label}</code>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Spacing ─────────────────────────────────────────────────────────── */}
        <Section title="Spacing">
          <div className="flex flex-wrap gap-ha-4 bg-surface-default p-ha-4 rounded-ha-2xl border border-surface-lower">
            {[1,2,3,4,5,6,7,8].map(n => (
              <div key={n} className="flex flex-col items-center gap-ha-1">
                <div className="bg-ha-blue rounded" style={{ width: n * 4, height: n * 4 }} />
                <span className="text-[13px] font-mono text-text-tertiary">ha-{n}</span>
                <span className="text-[13px] text-text-disabled">{n * 4}px</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Border Radius ───────────────────────────────────────────────────── */}
        <Section title="Border Radius">
          <div className="flex flex-wrap gap-ha-4 bg-surface-default p-ha-4 rounded-ha-2xl border border-surface-lower">
            {[
              { name: 'md', cls: 'rounded-ha-md' },
              { name: 'lg', cls: 'rounded-ha-lg' },
              { name: 'xl', cls: 'rounded-ha-xl' },
              { name: '2xl', cls: 'rounded-ha-2xl' },
              { name: '3xl', cls: 'rounded-ha-3xl' },
              { name: 'pill', cls: 'rounded-ha-pill' },
            ].map(r => (
              <div key={r.name} className="flex flex-col items-center gap-ha-1">
                <div className={`w-12 h-12 bg-fill-primary-normal ${r.cls}`} />
                <span className="text-[13px] font-mono text-text-tertiary">{r.name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Button ──────────────────────────────────────────────────────────── */}
        <Section title="Button">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="variant">
              <div className="flex flex-col gap-ha-1 items-start">
                <Button variant="default">Default</Button>
                <PropTag name="variant" value="default" />
              </div>
              <div className="flex flex-col gap-ha-1 items-start">
                <Button variant="primary">Primary</Button>
                <PropTag name="variant" value="primary" />
              </div>
              <div className="flex flex-col gap-ha-1 items-start">
                <Button variant="ghost">Ghost</Button>
                <PropTag name="variant" value="ghost" />
              </div>
            </Row>
            <Row label="size">
              <div className="flex flex-col gap-ha-1 items-start">
                <Button size="sm" icon={mdiCog} />
                <PropTag name="size" value="sm" />
              </div>
              <div className="flex flex-col gap-ha-1 items-start">
                <Button size="md" icon={mdiCog} />
                <PropTag name="size" value="md (default)" />
              </div>
              <div className="flex flex-col gap-ha-1 items-start">
                <Button size="lg" icon={mdiCog} />
                <PropTag name="size" value="lg" />
              </div>
            </Row>
            <Row label="icon + label">
              <Button icon={mdiPlus}>Add device</Button>
              <Button variant="primary" icon={mdiCheck}>Save</Button>
              <Button variant="ghost" icon={mdiClose}>Cancel</Button>
            </Row>
          </div>
        </Section>

        {/* ── Avatar ──────────────────────────────────────────────────────────── */}
        <Section title="Avatar">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="size — initials fallback">
              {(['xs','sm','md','lg','xl'] as const).map(s => (
                <div key={s} className="flex flex-col gap-ha-1 items-center">
                  <Avatar size={s} initials="MB" />
                  <PropTag name="size" value={s} />
                </div>
              ))}
            </Row>
            <Row label="with src">
              <Avatar size="lg" src="https://i.pravatar.cc/80" alt="User" />
              <Avatar size="md" src="https://i.pravatar.cc/40" alt="User" />
            </Row>
          </div>
        </Section>

        {/* ── CircularProgress ────────────────────────────────────────────────── */}
        <Section title="CircularProgress">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="progress values">
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                <div key={p} className="flex flex-col gap-ha-1 items-center">
                  <CircularProgress progress={p} size={48} strokeWidth={4}>
                    <span className="text-[13px] font-mono text-text-secondary">{Math.round(p * 100)}%</span>
                  </CircularProgress>
                  <PropTag name="progress" value={String(p)} />
                </div>
              ))}
            </Row>
            <Row label="size">
              {[24, 32, 48, 64].map(sz => (
                <div key={sz} className="flex flex-col gap-ha-1 items-center">
                  <CircularProgress progress={0.6} size={sz} strokeWidth={Math.max(2, sz / 12)} />
                  <PropTag name="size" value={String(sz)} />
                </div>
              ))}
            </Row>
            <Row label="custom color">
              <CircularProgress progress={0.7} size={48} strokeWidth={4} className="text-green-500" />
              <CircularProgress progress={0.4} size={48} strokeWidth={4} className="text-yellow-500" />
              <CircularProgress progress={0.9} size={48} strokeWidth={4} className="text-red-500" />
            </Row>
          </div>
        </Section>

        {/* ── SegmentedControl ────────────────────────────────────────────────── */}
        <Section title="SegmentedControl">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="2 segments">
              <SegmentedControl
                segments={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
                value={seg === 'all' ? 'on' : 'off'}
                onChange={() => {}}
              />
            </Row>
            <Row label="3 segments (interactive)">
              <SegmentedControl
                segments={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                value={seg}
                onChange={setSeg}
              />
            </Row>
          </div>
        </Section>

        {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
        <Section title="Tooltip">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower">
            <Row label="placement">
              {(['top','bottom','left','right'] as const).map(p => (
                <div key={p} className="flex flex-col gap-ha-1 items-center">
                  <Tooltip content={`Tooltip ${p}`} placement={p}>
                    <Button size="sm">{p}</Button>
                  </Tooltip>
                  <PropTag name="placement" value={p} />
                </div>
              ))}
            </Row>
          </div>
        </Section>

        {/* ── Sparkline ───────────────────────────────────────────────────────── */}
        <Section title="Sparkline">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="on=true (green)">
              <div className="w-64 border border-surface-lower rounded-ha-lg overflow-hidden">
                <Sparkline points={SPARK_POINTS} on gradientId="spark-on" />
              </div>
            </Row>
            <Row label="on=false (grey)">
              <div className="w-64 border border-surface-lower rounded-ha-lg overflow-hidden">
                <Sparkline points={SPARK_POINTS_2} on={false} gradientId="spark-off" />
              </div>
            </Row>
            <Row label="small=true">
              <div className="w-64 border border-surface-lower rounded-ha-lg overflow-hidden">
                <Sparkline points={SPARK_POINTS} on small gradientId="spark-sm" />
              </div>
            </Row>
          </div>
        </Section>

        {/* ── ListSection ─────────────────────────────────────────────────────── */}
        <Section title="ListSection">
          <div className="space-y-ha-4">
            <ListSection title="With title">
              <div className="flex items-center justify-between px-ha-4 py-ha-3">
                <span className="text-sm text-text-primary">Row item one</span>
                <Icon path={mdiChevronRight} size={16} className="text-text-tertiary" />
              </div>
              <div className="flex items-center justify-between px-ha-4 py-ha-3">
                <span className="text-sm text-text-primary">Row item two</span>
                <Icon path={mdiChevronRight} size={16} className="text-text-tertiary" />
              </div>
              <div className="flex items-center justify-between px-ha-4 py-ha-3">
                <span className="text-sm text-text-secondary">Row item three (muted)</span>
              </div>
            </ListSection>
            <ListSection>
              <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
                <Icon path={mdiAccount} size={18} className="text-text-secondary" />
                <span className="text-sm text-text-primary">No title variant</span>
              </div>
              <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
                <Icon path={mdiCog} size={18} className="text-text-secondary" />
                <span className="text-sm text-text-primary">Settings row</span>
              </div>
            </ListSection>
          </div>
        </Section>

        {/* ── SummaryCard ─────────────────────────────────────────────────────── */}
        <Section title="SummaryCard">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="color (full, filled, sm)">
              {(['default','primary','danger','success','yellow'] as const).map(c => (
                <div key={c} className="flex flex-col gap-ha-1 items-start">
                  <SummaryCard icon={mdiLightbulb} title="Lights" state={c} color={c} />
                  <PropTag name="color" value={c} />
                </div>
              ))}
            </Row>
            <Row label="compact + color">
              {(['default','primary','danger','success','yellow'] as const).map(c => (
                <SummaryCard key={c} icon={mdiFlash} title="Power" state="On" color={c} compact />
              ))}
            </Row>
            <Row label="variant=outlined">
              <SummaryCard icon={mdiThermometer} title="Temp" state="21°C" variant="outlined" />
              <SummaryCard icon={mdiThermometer} title="Temp" state="21°C" variant="outlined" compact />
            </Row>
            <Row label="compact size">
              {(['sm','md','lg'] as const).map(s => (
                <div key={s} className="flex flex-col gap-ha-1 items-start">
                  <SummaryCard icon={mdiLightbulb} title="Lights" state="5 on" compact size={s} color="primary" />
                  <PropTag name="size" value={s} />
                </div>
              ))}
            </Row>
          </div>
        </Section>

        {/* ── EntityCard ──────────────────────────────────────────────────────── */}
        <Section title="EntityCard">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="color variants (size=sm)">
              {(['default','primary','danger','success','yellow'] as const).map(c => (
                <div key={c} className="flex flex-col gap-ha-1 items-start">
                  <EntityCard icon={mdiLightbulb} title="Light" state="On" color={c} />
                  <PropTag name="color" value={c} />
                </div>
              ))}
            </Row>
            <Row label="size=lg">
              <EntityCard icon={mdiThermometer} title="Temperature" state="22°C" size="lg" color="primary" />
              <EntityCard icon={mdiMotionSensor} title="Motion" state="Detected" size="lg" color="danger" />
            </Row>
            <Row label="with increment/decrement">
              <EntityCard
                icon={mdiLightbulb}
                title="Brightness"
                state="75%"
                color="primary"
                count={75}
                onIncrement={() => {}}
                onDecrement={() => {}}
              />
            </Row>
          </div>
        </Section>

        {/* ── DeviceCardV2 ────────────────────────────────────────────────────── */}
        <Section title="DeviceCardV2">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">

            <Row label="single entity — inactive / active / unavailable">
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'light.desk', icon: mdiLightbulb, name: 'Desk Light', state: 'off' }}
                />
              </div>
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'light.desk', icon: mdiLightbulb, name: 'Desk Light', state: 'on', active: true, toggleable: true, onToggle: () => {} }}
                />
              </div>
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'light.desk', icon: mdiLightbulb, name: 'Desk Light', state: 'unavailable' }}
                />
              </div>
            </Row>

            <Row label="numeric read-only (unit prop)">
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'sensor.temp', icon: mdiThermometer, name: 'Temperature', state: '22.4', unit: '°C', active: true }}
                />
              </div>
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'sensor.power', icon: mdiFlash, name: 'Power', state: '142', unit: 'W', active: true }}
                />
              </div>
            </Row>

            <Row label="pressable entity">
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'script.good_night', icon: mdiBed, name: 'Good Night', state: 'off', pressable: true, onToggle: () => {} }}
                />
              </div>
            </Row>

            <Row label="secondary entities (sm row)">
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'light.living', icon: mdiLightbulb, name: 'Living Light', state: 'on', active: true, toggleable: true, onToggle: () => {} }}
                  secondary={[
                    { entityId: 'sensor.temp', icon: mdiThermometer, name: 'Temp', state: '22°C', size: 'sm' },
                    { entityId: 'sensor.humid', icon: mdiWifi, name: 'Signal', state: '-62 dBm', size: 'sm' },
                  ]}
                />
              </div>
            </Row>

            <Row label="selected + editMode">
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'light.desk', icon: mdiLightbulb, name: 'Desk Light', state: 'on', active: true }}
                  selected
                />
              </div>
              <div className="w-64">
                <DeviceCardV2
                  primary={{ entityId: 'light.desk', icon: mdiLightbulb, name: 'Desk Light', state: 'on', active: true }}
                  editMode
                />
              </div>
            </Row>
          </div>
        </Section>

        {/* ── Icon ────────────────────────────────────────────────────────────── */}
        <Section title="Icon">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="size">
              {[12, 16, 20, 24, 32, 40, 48].map(sz => (
                <div key={sz} className="flex flex-col gap-ha-1 items-center">
                  <Icon path={mdiHomeAutomation} size={sz} className="text-ha-blue" />
                  <span className="text-[13px] font-mono text-text-tertiary">{sz}</span>
                </div>
              ))}
            </Row>
            <Row label="color">
              {[
                ['text-ha-blue', mdiLightbulb],
                ['text-green-500', mdiCheck],
                ['text-yellow-500', mdiWeatherSunny],
                ['text-red-500', mdiClose],
                ['text-text-secondary', mdiCog],
                ['text-text-tertiary', mdiHome],
              ].map(([cls, path]) => (
                <div key={cls as string} className="flex flex-col gap-ha-1 items-center">
                  <Icon path={path as string} size={24} className={cls as string} />
                  <span className="text-[13px] font-mono text-text-tertiary">{(cls as string).replace('text-', '')}</span>
                </div>
              ))}
            </Row>
          </div>
        </Section>

        {/* ── HALoader ────────────────────────────────────────────────────────── */}
        <Section title="HALoader">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="size">
              {(['sm','md','lg'] as const).map(s => (
                <div key={s} className="flex flex-col gap-ha-2 w-48">
                  <HALoader size={s} />
                  <PropTag name="size" value={s} />
                </div>
              ))}
            </Row>
          </div>
        </Section>

        {/* ── RollingNumericValue ──────────────────────────────────────────────── */}
        <Section title="RollingNumericValue">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="values">
              <RollingNumericValue value="22.4°C" className="text-2xl font-bold" />
              <RollingNumericValue value="142 W" className="text-xl font-semibold text-ha-blue" />
              <RollingNumericValue value="98.6%" className="text-lg font-medium text-green-500" />
              <RollingNumericValue value="-12.3" className="text-base text-text-secondary" />
            </Row>
          </div>
        </Section>

        {/* ── ModalSheet ──────────────────────────────────────────────────────── */}
        <Section title="ModalSheet">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-3">
            <p className="text-xs text-text-secondary">Desktop: centered card. Mobile: bottom sheet. Click outside to close.</p>
            <Button onClick={() => setModalOpen(true)} icon={mdiPlus}>Open modal</Button>
            <ModalSheet open={modalOpen} onClose={() => setModalOpen(false)}>
              <div className="p-ha-5 space-y-ha-3">
                <h3 className="text-lg font-semibold text-text-primary">Modal title</h3>
                <p className="text-sm text-text-secondary">This is a ModalSheet — centered card on desktop, bottom sheet on mobile. Springs in and out.</p>
                <div className="flex gap-ha-2 pt-ha-2">
                  <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm</Button>
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
                </div>
              </div>
            </ModalSheet>
          </div>
        </Section>

        {/* ── AddMenu ─────────────────────────────────────────────────────────── */}
        <Section title="AddMenu">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-3">
            <p className="text-xs text-text-secondary">Desktop: anchored dropdown from button. Mobile: bottom sheet.</p>
            <button
              ref={addMenuAnchorRef}
              onClick={() => setAddMenuOpen(true)}
              className="h-9 px-ha-4 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-sm font-medium text-text-primary transition-colors"
            >
              + Add
            </button>
            <AddMenu isOpen={addMenuOpen} onClose={() => setAddMenuOpen(false)} anchorRef={addMenuAnchorRef} />
          </div>
        </Section>

        {/* ── Toast ───────────────────────────────────────────────────────────── */}
        <Section title="Toast">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-4">
            <Row label="icon + content">
              {[
                { label: 'Default', props: { icon: mdiAutoFix, title: 'Auto-configured', subtitle: '12 devices set up' } },
                { label: 'Success', props: { icon: mdiCheckCircle, iconColor: 'text-green-500', title: 'Saved', subtitle: 'Changes applied successfully' } },
                { label: 'Warning', props: { icon: mdiAlertCircle, iconColor: 'text-amber-500', title: 'Warning', subtitle: 'Something needs attention' } },
                { label: 'No subtitle', props: { icon: mdiAutoFix, title: 'Title only' } },
              ].map(({ label, props }) => (
                <button
                  key={label}
                  onClick={() => showToast(props)}
                  className="h-9 px-ha-4 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-sm font-medium text-text-primary transition-colors"
                >
                  {label}
                </button>
              ))}
            </Row>
            <Row label="with action">
              <button
                onClick={() => showToast({ icon: mdiAutoFix, title: 'With action', subtitle: 'Tap the button to undo', action: { label: 'Undo', onClick: () => {} } })}
                className="h-9 px-ha-4 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-sm font-medium text-text-primary transition-colors"
              >
                With action
              </button>
            </Row>
            <Row label="position">
              <div className="flex flex-col gap-ha-1 items-start">
                <button
                  onClick={() => showToast({ icon: mdiCheckCircle, iconColor: 'text-green-500', title: 'Bottom center', subtitle: 'Default position', position: 'bottom-center' })}
                  className="h-9 px-ha-4 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-sm font-medium text-text-primary transition-colors"
                >
                  bottom-center
                </button>
                <PropTag name="position" value="bottom-center (default)" />
              </div>
              <div className="flex flex-col gap-ha-1 items-start">
                <button
                  onClick={() => showToast({ icon: mdiCheckCircle, iconColor: 'text-ha-blue', title: 'Bottom right', subtitle: 'Slides in from edge', position: 'bottom-right' })}
                  className="h-9 px-ha-4 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-sm font-medium text-text-primary transition-colors"
                >
                  bottom-right
                </button>
                <PropTag name="position" value="bottom-right" />
              </div>
            </Row>
          </div>
        </Section>

        {/* ── Device thumbnails ─────────────────────────────────────────────── */}
        <Section title="Device thumbnails">
          <div className="bg-surface-default rounded-ha-2xl p-ha-5 border border-surface-lower space-y-ha-5">
            <p className="text-xs text-text-secondary">
              Product renders shown top-left of each device card, mapped by <span className="font-mono">deviceThumbnail()</span> off
              domain · device_class · name keyword. Files in <span className="font-mono">/public/devices</span>.
            </p>
            {DEVICE_THUMBS.map(({ group, items }) => (
              <Row key={group} label={group}>
                {items.map(({ file, label }) => (
                  <div key={file} className="flex flex-col items-center gap-ha-1 w-[88px]">
                    <div className="size-[72px] rounded-ha-xl bg-surface-mid flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/devices/${file}.png`} alt={label} className="size-full object-contain" />
                    </div>
                    <span className="text-[11px] text-text-secondary text-center leading-tight">{label}</span>
                    <span className="text-[10px] font-mono text-text-tertiary text-center leading-tight">{file}</span>
                  </div>
                ))}
              </Row>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
