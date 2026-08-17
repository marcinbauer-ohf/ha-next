'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { mdiArrowLeft, mdiCheck, mdiClose, mdiCogOutline } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { Dropdown, HALoader, ListSection, RollingNumericValue, SectionLabel, SelectChip, ToggleSwitch } from '../ui';
import { Sparkline } from '../ui/Sparkline';
import { useHomeAssistant } from '@/hooks';
import { mergeStatistics, type EnergyBucket } from '@/lib/energyStatistics';
import type { SelectChipOption } from '../ui/SelectChip';

// ─────────────────────────────────────────────────────────────────────────────
// The dialog kit — the pieces every summary more-info is made of, so the device
// dialog, the automation dialog and each glance dialog are literally the same
// object with different contents rather than six lookalikes drifting apart.
//
//   SheetHeader   the one header every sheet/dialog/panel wears
//   DialogFrame   fixed-height shell: close left, eyebrow + title, action right
//   DialogHero    the band: what it is, what it reads, what you can do about it
//   DialogTile    one figure with its label — the row of numbers under the hero
//   DetailRows    the entities behind the figure, with their live state
//   SetupStep     "which of your things feed this", one SelectChip per slot
//   StatsChart    the past, from long-term statistics, in the standard slot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every header glyph in the app: a bare round button on the header's own
 * surface. Exported so a caller's extra action can't drift from the close X
 * sitting a few pixels away.
 */
export const sheetHeaderButton =
  'shrink-0 rounded-full p-2.5 text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary';

/** The horizontal inset every sheet uses — header and body on the same edge. */
export const SHEET_PAD = 'px-ha-4';

/**
 * The one header. Close (or back) on the left, eyebrow over a large name in the
 * middle, actions on the right — the same object whether it's a device, an
 * automation, a store, Home Center or an "add" sheet. Only the words differ.
 *
 * Eyebrow is a plain string on purpose: it's the scope of the thing below it
 * (its room, its kind, where it came from), and a string is what truncates
 * cleanly when the room name is long.
 */
