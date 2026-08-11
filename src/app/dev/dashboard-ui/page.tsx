'use client';

import { useState } from 'react';
import { mdiChevronRight, mdiLightbulbOutline, mdiMinus, mdiPause, mdiPlay, mdiPlus, mdiStop } from '@mdi/js';
import {
  ControlButton,
  ControlGrid,
  ControlSlider,
  DateTimeInput,
  NumberInput,
  OptionControl,
  ReadRow,
  ReadoutCell,
  TextControl,
} from '@/components/cards/DeviceControls';
import {
  CircularProgress,
  Dropdown,
  Icon,
  ListSection,
  RollingNumericValue,
  SectionLabel,
  SegmentedControl,
  StateTimeline,
  ToggleSwitch,
} from '@/components/ui';
import { Sparkline } from '@/components/ui/Sparkline';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard UI — every control the device card and its dialog are built from,
// on one page, driven by local state instead of Home Assistant. This is the
// bento kit: what a control looks like, what shape means, and which one to
// reach for. Nothing here talks to an instance, so it renders identically with
// or without a connection.
// ─────────────────────────────────────────────────────────────────────────────

/** Fixed clock so the demo history is deterministic (and lint-pure). */
const NOW = 1_770_000_000;

const CURVE = Array.from({ length: 48 }, (_, i) => 20 + Math.sin(i / 5) * 3 + Math.sin(i / 1.7));

const TIMELINE = [
  { state: 'off', start: NOW - 86_400, end: NOW - 61_200 },
  { state: 'on', start: NOW - 61_200, end: NOW - 54_000 },
  { state: 'off', start: NOW - 54_000, end: NOW - 21_600 },
  { state: 'on', start: NOW - 21_600, end: NOW - 10_800 },
  { state: 'unavailable', start: NOW - 10_800, end: NOW - 9_000 },
  { state: 'off', start: NOW - 9_000, end: NOW },
];

