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
  /**
   * Extra facts about the state, shown after it separated by "・" — a light's
   * colour, a speaker's source, a thermostat's setpoint. See `stateExtras`.
   */
  details?: string[];
  /** A colour worth a dot before the state (a light's current colour). */
  dotColor?: string;
}

/**
 * Does this entity have a curve worth drawing on the card? A unit is the obvious
 * case, but plenty of measured sensors ship none (an index, a count, a signal
 * score) — what actually matters is that the reading is a number.
 */
function hasHistory(entity: { state: string; unit?: string }): boolean {
  return !!entity.unit || !isNaN(parseFloat(entity.state));
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
  // Layout experiments (settings → Prototype & Debug → Developer flags). `hero`
  // is the current design (name top-left, image right, toggle bottom-left);
  // `classic` is the previous layout (image left, name/state + toggle bottom).
  // `hideCardImages` drops the product render from either one.
  const { hideCardImagesEnabled } = useDebugFlags();
  const hasPicture = !!primary.entityPicture;
  const rawState = primary.state.toLowerCase();
  const isUnavailable = rawState === 'unavailable' || rawState === 'unknown';
  // Camera/media hero feed — full-bleed image with white text over a scrim.
  // Suppressed while unavailable so the amber state stays readable.
  const showFeed = !!feedImage && !isUnavailable;
  const hasSecondary = secondary && secondary.length > 0;
  const primaryHasHistory = hasHistory(primary);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Thumbnail PNGs are dropped in by hand; revert to the mdi icon if one is
  // missing. Reset the error flag when the thumbnail changes by adjusting state
  // during render (the React-sanctioned alternative to a setState-in-effect).
  const [thumb, setThumb] = useState<{ src?: string | null; ok: boolean }>({ src: primary.thumbnail, ok: true });
  if (thumb.src !== primary.thumbnail) setThumb({ src: primary.thumbnail, ok: true });
  const showThumb = !hideCardImagesEnabled && !!primary.thumbnail && thumb.ok && thumb.src === primary.thumbnail;

  // Graph hover scrubbing (desktop) — show the hovered point + timestamp in
  // place of the live value, like the detail panel
  const [hoverPoint, setHoverPoint] = useState<MiniSparklinePoint | null>(null);
  // The whole primary block is the scrub surface — the graph is a 40px strip
  // along the bottom edge, far too small to aim at.
  const primaryRef = useRef<HTMLDivElement>(null);
  // A long press means "arrange the dashboard" — the tap that ends it must not
  // also count as a tap on the card (which opened the dialog on top of edit
  // mode). Touch fires click after the press ends, so the click is swallowed at
  // the card's own capture phase, before the hero, a switch or a row sees it.
  const longPressFired = useRef(false);

  // Read-only text block (area eyebrow → prominent name → state / unavailable /
  // hover-scrubbed value). Takes the card's full width — the product render has
  // its own cell in the bottom row, so there is nothing to reserve space for.
  // Type sizes read `--dct-*` vars (set by the developer card-tuner panel) with
  // the production value as fallback, so live tuning repaints without renders.
  const renderNameState = () => (
    <div className={clsx(
      'flex-1 min-w-0',
      showFeed && '[text-shadow:0_1px_3px_rgba(0,0,0,0.7)]',
    )}>
      {areaName && (
        <p
          className={clsx('font-medium leading-none truncate ha-card-marquee mb-1', showFeed ? 'text-white/75' : 'text-text-tertiary')}
          style={{
            fontSize: 'var(--dct-area-size, 12px)',
            textTransform: 'var(--dct-area-transform, none)' as 'none',
            letterSpacing: 'var(--dct-area-tracking, normal)',
          }}
        ><span data-marquee>{areaName}</span></p>
      )}
      {/* The name may take two lines before it truncates — device names run long
          ("Living room ceiling spotlights") and the card has room for a second
          line, so this one wraps rather than marqueeing. */}
      <p
        className={clsx('leading-tight line-clamp-2', showFeed ? 'text-white' : 'text-text-primary')}
        style={{ fontSize: 'var(--dct-name-size, 15px)', fontWeight: 'var(--dct-name-weight, 600)' }}
      >{primary.name}</p>
      {isUnavailable ? (
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-amber-500/90">Offline</span>
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
        // (and scrubs to the hovered sparkline point on desktop). Long strings
        // — firmware builds, media titles, enum text — get the same marquee the
        // name uses, so they scroll into view instead of dying at an ellipsis.
        <p
          className={clsx('font-medium truncate ha-card-marquee', showFeed ? 'text-white/85' : 'text-text-secondary')}
          style={{
            fontSize: 'var(--dct-state-size, 13px)',
            marginTop: 'var(--dct-state-gap, 1px)',
            fontFamily: 'var(--dct-state-font, var(--font-mono))',
          }}
        >
          <span data-marquee>
            {primary.dotColor && !hoverPoint && (
              <span
                aria-hidden
                className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle ring-1 ring-black/10"
                style={{ backgroundColor: primary.dotColor }}
              />
            )}
            {hoverPoint
              ? `${Number.isInteger(hoverPoint.value) ? hoverPoint.value : hoverPoint.value.toFixed(1)}${primary.unit ? ` ${primary.unit}` : ''}`
              : primary.state}
            {/* Extra facts ride the same line, dot-separated — the state alone
                ("On") rarely says enough about a light or a speaker. */}
            {!hoverPoint && primary.details?.map(d => (
              <span key={d} className={clsx('ml-1.5', showFeed ? 'text-white/60' : 'text-text-tertiary')}>
                ・{d}
              </span>
            ))}
            {hoverPoint?.ts != null && (
              <span className={clsx('ml-1.5 text-[11px] font-semibold uppercase tracking-wide', showFeed ? 'text-white/60' : 'text-text-tertiary')}>
                {formatHoverTime(hoverPoint.ts)}
              </span>
            )}
          </span>
        </p>
      )}
    </div>
  );

  // Icon glyph to the LEFT of the name/state text, HA tile-card order — bare,
  // no badge circle, just a state tint. It stands down for a product render or a
  // camera feed (two images fight), but an offline alert always keeps the slot.
  const iconBadge = (isUnavailable || (!showThumb && !showFeed)) && (
    <Icon
      path={isUnavailable ? mdiAlertCircleOutline : primary.icon}
      size={22}
      className={clsx(
        'shrink-0',
        isUnavailable
          ? 'text-amber-500'
          : primary.active && primary.toggleable
            ? 'text-green-500'
            : 'text-text-secondary',
      )}
    />
  );

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onLongPress();
    }, 500);
  }, [onLongPress]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  return (
    <div
      data-entity-id={primary.entityId}
      onClickCapture={(e) => {
        if (!longPressFired.current) return;
        longPressFired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
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
        // A plain pencil button in the corner — the same round icon button the
        // dialogs use. Shown the whole time editing, not on hover: hover is the
        // one state a touch user never has. The card itself takes the click, so
        // this stays inert and never steals the drag.
        <div className="absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-surface-mid text-text-secondary pointer-events-none transition-colors group-hover/card:bg-surface-lower group-hover/card:text-text-primary">
          <Icon path={mdiPencil} size={15} />
        </div>
      )}

      {/* Primary entity — unavailable keeps the same layout, tinted amber */}
      <div
        ref={primaryRef}
        // Imageless: the icon is flush against the card edge with nothing to
        // buffer it (no render, no scrim), so it needs more room than the
        // picture layouts do.
        style={{ padding: hideCardImagesEnabled ? 'var(--dct-pad, 14px)' : 'var(--dct-pad, 10px)' }}
        className={clsx(
          'flex flex-col justify-between relative overflow-hidden transition-colors',
          hasSecondary ? 'rounded-t-ha-2xl' : 'rounded-ha-2xl',
          // Vertical rhythm: the masonry stacks cards in flex columns with a
          // 16px gap, so a card's *slot* is height + 16. Keep every slot a whole
          // multiple of the 52px secondary-row height and each card boundary
          // lands on the same 52px lattice in every column — a card with N extra
          // rows sits exactly N rows lower than its neighbour instead of drifting
          // by some arbitrary offset. 140+16 = 3×52.
          // Phone keeps the 140px step. Desktop used to take a full extra row
          // (192+16 = 4x52) back when it ran three wide; at four columns the card
          // is ~320px instead of ~434px, and the extra row read as dead space
          // above the render rather than room for it.
          // Desktop is tighter again: 116px on a 44px row lattice (116+16 = 3x44),
          // which is why the secondary rows shrink to 44 there too — the lattice
          // only holds while (base + 16) is a whole multiple of the row height.
          // Staying on 52 would have meant the next step down, 88px, and that is
          // too short: it squashes the product render, and a card you glance at
          // from across a room needs the picture.
          // Imageless (debug flag): one tile-card row — icon, name/state, control
          // — so the card is only as tall as that row plus padding. It leaves the
          // 52px lattice, which is fine because every imageless card shares the
          // same base: the *differences* between neighbours are still whole
          // secondary rows, so columns keep lining up.
          hideCardImagesEnabled
            ? 'min-h-[64px]'
            // Desktop pins the height rather than flooring it. A product render
            // is square and sized by width, and `h-full` inside an indefinite row
            // measures from its own aspect — so at four columns the *image* was
            // setting the card's height and the floor never came into it. A
            // definite height turns that around: the box is the height it says,
            // and the render fits the room that leaves.
            // `lg:min-h-0` clears both the phone floor and the automatic minimum
            // a flex item gets from its content — either one would out-vote the
            // height and hand the card back to the render.
            : 'min-h-[var(--dct-min-h,140px)] lg:min-h-0 lg:h-[var(--dct-min-h,116px)]',
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

        {/* Non-feed entity_picture (person avatar, brand art) as a faint wash.
            Skipped when a product thumbnail renders — two images fight. */}
        {hasPicture && !showFeed && !showThumb && !hideCardImagesEnabled && (
          <img src={primary.entityPicture} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}

        {/* Two stacked blocks, no overlap between them:
              row 1 — icon + name/state, across the CARD's full width
              row 2 — control on the left, product render on the right
            The render used to be an absolute layer centred on the right edge, so
            the text block had to reserve ~44% of its width to clear it. On a
            phone that leaves a two-column card with barely half a line for the
            name. Giving the render its own cell in the bottom row hands the
            whole width back to the name and the reading. */}

        {/* Top row, HA tile-card order: icon badge left, name/state beside it. */}
        <div className="relative z-[2] flex items-center gap-3">
          {iconBadge}
          {renderNameState()}
        </div>

        {/* Sparkline — sensor entities only. Out of flow (see the card-height
            rhythm note above): full-bleed along the bottom edge, painted
            BEHIND the text and the thumbnail (z-[1] < z-[2]) so the line
            disappears exactly where the device pixels begin — the graph
            "ends" at the image no matter how big the thumbnail is. */}
        {primaryHasHistory && !isUnavailable && (
          <div className="absolute inset-x-0 bottom-0 z-[1]" style={{ opacity: 'var(--dct-spark-alpha, 1)' }}>
            <EntityMiniSparkline entityId={primary.entityId} onHover={setHoverPoint} hoverTarget={primaryRef} />
          </div>
        )}

        {/* Bottom row: control left, render right. Takes the slack the top row
            leaves, so the render is as tall as the card allows and both cells
            sit on the card's bottom edge. Either cell may be empty — a
            read-only device has no control, a camera has no render. */}
        <div className="relative z-[2] mt-auto flex flex-1 min-h-0 items-end justify-between gap-ha-2">
          <div className="flex items-center">
            {!isUnavailable && primary.toggleable && primary.onToggle && (
              <ToggleSwitch on={primary.active} onToggle={primary.onToggle} />
            )}
          </div>
          {showThumb && !showFeed && (
            <img
              src={primary.thumbnail!}
              alt=""
              aria-hidden
              onError={() => setThumb((t) => ({ ...t, ok: false }))}
              className={clsx(
                // Its own cell now, so no left-edge mask: nothing is behind it
                // to keep legible. Shrinks with the row rather than overflowing
                // a short card. Narrower on desktop, where the card is shorter
                // and four to a row — the render doesn't need to reach as far
                // across, and the name gets the width back.
                'pointer-events-none select-none h-full max-h-full w-[var(--dct-thumb-w,44%)] lg:w-[var(--dct-thumb-w,34%)] shrink-0 object-contain object-right-bottom',
                isUnavailable && 'grayscale',
              )}
              style={{
                opacity: isUnavailable ? 'calc(var(--dct-thumb-alpha, 1) * 0.5)' : 'var(--dct-thumb-alpha, 1)',
              }}
            />
          )}
        </div>
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
                  // A class, not an inline style, so the desktop step can differ:
                  // 44px there to match the shorter card's lattice (see the
                  // card-height note above). The tuner's `--dct-row-h` still
                  // overrides both.
                  'flex min-h-[var(--dct-row-h,52px)] items-center gap-3 px-3 border-t border-surface-lower transition-colors lg:min-h-[var(--dct-row-h,44px)]',
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
                      // No row icons on a phone: a secondary row has to fit a
                      // name, a graph and a value (or a switch) into a
                      // half-screen card, and the icon is the part that carries
                      // the least — the name already says what the row is.
                      'hidden md:block flex-shrink-0',
                      entityUnavailable ? 'text-text-disabled' : (entity.active && entity.toggleable) ? 'text-green-500' : 'text-text-tertiary',
                    )}
                  />
                )}

                <span
                  style={entity.size === 'sm' ? undefined : { fontSize: 'var(--dct-row-size, 15px)' }}
                  className={clsx(
                    'flex-1 truncate ha-card-marquee',
                    entity.size === 'sm' ? 'text-xs text-text-secondary' : 'text-text-primary',
                  )}
                >
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
                    {hasHistory(entity) && entity.chart !== false && <EntityMiniSparkline entityId={entity.entityId} tiny />}
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
    a.cornerLabel === b.cornerLabel &&
    a.dotColor === b.dotColor &&
    (a.details ?? []).join('|') === (b.details ?? []).join('|')
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