export function SheetHeader({
  eyebrow,
  title,
  onClose,
  onBack,
  onTitleClick,
  titleHint,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  onClose: () => void;
  /** Drilled a level in: the leading button becomes a back arrow. */
  onBack?: () => void;
  /** Makes the title a button — used where it reveals what else is in here. */
  onTitleClick?: () => void;
  titleHint?: string;
  /** The right side. Wrap each in `sheetHeaderButton`. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex shrink-0 items-start justify-between gap-ha-2 pb-ha-2 pt-ha-2 lg:pt-ha-4', SHEET_PAD, className)}>
      <button
        type="button"
        onClick={onBack ?? onClose}
        aria-label={onBack ? 'Back' : 'Close'}
        title={onBack ? 'Back' : 'Close'}
        className={sheetHeaderButton}
      >
        <Icon path={onBack ? mdiArrowLeft : mdiClose} size={24} />
      </button>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-0.5 truncate text-sm leading-none text-text-tertiary">{eyebrow}</p>}
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            title={titleHint}
            className="block max-w-full truncate text-left text-2xl font-bold leading-tight text-text-primary"
          >
            {title}
          </button>
        ) : (
          <p className="truncate text-2xl font-bold leading-tight text-text-primary">{title}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-ha-1">{actions}</div>}
    </div>
  );
}

/** The dialog shell — one height for every dialog, a scrolling middle. */
export function DialogFrame({
  eyebrow,
  title,
  onClose,
  onBack,
  onConfigure,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  /**
   * Drilled into something inside the dialog (a store item, say): the leftmost
   * button becomes a back arrow to the level above instead of the close X.
   */
  onBack?: () => void;
  /** Shows the cog; opens whatever setup step the dialog owns. */
  onConfigure?: () => void;
  /** Anything else for the header's right side (a link out, say). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[min(70dvh,760px)] flex-col overflow-hidden lg:h-[min(85vh,780px)]">
      <SheetHeader
        eyebrow={eyebrow}
        title={title}
        onClose={onClose}
        onBack={onBack}
        actions={(action || onConfigure) && (
          <>
            {action}
            {onConfigure && (
              <button
                type="button"
                onClick={onConfigure}
                aria-label="Change what this reads"
                title="Change what this reads"
                className={sheetHeaderButton}
              >
                <Icon path={mdiCogOutline} size={24} />
              </button>
            )}
          </>
        )}
      />

      <div className={clsx('min-h-0 flex-1 overflow-y-auto scrollbar-hide py-ha-2', SHEET_PAD)}>
        <div className="flex w-full flex-col gap-ha-2">{children}</div>
      </div>
    </div>
  );
}

/** The card everything sits on — hero, numbers and the past, hairline-divided. */
export function DialogCard({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full flex-col gap-ha-2 rounded-ha-2xl bg-surface-low p-ha-2">{children}</div>;
}

/** The band: glyph, the reading in the middle, the control (if any) on the right. */
export function DialogHero({
  icon,
  iconClass = 'text-text-tertiary',
  value,
  unit,
  meta,
  right,
  highlight,
  stamp,
}: {
  icon: string;
  iconClass?: string;
  value: string;
  unit?: string;
  meta?: string;
  right?: React.ReactNode;
  /** Tint the band — the group is in a state worth noticing. */
  highlight?: string;
  /**
   * The moment being scrubbed on the chart below, in the accent so "this is not
   * now" reads at a glance. Out of flow and fading in, so arriving on the chart
   * can't nudge the reading off centre.
   */
  stamp?: string | null;
}) {
  return (
    <div className={clsx(
      'relative flex w-full items-center gap-ha-3 rounded-ha-2xl px-ha-3 py-ha-2 transition-colors',
      highlight ?? 'bg-surface-default',
    )}>
      <Icon path={icon} size={28} className={clsx('shrink-0', iconClass)} />
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <span className="relative flex min-w-0 items-baseline">
          <RollingNumericValue value={value} className="font-mono text-2xl font-bold capitalize text-text-primary" />
          {unit && <span className="ml-1 font-mono text-sm text-text-secondary">{unit}</span>}
          {stamp && (
            <span className="ha-scrub-stamp-in absolute inset-x-0 top-full whitespace-nowrap pt-0.5 text-center text-[11px] font-semibold leading-none text-ha-blue">
              {stamp}
            </span>
          )}
        </span>
        {meta && <span className="max-w-full truncate text-xs text-text-tertiary">{meta}</span>}
      </div>
      {right}
    </div>
  );
}

export interface DialogTileSpec {
  label: string;
  value: string;
  unit?: string;
  icon: string;
}

export function DialogTile({ label, value, unit, icon }: DialogTileSpec) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-ha-xl bg-surface-default px-ha-3 py-ha-2">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        <Icon path={icon} size={13} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex items-baseline gap-1">
        <span className="truncate font-mono text-xl font-bold text-text-primary">{value}</span>
        {unit && <span className="shrink-0 font-mono text-xs text-text-secondary">{unit}</span>}
      </span>
    </div>
  );
}

export function DialogTiles({ tiles }: { tiles: DialogTileSpec[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid w-full grid-cols-2 gap-ha-1 lg:grid-cols-4">
      {tiles.map((tile) => <DialogTile key={tile.label} {...tile} />)}
    </div>
  );
}

export interface DetailRow {
  id: string;
  icon?: string;
  label: string;
  state: string;
  /** Drives the switch and the icon tint. */
  active?: boolean;
  /** A person's photo, where a glyph would be a worse likeness. */
  picture?: string;
  initials?: string;
  onToggle?: () => void;
}

/** The entities behind the figure. Rides the dialog's own scroll — no nested scrollport. */
export function DetailRows({ title, rows, empty }: { title: string; rows: DetailRow[]; empty?: string }) {
  return (
    <div className="w-full">
      <SectionLabel inset>{title}</SectionLabel>
      <div className="mt-ha-2">
        <ListSection>
          {rows.length === 0 ? (
            <p className="px-ha-4 py-ha-3 text-sm text-text-tertiary">{empty ?? 'Nothing here.'}</p>
          ) : rows.map((row) => (
            <div key={row.id} className="flex items-center gap-ha-3 px-ha-4 py-ha-2">
              {row.picture !== undefined || row.initials !== undefined ? (
                <Avatar src={row.picture} initials={row.initials ?? '?'} size="xs" className="shrink-0" />
              ) : (
                <Icon path={row.icon ?? ''} size={18} className={clsx('shrink-0', row.active ? 'text-ha-blue' : 'text-text-tertiary')} />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{row.label}</span>
              <span className="shrink-0 font-mono text-sm capitalize text-text-secondary">{row.state}</span>
              {row.onToggle && <ToggleSwitch on={!!row.active} onToggle={row.onToggle} size="sm" />}
            </div>
          ))}
        </ListSection>
      </div>
    </div>
  );
}

// ── Setup step ───────────────────────────────────────────────────────────────

export interface SetupSlot {
  key: string;
  title: string;
  hint: string;
  icon: string;
  options: SelectChipOption[];
  selected: string[];
  /** Copy for an empty option list — what the home would need to report. */
  emptyHint?: string;
}

/** One slot: what it's for, and the things feeding it. */
function Slot({ slot, onToggle }: { slot: SetupSlot; onToggle: (id: string) => void }) {
  const summary = slot.selected.length === 0
    ? 'Not set'
    : slot.selected.length === 1
      ? slot.options.find((o) => o.id === slot.selected[0])?.label ?? slot.selected[0]
      : `${slot.selected.length} picked`;

  return (
    <div className="flex w-full flex-col gap-ha-2 rounded-ha-2xl bg-surface-default p-ha-3">
      <div className="flex items-start gap-ha-3">
        <Icon path={slot.icon} size={20} className="mt-0.5 shrink-0 text-text-tertiary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{slot.title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{slot.hint}</p>
        </div>
      </div>
      {slot.options.length > 0 ? (
        <SelectChip
          icon={slot.icon}
          prefix="Pick"
          valueLabel={summary}
          options={slot.options}
          selectedId={slot.selected}
          onSelect={onToggle}
        />
      ) : (
        <p className="rounded-ha-xl bg-surface-low px-ha-3 py-2 text-xs text-text-secondary">
          {slot.emptyHint ?? 'Nothing in your home reports this yet.'}
        </p>
      )}
    </div>
  );
}

/**
 * The setup step, in the same frame as the dialog it belongs to. Slots are
 * multi-select throughout: one sensor is just a list of one, so nothing needs a
 * second kind of picker.
 */
export function SetupStep({
  eyebrow,
  title = 'Set it up',
  intro,
  slots,
  onToggle,
  onSave,
  onClose,
  canSave = true,
  saveLabel = 'Save',
  blockedLabel,
  children,
}: {
  eyebrow: string;
  title?: string;
  intro: string;
  slots: SetupSlot[];
  onToggle: (slotKey: string, id: string) => void;
  onSave: () => void;
  onClose: () => void;
  canSave?: boolean;
  saveLabel?: string;
  /** What the button says while `canSave` is false — why it can't be pressed. */
  blockedLabel?: string;
  /** Extra controls under the slots (a price field, a switch…). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-[min(70dvh,760px)] flex-col overflow-hidden lg:h-[min(85vh,780px)]">
      <SheetHeader eyebrow={eyebrow} title={title} onClose={onClose} />

      <div className={clsx('min-h-0 flex-1 overflow-y-auto scrollbar-hide py-ha-2', SHEET_PAD)}>
        <div className="flex w-full flex-col gap-ha-2">
          <p className="px-ha-1 text-sm text-text-secondary">{intro}</p>
          {slots.map((slot) => (
            <Slot key={slot.key} slot={slot} onToggle={(id) => onToggle(slot.key, id)} />
          ))}
          {children}
        </div>
      </div>

      <div className="shrink-0 px-ha-4 pb-ha-4 pt-ha-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className={clsx(
            'flex h-12 w-full items-center justify-center gap-ha-2 rounded-ha-xl text-sm font-semibold transition-colors',
            canSave
              ? 'bg-ha-blue text-white hover:brightness-110 active:scale-[0.99]'
              : 'cursor-not-allowed bg-surface-low text-text-tertiary',
          )}
        >
          <Icon path={mdiCheck} size={18} />
          {canSave ? saveLabel : blockedLabel ?? saveLabel}
        </button>
      </div>
    </div>
  );
}

// ── The past ─────────────────────────────────────────────────────────────────

const STATS_SPANS = [
  { value: '24', label: '24h' },
  { value: '168', label: '7d' },
  { value: '720', label: '30d' },
];

/**
 * A group's past, averaged: long-term statistics for each entity, meaned across
 * them (not summed — a home's temperature is the average of its rooms, and the
 * hour/day buckets already line up across entities). Same fixed slot as every
 * other dialog's history, so nothing moves when the span changes.
 */
export function StatsChart({ ids, unit, label }: { ids: string[]; unit?: string; label: string }) {
  const { getStatistics } = useHomeAssistant();
  const [hours, setHours] = useState('24');
  const [series, setSeries] = useState<EnergyBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  const idKey = ids.join(',');
  useEffect(() => {
    const list = idKey ? idKey.split(',') : [];
    let cancelled = false;
    setLoading(true);
    setHovered(null);
    const span = Number(hours);
    Promise.all(list.map((id) => getStatistics(id, span, span > 200 ? 'day' : 'hour'))).then((perEntity) => {
      if (cancelled) return;
      const present = perEntity.filter((buckets) => buckets.length > 0);
      const summed = mergeStatistics(present, present.map(() => 1), 'mean');
      // Mean across the entities that actually reported, so a sensor that only
      // started recording yesterday doesn't drag the whole curve down.
      setSeries(present.length > 1
        ? summed.map((b, i) => ({ ts: b.ts, value: b.value / countAt(present, summed[i].ts) }))
        : summed);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [idKey, hours, getStatistics]);

  const points = series.map((b) => b.value);
  const xFractions = series.length > 1
    ? series.map((b) => (b.ts - series[0].ts) / (series[series.length - 1].ts - series[0].ts || 1))
    : [];
  const hoveredBucket = hovered !== null ? series[hovered] ?? null : null;
  const stamp = hoveredBucket
    ? `${hoveredBucket.value.toFixed(1)}${unit ?? ''} · ${new Date(hoveredBucket.ts).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })}`
    : label;

  return (
    <div className="flex w-full flex-col gap-ha-1 border-t border-surface-mid pt-ha-2">
      <div className="flex w-full items-center gap-ha-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{stamp}</span>
        <Dropdown className="ml-auto shrink-0" options={STATS_SPANS} value={hours} onChange={setHours} />
      </div>
      <div className="flex h-[132px] w-full flex-col overflow-hidden lg:h-[168px]">
        {loading ? (
          <div className="flex h-full items-center justify-center"><HALoader size="sm" /></div>
        ) : points.length < 3 ? (
          <div className="flex h-full items-center justify-center px-ha-4 text-center text-sm text-text-tertiary">
            Home Assistant hasn’t recorded enough of this yet.
          </div>
        ) : (
          <div className="min-h-0 w-full flex-1 opacity-90">
            <Sparkline points={points} on gradientId={`stats-${label.replace(/\W/g, '')}`} xFractions={xFractions} onHover={setHovered} fillHeight />
          </div>
        )}
      </div>
    </div>
  );
}

/** How many of the entity series covered this bucket — the divisor for the mean. */
function countAt(perEntity: { start: number }[][], ts: number): number {
  let n = 0;
  for (const buckets of perEntity) if (buckets.some((b) => b.start === ts)) n++;
  return n || 1;
}
