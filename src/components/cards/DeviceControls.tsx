'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  mdiArrowDown,
  mdiArrowExpandVertical,
  mdiArrowUp,
  mdiBrightness6,
  mdiCheck,
  mdiCrosshairsGps,
  mdiDownload,
  mdiHomeImportOutline,
  mdiLock,
  mdiLockOpenVariant,
  mdiMinus,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiRepeat,
  mdiRepeatOff,
  mdiRepeatOnce,
  mdiRestart,
  mdiRotateRight,
  mdiShieldHomeOutline,
  mdiShieldLockOutline,
  mdiShieldMoonOutline,
  mdiShieldOffOutline,
  mdiShuffleVariant,
  mdiSkipForward,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiStop,
  mdiSync,
  mdiThermometer,
  mdiVolumeHigh,
  mdiVolumeMute,
  mdiWaterPercent,
} from '@mdi/js';
import { Dropdown, Icon } from '../ui';
import { useEntity, useHomeAssistant } from '@/hooks/useHomeAssistant';
import { stateLabel } from '@/lib/homeassistant/entityHelpers';
import type { HassEntity } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Domain-specific control surfaces for the more-info panel. Until now every
// entity was toggle-only; these add the actual setters — light brightness /
// color, climate setpoint + HVAC mode, cover position, media transport +
// volume, fan speed — driven by the live entity from the store and calling the
// matching HA services.
// ─────────────────────────────────────────────────────────────────────────────

function attr<T>(e: HassEntity, key: string): T | undefined {
  return e.attributes[key] as T | undefined;
}

// ── Bento control grid ───────────────────────────────────────────────────────

/**
 * Every domain's secondary buttons live in the same grid: uniform 48px cells on
 * a shared column track, so a 1-col pill and a 2-col rounded rect sit flush.
 * `cols` is inlined as a style (Tailwind can't see a dynamic grid-cols-N).
 */
export function ControlGrid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <div className="grid w-full gap-ha-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

/**
 * The shape rule for this bento: anything you press is a full pill, whatever its
 * width. Shape carries the affordance, so a wide two-column action and a small
 * one-column action are obviously the same kind of thing — and obviously not the
 * readouts, which are bordered rectangles (see ReadoutCell).
 */
export function ControlButton({
  label,
  icon,
  text,
  onClick,
  span = 1,
  variant = 'default',
  pressed,
}: {
  label: string;
  icon?: string;
  /** Text cells (mode names) — icon and text are mutually exclusive in practice. */
  text?: string;
  onClick: () => void;
  span?: number;
  variant?: 'default' | 'primary';
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={icon ? label : undefined}
      aria-pressed={pressed}
      onClick={onClick}
      style={span > 1 ? { gridColumn: `span ${span} / span ${span}` } : undefined}
      className={clsx(
        'flex h-12 items-center justify-center rounded-full px-ha-3 text-sm font-semibold capitalize transition-colors',
        variant === 'primary'
          ? 'bg-ha-blue text-white hover:brightness-110'
          : pressed
            ? 'bg-fill-primary-normal text-ha-blue'
            : 'bg-surface-default text-text-secondary hover:bg-surface-low hover:text-text-primary',
      )}
    >
      {icon ? <Icon path={icon} size={22} /> : <span className="truncate">{text}</span>}
    </button>
  );
}

/**
 * A readout — a value the control grid *shows* rather than something you press:
 * the setpoint, the counter, a number in box mode. Bordered rounded rectangle,
 * no fill, so it never reads as a tappable pill.
 */
export function ReadoutCell({
  value,
  caption,
  span = 2,
}: {
  value: React.ReactNode;
  caption?: string;
  span?: number;
}) {
  return (
    <div
      style={span > 1 ? { gridColumn: `span ${span} / span ${span}` } : undefined}
      className="flex h-12 flex-col items-center justify-center rounded-ha-xl border border-surface-mid px-ha-2"
    >
      <span className="text-2xl font-bold font-mono leading-none text-text-primary tabular-nums">{value}</span>
      {caption && <span className="mt-0.5 text-[11px] leading-tight text-text-tertiary">{caption}</span>}
    </div>
  );
}

/** `heat_cool` → `heat cool`, for option labels that come from HA as slugs. */
function words(s: string): string {
  return s.replace(/_/g, ' ');
}

/**
 * Every "pick one of these" control — HVAC modes, select options, presets, fan
 * modes, media sources, vacuum suction, remote activities.
 *
 * Always a dropdown, never a row of buttons: Home Assistant models these as a
 * selector with one active value, and a dropdown says "one of these" where a row
 * of pills says "several actions". It also stops the layout changing shape with
 * the option count (3 modes vs 7 was a pill row vs a dropdown before).
 */
