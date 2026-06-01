'use client';

import { memo, useCallback } from 'react';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { Sparkline } from '../ui/Sparkline';

// Power icon (MDI mdiPower inline — avoids adding a dep just for controls)
const ICON_POWER =
  'M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13V3Z';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceAttribute {
  label: string;
  value: string | number;
}

export interface DeviceEntry {
  icon: string;
  name: string;
  state: string;
  /** Green icon when true */
  active?: boolean;
  attributes?: DeviceAttribute[];
  /** Called when the icon badge is clicked — used for toggle actions */
  onIconClick?: () => void;
  /** 'sm' = compact row (no icon, smaller text). Default 'lg' */
  size?: 'sm' | 'lg';
}

export interface DeviceCardProps {
  /** 'row' = compact pill, 'card' = padded block. Default: 'row' */
  variant?: 'row' | 'card';
  /** Dark (charcoal) background — used for active/selected state */
  dark?: boolean;

  // Single-entity shorthand — sugar for entities=[{ icon, name, state, ... }]
  icon?: string;
  name?: string;
  state?: string;
  active?: boolean;
  attributes?: DeviceAttribute[];
  /** Called when the icon badge is clicked — used for toggle actions */
  onIconClick?: () => void;
  /** Highlight the card as selected */
  selected?: boolean;

  // Multi-entity — overrides single-entity props when present
  entities?: DeviceEntry[];

  // Optional control section (card variant only)
  label?: string;
  showPower?: boolean;
  powerOn?: boolean;
  showToggle?: boolean;
  toggleOn?: boolean;
  onPower?: () => void;
  onToggle?: () => void;

  /** Small label shown above entity rows (card variant only) */
  title?: string;
  /** Per-entry sparkline data — parallel array to entries. null = no sparkline for that entry. */
  sparklinePoints?: (number[] | null)[];
  onClick?: () => void;
  className?: string;
}

// ── Internal sub-components ───────────────────────────────────────────────────

const DeviceIconBadge = memo(function DeviceIconBadge({
  path,
  active,
  dark,
  onIconClick,
}: {
  path: string;
  active?: boolean;
  dark?: boolean;
  onIconClick?: () => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onIconClick!();
  }, [onIconClick]);

  const className = clsx(
    'flex-shrink-0 flex items-center justify-center w-8 h-8 transition-transform',
    onIconClick
      ? clsx(
          'rounded-full',
          active
            ? 'bg-green-500/20 text-green-500'
            : dark
              ? 'bg-white/10 text-white/50'
              : 'bg-surface-mid text-text-secondary',
          'hover:scale-110 active:scale-95 cursor-pointer',
        )
      : active
        ? 'text-green-500'
        : dark
          ? 'text-white/50'
          : 'text-text-secondary',
  );

  if (onIconClick) {
    return (
      <button
        className={className}
        onClick={handleClick}
        tabIndex={0}
      >
        <Icon path={path} size={18} />
      </button>
    );
  }

  return (
    <div className={className}>
      <Icon path={path} size={18} />
    </div>
  );
});

const AttributeRow = memo(function AttributeRow({
  label,
  value,
  dark,
}: {
  label: string;
  value: string | number;
  dark?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={clsx('text-xs shrink-0', dark ? 'text-white/50' : 'text-text-secondary')}>
        {label}
      </span>
      <span
        className={clsx(
          'flex-1 border-b border-dashed mb-[3px]',
          dark ? 'border-white/10' : 'border-surface-lower',
        )}
      />
      <span
        className={clsx('text-xs tabular-nums shrink-0', dark ? 'text-white/75' : 'text-text-primary')}
      >
        {value}
      </span>
    </div>
  );
});

