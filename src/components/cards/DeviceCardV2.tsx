'use client';

import { useRef, useCallback, useState, memo } from 'react';
import { clsx } from 'clsx';
import { mdiPower, mdiAlertCircleOutline, mdiPencil } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { RollingNumericValue } from '../ui/RollingNumericValue';
import { EntityMiniSparkline, type MiniSparklinePoint } from '../ui/EntityMiniSparkline';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { useDebugFlags } from '@/contexts';
import { formatHoverTime } from './EntityDetailPanel';

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
  /** Inline history sparkline on secondary rows. Default on; false hides it. */
  chart?: boolean;
  /** 'sm' = compact row (no icon). Default 'lg' */
  size?: 'sm' | 'lg';
  onToggle?: () => void;
  onClick?: () => void;
  /**
   * Glanceable value for the freed top-right corner of toggleable cards — a live
   * sub-metric, power draw, or last-changed time. See `primaryCornerBadge`.
   */
  corner?: string;
  /** Accessible label / tooltip describing `corner`. */
  cornerLabel?: string;
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
  /** Softer marker than `selected` — the card was the last one opened, kept after the panel closes. */
  lastOpened?: boolean;
  editMode?: boolean;
  onLongPress?: () => void;
  className?: string;
  /** Shown above device name in smaller muted text — use when grouped by type */
  areaName?: string;
  /**
   * Resolved image URL for a camera snapshot / media artwork — rendered as a
   * full-bleed hero behind the primary content (name/state in white over a
   * scrim). Device-level, so it shows even when the primary slot is another
   * entity (e.g. a camera's motion sensor).
   */
  feedImage?: string;
}

// ── Controls ──────────────────────────────────────────────────────────────────

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