export function OptionControl({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: string[];
  value?: string;
  onSelect: (option: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    // The whole 48px row is the control (Dropdown's `row` variant) — a pill
    // parked at the end of a row was a small target on a wide surface.
    <Dropdown
      variant="row"
      label={label}
      options={options.map(o => ({ value: o, label: words(o) }))}
      value={value ?? ''}
      onChange={onSelect}
    />
  );
}

/**
 * Free-text / code entry (text helpers, alarm and lock codes, a new to-do item).
 * Commits on Enter or the check button — never per keystroke, which would fire a
 * service call for every letter.
 */
export function TextControl({
  value = '',
  placeholder,
  pattern,
  maxLength,
  inputMode,
  clearOnCommit,
  ariaLabel,
  onCommit,
}: {
  value?: string;
  placeholder?: string;
  pattern?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric';
  /** Add-item fields empty themselves; value fields keep what was committed. */
  clearOnCommit?: boolean;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = () => {
    if (draft === value && !clearOnCommit) return;
    onCommit(draft);
    if (clearOnCommit) setDraft('');
  };

  return (
    <div className="flex w-full items-center gap-ha-2">
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        pattern={pattern}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-label={ariaLabel}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        className="h-12 min-w-0 flex-1 rounded-ha-xl bg-surface-default px-ha-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-ha-blue/60"
      />
      <ControlButton label={`Save ${ariaLabel}`} icon={mdiCheck} onClick={commit} />
    </div>
  );
}

/**
 * Numeric entry — a real input you can type into, with the unit pinned to its
 * right edge as a suffix. Commits on Enter or blur (never per keystroke: "1" on
 * the way to "18" would fire a service call), clamped to the entity's range.
 */
export function NumberInput({
  value,
  min,
  max,
  unit,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (draft.trim() === '' || isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <div className="flex h-12 min-w-0 flex-1 items-center gap-ha-2 rounded-ha-xl bg-surface-default px-ha-3 focus-within:ring-2 focus-within:ring-ha-blue/60">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label="Value"
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        className="min-w-0 flex-1 bg-transparent font-mono text-lg font-semibold text-text-primary outline-none tabular-nums"
      />
      {unit && <span className="shrink-0 font-mono text-sm text-text-secondary">{unit}</span>}
    </div>
  );
}

/**
 * A native picker for date / time entities. `<input type="date">` and friends
 * already give a locale-correct, accessible, mobile-friendly picker — there is
 * nothing worth hand-rolling here.
 */
export function DateTimeInput({
  type,
  value,
  ariaLabel,
  onCommit,
}: {
  type: 'date' | 'time' | 'datetime-local';
  value: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      type={type}
      value={value}
      aria-label={ariaLabel}
      onChange={e => e.target.value && onCommit(e.target.value)}
      className="h-12 w-full rounded-ha-xl bg-surface-default px-ha-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60"
    />
  );
}

/**
 * Read-only detail line — for domains whose "controls" are really information.
 * Carries the same white surface as every other control: the dialog's controls
 * are bento tiles on a grey ground, so a bare line would read as a caption
 * rather than as one of the device's readings.
 */
export function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 w-full items-center justify-between gap-ha-3 rounded-ha-xl bg-surface-default px-ha-3 py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium font-mono text-text-primary text-right">{value}</span>
    </div>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────

/**
 * Chunky HA-style slider: rounded track, filled portion, drag anywhere.
 * Value follows the entity between interactions; while dragging (and until the
 * next entity update) the local value wins, so the handle never snaps back
 * while the round-trip is in flight.
 */
export function ControlSlider({
  value,
  min,
  max,
  step = 1,
  onCommit,
  format,
  icon,
  trackStyle,
  fillColor,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
  format: (v: number) => string;
  icon?: string;
  /** Optional gradient/track override (e.g. warm→cool for color temperature). */
  trackStyle?: React.CSSProperties;
  /** Colour of the filled portion — a light paints its own colour here. */
  fillColor?: string;
  ariaLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // A fresh entity reading clears the local override (unless mid-drag) —
  // render-time state adjustment instead of an effect.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    if (!dragging) setLocal(null);
  }

  const shown = local ?? value;
  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step)),
    [min, max, step],
  );
  const fraction = max > min ? (shown - min) / (max - min) : 0;

  const valueFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return shown;
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return clamp(min + f * (max - min));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setLocal(valueFromClientX(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setLocal(valueFromClientX(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const v = valueFromClientX(e.clientX);
    setLocal(v);
    onCommit(v);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp(shown + step);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp(shown - step);
    if (e.key === 'Home') next = min;
    if (e.key === 'End') next = max;
    if (next === null || next === shown) return;
    e.preventDefault();
    setLocal(next);
    onCommit(next);
  };

  return (
    // Inset by 4px so the row lines up with the surfaces above it: the icon's
    // 28px box centres where the hero's icon does, and the value's right edge
    // lands under the hero's control instead of 4px further out.
    <div className="flex items-center gap-ha-3 w-full px-ha-1">
      {icon && (
        <span className="flex w-7 shrink-0 items-center justify-center">
          <Icon path={icon} size={18} className="text-text-secondary" />
        </span>
      )}
      <div
        ref={trackRef}
        data-sheet-drag="none"
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={format(shown)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative h-12 flex-1 cursor-pointer touch-none select-none overflow-hidden rounded-ha-xl bg-surface-default outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60"
        style={trackStyle}
      >
        <div
          className={clsx('absolute inset-y-0 left-0 transition-colors', (trackStyle || fillColor) ? 'bg-transparent' : 'bg-ha-blue/30')}
          style={{ width: `${fraction * 100}%`, background: fillColor }}
        />
        {/* Handle bar — a slim vertical pill at the fill edge, like HA tiles. */}
        <div
          className="absolute top-2 bottom-2 w-1.5 rounded-full bg-text-primary/80"
          style={{ left: `calc(${fraction * 100}% - 3px)` }}
        />
      </div>
      <span className="w-12 flex-shrink-0 text-right text-sm font-semibold text-text-primary tabular-nums">
        {format(shown)}
      </span>
    </div>
  );
}

// ── Light ────────────────────────────────────────────────────────────────────

const COLOR_PRESETS: [number, number, number][] = [
  [244, 67, 54],   // red
  [255, 152, 0],   // orange
  [255, 235, 59],  // yellow
  [76, 175, 80],   // green
  [0, 150, 136],   // teal
  [33, 150, 243],  // blue
  [156, 39, 176],  // purple
  [233, 30, 99],   // pink
];

/**
 * Any colour, not just the eight presets — `<input type="color">` is the OS
 * picker, free and better than anything worth hand-rolling here. Dragging inside
 * that picker fires continuously, so calls are gated to ~4/s: the light follows
 * the drag without flooding the connection.
 */
function CustomColorSwatch({ rgb, onPick }: {
  rgb?: [number, number, number];
  onPick: (rgb: [number, number, number]) => void;
}) {
  const lastSent = useRef(0);
  const hex = rgb
    ? `#${rgb.map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`
    : '#ffffff';

  return (
    <span
      className="relative h-8 w-8 shrink-0 rounded-full ring-1 ring-surface-mid"
      style={{ background: 'conic-gradient(#f44336, #ffeb3b, #4caf50, #00bcd4, #2196f3, #9c27b0, #f44336)' }}
    >
      <input
        type="color"
        value={hex}
        aria-label="Custom colour"
        title="Custom colour"
        onChange={(e) => {
          const now = performance.now();
          if (now - lastSent.current < 250) return;
          lastSent.current = now;
          const v = e.target.value;
          onPick([parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}

function LightControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const modes = attr<string[]>(entity, 'supported_color_modes') ?? [];
  const dimmable = modes.some((m) => m !== 'onoff');
  const hasTemp = modes.includes('color_temp');
  const hasColor = modes.some((m) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m));
  const isOn = entity.state === 'on';

  const brightness = attr<number>(entity, 'brightness') ?? 0;
  const brightnessPct = Math.round((brightness / 255) * 100);

  const minK = attr<number>(entity, 'min_color_temp_kelvin')
    ?? (attr<number>(entity, 'max_mireds') ? Math.round(1_000_000 / attr<number>(entity, 'max_mireds')!) : 2000);
  const maxK = attr<number>(entity, 'max_color_temp_kelvin')
    ?? (attr<number>(entity, 'min_mireds') ? Math.round(1_000_000 / attr<number>(entity, 'min_mireds')!) : 6500);
  const tempK = attr<number>(entity, 'color_temp_kelvin')
    ?? (attr<number>(entity, 'color_temp') ? Math.round(1_000_000 / attr<number>(entity, 'color_temp')!) : Math.round((minK + maxK) / 2));

  const rgb = attr<[number, number, number]>(entity, 'rgb_color');
  const effects = attr<string[]>(entity, 'effect_list') ?? [];
  const effect = attr<string>(entity, 'effect');
  const hasWhite = modes.includes('white');

  // An on/off-only light still gets its effect list — that's the only thing left
  // to set once brightness is off the table.
  if (!dimmable) {
    return effects.length > 0 ? (
      <div className="w-full">
        <OptionControl
          label="Effect"
          options={effects}
          value={effect}
          onSelect={(v) =>
            callService({ domain: 'light', service: 'turn_on', serviceData: { effect: v }, target: { entity_id: entity.entity_id } })
          }
        />
      </div>
    ) : null;
  }

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlSlider
        value={isOn ? brightnessPct : 0}
        min={0}
        max={100}
        icon={mdiBrightness6}
        // The bar shows what the bulb is actually emitting — HA reports rgb_color
        // for colour-temp modes too, so warm white fills warm. Off falls back to
        // the neutral blue fill (there is no colour to show).
        fillColor={isOn && rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.55)` : undefined}
        ariaLabel="Brightness"
        format={(v) => `${Math.round(v)}%`}
        onCommit={(v) => {
          if (v <= 0) {
            callService({ domain: 'light', service: 'turn_off', target: { entity_id: entity.entity_id } });
          } else {
            callService({ domain: 'light', service: 'turn_on', serviceData: { brightness_pct: Math.round(v) }, target: { entity_id: entity.entity_id } });
          }
        }}
      />
      {hasTemp && (
        <ControlSlider
          value={tempK}
          min={minK}
          max={maxK}
          step={50}
          icon={mdiThermometer}
          ariaLabel="Color temperature"
          format={(v) => `${(v / 1000).toFixed(1)}k`}
          trackStyle={{ background: 'linear-gradient(to right, #ffb46b 0%, #fff3e0 50%, #cfe4ff 100%)', opacity: 0.9 }}
          onCommit={(v) =>
            callService({ domain: 'light', service: 'turn_on', serviceData: { color_temp_kelvin: Math.round(v) }, target: { entity_id: entity.entity_id } })
          }
        />
      )}
      {hasWhite && (
        <ControlGrid cols={1}>
          <ControlButton
            label="White mode"
            text="White"
           
            pressed={attr<string>(entity, 'color_mode') === 'white'}
            onClick={() =>
              callService({ domain: 'light', service: 'turn_on', serviceData: { white: brightness || 255 }, target: { entity_id: entity.entity_id } })
            }
          />
        </ControlGrid>
      )}
      {effects.length > 0 && (
        <OptionControl
          label="Effect"
          options={effects}
          value={effect}
          onSelect={(v) =>
            callService({ domain: 'light', service: 'turn_on', serviceData: { effect: v }, target: { entity_id: entity.entity_id } })
          }
        />
      )}
      {hasColor && (
        // Swatches sit on the same 48px surface row as every other control, so
        // the colour picker reads as one thing rather than eight loose chips.
        // The last slot is the OS colour picker — the presets are shortcuts, not
        // the whole palette.
        <div className="flex h-12 w-full items-center gap-ha-2 rounded-ha-xl bg-surface-default px-ha-2">
          {COLOR_PRESETS.map(([r, g, b]) => {
            const active = !!rgb && Math.abs(rgb[0] - r) < 12 && Math.abs(rgb[1] - g) < 12 && Math.abs(rgb[2] - b) < 12;
            return (
              <button
                key={`${r}-${g}-${b}`}
                type="button"
                aria-label={`Set color rgb(${r}, ${g}, ${b})`}
                aria-pressed={active}
                onClick={() =>
                  callService({ domain: 'light', service: 'turn_on', serviceData: { rgb_color: [r, g, b] }, target: { entity_id: entity.entity_id } })
                }
                className={clsx(
                  'h-8 flex-1 rounded-full transition-transform hover:scale-105',
                  active && 'ring-2 ring-text-primary ring-offset-2 ring-offset-surface-default',
                )}
                style={{ backgroundColor: `rgb(${r} ${g} ${b})` }}
              />
            );
          })}
          <CustomColorSwatch
            rgb={rgb}
            onPick={([r, g, b]) =>
              callService({ domain: 'light', service: 'turn_on', serviceData: { rgb_color: [r, g, b] }, target: { entity_id: entity.entity_id } })
            }
          />
        </div>
      )}
    </div>
  );
}

// ── Climate ──────────────────────────────────────────────────────────────────

function ClimateControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const target = attr<number>(entity, 'temperature');
  const current = attr<number>(entity, 'current_temperature');
  const min = attr<number>(entity, 'min_temp') ?? 7;
  const max = attr<number>(entity, 'max_temp') ?? 35;
  const step = attr<number>(entity, 'target_temp_step') ?? 0.5;
  const modes = attr<string[]>(entity, 'hvac_modes') ?? [];
  // heat_cool devices carry a range instead of a single setpoint — without this
  // branch they showed no temperature control at all.
  const low = attr<number>(entity, 'target_temp_low');
  const high = attr<number>(entity, 'target_temp_high');
  const action = attr<string>(entity, 'hvac_action');
  const presets = attr<string[]>(entity, 'preset_modes') ?? [];
  const fanModes = attr<string[]>(entity, 'fan_modes') ?? [];
  const swingModes = attr<string[]>(entity, 'swing_modes') ?? [];
  const humidity = attr<number>(entity, 'humidity');

  const call = (service: string, data: Record<string, unknown>) =>
    callService({ domain: 'climate', service, serviceData: data, target: { entity_id: entity.entity_id } });

  const setTarget = (v: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(v / step) * step));
    call('set_temperature', { temperature: clamped });
  };
  const setRange = (nextLow: number, nextHigh: number) => {
    call('set_temperature', {
      target_temp_low: Math.min(Math.max(nextLow, min), nextHigh - step),
      target_temp_high: Math.max(Math.min(nextHigh, max), nextLow + step),
    });
  };

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {action && (
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          {words(action)}
          {current != null && ` · now ${current.toFixed(1)}°`}
        </p>
      )}
      {target == null && low != null && high != null && (
        // Range setpoint: one ± row per end, stacked, sharing the reading cell.
        <div className="flex flex-col gap-ha-2">
          <ControlGrid cols={4}>
            <ControlButton label="Lower heat-to temperature" icon={mdiMinus} onClick={() => setRange(low - step, high)} />
            <ReadoutCell value={`${low.toFixed(step < 1 ? 1 : 0)}°`} caption="Heat to" />
            <ControlButton label="Raise heat-to temperature" icon={mdiPlus} onClick={() => setRange(low + step, high)} />
          </ControlGrid>
          <ControlGrid cols={4}>
            <ControlButton label="Lower cool-to temperature" icon={mdiMinus} onClick={() => setRange(low, high - step)} />
            <ReadoutCell value={`${high.toFixed(step < 1 ? 1 : 0)}°`} caption="Cool to" />
            <ControlButton label="Raise cool-to temperature" icon={mdiPlus} onClick={() => setRange(low, high + step)} />
          </ControlGrid>
        </div>
      )}
      {target != null && (
        // Setpoint: pills either side of a wide reading cell, same grid track.
        <ControlGrid cols={4}>
          <ControlButton label="Decrease target temperature" icon={mdiMinus} onClick={() => setTarget(target - step)} />
          <ReadoutCell
            value={`${target.toFixed(step < 1 ? 1 : 0)}°`}
            caption={current != null ? `Currently ${current.toFixed(1)}°` : undefined}
          />
          <ControlButton label="Increase target temperature" icon={mdiPlus} onClick={() => setTarget(target + step)} />
        </ControlGrid>
      )}
      {/* HVAC mode is a selector in HA — one active value out of a list — so it
          gets the same dropdown as every other selector, not a row of buttons. */}
      {modes.length > 1 && (
        <OptionControl
          label="Mode"
          options={modes}
          value={entity.state}
          onSelect={(mode) => call('set_hvac_mode', { hvac_mode: mode })}
        />
      )}
      {presets.length > 0 && (
        <OptionControl
          label="Preset"
          options={presets}
          value={attr<string>(entity, 'preset_mode')}
          onSelect={(v) => call('set_preset_mode', { preset_mode: v })}
        />
      )}
      {fanModes.length > 0 && (
        <OptionControl
          label="Fan"
          options={fanModes}
          value={attr<string>(entity, 'fan_mode')}
          onSelect={(v) => call('set_fan_mode', { fan_mode: v })}
        />
      )}
      {swingModes.length > 0 && (
        <OptionControl
          label="Swing"
          options={swingModes}
          value={attr<string>(entity, 'swing_mode')}
          onSelect={(v) => call('set_swing_mode', { swing_mode: v })}
        />
      )}
      {humidity != null && (
        <ControlSlider
          value={humidity}
          min={attr<number>(entity, 'min_humidity') ?? 30}
          max={attr<number>(entity, 'max_humidity') ?? 99}
          icon={mdiWaterPercent}
          ariaLabel="Target humidity"
          format={(v) => `${Math.round(v)}%`}
          onCommit={(v) => call('set_humidity', { humidity: Math.round(v) })}
        />
      )}
    </div>
  );
}

// ── Cover ────────────────────────────────────────────────────────────────────

const COVER_SET_POSITION = 4;
const COVER_OPEN_TILT = 16;
const COVER_SET_TILT = 128;

function CoverControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const features = attr<number>(entity, 'supported_features') ?? 0;
  const position = attr<number>(entity, 'current_position');
  const tilt = attr<number>(entity, 'current_tilt_position');
  const canPosition = (features & COVER_SET_POSITION) !== 0 && position != null;

  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'cover', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {/* wide rects for the two travel directions, a pill for the stop between */}
      <ControlGrid cols={5}>
        <ControlButton label="Open cover" icon={mdiArrowUp} onClick={() => call('open_cover')} span={2} />
        <ControlButton label="Stop cover" icon={mdiStop} onClick={() => call('stop_cover')} />
        <ControlButton label="Close cover" icon={mdiArrowDown} onClick={() => call('close_cover')} span={2} />
      </ControlGrid>
      {canPosition && (
        <ControlSlider
          value={position}
          min={0}
          max={100}
          ariaLabel="Cover position"
          format={(v) => `${Math.round(v)}%`}
          onCommit={(v) => call('set_cover_position', { position: Math.round(v) })}
        />
      )}
      {/* Tilt — venetian blinds and shutters. Same shape as travel, one row down. */}
      {(features & COVER_OPEN_TILT) !== 0 && (
        <ControlGrid cols={5}>
          <ControlButton label="Open tilt" icon={mdiArrowExpandVertical} onClick={() => call('open_cover_tilt')} span={2} />
          <ControlButton label="Stop tilt" icon={mdiStop} onClick={() => call('stop_cover_tilt')} />
          <ControlButton label="Close tilt" icon={mdiArrowDown} onClick={() => call('close_cover_tilt')} span={2} />
        </ControlGrid>
      )}
      {(features & COVER_SET_TILT) !== 0 && tilt != null && (
        <ControlSlider
          value={tilt}
          min={0}
          max={100}
          ariaLabel="Tilt position"
          format={(v) => `${Math.round(v)}%`}
          onCommit={(v) => call('set_cover_tilt_position', { tilt_position: Math.round(v) })}
        />
      )}
    </div>
  );
}

// ── Media player ─────────────────────────────────────────────────────────────

/** mm:ss for a media position / duration in seconds. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const REPEAT_ICON: Record<string, string> = { off: mdiRepeatOff, all: mdiRepeat, one: mdiRepeatOnce };
const REPEAT_NEXT: Record<string, string> = { off: 'all', all: 'one', one: 'off' };

function MediaControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const playing = entity.state === 'playing';
  const volume = attr<number>(entity, 'volume_level');
  const muted = attr<boolean>(entity, 'is_volume_muted') ?? false;
  const title = attr<string>(entity, 'media_title');
  const artist = attr<string>(entity, 'media_artist') ?? attr<string>(entity, 'media_series_title');
  const duration = attr<number>(entity, 'media_duration');
  const position = attr<number>(entity, 'media_position');
  const sources = attr<string[]>(entity, 'source_list') ?? [];
  const soundModes = attr<string[]>(entity, 'sound_mode_list') ?? [];
  const shuffle = attr<boolean>(entity, 'shuffle');
  const repeat = attr<string>(entity, 'repeat');

  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'media_player', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {/* What's playing — the dialog showed artwork but never the track. */}
      {title && (
        <div className="w-full text-center">
          <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
          {artist && <p className="truncate text-xs text-text-secondary">{artist}</p>}
        </div>
      )}
      {/* pill · wide rect · pill — transport reads as one bento row */}
      <ControlGrid cols={4}>
        <ControlButton label="Previous track" icon={mdiSkipPrevious} onClick={() => call('media_previous_track')} />
        <ControlButton
          label={playing ? 'Pause' : 'Play'}
          icon={playing ? mdiPause : mdiPlay}
          onClick={() => call('media_play_pause')}
         
          span={2}
          variant="primary"
        />
        <ControlButton label="Next track" icon={mdiSkipNext} onClick={() => call('media_next_track')} />
      </ControlGrid>
      {volume != null && (
        <div className="flex items-center gap-ha-2 w-full">
          <button
            type="button"
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            onClick={() => call('volume_mute', { is_volume_muted: !muted })}
            className={clsx('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-colors', muted ? 'bg-fill-primary-normal text-ha-blue' : 'bg-surface-low text-text-secondary hover:bg-surface-mid')}
          >
            <Icon path={muted ? mdiVolumeMute : mdiVolumeHigh} size={18} />
          </button>
          <div className="flex-1">
            <ControlSlider
              value={Math.round((volume ?? 0) * 100)}
              min={0}
              max={100}
              ariaLabel="Volume"
              format={(v) => `${Math.round(v)}%`}
              onCommit={(v) => call('volume_set', { volume_level: Math.round(v) / 100 })}
            />
          </div>
        </div>
      )}
      {/* Seek — position is only meaningful with a known duration. */}
      {duration != null && duration > 0 && position != null && (
        <ControlSlider
          value={Math.min(position, duration)}
          min={0}
          max={duration}
          ariaLabel="Seek"
          format={clock}
          onCommit={(v) => call('media_seek', { seek_position: Math.round(v) })}
        />
      )}
      {(shuffle != null || repeat != null) && (
        <ControlGrid cols={2}>
          {shuffle != null && (
            <ControlButton
              label="Shuffle"
              icon={mdiShuffleVariant}
              pressed={shuffle}
              onClick={() => call('shuffle_set', { shuffle: !shuffle })}
            />
          )}
          {repeat != null && (
            <ControlButton
              label={`Repeat: ${repeat}`}
              icon={REPEAT_ICON[repeat] ?? mdiRepeatOff}
              pressed={repeat !== 'off'}
              onClick={() => call('repeat_set', { repeat: REPEAT_NEXT[repeat] ?? 'off' })}
            />
          )}
        </ControlGrid>
      )}
      {sources.length > 0 && (
        <OptionControl label="Source" options={sources} value={attr<string>(entity, 'source')} onSelect={(v) => call('select_source', { source: v })} />
      )}
      {soundModes.length > 0 && (
        <OptionControl label="Sound" options={soundModes} value={attr<string>(entity, 'sound_mode')} onSelect={(v) => call('select_sound_mode', { sound_mode: v })} />
      )}
    </div>
  );
}

// ── Fan ──────────────────────────────────────────────────────────────────────

function FanControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const percentage = attr<number>(entity, 'percentage');
  const step = attr<number>(entity, 'percentage_step') ?? 1;
  const presets = attr<string[]>(entity, 'preset_modes') ?? [];
  const oscillating = attr<boolean>(entity, 'oscillating');
  const direction = attr<string>(entity, 'direction');

  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'fan', service, serviceData: data, target: { entity_id: entity.entity_id } });

  if (percentage == null && presets.length === 0 && oscillating == null && direction == null) return null;

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {percentage != null && (
        <ControlSlider
          value={percentage}
          min={0}
          max={100}
          step={step}
          ariaLabel="Fan speed"
          format={(v) => `${Math.round(v)}%`}
          onCommit={(v) => {
            if (v <= 0) call('turn_off');
            else call('set_percentage', { percentage: Math.round(v) });
          }}
        />
      )}
      {presets.length > 0 && (
        <OptionControl label="Preset" options={presets} value={attr<string>(entity, 'preset_mode')} onSelect={(v) => call('set_preset_mode', { preset_mode: v })} />
      )}
      {(oscillating != null || direction != null) && (
        <ControlGrid cols={2}>
          {oscillating != null && (
            <ControlButton label="Oscillate" icon={mdiSync} pressed={oscillating} onClick={() => call('oscillate', { oscillating: !oscillating })} />
          )}
          {direction != null && (
            <ControlButton
              label={`Direction: ${direction}`}
              icon={mdiRotateRight}
              pressed={direction === 'reverse'}
              onClick={() => call('set_direction', { direction: direction === 'forward' ? 'reverse' : 'forward' })}
            />
          )}
        </ControlGrid>
      )}
    </div>
  );
}

// ── Value setters: number / select / text / date & time ──────────────────────

function NumberControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const domain = entity.entity_id.split('.')[0];
  const value = Number(entity.state);
  const min = attr<number>(entity, 'min') ?? 0;
  const max = attr<number>(entity, 'max') ?? 100;
  const step = attr<number>(entity, 'step') ?? 1;
  const unit = attr<string>(entity, 'unit_of_measurement') ?? '';
  const mode = attr<string>(entity, 'mode') ?? 'auto';
  if (isNaN(value)) return null;

  const set = (v: number) =>
    callService({ domain, service: 'set_value', serviceData: { value: v }, target: { entity_id: entity.entity_id } });

  // `box` means the integration wants exact entry rather than a drag — so give
  // it a field you can actually type into, unit suffixed on the right. HA also
  // falls back to box when the range is too fine to drag (its own rule is a
  // range/step ratio over 256), and so do we.
  if (mode === 'box' || (mode === 'auto' && (max - min) / step > 256)) {
    return (
      <div className="flex w-full items-center gap-ha-2">
        <ControlButton label="Decrease value" icon={mdiMinus} onClick={() => set(Math.max(min, value - step))} />
        <NumberInput value={value} min={min} max={max} unit={unit || undefined} onCommit={set} />
        <ControlButton label="Increase value" icon={mdiPlus} onClick={() => set(Math.min(max, value + step))} />
      </div>
    );
  }
  return (
    <ControlSlider
      value={value}
      min={min}
      max={max}
      step={step}
      ariaLabel="Value"
      format={(v) => `${step < 1 ? v.toFixed(1) : Math.round(v)}${unit ? ` ${unit}` : ''}`}
      onCommit={set}
    />
  );
}

function SelectControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const domain = entity.entity_id.split('.')[0];
  const options = attr<string[]>(entity, 'options') ?? [];
  return (
    <OptionControl
      label="Option"
      options={options}
      value={entity.state}
      onSelect={(option) =>
        callService({ domain, service: 'select_option', serviceData: { option }, target: { entity_id: entity.entity_id } })
      }
    />
  );
}

function TextControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const domain = entity.entity_id.split('.')[0];
  return (
    <TextControl
      value={entity.state}
      pattern={attr<string>(entity, 'pattern')}
      maxLength={attr<number>(entity, 'max')}
      ariaLabel="Text value"
      onCommit={(value) =>
        callService({ domain, service: 'set_value', serviceData: { value }, target: { entity_id: entity.entity_id } })
      }
    />
  );
}

function DateTimeControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const domain = entity.entity_id.split('.')[0];
  const state = entity.state;

  if (domain === 'input_datetime') {
    const hasDate = attr<boolean>(entity, 'has_date') ?? false;
    const hasTime = attr<boolean>(entity, 'has_time') ?? false;
    const type = hasDate && hasTime ? 'datetime-local' : hasDate ? 'date' : 'time';
    const value = type === 'datetime-local' ? state.replace(' ', 'T').slice(0, 16) : state.slice(0, type === 'date' ? 10 : 5);
    return (
      <DateTimeInput
        type={type}
        value={value}
        ariaLabel="Date and time"
        onCommit={(v) =>
          callService({
            domain,
            service: 'set_datetime',
            serviceData: type === 'datetime-local'
              ? { datetime: v.replace('T', ' ') }
              : type === 'date' ? { date: v } : { time: v },
            target: { entity_id: entity.entity_id },
          })
        }
      />
    );
  }

  const type = domain === 'date' ? 'date' : domain === 'time' ? 'time' : 'datetime-local';
  const value = type === 'datetime-local' ? state.slice(0, 16) : type === 'date' ? state.slice(0, 10) : state.slice(0, 5);
  return (
    <DateTimeInput
      type={type}
      value={value}
      ariaLabel={type === 'date' ? 'Date' : type === 'time' ? 'Time' : 'Date and time'}
      onCommit={(v) =>
        callService({
          domain,
          service: 'set_value',
          serviceData: type === 'date' ? { date: v } : type === 'time' ? { time: v } : { datetime: v },
          target: { entity_id: entity.entity_id },
        })
      }
    />
  );
}

// ── Appliances: vacuum / lawn mower / humidifier / water heater / valve ──────

function VacuumControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const speeds = attr<string[]>(entity, 'fan_speed_list') ?? [];
  const battery = attr<number>(entity, 'battery_level');
  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'vacuum', service, serviceData: data, target: { entity_id: entity.entity_id } });
  const cleaning = entity.state === 'cleaning';

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlGrid cols={4}>
        <ControlButton
          label={cleaning ? 'Pause' : 'Start cleaning'}
          icon={cleaning ? mdiPause : mdiPlay}
          onClick={() => call(cleaning ? 'pause' : 'start')}
         
          span={2}
          variant="primary"
        />
        <ControlButton label="Return to dock" icon={mdiHomeImportOutline} onClick={() => call('return_to_base')} />
        <ControlButton label="Locate" icon={mdiCrosshairsGps} onClick={() => call('locate')} />
      </ControlGrid>
      {speeds.length > 0 && (
        <OptionControl label="Suction" options={speeds} value={attr<string>(entity, 'fan_speed')} onSelect={(v) => call('set_fan_speed', { fan_speed: v })} />
      )}
      {battery != null && <ReadRow label="Battery" value={`${Math.round(battery)}%`} />}
    </div>
  );
}

function LawnMowerControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const call = (service: string) =>
    callService({ domain: 'lawn_mower', service, target: { entity_id: entity.entity_id } });
  const mowing = entity.state === 'mowing';
  return (
    <ControlGrid cols={4}>
      <ControlButton
        label={mowing ? 'Pause' : 'Start mowing'}
        icon={mowing ? mdiPause : mdiPlay}
        onClick={() => call(mowing ? 'pause' : 'start_mowing')}
       
        span={2}
        variant="primary"
      />
      <ControlButton label="Dock" icon={mdiHomeImportOutline} onClick={() => call('dock')} span={2} />
    </ControlGrid>
  );
}

function HumidifierControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const target = attr<number>(entity, 'humidity');
  const current = attr<number>(entity, 'current_humidity');
  const modes = attr<string[]>(entity, 'available_modes') ?? [];
  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'humidifier', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {target != null && (
        <ControlSlider
          value={target}
          min={attr<number>(entity, 'min_humidity') ?? 0}
          max={attr<number>(entity, 'max_humidity') ?? 100}
          icon={mdiWaterPercent}
          ariaLabel="Target humidity"
          format={(v) => `${Math.round(v)}%`}
          onCommit={(v) => call('set_humidity', { humidity: Math.round(v) })}
        />
      )}
      {current != null && <ReadRow label="Currently" value={`${Math.round(current)}%`} />}
      {modes.length > 0 && (
        <OptionControl label="Mode" options={modes} value={attr<string>(entity, 'mode')} onSelect={(v) => call('set_mode', { mode: v })} />
      )}
    </div>
  );
}

function WaterHeaterControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const target = attr<number>(entity, 'temperature');
  const current = attr<number>(entity, 'current_temperature');
  const min = attr<number>(entity, 'min_temp') ?? 30;
  const max = attr<number>(entity, 'max_temp') ?? 80;
  const modes = attr<string[]>(entity, 'operation_list') ?? [];
  const away = attr<string>(entity, 'away_mode');
  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'water_heater', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {target != null && (
        <ControlGrid cols={4}>
          <ControlButton label="Decrease temperature" icon={mdiMinus} onClick={() => call('set_temperature', { temperature: Math.max(min, target - 1) })} />
          <ReadoutCell
            value={`${Math.round(target)}°`}
            caption={current != null ? `Currently ${Math.round(current)}°` : undefined}
          />
          <ControlButton label="Increase temperature" icon={mdiPlus} onClick={() => call('set_temperature', { temperature: Math.min(max, target + 1) })} />
        </ControlGrid>
      )}
      {modes.length > 0 && (
        <OptionControl label="Operation" options={modes} value={attr<string>(entity, 'operation_mode')} onSelect={(v) => call('set_operation_mode', { operation_mode: v })} />
      )}
      {away != null && (
        <ControlGrid cols={1}>
          <ControlButton
            label="Away mode"
            text="Away mode"
           
            pressed={away === 'on'}
            onClick={() => call('set_away_mode', { away_mode: away !== 'on' })}
          />
        </ControlGrid>
      )}
    </div>
  );
}

const VALVE_SET_POSITION = 4;

function ValveControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const features = attr<number>(entity, 'supported_features') ?? 0;
  const position = attr<number>(entity, 'current_valve_position');
  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'valve', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlGrid cols={5}>
        <ControlButton label="Open valve" icon={mdiArrowUp} onClick={() => call('open_valve')} span={2} />
        <ControlButton label="Stop valve" icon={mdiStop} onClick={() => call('stop_valve')} />
        <ControlButton label="Close valve" icon={mdiArrowDown} onClick={() => call('close_valve')} span={2} />
      </ControlGrid>
      {(features & VALVE_SET_POSITION) !== 0 && position != null && (
        <ControlSlider
          value={position}
          min={0}
          max={100}
          ariaLabel="Valve position"
          format={(v) => `${Math.round(v)}%`}
          onCommit={(v) => call('set_valve_position', { position: Math.round(v) })}
        />
      )}
    </div>
  );
}

// ── Security: lock / alarm / siren ───────────────────────────────────────────

const LOCK_OPEN = 1;

function LockControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const [code, setCode] = useState('');
  const codeFormat = attr<string>(entity, 'code_format');
  const canOpen = (attr<number>(entity, 'supported_features') ?? 0) & LOCK_OPEN;
  const locked = entity.state === 'locked';
  const call = (service: string) =>
    callService({
      domain: 'lock',
      service,
      serviceData: code ? { code } : undefined,
      target: { entity_id: entity.entity_id },
    });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlGrid cols={canOpen ? 4 : 2}>
        <ControlButton
          label={locked ? 'Unlock' : 'Lock'}
          icon={locked ? mdiLockOpenVariant : mdiLock}
          onClick={() => call(locked ? 'unlock' : 'lock')}
         
          span={2}
          variant="primary"
        />
        {/* Latch release — a door that can be pushed open, not just unlocked. */}
        {!!canOpen && (
          <ControlButton label="Open door" icon={mdiSkipForward} onClick={() => call('open')} span={2} />
        )}
      </ControlGrid>
      {codeFormat && (
        <TextControl
          value={code}
          placeholder="Code"
          pattern={codeFormat}
          inputMode="numeric"
          ariaLabel="Lock code"
          onCommit={setCode}
        />
      )}
    </div>
  );
}

const ALARM_ARM_HOME = 1;
const ALARM_ARM_AWAY = 2;
const ALARM_ARM_NIGHT = 4;

function AlarmControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const [code, setCode] = useState('');
  const features = attr<number>(entity, 'supported_features') ?? 0;
  const codeFormat = attr<string>(entity, 'code_format');
  const disarmed = entity.state === 'disarmed';
  const call = (service: string) =>
    callService({
      domain: 'alarm_control_panel',
      service,
      serviceData: code ? { code } : undefined,
      target: { entity_id: entity.entity_id },
    });

  const armModes = [
    { bit: ALARM_ARM_HOME, service: 'alarm_arm_home', label: 'Home', icon: mdiShieldHomeOutline, state: 'armed_home' },
    { bit: ALARM_ARM_AWAY, service: 'alarm_arm_away', label: 'Away', icon: mdiShieldLockOutline, state: 'armed_away' },
    { bit: ALARM_ARM_NIGHT, service: 'alarm_arm_night', label: 'Night', icon: mdiShieldMoonOutline, state: 'armed_night' },
  ].filter(m => (features & m.bit) !== 0);

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlGrid cols={Math.max(1, armModes.length)}>
        {armModes.map(m => (
          <ControlButton
            key={m.service}
            label={`Arm ${m.label}`}
            icon={m.icon}
            pressed={entity.state === m.state}
            onClick={() => call(m.service)}
          />
        ))}
      </ControlGrid>
      <ControlGrid cols={1}>
        <ControlButton
          label="Disarm"
          icon={mdiShieldOffOutline}
         
          pressed={disarmed}
          onClick={() => call('alarm_disarm')}
        />
      </ControlGrid>
      {codeFormat && (
        <TextControl
          value={code}
          placeholder="Code"
          pattern={codeFormat === 'number' ? '[0-9]*' : undefined}
          inputMode={codeFormat === 'number' ? 'numeric' : 'text'}
          ariaLabel="Alarm code"
          onCommit={setCode}
        />
      )}
    </div>
  );
}

function SirenControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const tones = attr<string[]>(entity, 'available_tones') ?? [];
  if (tones.length === 0) return null;
  return (
    <OptionControl
      label="Tone"
      options={tones}
      onSelect={(tone) =>
        callService({ domain: 'siren', service: 'turn_on', serviceData: { tone }, target: { entity_id: entity.entity_id } })
      }
    />
  );
}

function RemoteControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const activities = attr<string[]>(entity, 'activity_list') ?? [];
  if (activities.length === 0) return null;
  return (
    <OptionControl
      label="Activity"
      options={activities}
      value={attr<string>(entity, 'current_activity')}
      onSelect={(activity) =>
        callService({ domain: 'remote', service: 'turn_on', serviceData: { activity }, target: { entity_id: entity.entity_id } })
      }
    />
  );
}

// ── Helpers with actions: timer / counter / todo / update ────────────────────

function TimerControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const running = entity.state === 'active';
  const call = (service: string) =>
    callService({ domain: 'timer', service, target: { entity_id: entity.entity_id } });
  const remaining = attr<string>(entity, 'remaining');
  const duration = attr<string>(entity, 'duration');

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlGrid cols={4}>
        <ControlButton
          label={running ? 'Pause timer' : 'Start timer'}
          icon={running ? mdiPause : mdiPlay}
          onClick={() => call(running ? 'pause' : 'start')}
         
          span={2}
          variant="primary"
        />
        <ControlButton label="Cancel timer" icon={mdiStop} onClick={() => call('cancel')} />
        <ControlButton label="Finish timer" icon={mdiSkipForward} onClick={() => call('finish')} />
      </ControlGrid>
      {(remaining ?? duration) && <ReadRow label={running ? 'Remaining' : 'Duration'} value={(remaining ?? duration)!} />}
    </div>
  );
}

function CounterControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const call = (service: string) =>
    callService({ domain: 'counter', service, target: { entity_id: entity.entity_id } });
  return (
    <ControlGrid cols={4}>
      <ControlButton label="Decrement" icon={mdiMinus} onClick={() => call('decrement')} />
      <ReadoutCell value={entity.state} />
      <ControlButton label="Increment" icon={mdiPlus} onClick={() => call('increment')} />
      <ControlButton label="Reset counter" icon={mdiRestart} onClick={() => call('reset')} span={4} />
    </ControlGrid>
  );
}

function TodoControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  // ponytail: add-only. Rendering and ticking off existing items needs the
  // todo/item/list websocket command, not an attribute — wire that in when the
  // dialog should own the list rather than just append to it.
  return (
    <div className="w-full flex flex-col gap-ha-2">
      <TextControl
        placeholder="Add an item…"
        clearOnCommit
        ariaLabel="New to-do item"
        onCommit={(item) => {
          if (!item.trim()) return;
          callService({ domain: 'todo', service: 'add_item', serviceData: { item }, target: { entity_id: entity.entity_id } });
        }}
      />
      <ReadRow label="Open items" value={entity.state} />
    </div>
  );
}

function UpdateControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const installed = attr<string>(entity, 'installed_version');
  const latest = attr<string>(entity, 'latest_version');
  const progress = attr<number>(entity, 'update_percentage') ?? attr<number>(entity, 'in_progress');
  const releaseUrl = attr<string>(entity, 'release_url');
  const pending = entity.state === 'on';
  const call = (service: string) =>
    callService({ domain: 'update', service, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {pending && (
        <ControlGrid cols={4}>
          <ControlButton label="Install update" icon={mdiDownload} onClick={() => call('install')} span={3} variant="primary" />
          <ControlButton label="Skip this version" icon={mdiSkipForward} onClick={() => call('skip')} />
        </ControlGrid>
      )}
      {typeof progress === 'number' && progress > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-low">
          <div className="h-full rounded-full bg-ha-blue" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {installed && <ReadRow label="Installed" value={installed} />}
      {latest && <ReadRow label="Latest" value={latest} />}
      {releaseUrl && (
        <a
          href={releaseUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-ha-blue hover:underline"
        >
          Release notes
        </a>
      )}
    </div>
  );
}

// ── Information-only domains ─────────────────────────────────────────────────

function WeatherDetails({ entity }: { entity: HassEntity }) {
  const forecast = attr<Array<Record<string, unknown>>>(entity, 'forecast') ?? [];
  const temp = attr<number>(entity, 'temperature');
  const unit = attr<string>(entity, 'temperature_unit') ?? '°';
  return (
    <div className="w-full flex flex-col gap-ha-1">
      {temp != null && <ReadRow label="Now" value={`${Math.round(temp)}${unit}`} />}
      {attr<number>(entity, 'humidity') != null && <ReadRow label="Humidity" value={`${attr<number>(entity, 'humidity')}%`} />}
      {attr<number>(entity, 'wind_speed') != null && (
        <ReadRow label="Wind" value={`${attr<number>(entity, 'wind_speed')} ${attr<string>(entity, 'wind_speed_unit') ?? ''}`.trim()} />
      )}
      {/* Modern integrations serve forecasts via weather.get_forecasts; the
          legacy attribute is rendered when the integration still ships it. */}
      {forecast.slice(0, 5).map((f, i) => {
        const when = typeof f.datetime === 'string'
          ? new Date(f.datetime).toLocaleDateString(undefined, { weekday: 'short' })
          : `Day ${i + 1}`;
        const high = f.temperature ?? f.native_temperature;
        const low = f.templow ?? f.native_templow;
        return <ReadRow key={i} label={when} value={`${high != null ? `${Math.round(Number(high))}${unit}` : '—'}${low != null ? ` / ${Math.round(Number(low))}${unit}` : ''}`} />;
      })}
    </div>
  );
}

function TrackerDetails({ entity }: { entity: HassEntity }) {
  const rows: Array<[string, string | undefined]> = [
    ['Location', stateLabel(entity)],
    ['Source', attr<string>(entity, 'source_type')],
    ['Battery', attr<number>(entity, 'battery_level') != null ? `${attr<number>(entity, 'battery_level')}%` : undefined],
    ['Accuracy', attr<number>(entity, 'gps_accuracy') != null ? `${attr<number>(entity, 'gps_accuracy')} m` : undefined],
  ];
  return (
    <div className="w-full flex flex-col gap-ha-1">
      {rows.filter(([, v]) => v != null).map(([label, value]) => <ReadRow key={label} label={label} value={value!} />)}
    </div>
  );
}

function CalendarDetails({ entity }: { entity: HassEntity }) {
  const message = attr<string>(entity, 'message');
  const start = attr<string>(entity, 'start_time');
  const end = attr<string>(entity, 'end_time');
  const location = attr<string>(entity, 'location');
  if (!message) return null;
  return (
    <div className="w-full flex flex-col gap-ha-1">
      <ReadRow label="Next" value={message} />
      {start && <ReadRow label="Starts" value={start} />}
      {end && <ReadRow label="Ends" value={end} />}
      {location && <ReadRow label="Where" value={location} />}
    </div>
  );
}

function GroupDetails({ entity }: { entity: HassEntity }) {
  const members = attr<string[]>(entity, 'entity_id') ?? [];
  if (members.length === 0) return null;
  return (
    <div className="w-full flex flex-col gap-ha-1">
      <ReadRow label="Members" value={String(members.length)} />
      {members.slice(0, 8).map(id => <ReadRow key={id} label={id.split('.')[1].replace(/_/g, ' ')} value={id.split('.')[0]} />)}
    </div>
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Renders the control surface matching the entity's domain, or nothing when
 * the domain has no setters beyond the toggle the panel already shows.
 */
/**
 * Optimistic devices (RF switches, IR blasters) report no real state, so a
 * single toggle can leave the UI and the device disagreeing. HA gives these two
 * explicit commands instead — press the direction you want, every time.
 */
function AssumedStateControls({ entity, domain }: { entity: HassEntity; domain: string }) {
  const { callService } = useHomeAssistant();
  const call = (service: string) =>
    callService({ domain, service, target: { entity_id: entity.entity_id } });
  return (
    <ControlGrid cols={2}>
      <ControlButton label="Turn on" text="On" pressed={entity.state === 'on'} onClick={() => call('turn_on')} />
      <ControlButton label="Turn off" text="Off" pressed={entity.state === 'off'} onClick={() => call('turn_off')} />
    </ControlGrid>
  );
}

export function DomainControls({ entityId }: { entityId: string }) {
  const entity = useEntity(entityId);
  const domain = useMemo(() => entityId.split('.')[0], [entityId]);
  if (!entity) return null;
  if (entity.state === 'unavailable' || entity.state === 'unknown') return null;

  if (entity.attributes.assumed_state === true) {
    return (
      <div className="w-full flex flex-col gap-ha-3">
        <AssumedStateControls entity={entity} domain={domain} />
        <DomainSurface entity={entity} domain={domain} />
      </div>
    );
  }
  return <DomainSurface entity={entity} domain={domain} />;
}

function DomainSurface({ entity, domain }: { entity: HassEntity; domain: string }) {
  switch (domain) {
    case 'light':
      return <LightControls entity={entity} />;
    case 'climate':
      return <ClimateControls entity={entity} />;
    case 'cover':
      return <CoverControls entity={entity} />;
    case 'media_player':
      return <MediaControls entity={entity} />;
    case 'fan':
      return <FanControls entity={entity} />;
    case 'number':
    case 'input_number':
      return <NumberControls entity={entity} />;
    case 'select':
    case 'input_select':
      return <SelectControls entity={entity} />;
    case 'text':
    case 'input_text':
      return <TextControls entity={entity} />;
    case 'date':
    case 'time':
    case 'datetime':
    case 'input_datetime':
      return <DateTimeControls entity={entity} />;
    case 'vacuum':
      return <VacuumControls entity={entity} />;
    case 'lawn_mower':
      return <LawnMowerControls entity={entity} />;
    case 'humidifier':
      return <HumidifierControls entity={entity} />;
    case 'water_heater':
      return <WaterHeaterControls entity={entity} />;
    case 'valve':
      return <ValveControls entity={entity} />;
    case 'lock':
      return <LockControls entity={entity} />;
    case 'alarm_control_panel':
      return <AlarmControls entity={entity} />;
    case 'siren':
      return <SirenControls entity={entity} />;
    case 'remote':
      return <RemoteControls entity={entity} />;
    case 'timer':
      return <TimerControls entity={entity} />;
    case 'counter':
      return <CounterControls entity={entity} />;
    case 'todo':
      return <TodoControls entity={entity} />;
    case 'update':
      return <UpdateControls entity={entity} />;
    case 'weather':
      return <WeatherDetails entity={entity} />;
    case 'person':
    case 'device_tracker':
      return <TrackerDetails entity={entity} />;
    case 'calendar':
      return <CalendarDetails entity={entity} />;
    case 'group':
      return <GroupDetails entity={entity} />;
    default:
      // ponytail: camera streaming (HLS/WebRTC) is the one gap left here — the
      // dialog shows the snapshot; a live feed needs a player, not a service call.
      return null;
  }
}
