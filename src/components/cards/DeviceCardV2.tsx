'use client';

import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCardV2Entity {
  entityId: string;
  icon: string;        // MDI path
  name: string;
  state: string;
  active?: boolean;
  entityPicture?: string; // URL from HA attributes
  toggleable?: boolean;
  /** 'sm' = compact row (no icon). Default 'lg' */
  size?: 'sm' | 'lg';
  onToggle?: () => void;    // called when icon/toggle is tapped
  onClick?: () => void;     // called when row/hero is tapped → opens detail panel
}

export interface DeviceCardV2Props {
  primary: DeviceCardV2Entity;
  secondary?: DeviceCardV2Entity[];
  selected?: boolean;
  className?: string;
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
      {/* Primary entity row — ~2× secondary row height */}
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
        {/* Entity picture as subtle background when available */}
        {hasPicture && (
          <img
            src={primary.entityPicture}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}

        {/* Icon — top-left. Toggleable: rounded bg + interactions. Read-only: bare icon only. */}
        <div className="relative">
          {primary.toggleable ? (
            <button
              className={clsx(
                'w-9 h-9 rounded-ha-lg flex items-center justify-center transition-all',
                primary.active
                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 active:bg-green-500/40'
                  : 'bg-surface-mid text-text-secondary hover:bg-surface-lower active:bg-surface-lower',
              )}
              onClick={(e) => { e.stopPropagation(); primary.onToggle?.(); }}
            >
              <Icon path={primary.icon} size={20} />
            </button>
          ) : (
            <Icon
              path={primary.icon}
              size={20}
              className={primary.active ? 'text-green-500' : 'text-text-tertiary'}
            />
          )}
        </div>

        {/* Name + state — bottom */}
        <div className="relative">
          <p className="text-sm font-semibold text-text-primary leading-tight truncate">{primary.name}</p>
          <p className="text-xs text-text-secondary mt-0.5">{primary.state}</p>
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
              {/* Icon — hidden in compact ('sm') mode */}
              {entity.size !== 'sm' && (
                <div className={clsx(
                  'w-6 h-6 flex items-center justify-center flex-shrink-0',
                  entity.active ? 'text-green-500' : 'text-text-tertiary',
                )}>
                  <Icon path={entity.icon} size={16} />
                </div>
              )}

              {/* Name */}
              <span className={clsx(
                'flex-1 truncate',
                entity.size === 'sm' ? 'text-xs text-text-secondary' : 'text-sm text-text-primary',
              )}>
                {entity.name}
              </span>

              {/* State */}
              <span className="text-xs text-text-secondary tabular-nums shrink-0">
                {entity.state}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