function Spec({ name, rule, children }: { name: string; rule: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-ha-2">
      <div>
        <p className="text-sm font-semibold text-text-primary">{name}</p>
        <p className="text-xs text-text-tertiary">{rule}</p>
      </div>
      <div className="rounded-ha-2xl bg-surface-default p-ha-4">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-ha-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="grid gap-ha-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default function DashboardUiPage() {
  const [brightness, setBrightness] = useState(64);
  const [kelvin, setKelvin] = useState(3200);
  const [offset, setOffset] = useState(-1.5);
  const [mode, setMode] = useState('heat_cool');
  const [effect, setEffect] = useState('Candle');
  const [name, setName] = useState('Guest');
  const [time, setTime] = useState('07:30');
  const [on, setOn] = useState(true);
  const [span, setSpan] = useState('24h');
  const [aggregation, setAggregation] = useState('auto');
  const [rows, setRows] = useState(['Ceiling light', 'Motion', 'Temperature', 'Battery']);

  // Same signature the dialog uses: the dragged row's id, and the row it lands
  // above (null = end of the list).
  const reorder = (fromId: string, beforeId: string | null) => {
    setRows(prev => {
      const rest = prev.filter(r => r !== fromId);
      const idx = beforeId ? rest.indexOf(beforeId) : -1;
      if (idx >= 0) rest.splice(idx, 0, fromId); else rest.push(fromId);
      return rest;
    });
  };

  return (
    <div className="min-h-screen bg-surface-lower px-ha-6 py-ha-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-ha-8">
        <header>
          <h1 className="text-3xl font-bold text-text-primary">Dashboard UI</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            The controls the device card and its dialog are assembled from. Shape carries
            the affordance: anything you press is a full pill, anything that only shows a
            value is a bordered rectangle, and anything you set sits on a 48px surface row.
          </p>
        </header>

        <Group title="Press">
          <Spec name="ControlButton" rule="Full pill at any width — icon or text, one or many columns.">
            <ControlGrid cols={4}>
              <ControlButton label="Play" icon={mdiPlay} onClick={() => {}} />
              <ControlButton label="Pause" icon={mdiPause} onClick={() => {}} />
              <ControlButton label="Stop" icon={mdiStop} onClick={() => {}} />
              <ControlButton label="Identify" text="Identify" onClick={() => {}} />
              <ControlButton label="Open cover" text="Open" span={2} onClick={() => {}} />
              <ControlButton label="Locate" text="Locate" span={2} variant="primary" onClick={() => {}} />
            </ControlGrid>
          </Spec>

          <Spec name="ControlButton · pressed" rule="Active state is the blue fill, not a border swap.">
            <ControlGrid cols={3}>
              <ControlButton label="Auto" text="Auto" pressed onClick={() => {}} />
              <ControlButton label="Eco" text="Eco" onClick={() => {}} />
              <ControlButton label="Boost" text="Boost" onClick={() => {}} />
            </ControlGrid>
          </Spec>

          <Spec name="ToggleSwitch" rule="Bigger than stock HA on purpose: affordance beats density.">
            <div className="flex items-center gap-ha-4">
              <ToggleSwitch on={on} onToggle={() => setOn(v => !v)} />
              <ToggleSwitch on={on} onToggle={() => setOn(v => !v)} size="lg" />
              <ToggleSwitch on={on} onToggle={() => setOn(v => !v)} size="xl" />
            </div>
          </Spec>

          <Spec name="ReadoutCell" rule="Shows, never presses — bordered rectangle, no fill.">
            <ControlGrid cols={4}>
              <ReadoutCell value="21°" caption="Heat to" />
              <ReadoutCell value="24°" caption="Cool to" />
            </ControlGrid>
          </Spec>
        </Group>

        <Group title="Set">
          <Spec name="ControlSlider" rule="48px track, drag anywhere, value pinned right.">
            <div className="flex flex-col gap-ha-3">
              <ControlSlider
                value={brightness}
                min={0}
                max={100}
                icon={mdiLightbulbOutline}
                ariaLabel="Brightness"
                format={v => `${Math.round(v)}%`}
                onCommit={setBrightness}
              />
              <ControlSlider
                value={brightness}
                min={0}
                max={100}
                ariaLabel="Brightness (light colour)"
                format={v => `${Math.round(v)}%`}
                fillColor="rgba(255, 170, 60, 0.55)"
                onCommit={setBrightness}
              />
              <ControlSlider
                value={kelvin}
                min={2000}
                max={6500}
                step={50}
                ariaLabel="Colour temperature"
                format={v => `${(v / 1000).toFixed(1)}k`}
                trackStyle={{ background: 'linear-gradient(to right, #ffb46b 0%, #fff3e0 50%, #cfe4ff 100%)', opacity: 0.9 }}
                onCommit={setKelvin}
              />
            </div>
          </Spec>

          <Spec name="NumberInput" rule="Writable numbers are typed, unit suffixed right. ± flank it.">
            <div className="flex w-full items-center gap-ha-2">
              <ControlButton label="Decrease" icon={mdiMinus} onClick={() => setOffset(v => Math.max(-5, v - 0.5))} />
              <NumberInput value={offset} min={-5} max={5} unit="°C" onCommit={setOffset} />
              <ControlButton label="Increase" icon={mdiPlus} onClick={() => setOffset(v => Math.min(5, v + 0.5))} />
            </div>
          </Spec>

          <Spec name="OptionControl" rule="One active value out of a list is always a dropdown, never a pill row.">
            <div className="flex flex-col gap-ha-2">
              <OptionControl label="Mode" options={['off', 'heat', 'cool', 'heat_cool', 'dry', 'fan_only']} value={mode} onSelect={setMode} />
              <OptionControl label="Effect" options={['None', 'Candle', 'Fireplace', 'Colorloop']} value={effect} onSelect={setEffect} />
            </div>
          </Spec>

          <Spec name="TextControl / DateTimeInput" rule="Commit on Enter or the check — never per keystroke.">
            <div className="flex flex-col gap-ha-2">
              <TextControl value={name} ariaLabel="Name" onCommit={setName} />
              <DateTimeInput type="time" value={time} ariaLabel="Wake time" onCommit={setTime} />
            </div>
          </Spec>
        </Group>

        <Group title="Show">
          <Spec name="RollingNumericValue" rule="Digits roll; direction follows the cursor when scrubbing a chart.">
            <div className="flex items-baseline gap-ha-3">
              <RollingNumericValue value={String(brightness)} className="font-mono text-4xl font-bold text-text-primary" />
              <span className="font-mono text-lg text-text-secondary">%</span>
              <RollingNumericValue value={offset.toFixed(1)} direction="down" className="ml-ha-4 font-mono text-2xl font-bold text-text-primary" />
            </div>
          </Spec>

          <Spec name="CircularProgress" rule="A reading with a known range is a position on a scale — draw the scale.">
            <div className="flex justify-center">
              <CircularProgress progress={brightness / 100} size={132} strokeWidth={10} trackClassName="text-surface-low">
                <span className="flex items-baseline">
                  <RollingNumericValue value={String(brightness)} className="font-mono text-3xl font-bold text-text-primary" />
                  <span className="ml-1 font-mono text-sm text-text-secondary">%</span>
                </span>
              </CircularProgress>
            </div>
          </Spec>

          <Spec name="ReadRow" rule="Domains whose controls are really information.">
            <div className="flex flex-col">
              <ReadRow label="Firmware" value="2026.7.1" />
              <ReadRow label="Signal" value="-63 dBm" />
            </div>
          </Spec>

          <Spec name="Sparkline / StateTimeline" rule="Numeric gets a curve; everything else gets duration bands.">
            <div className="flex flex-col gap-ha-3">
              <div className="h-16 w-full">
                <Sparkline points={CURVE} on gradientId="dashboard-ui-spark" fillHeight />
              </div>
              <StateTimeline segments={TIMELINE} startTs={NOW - 86_400} endTs={NOW} compact />
              <StateTimeline segments={TIMELINE} startTs={NOW - 86_400} endTs={NOW} />
            </div>
          </Spec>
        </Group>

        <Group title="Navigate">
          <Spec name="SegmentedControl + span picker" rule="Full width; 'All' hands off to Home Assistant's own history.">
            <div className="flex flex-col gap-ha-2">
              <SegmentedControl
                segments={[{ value: 'controls', label: 'Controls' }, { value: 'history', label: 'History' }]}
                value="controls"
                onChange={() => {}}
              />
              <div className="flex w-full items-center gap-[2px] rounded-ha-xl bg-surface-mid p-[3px]">
                {['1h', '6h', '24h', '7d', '30d'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpan(s)}
                    aria-pressed={span === s}
                    className={
                      'flex-1 rounded-ha-lg px-ha-3 py-1.5 text-xs font-medium transition-all duration-200 ' +
                      (span === s ? 'bg-surface-default text-text-primary' : 'text-text-secondary hover:text-text-primary')
                    }
                  >
                    {s}
                  </button>
                ))}
                <span className="flex w-9 shrink-0 items-center justify-center rounded-ha-lg py-1.5 text-text-secondary">
                  <Icon path={mdiChevronRight} size={18} />
                </span>
              </div>
              <Dropdown
                options={[{ value: 'auto', label: 'Auto' }, { value: 'avg', label: 'Average' }, { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' }]}
                value={aggregation}
                onChange={setAggregation}
              />
            </div>
          </Spec>

          <Spec name="ListSection" rule="Inset heading over one bordered card; rows divide themselves. Drag to rearrange — the landing line and the drop highlight come free.">
            <ListSection title="On this device" onReorder={reorder}>
              {rows.map(row => (
                <div key={row} className="flex items-center justify-between gap-ha-3 px-ha-4 py-ha-3">
                  <span className="text-sm text-text-primary">{row}</span>
                  <span className="font-mono text-sm text-text-secondary">—</span>
                </div>
              ))}
            </ListSection>
          </Spec>
        </Group>
      </div>
    </div>
  );
}
