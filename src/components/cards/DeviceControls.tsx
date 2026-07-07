'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiBrightness6,
  mdiMinus,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiStop,
  mdiThermometer,
  mdiVolumeHigh,
  mdiVolumeMute,
} from '@mdi/js';
import { Icon } from '../ui';
import { useEntity, useHomeAssistant } from '@/hooks/useHomeAssistant';
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

// ── Slider ───────────────────────────────────────────────────────────────────

/**
 * Chunky HA-style slider: rounded track, filled portion, drag anywhere.
 * Value follows the entity between interactions; while dragging (and until the
 * next entity update) the local value wins, so the handle never snaps back
 * while the round-trip is in flight.
 */
function ControlSlider({
  value,
  min,
  max,
  step = 1,
  onCommit,
  format,
  icon,
  trackStyle,
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
    <div className="flex items-center gap-ha-3 w-full">
      {icon && <Icon path={icon} size={18} className="text-text-secondary flex-shrink-0" />}
      <div
        ref={trackRef}
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
        className="relative h-9 flex-1 cursor-pointer touch-none select-none overflow-hidden rounded-ha-xl bg-surface-low outline-none focus-visible:ring-2 focus-visible:ring-ha-blue/60"
        style={trackStyle}
      >
        <div
          className={clsx('absolute inset-y-0 left-0', trackStyle ? 'bg-transparent' : 'bg-ha-blue/30')}
          style={{ width: `${fraction * 100}%` }}
        />
        {/* Handle bar — a slim vertical pill at the fill edge, like HA tiles. */}
        <div
          className="absolute top-1.5 bottom-1.5 w-1 rounded-full bg-text-primary/80"
          style={{ left: `calc(${fraction * 100}% - 2px)` }}
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

  if (!dimmable) return null;

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <ControlSlider
        value={isOn ? brightnessPct : 0}
        min={0}
        max={100}
        icon={mdiBrightness6}
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
      {hasColor && (
        <div className="flex items-center justify-between gap-ha-2">
          {COLOR_PRESETS.map(([r, g, b]) => {
            const active = !!rgb && Math.abs(rgb[0] - r) < 12 && Math.abs(rgb[1] - g) < 12 && Math.abs(rgb[2] - b) < 12;
            return (
              <button
                key={`${r}-${g}-${b}`}
                type="button"
                aria-label={`Set color rgb(${r}, ${g}, ${b})`}
                onClick={() =>
                  callService({ domain: 'light', service: 'turn_on', serviceData: { rgb_color: [r, g, b] }, target: { entity_id: entity.entity_id } })
                }
                className={clsx(
                  'h-7 flex-1 rounded-ha-lg transition-transform hover:scale-105',
                  active && 'ring-2 ring-text-primary ring-offset-2 ring-offset-surface-default',
                )}
                style={{ backgroundColor: `rgb(${r} ${g} ${b})` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Climate ──────────────────────────────────────────────────────────────────

const HVAC_LABEL: Record<string, string> = {
  off: 'Off',
  heat: 'Heat',
  cool: 'Cool',
  heat_cool: 'Heat/Cool',
  auto: 'Auto',
  dry: 'Dry',
  fan_only: 'Fan',
};

function ClimateControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const target = attr<number>(entity, 'temperature');
  const current = attr<number>(entity, 'current_temperature');
  const min = attr<number>(entity, 'min_temp') ?? 7;
  const max = attr<number>(entity, 'max_temp') ?? 35;
  const step = attr<number>(entity, 'target_temp_step') ?? 0.5;
  const modes = attr<string[]>(entity, 'hvac_modes') ?? [];

  const setTarget = (v: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(v / step) * step));
    callService({ domain: 'climate', service: 'set_temperature', serviceData: { temperature: clamped }, target: { entity_id: entity.entity_id } });
  };

  return (
    <div className="w-full flex flex-col gap-ha-3">
      {target != null && (
        <div className="flex items-center justify-center gap-ha-4">
          <button
            type="button"
            aria-label="Decrease target temperature"
            onClick={() => setTarget(target - step)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary"
          >
            <Icon path={mdiMinus} size={20} />
          </button>
          <div className="flex flex-col items-center min-w-[96px]">
            <span className="text-3xl font-bold font-mono text-text-primary tabular-nums">
              {target.toFixed(step < 1 ? 1 : 0)}°
            </span>
            {current != null && (
              <span className="text-xs text-text-tertiary">Currently {current.toFixed(1)}°</span>
            )}
          </div>
          <button
            type="button"
            aria-label="Increase target temperature"
            onClick={() => setTarget(target + step)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary"
          >
            <Icon path={mdiPlus} size={20} />
          </button>
        </div>
      )}
      {modes.length > 1 && (
        <div className="flex flex-wrap justify-center gap-ha-2">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={entity.state === mode}
              onClick={() =>
                callService({ domain: 'climate', service: 'set_hvac_mode', serviceData: { hvac_mode: mode }, target: { entity_id: entity.entity_id } })
              }
              className={clsx(
                'rounded-ha-xl border px-ha-3 py-1.5 text-sm font-semibold capitalize transition-colors',
                entity.state === mode
                  ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
                  : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low',
              )}
            >
              {HVAC_LABEL[mode] ?? mode.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cover ────────────────────────────────────────────────────────────────────

const COVER_SET_POSITION = 4;

function CoverControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const features = attr<number>(entity, 'supported_features') ?? 0;
  const position = attr<number>(entity, 'current_position');
  const canPosition = (features & COVER_SET_POSITION) !== 0 && position != null;

  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'cover', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <div className="flex items-center justify-center gap-ha-3">
        <button type="button" aria-label="Open cover" onClick={() => call('open_cover')} className="flex h-11 w-14 items-center justify-center rounded-ha-xl bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary">
          <Icon path={mdiArrowUp} size={20} />
        </button>
        <button type="button" aria-label="Stop cover" onClick={() => call('stop_cover')} className="flex h-11 w-14 items-center justify-center rounded-ha-xl bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary">
          <Icon path={mdiStop} size={20} />
        </button>
        <button type="button" aria-label="Close cover" onClick={() => call('close_cover')} className="flex h-11 w-14 items-center justify-center rounded-ha-xl bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary">
          <Icon path={mdiArrowDown} size={20} />
        </button>
      </div>
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
    </div>
  );
}

// ── Media player ─────────────────────────────────────────────────────────────

function MediaControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const playing = entity.state === 'playing';
  const volume = attr<number>(entity, 'volume_level');
  const muted = attr<boolean>(entity, 'is_volume_muted') ?? false;

  const call = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: 'media_player', service, serviceData: data, target: { entity_id: entity.entity_id } });

  return (
    <div className="w-full flex flex-col gap-ha-3">
      <div className="flex items-center justify-center gap-ha-3">
        <button type="button" aria-label="Previous track" onClick={() => call('media_previous_track')} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary">
          <Icon path={mdiSkipPrevious} size={22} />
        </button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => call('media_play_pause')} className="flex h-12 w-12 items-center justify-center rounded-full bg-ha-blue text-white transition-transform hover:scale-105">
          <Icon path={playing ? mdiPause : mdiPlay} size={24} />
        </button>
        <button type="button" aria-label="Next track" onClick={() => call('media_next_track')} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid hover:text-text-primary">
          <Icon path={mdiSkipNext} size={22} />
        </button>
      </div>
      {volume != null && (
        <div className="flex items-center gap-ha-2 w-full">
          <button
            type="button"
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            onClick={() => call('volume_mute', { is_volume_muted: !muted })}
            className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-lg transition-colors', muted ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:bg-surface-low')}
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
    </div>
  );
}

// ── Fan ──────────────────────────────────────────────────────────────────────

function FanControls({ entity }: { entity: HassEntity }) {
  const { callService } = useHomeAssistant();
  const percentage = attr<number>(entity, 'percentage');
  if (percentage == null) return null;
  const step = attr<number>(entity, 'percentage_step') ?? 1;
  return (
    <ControlSlider
      value={percentage}
      min={0}
      max={100}
      step={step}
      ariaLabel="Fan speed"
      format={(v) => `${Math.round(v)}%`}
      onCommit={(v) => {
        if (v <= 0) {
          callService({ domain: 'fan', service: 'turn_off', target: { entity_id: entity.entity_id } });
        } else {
          callService({ domain: 'fan', service: 'set_percentage', serviceData: { percentage: Math.round(v) }, target: { entity_id: entity.entity_id } });
        }
      }}
    />
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Renders the control surface matching the entity's domain, or nothing when
 * the domain has no setters beyond the toggle the panel already shows.
 */
export function DomainControls({ entityId }: { entityId: string }) {
  const entity = useEntity(entityId);
  const domain = useMemo(() => entityId.split('.')[0], [entityId]);
  if (!entity) return null;
  if (entity.state === 'unavailable' || entity.state === 'unknown') return null;

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
    default:
      return null;
  }
}