function DeviceCardV2Component({ primary, secondary, selected, lastOpened, editMode, onLongPress, className, areaName, feedImage }: DeviceCardV2Props) {
  const hasPicture = !!primary.entityPicture;
  const rawState = primary.state.toLowerCase();
  const isUnavailable = rawState === 'unavailable' || rawState === 'unknown';
  // Camera/media hero feed — full-bleed image with white text over a scrim.
  // Suppressed while unavailable so the amber state stays readable.
  const showFeed = !!feedImage && !isUnavailable;
  const hasSecondary = secondary && secondary.length > 0;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Thumbnail PNGs are dropped in by hand; revert to the mdi icon if one is
  // missing. Reset the error flag when the thumbnail changes by adjusting state
  // during render (the React-sanctioned alternative to a setState-in-effect).
  const [thumb, setThumb] = useState<{ src?: string | null; ok: boolean }>({ src: primary.thumbnail, ok: true });
  if (thumb.src !== primary.thumbnail) setThumb({ src: primary.thumbnail, ok: true });
  const showThumb = !!primary.thumbnail && thumb.ok && thumb.src === primary.thumbnail;

  // Graph hover scrubbing (desktop) — show the hovered point + timestamp in
  // place of the live value, like the detail panel
  const [hoverPoint, setHoverPoint] = useState<MiniSparklinePoint | null>(null);

  // Layout experiment (settings → Prototype & Debug → Developer flags). `hero`
  // is the current design (name top-left, image right, toggle bottom-left);
  // `classic` is the previous layout (image left, name/state + toggle bottom).
  const { heroCardLayoutEnabled } = useDebugFlags();

  // Read-only text block (area eyebrow → prominent name → state / unavailable /
  // hover-scrubbed value). Shared by both layouts; `hero` only tweaks type sizes
  // and reserves right padding to clear the right-anchored thumbnail.
  const renderNameState = (hero: boolean) => (
    <div className={clsx(
      'flex-1 min-w-0',
      hero && showThumb && !showFeed && 'pr-[38%] md:pr-[42%]',
      showFeed && '[text-shadow:0_1px_3px_rgba(0,0,0,0.7)]',
    )}>
      {areaName && (
        <p className={clsx('font-medium leading-none truncate ha-card-marquee', hero ? 'text-[12px] mb-1' : 'text-[13px] mb-0.5', showFeed ? 'text-white/75' : 'text-text-tertiary')}><span data-marquee>{areaName}</span></p>
      )}
      <p className={clsx('font-semibold leading-tight truncate ha-card-marquee', hero ? 'text-[15px]' : 'text-sm', showFeed ? 'text-white' : 'text-text-primary')}><span data-marquee>{primary.name}</span></p>
      {isUnavailable ? (
        <div className={clsx('flex items-baseline gap-1.5', hero ? 'mt-1' : 'mt-0.5')}>
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-amber-500/90">Unavailable</span>
          {formatUnavailableDuration(primary.lastChanged) && (
            <span className="text-[12px] font-medium font-mono text-amber-500/60">
              {formatUnavailableDuration(primary.lastChanged) === 'just now'
                ? 'just now'
                : `for ${formatUnavailableDuration(primary.lastChanged)}`}
            </span>
          )}
        </div>
      ) : (
        // State sits under the name. For numeric sensors this is the reading
        // (and scrubs to the hovered sparkline point on desktop).
        <p className={clsx('font-medium font-mono mt-0.5 truncate', hero ? 'text-[13px]' : 'text-sm', showFeed ? 'text-white/85' : 'text-text-secondary')}>
          {hoverPoint
            ? `${Number.isInteger(hoverPoint.value) ? hoverPoint.value : hoverPoint.value.toFixed(1)}${primary.unit ? ` ${primary.unit}` : ''}`
            : primary.state}
          {hoverPoint?.ts != null && (
            <span className={clsx('ml-1.5 text-[11px] font-semibold uppercase tracking-wide', showFeed ? 'text-white/60' : 'text-text-tertiary')}>
              {formatHoverTime(hoverPoint.ts)}
            </span>
          )}
        </p>
      )}
    </div>
  );

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
        !selected && lastOpened && 'ha-last-opened',
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

      {/* Primary entity — unavailable keeps the same layout, tinted amber */}
      <div
        className={clsx(
          'flex flex-col justify-between px-3 pt-3 pb-3 relative overflow-hidden transition-colors',
          hasSecondary ? 'rounded-t-ha-2xl' : 'rounded-ha-2xl',
          'min-h-[104px] md:min-h-[136px]',
          editMode
            ? 'bg-surface-default hover:bg-surface-low'
            : isUnavailable
              ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.11] active:bg-amber-500/[0.15] cursor-pointer'
              : primary.active && primary.toggleable
                ? 'bg-green-500/10 hover:bg-green-500/[0.16] active:bg-green-500/20 cursor-pointer'
                : 'bg-surface-default hover:bg-surface-low active:bg-surface-mid cursor-pointer',
        )}
        onClick={primary.onClick}
      >
        {/* Camera/media hero feed — full-bleed, with a bottom scrim so the
            white name/state stay legible. */}
        {showFeed && (
          <>
            <img src={feedImage} alt="" aria-hidden
              className="absolute inset-0 w-full h-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          </>
        )}

        {hasPicture && !showFeed && (
          <img src={primary.entityPicture} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}

        {heroCardLayoutEnabled ? (
          /* ── HERO layout ── screenshot-style: text top-left, product image
             right-centered, control bottom-left. */
          <>
            {/* Thumbnail — right-anchored, vertically centered, sitting BEHIND the
                text. Left edge masked to transparent so name/state stay legible. */}
            {showThumb && !showFeed && (
              <img
                src={primary.thumbnail!}
                alt=""
                aria-hidden
                onError={() => setThumb((t) => ({ ...t, ok: false }))}
                className={clsx(
                  'pointer-events-none select-none absolute right-1 top-1/2 -translate-y-1/2 z-[2] h-[52%] w-[40%] md:h-[64%] md:w-[44%] object-contain object-right',
                  isUnavailable && 'opacity-50 grayscale',
                )}
                style={{
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 28%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, #000 28%)',
                }}
              />
            )}

            {/* Top: name-prominent text on the LEFT; icon/alert tucked top-right. */}
            <div className="relative z-[2] flex items-start justify-between gap-2">
              {renderNameState(true)}
              {!showThumb && !showFeed && !isUnavailable && (
                <Icon path={primary.icon} size={20} className="text-text-tertiary shrink-0" />
              )}
              {isUnavailable && (
                <Icon path={mdiAlertCircleOutline} size={20} className="text-amber-500 shrink-0" />
              )}
            </div>

            {/* Sparkline — sensor entities only. Full width, but painted BEHIND
                the thumbnail (z-[1] < image z-[2]) so the line disappears exactly
                where the device pixels begin — the graph "ends" at the image no
                matter how big the thumbnail is. */}
            {primary.unit && !isUnavailable && (
              <div className="relative z-[1] w-full">
                <EntityMiniSparkline entityId={primary.entityId} onHover={setHoverPoint} />
              </div>
            )}

            {/* Bottom: control anchored bottom-LEFT. Empty for read-only. */}
            <div className="relative z-[2] flex items-center">
              {!isUnavailable && primary.toggleable && primary.onToggle && (
                <ToggleSwitch on={primary.active} onToggle={primary.onToggle} />
              )}
            </div>
          </>
        ) : (
          /* ── CLASSIC layout (previous) ── product image left, name/state + toggle
             along the bottom row. Kept behind the toggle for comparison. */
          <>
            {/* Product thumbnail — left-anchored background graphic BEHIND the
                name/state, faded toward the bottom so text stays legible. */}
            {showThumb && !showFeed && (
              <>
                {/* Fade the sparkline out left-to-right so the thumbnail sits on a
                    calm backdrop — only needed when a graph renders under it */}
                {primary.unit && !isUnavailable && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-3/5 z-[1] bg-gradient-to-r from-surface-default to-transparent"
                  />
                )}
                <img
                  src={primary.thumbnail!}
                  alt=""
                  aria-hidden
                  onError={() => setThumb((t) => ({ ...t, ok: false }))}
                  className={clsx(
                    'pointer-events-none select-none absolute left-2 top-2 z-[1] h-[42%] md:h-[52%] w-auto object-contain object-left',
                    isUnavailable && 'opacity-50 grayscale',
                  )}
                  style={{
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 92%)',
                    maskImage: 'linear-gradient(to bottom, #000 0%, #000 42%, transparent 92%)',
                  }}
                />
              </>
            )}

            {/* Top row: icon (hidden when the product thumbnail is shown). */}
            <div className={clsx('relative z-[2] flex items-center', (showThumb || showFeed) ? 'justify-end' : 'justify-between')}>
              {!showThumb && !showFeed && (
                <Icon path={primary.icon} size={20} className={isUnavailable ? 'text-amber-500/70' : 'text-text-tertiary'} />
              )}
              {isUnavailable && (
                <Icon path={mdiAlertCircleOutline} size={20} className="text-amber-500 shrink-0" />
              )}
            </div>

            {/* Sparkline — sensor entities only */}
            {primary.unit && !isUnavailable && (
              <EntityMiniSparkline entityId={primary.entityId} onHover={setHoverPoint} />
            )}

            {/* Bottom: name + state on the left, the toggle on the right. */}
            <div className="relative z-[2] flex items-center justify-between gap-3">
              {renderNameState(false)}
              {!isUnavailable && primary.toggleable && primary.onToggle && (
                <ToggleSwitch on={primary.active} onToggle={primary.onToggle} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Secondary entity rows */}
      {hasSecondary && (
        <div className={clsx('rounded-b-ha-2xl overflow-hidden', isUnavailable && 'opacity-40 pointer-events-none')}>
          {secondary!.map((entity) => {
            const entityUnavailable = entity.state === 'unavailable' || entity.state === 'unknown';
            return (
              <div
                key={entity.entityId}
                className={clsx(
                  'flex items-center gap-3 px-3 border-t border-surface-lower transition-colors min-h-[52px]',
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
                    size={19}
                    className={clsx(
                      'flex-shrink-0',
                      entityUnavailable ? 'text-text-disabled' : (entity.active && entity.toggleable) ? 'text-green-500' : 'text-text-tertiary',
                    )}
                  />
                )}

                <span className={clsx(
                  'flex-1 truncate ha-card-marquee',
                  entity.size === 'sm' ? 'text-xs text-text-secondary' : 'text-sm text-text-primary',
                )}>
                  <span data-marquee>{entity.name}</span>
                </span>

                {entityUnavailable ? (
                  <Icon path={mdiAlertCircleOutline} size={14} className="text-amber-500 shrink-0" />
                ) : entity.size !== 'sm' && entity.toggleable && entity.onToggle ? (
                  <ToggleSwitch on={entity.active} onToggle={entity.onToggle} />
                ) : entity.size !== 'sm' && entity.pressable && entity.onToggle ? (
                  <ActionButton onPress={entity.onToggle} />
                ) : (
                  <>
                    {/* Numeric sensors get an inline history sparkline before the state */}
                    {entity.unit && entity.chart !== false && <EntityMiniSparkline entityId={entity.entityId} tiny />}
                    <RollingNumericValue
                      value={entity.state}
                      className="text-sm font-medium font-mono text-text-secondary shrink-0"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fast-scroll gist label — always in the DOM, invisible until an ancestor
          scroll container gains `.ha-fast-scroll` (see useFastScrollLabels). The
          reveal is pure CSS so flinging never re-renders the card. Clipped to the
          card's rounded shape by the outer overflow-hidden. */}
      <div data-card-fast-label aria-hidden>
        {areaName && <span data-fast-label-area>{areaName}</span>}
        <span data-fast-label-name>{primary.name}</span>
      </div>
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
    a.chart === b.chart &&
    a.size === b.size &&
    a.entityPicture === b.entityPicture &&
    a.thumbnail === b.thumbnail &&
    a.toggleable === b.toggleable &&
    a.pressable === b.pressable &&
    a.lastChanged === b.lastChanged &&
    a.corner === b.corner &&
    a.cornerLabel === b.cornerLabel
  );
}

function propsEqual(prev: DeviceCardV2Props, next: DeviceCardV2Props): boolean {
  if (
    prev.selected !== next.selected ||
    prev.lastOpened !== next.lastOpened ||
    prev.editMode !== next.editMode ||
    prev.areaName !== next.areaName ||
    prev.feedImage !== next.feedImage ||
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
