'use client';

import { useRef, useCallback, useState, memo } from 'react';
import { clsx } from 'clsx';
import { mdiPower, mdiAlertCircleOutline, mdiPencil } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { RollingNumericValue } from '../ui/RollingNumericValue';
import { EntityMiniSparkline } from '../ui/EntityMiniSparkline';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCardV2Entity {
  entityId: string;
  icon: string;
  name: string;
  state: string;
  lastChanged?: string;
  active?: boolean;
  entityPicture?: string;
  /** Product-type thumbnail (e.g. /devices/motion_sensor.png) shown in place of the icon */
  thumbnail?: string | null;
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

function formatUnavailableDuration(lastChanged: string | undefined): string | null {
  if (!lastChanged) return null;
  const diffMs = Date.now() - new Date(lastChanged).getTime();
  if (isNaN(diffMs) || diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export interface DeviceCardV2Props {
  primary: DeviceCardV2Entity;
  secondary?: DeviceCardV2Entity[];
  selected?: boolean;
  editMode?: boolean;
  onLongPress?: () => void;
  className?: string;
  /** Shown above device name in smaller muted text — use when grouped by type */
  areaName?: string;
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

function DeviceCardV2Component({ primary, secondary, selected, editMode, onLongPress, className, areaName }: DeviceCardV2Props) {
  const hasPicture = !!primary.entityPicture;
  const rawState = primary.state.toLowerCase();
  const isUnavailable = rawState === 'unavailable' || rawState === 'unknown';
  const hasSecondary = secondary && secondary.length > 0;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Thumbnail PNGs are dropped in by hand; revert to the mdi icon if one is
  // missing. Reset the error flag when the thumbnail changes by adjusting state
  // during render (the React-sanctioned alternative to a setState-in-effect).
  const [thumb, setThumb] = useState<{ src?: string | null; ok: boolean }>({ src: primary.thumbnail, ok: true });
  if (thumb.src !== primary.thumbnail) setThumb({ src: primary.thumbnail, ok: true });
  const showThumb = !!primary.thumbnail && thumb.ok && thumb.src === primary.thumbnail;

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return;
    longPressTimer.current = setTimeout(() => { onLongPress(); }, 500);
  }, [onLongPress]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  return (
    <div
      data-entity-id={primary.entityId}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      className={clsx(
        'group/card relative rounded-ha-2xl overflow-hidden bg-surface-default transition-[box-shadow]',
        editMode && 'cursor-grab active:cursor-grabbing select-none',
        selected && 'ha-selected',
        isUnavailable && 'ring-2 ring-inset ring-amber-500/40',
        className,
      )}
    >
      {/* Edit mode: full-card ring + pencil on hover */}
      {editMode && (
        <div
          className="absolute inset-0 rounded-ha-2xl ring-2 ring-inset ring-ha-blue/30 pointer-events-none z-10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150"
          aria-hidden
        />
      )}
      {editMode && (
        <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-ha-blue flex items-center justify-center shadow-md pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
          <Icon path={mdiPencil} size={12} className="text-white" />
        </div>
      )}

      {/* Primary entity */}
      {isUnavailable ? (
        <div
          className={clsx(
            'flex flex-col items-center justify-center gap-1.5 px-3 py-5 min-h-[88px] bg-amber-500/[0.07] cursor-pointer hover:bg-amber-500/[0.11] active:bg-amber-500/[0.15] transition-colors',
            hasSecondary ? 'rounded-t-ha-2xl' : 'rounded-ha-2xl',
          )}
          onClick={primary.onClick}
        >
          <Icon path={mdiAlertCircleOutline} size={24} className="text-amber-500/70 flex-shrink-0" />
          <p className="text-sm font-semibold text-text-secondary leading-tight truncate text-center max-w-full">{primary.name}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Unavailable
            </span>
            {formatUnavailableDuration(primary.lastChanged) && (
              <span className="text-[13px] text-text-disabled">
                {formatUnavailableDuration(primary.lastChanged)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          className={clsx(
            'flex flex-col justify-between px-3 pt-3 pb-3 relative overflow-hidden transition-colors',
            hasSecondary ? 'rounded-t-ha-2xl' : 'rounded-ha-2xl',
            'min-h-[148px] md:min-h-[136px]',
            editMode
              ? 'bg-surface-default hover:bg-surface-low'
              : primary.active && primary.toggleable
                ? 'bg-green-500/10 hover:bg-green-500/[0.16] active:bg-green-500/20 cursor-pointer'
                : 'bg-surface-default hover:bg-surface-low active:bg-surface-mid cursor-pointer',
          )}
          onClick={primary.onClick}
        >
          {hasPicture && (
            <img src={primary.entityPicture} alt="" aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-20" />
          )}

          {/* Product thumbnail — a left-anchored background graphic sitting BEHIND
              the name/state (which render on top). Faded toward the bottom with a
              gradient mask so the text stays legible on any card background (incl.
              the green "on" tint). The card keeps its size. */}
          {showThumb && (
            <img
              src={primary.thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb((t) => ({ ...t, ok: false }))}
              className="pointer-events-none select-none absolute left-2 top-2 h-[38%] md:h-[52%] w-auto object-contain object-left"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 92%)',
                maskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 92%)',
              }}
            />
          )}

          {/* Top row: icon (hidden when the product thumbnail is shown) + control */}
          <div className={clsx('relative flex items-center', showThumb ? 'justify-end' : 'justify-between')}>
            {!showThumb && (
              <Icon path={primary.icon} size={20} className="text-text-tertiary" />
            )}
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

          {/* Sparkline — sensor entities only */}
          {primary.unit && (
            <EntityMiniSparkline entityId={primary.entityId} />
          )}

          {/* Bottom: name + state — render on top of the background thumbnail */}
          <div className="relative">
            {areaName && (
              <p className="text-[13px] font-medium text-text-tertiary leading-none truncate mb-0.5">{areaName}</p>
            )}
            <p className="text-sm font-semibold text-text-primary leading-tight truncate">{primary.name}</p>
            {primary.toggleable ? (
              <p className="text-sm font-medium font-mono text-text-secondary mt-0.5">{primary.state}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Secondary entity rows */}
      {hasSecondary && (
        <div className={clsx('rounded-b-ha-2xl overflow-hidden', isUnavailable && 'opacity-40 pointer-events-none')}>
          {secondary!.map((entity) => {
            const entityUnavailable = entity.state === 'unavailable' || entity.state === 'unknown';
            return (
              <div
                key={entity.entityId}
                className={clsx(
                  'flex items-center gap-3 px-3 border-t border-surface-lower transition-colors min-h-[44px]',
                  entityUnavailable
                    ? 'opacity-50 cursor-default'
                    : editMode
                      ? 'hover:bg-surface-low'
                      : entity.active && entity.toggleable
                        ? 'cursor-pointer bg-green-500/10 hover:bg-green-500/[0.16] active:bg-green-500/20'
                        : 'cursor-pointer hover:bg-surface-low',
                )}
                onClick={entityUnavailable ? undefined : entity.onClick}
              >
                {entity.size !== 'sm' && (
                  <Icon
                    path={entity.icon}
                    size={16}
                    className={clsx(
                      'flex-shrink-0',
                      entityUnavailable ? 'text-text-disabled' : (entity.active && entity.toggleable) ? 'text-green-500' : 'text-text-tertiary',
                    )}
                  />
                )}

                <span className={clsx(
                  'flex-1 truncate',
                  entity.size === 'sm' ? 'text-xs text-text-secondary' : 'text-sm text-text-primary',
                )}>
                  {entity.name}
                </span>

                {entityUnavailable ? (
                  <Icon path={mdiAlertCircleOutline} size={14} className="text-amber-500 shrink-0" />
                ) : entity.size !== 'sm' && entity.toggleable && entity.onToggle ? (
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
            );
          })}
        </div>
      )}
    </div>
  );
}

// The dashboard rebuilds the device tree and re-runs renderCard for every device
// on each entity-store update, handing each card fresh inline prop objects. Without
// memoization all 20-50 cards re-render every update even when their own entity did
// not change. Compare the meaningful display fields (not object/function identity):
// onToggle/onClick closures only capture state that is also a compared field, so a
// skipped render can never leave a stale closure behind.
function entityFieldsEqual(a?: DeviceCardV2Entity, b?: DeviceCardV2Entity): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.entityId === b.entityId &&
    a.state === b.state &&
    a.active === b.active &&
    a.icon === b.icon &&
    a.name === b.name &&
    a.unit === b.unit &&
    a.size === b.size &&
    a.entityPicture === b.entityPicture &&
    a.thumbnail === b.thumbnail &&
    a.toggleable === b.toggleable &&
    a.pressable === b.pressable &&
    a.lastChanged === b.lastChanged
  );
}

function propsEqual(prev: DeviceCardV2Props, next: DeviceCardV2Props): boolean {
  if (
    prev.selected !== next.selected ||
    prev.editMode !== next.editMode ||
    prev.areaName !== next.areaName ||
    prev.className !== next.className ||
    !!prev.onLongPress !== !!next.onLongPress
  ) {
    return false;
  }
  if (!entityFieldsEqual(prev.primary, next.primary)) return false;
  const ps = prev.secondary ?? [];
  const ns = next.secondary ?? [];
  if (ps.length !== ns.length) return false;
  for (let i = 0; i < ps.length; i += 1) {
    if (!entityFieldsEqual(ps[i], ns[i])) return false;
  }
  return true;
}

export const DeviceCardV2 = memo(DeviceCardV2Component, propsEqual);