const EntryBlock = memo(function EntryBlock({
  entry,
  dark,
  divider,
}: {
  entry: DeviceEntry;
  dark?: boolean;
  divider?: boolean;
}) {
  const isCompact = entry.size === 'sm';

  return (
    <>
      {divider && (
        <div className={clsx('h-px', dark ? 'bg-white/10' : 'bg-surface-lower')} />
      )}

      {isCompact ? (
        /* Compact row — no icon, no indent */
        <div className="flex items-center gap-ha-2">
          <span className={clsx('flex-1 text-xs truncate', dark ? 'text-white/60' : 'text-text-secondary')}>
            {entry.name}
          </span>
          <span className={clsx('text-xs tabular-nums shrink-0', dark ? 'text-white/50' : 'text-text-tertiary')}>
            {entry.state}
          </span>
        </div>
      ) : (
        /* Full row — icon badge + name + state */
        <div className="flex flex-col gap-ha-2">
          <div className="flex items-center gap-ha-3">
            <DeviceIconBadge path={entry.icon} active={entry.active} dark={dark} onIconClick={entry.onIconClick} />
            <div className="flex flex-col min-w-0 flex-1">
              <span className={clsx('text-sm font-medium leading-tight truncate', dark ? 'text-white' : 'text-text-primary')}>
                {entry.name}
              </span>
              <span className={clsx('text-xs leading-tight truncate', dark ? 'text-white/50' : 'text-text-secondary')}>
                {entry.state}
              </span>
            </div>
          </div>

          {entry.attributes && entry.attributes.length > 0 && (
            <div className="flex flex-col gap-[3px] pl-[44px]">
              {entry.attributes.map((attr, i) => (
                <AttributeRow key={i} label={attr.label} value={attr.value} dark={dark} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
});

const Toggle = memo(function Toggle({ on, dark }: { on?: boolean; dark?: boolean }) {
  return (
    <div
      className={clsx(
        'w-11 h-6 rounded-full flex items-center px-[3px] transition-colors duration-200',
        on ? 'bg-green-500' : dark ? 'bg-white/20' : 'bg-surface-lower',
      )}
    >
      <div
        className={clsx(
          'w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
          on ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </div>
  );
});

const ControlsSection = memo(function ControlsSection({
  label,
  showPower,
  powerOn,
  showToggle,
  toggleOn,
  onPower,
  onToggle,
  dark,
}: Pick<
  DeviceCardProps,
  'label' | 'showPower' | 'powerOn' | 'showToggle' | 'toggleOn' | 'onPower' | 'onToggle'
> & { dark?: boolean }) {
  return (
    <div className="flex flex-col gap-ha-2">
      {label !== undefined && (
        <div
          className={clsx(
            'flex items-center justify-center py-ha-2 rounded-ha-xl',
            dark ? 'bg-white/10' : 'bg-surface-mid',
          )}
        >
          <span className={clsx('text-sm', dark ? 'text-white/60' : 'text-text-secondary')}>
            {label}
          </span>
        </div>
      )}

      {showPower && (
        <button
          onClick={onPower}
          className={clsx(
            'flex items-center justify-center py-ha-3 rounded-ha-xl transition-colors',
            powerOn
              ? 'bg-green-500/20 text-green-500'
              : dark
                ? 'bg-white/10 text-white/50 hover:bg-white/15'
                : 'bg-surface-mid text-text-secondary hover:bg-surface-lower',
          )}
        >
          <Icon path={ICON_POWER} size={22} />
        </button>
      )}

      {showToggle && (
        <button
          onClick={onToggle}
          className={clsx(
            'flex items-center justify-center py-ha-3 rounded-ha-xl transition-colors',
            dark ? 'bg-white/10 hover:bg-white/15' : 'bg-surface-mid hover:bg-surface-lower',
          )}
        >
          <Toggle on={toggleOn} dark={dark} />
        </button>
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export const DeviceCard = memo(function DeviceCard({
  variant = 'row',
  dark = false,
  icon,
  name,
  state,
  active,
  attributes,
  onIconClick,
  selected,
  entities,
  label,
  showPower,
  powerOn,
  showToggle,
  toggleOn,
  onPower,
  onToggle,
  title,
  sparklinePoints,
  onClick,
  className,
}: DeviceCardProps) {
  const entries: DeviceEntry[] =
    entities ??
    (icon && name
      ? [{ icon, name, state: state ?? '', active, attributes, onIconClick }]
      : []);

  const hasControls = label !== undefined || showPower || showToggle;

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button')) return;
    onClick!();
  }, [onClick]);

  return (
    <div
      className={clsx(
        'transition-all',
        dark ? 'bg-[#2a2a2a]' : 'bg-surface-default',
        variant === 'card' ? 'rounded-ha-2xl p-ha-4' : 'rounded-ha-xl p-ha-3',
        onClick && 'cursor-pointer hover:bg-surface-low active:scale-[0.99]',
        selected && 'ha-selected',
        className,
      )}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={clsx('flex flex-col', variant === 'card' ? 'gap-ha-3' : 'gap-ha-2')}>
        {title && variant === 'card' && (
          <span className={clsx('text-xs font-medium truncate', dark ? 'text-white/40' : 'text-text-tertiary')}>
            {title}
          </span>
        )}
        {entries.map((entry, i) => {
          const pts = variant === 'card' ? sparklinePoints?.[i] : null;
          const hasSpark = pts && pts.length >= 3;
          const gid = `dc-sg-${i}-${entry.name.replace(/\s+/g, '-')}`;
          return (
            <div key={i}>
              <EntryBlock entry={entry} dark={dark} divider={i > 0} />
              {hasSpark && (
                <div className={clsx('opacity-50 overflow-hidden', variant === 'card' ? '-mx-ha-1 rounded-ha-lg' : '-mx-1 mt-1')}>
                  <Sparkline points={pts} on={!!entry.active} gradientId={gid} small />
                </div>
              )}
            </div>
          );
        })}

        {hasControls && variant === 'card' && (
          <ControlsSection
            label={label}
            showPower={showPower}
            powerOn={powerOn}
            showToggle={showToggle}
            toggleOn={toggleOn}
            onPower={onPower}
            onToggle={onToggle}
            dark={dark}
          />
        )}
      </div>
    </div>
  );
});
