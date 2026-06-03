'use client';

import { clsx } from 'clsx';
import { mdiPower } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { RollingNumericValue } from '../ui/RollingNumericValue';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCardV2Entity {
  entityId: string;
  icon: string;
  name: string;
  state: string;
  active?: boolean;
  entityPicture?: string;
  toggleable?: boolean;
  /** true for press-only entities (button, script) — renders action button instead of pill switch */
  pressable?: boolean;
  /** unit_of_measurement — used to style numeric read-only primary state prominently */
  unit?: string;
  /** 'sm' = compact row (no icon). Default 'lg' */
  size?: 'sm' | 'lg';
  onToggle?: () => void;
  onClick?: () => void;
}

export interface DeviceCardV2Props {
  primary: DeviceCardV2Entity;
  secondary?: DeviceCardV2Entity[];
  selected?: boolean;
  className?: string;
}

// ── Controls ──────────────────────────────────────────────────────────────────

/** Pill toggle switch for binary on/off entities */
function ToggleSwitch({ on, onToggle }: { on?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={clsx(
        'flex items-center shrink-0 w-11 h-[26px] rounded-full px-[4px] transition-colors',
        on ? 'bg-green-500' : 'bg-surface-mid hover:bg-surface-lower',
      )}
      aria-checked={on}
      role="switch"
    >
      <div className={clsx(
        'w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
        on ? 'translate-x-[18px]' : 'translate-x-0',
      )} />
    </button>
  );
}

/** Pill action button (same dimensions as ToggleSwitch) for press-only entities */
function ActionButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onPress(); }}
      className="flex items-center justify-center shrink-0 w-11 h-[26px] rounded-full bg-surface-mid hover:bg-surface-lower active:bg-surface-lower transition-colors"
    >
      <Icon path={mdiPower} size={14} className="text-text-secondary" />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeviceCardV2({ primary, secondary, selected, className }: DeviceCardV2Props) {
  const hasPicture = !!primary.entityPicture;

  return (
    <div
      className={clsx(
        'rounded-ha-2xl overflow-hidden bg-surface-default transition-all',
        selected && 'ha-selected',
        className,
      )}
    >
      {/* Primary entity — ~2× secondary row height */}
      <div
        className={clsx(
          'flex flex-col justify-between px-3 pt-3 pb-3 cursor-pointer rounded-t-[inherit] relative overflow-hidden transition-colors',
          'min-h-[88px]',
          primary.active
            ? 'bg-green-500/10 hover:bg-green-500/[0.16] active:bg-green-500/20'
            : 'bg-surface-default hover:bg-surface-low active:bg-surface-mid',
        )}
        onClick={primary.onClick}
      >
        {hasPicture && (
          <img src={primary.entityPicture} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}

        {/* Top row: icon (identifier only) + toggle switch if controllable */}
        <div className="relative flex items-center justify-between">
          {/* Icon — always non-interactive, purely informational */}
          <Icon
            path={primary.icon}
            size={20}
            className={primary.active ? 'text-green-500' : 'text-text-tertiary'}
          />

          {/* Toggle switch for controllable; prominent state value for read-only */}
          {primary.toggleable && primary.onToggle ? (
            <ToggleSwitch on={primary.active} onToggle={primary.onToggle} />
          ) : (
            <div className="flex items-baseline gap-0.5 shrink-0">
              <RollingNumericValue
                value={primary.unit ? String(parseFloat(primary.state) || primary.state) : primary.state}
                className={clsx(
                  'font-bold font-mono leading-none',
                  primary.unit ? 'text-2xl text-text-primary' : 'text-lg text-text-primary',
                )}
              />
              {primary.unit && (
                <span className="text-sm font-mono text-text-secondary">{primary.unit}</span>
              )}
            </div>
          )}
        </div>

        {/* Bottom: name, and state only for toggleable (read-only shows state top-right) */}
        <div className="relative">
          <p className="text-sm font-semibold text-text-primary leading-tight truncate">{primary.name}</p>
          {primary.toggleable && (
            <p className="text-sm font-medium font-mono text-text-secondary mt-0.5">{primary.state}</p>
          )}
        </div>
      </div>

      {/* Secondary entity rows */}
      {secondary && secondary.length > 0 && (
        <div>
          {secondary.map((entity) => (
            <div
              key={entity.entityId}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-low transition-colors border-t border-surface-lower"
              onClick={entity.onClick}
            >
              {/* Icon — non-interactive identifier, hidden in compact mode */}
              {entity.size !== 'sm' && (
                <Icon
                  path={entity.icon}
                  size={16}
                  className={clsx(
                    'flex-shrink-0',
                    entity.active ? 'text-green-500' : 'text-text-tertiary',
                  )}
                />
              )}

              {/* Name */}
              <span className={clsx(
                'flex-1 truncate',
                entity.size === 'sm' ? 'text-xs text-text-secondary' : 'text-sm text-text-primary',
              )}>
                {entity.name}
              </span>

              {/* Dedicated control — suppressed for compact ('sm') rows */}
              {entity.size !== 'sm' && entity.toggleable && entity.onToggle ? (
                <ToggleSwitch on={entity.active} onToggle={entity.onToggle} />
              ) : entity.size !== 'sm' && entity.pressable && entity.onToggle ? (
                <ActionButton onPress={entity.onToggle} />
              ) : (
                <RollingNumericValue
                  value={entity.state}
                  className="text-sm font-medium font-mono text-text-secondary shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
