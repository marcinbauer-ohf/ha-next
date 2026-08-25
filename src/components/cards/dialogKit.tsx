'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { mdiArrowLeft, mdiCheck, mdiClose, mdiCogOutline, mdiRestart } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { Button, Dropdown, HALoader, IconButton, iconButtonClass, ListSection, RollingNumericValue, SectionLabel, SelectChip, ToggleSwitch } from '../ui';
import { Sparkline } from '../ui/Sparkline';
import { useHomeAssistant } from '@/hooks';
import { useScrollFades } from '@/hooks/useScrollFades';
import { useContainedSheet } from '../layout/containedSheet';
import { mergeStatistics, type EnergyBucket } from '@/lib/energyStatistics';
import type { SelectChipOption } from '../ui/SelectChip';

// ─────────────────────────────────────────────────────────────────────────────
// The dialog kit — the pieces every summary more-info is made of, so the device
// dialog, the automation dialog and each glance dialog are literally the same
// object with different contents rather than six lookalikes drifting apart.
//
//   SheetHeader   the one header every sheet/dialog/panel wears
//   DialogFrame   fixed-height shell: close left, optional title, action right,
//                 and on lg a second column for the charts
//   DialogHero    the band: what it is, what it reads, what you can do about it
//   DialogTile    one figure with its label — the row of numbers under the hero
//   DetailRows    the entities behind the figure, with their live state
//   IntroStep     the empty state a summary opens on before it has anything:
//                 one big glyph, what it's for, and the way in
//   SetupStep     "which of your things feed this", one SelectChip per slot
//   DialogConfigureButton  the way into that setup, spelled out, at the bottom
//   StatsChart    the past, from long-term statistics, in the standard slot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every header glyph in the app: a bare round button on the header's own
 * surface. Exported so a caller's extra action can't drift from the close X
 * sitting a few pixels away.
 */
export const sheetHeaderButton = iconButtonClass({ size: 'lg' });

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
  /** Makes the title a button — used where it reveals what else is in here. The
   *  event comes through so a caller can anchor a menu to the title. */
  onTitleClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  titleHint?: string;
  /** The right side. Use <IconButton size="lg"> (or `sheetHeaderButton` for a link). */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex shrink-0 items-start justify-between gap-ha-2 pb-ha-2 pt-ha-2 lg:pt-ha-4', SHEET_PAD, className)}>
      <IconButton
        icon={onBack ? mdiArrowLeft : mdiClose}
        label={onBack ? 'Back' : 'Close'}
        size="lg"
        onClick={onBack ?? onClose}
      />
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-0.5 truncate text-sm leading-none text-text-tertiary">{eyebrow}</p>}
        {/* An empty title is a deliberate one: the store puts its name in the big
            search field below instead of saying it twice. */}
        {!title ? null : onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            title={titleHint}
            className="block max-w-full truncate text-left text-xl font-bold leading-tight text-text-primary lg:text-2xl"
          >
            {title}
          </button>
        ) : (
          <p className="truncate text-xl font-bold leading-tight text-text-primary lg:text-2xl">{title}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-ha-1">{actions}</div>}
    </div>
  );
}

/** The dialog shell — one height for every dialog, a scrolling middle. */
export function DialogFrame({
  eyebrow,
  title = '',
  onClose,
  onBack,
  action,
  size = 'default',
  headerless = false,
  stickyTop,
  aside,
  children,
}: {
  /**
   * Both optional, and the summary dialogs pass neither: a chip you just tapped
   * doesn't need the dialog to repeat its own name back at you. The header stays
   * as the control strip — close on the left, the cog on the right.
   */
  eyebrow?: string;
  title?: string;
  onClose: () => void;
  /**
   * Drilled into something inside the dialog (a store item, say): the leftmost
   * button becomes a back arrow to the level above instead of the close X.
   */
  onBack?: () => void;
  /** Anything else for the header's right side (a link out, say). */
  action?: React.ReactNode;
  /**
   * 'large' takes the whole height the sheet allows, for a dialog you browse
   * rather than read — the stores. Phones are already near-full either way.
   */
  size?: 'default' | 'large';
  /**
   * No header at all — for content that is its own heading (a store's big search
   * field). Closing is still covered: Escape, the scrim, and on phones the
   * grabber or an overscroll pull, all of which live in ModalSheet.
   */
  headerless?: boolean;
  /**
   * Controls that stay put while the body scrolls under them — a store's search
   * field and its filters. Rendered outside the scroll container rather than
   * `position: sticky` inside it, so nothing shows through above them.
   */
  stickyTop?: React.ReactNode;
  /**
   * The charts. On lg they get a column of their own beside the cards, because a
   * chart read at the full width of a panel-wide sheet is a smear; below lg they
   * fall in under the body. Omit it and the body keeps the single column.
   */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  // The house scroll treatment: content fades out at whichever edge it runs past.
  const { attach, showTop, showBottom } = useScrollFades<HTMLDivElement>();
  // One height for every dialog — except in the contained sheet, which already
  // caps itself against the panel. Holding the fixed height there just parks a
  // slab of empty surface under a two-column body.
  const inSheet = useContainedSheet();
  return (
    <div
      className={clsx(
        'flex flex-col overflow-hidden',
        inSheet
          ? 'h-auto max-h-full'
          : clsx('h-[min(70dvh,760px)]', size === 'large' ? 'lg:h-[min(90vh,1000px)]' : 'lg:h-[min(85vh,780px)]'),
      )}
    >
      {/* A header only when it has something to say. Give it no words, no way
          back and no actions — every summary dialog — and there is no bar at all:
          Escape, the scrim and a pull on the grabber all still close it, and the
          reading is the first thing you see instead of its own name. */}
      {!headerless && (eyebrow || title || onBack || action) && (
        <SheetHeader
          eyebrow={eyebrow}
          title={title}
          onClose={onClose}
          onBack={onBack}
          actions={action}
        />
      )}

      {stickyTop && (
        <div
          className={clsx(
            'flex shrink-0 flex-col gap-ha-3 pb-ha-3',
            // Standing in for the header, so it wears the header's own top inset:
            // whatever leads the band lands where the header's content would.
            headerless && 'pt-ha-2 lg:pt-ha-4',
            SHEET_PAD,
          )}
        >
          {stickyTop}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          className={clsx(
            'pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent transition-opacity duration-300',
            showTop ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={clsx(
            'pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent transition-opacity duration-300',
            showBottom ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          ref={attach}
          className={clsx(
            'h-full overflow-y-auto scrollbar-hide py-ha-2',
            // With no header and no sticky band, the body carries the top inset.
            headerless && !stickyTop && 'pt-ha-3 lg:pt-ha-5',
            SHEET_PAD,
          )}
        >
          <div
            className={clsx(
              'flex w-full flex-col gap-ha-4',
              // items-start so the chart column keeps its own height instead of
              // stretching to match a long list beside it.
              aside && 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-ha-4',
            )}
          >
            {aside ? <div className="flex min-w-0 flex-col gap-ha-4">{children}</div> : children}
            {aside && (
              // Sticky: the list on the left is the long one, and the chart is
              // what you're comparing it against — it shouldn't scroll away.
              <div className="flex min-w-0 flex-col gap-ha-4 lg:sticky lg:top-0">{aside}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A group, held together by being close rather than by a surface of its own: the
 * hero and the numbers that follow from it. It used to be a card, which put a
 * third ground (sheet → card → hero) behind a reading that only ever needed
 * two — so it's tight spacing now, and the body gap does the separating.
 */
export function DialogCard({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full flex-col gap-ha-1">{children}</div>;
}

// ── Tone ─────────────────────────────────────────────────────────────────────

/**
 * The one colour language every summary dialog speaks. Colour here says *how
 * this reading is doing*, never *what it is about* — the glyph already says
 * what it is about, and a hue per subject is what left nine dialogs wearing
 * seven unrelated colours (yellow lights, violet mode, amber energy…) with the
 * same tint meaning "fine" in one and "look at me" in the next.
 *
 *   neutral  nothing wants you — the resting state of most dialogs
 *   active   something is on, running, drawing or present
 *   good     the question you opened this to ask answers yes
 *   warn     something wants you
 *
 * Ink only, from the themed ramp: `fill-*` and `yellow-95` are *paper* tokens
 * that some themes flatten to plain white (see the INK vs PAPER note in
 * globals.css), so a tone painted as a fill would come out identical across all
 * four in the default light theme.
 */
export type DialogTone = 'neutral' | 'active' | 'good' | 'warn';

const TONE_INK: Record<DialogTone, string> = {
  neutral: 'text-text-tertiary',
  active: 'text-ha-blue',
  good: 'text-green-500',
  warn: 'text-yellow-500',
};

/** The rail down the hero's leading edge. Only the two tones worth a glance. */
const TONE_RAIL: Partial<Record<DialogTone, string>> = {
  good: 'bg-green-500',
  warn: 'bg-yellow-500',
};

/**
 * The reading, at the top of every summary dialog.
 *
 * Left-aligned and display-scale, because it is the headline of the sheet: it
 * used to be a centred 26px figure floating in a full-width tinted band, which
 * at panel width put the one thing you opened the dialog for in the middle of
 * two empty gutters — and the band's `/15` wash came out as sludge on dark and
 * as nothing at all on the themes that flatten fills. Status is the glyph's ink
 * plus a rail on the leading edge instead.
 *
 * `subject` is the dialog's own name. The summary dialogs are headerless (a chip
 * you just tapped shouldn't have its name read back at you in a title bar) —
 * which left the Climate dialog never saying the word "climate" anywhere. The
 * eyebrow puts it back where it costs nothing.
 */
export function DialogHero({
  icon,
  tone = 'neutral',
  subject,
  value,
  numeric = false,
  unit,
  meta,
  action,
  right,
  onConfigure,
  stamp,
}: {
  icon: string;
  /** How this reading is doing. See DialogTone — never used for identity. */
  tone?: DialogTone;
  /** The dialog's own name, as an eyebrow over the reading. */
  subject?: string;
  value: string;
  /**
   * True for a *measurement* (°, %, W, kWh) — those get the mono face, same as
   * a device card's state line, so readings look like readings. Counts and
   * words ("3 on", "Secure", "Away") are not measurements: mono makes them read
   * as terminal output rather than as the sentence they are.
   */
  numeric?: boolean;
  unit?: string;
  meta?: string;
  /**
   * The one thing this dialog lets you do about the reading — "turn them all
   * off", "lock everything". It rides the hero's right edge on a wide sheet,
   * where it fills the space beside the headline and stays button-sized; below
   * lg there is no room beside anything, so the panel renders its own
   * full-width copy underneath instead (`lg:hidden`).
   */
  action?: React.ReactNode;
  right?: React.ReactNode;
  /**
   * Shows the cog on the band's right edge and opens the dialog's setup step.
   * It lives here rather than in a header because what it changes is this
   * reading — which sensors it's made of — and the dialogs have no header.
   */
  onConfigure?: () => void;
  /**
   * The moment being scrubbed on the chart below, in the accent so "this is not
   * now" reads at a glance. It takes the meta line's place rather than stacking
   * under it — both are one line of context about the figure above, and swapping
   * them keeps the reading from shifting as the finger arrives on the chart.
   */
  stamp?: string | null;
}) {
  const rail = TONE_RAIL[tone];
  return (
    <div className="relative flex w-full items-start gap-ha-3 overflow-hidden rounded-ha-2xl bg-surface-default px-ha-4 py-ha-4">
      {rail && <span aria-hidden className={clsx('absolute inset-y-ha-3 left-0 w-1 rounded-r-full transition-colors', rail)} />}
      <Icon path={icon} size={26} className={clsx('mt-1 shrink-0 transition-colors', TONE_INK[tone])} />

      <div className="flex min-w-0 flex-1 flex-col">
        {subject && (
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{subject}</span>
        )}
        <span className="flex min-w-0 items-baseline gap-1.5">
          <RollingNumericValue
            value={value}
            className={clsx(
              'text-3xl font-bold leading-tight capitalize text-text-primary lg:text-4xl',
              numeric && 'font-mono',
            )}
          />
          {unit && <span className="shrink-0 text-base font-medium text-text-secondary">{unit}</span>}
        </span>
        {(stamp || meta) && (
          <span className={clsx(
            'mt-1 truncate text-sm',
            stamp ? 'font-semibold text-ha-blue' : 'text-text-secondary',
          )}>
            {stamp || meta}
          </span>
        )}
      </div>

      {action && <div className="hidden shrink-0 self-center lg:block">{action}</div>}
      {right}
      {onConfigure && (
        <IconButton
          icon={mdiCogOutline}
          label="Change what this reads"
          size="sm"
          onClick={onConfigure}
          className="shrink-0"
        />
      )}
    </div>
  );
}
/**
 * The way into a dialog's setup step, spelled out. The hero's cog is there for
 * anyone who already knows it, but nothing about a glyph says what it changes —
 * so every configurable dialog also ends on this, the same full-width action
 * the Home Center's desktop pop-up ends on. Last child of the body.
 */
export function DialogConfigureButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button variant="neutral" icon={mdiCogOutline} block onClick={onClick}>{label}</Button>;
}

export interface DialogTileSpec {
  label: string;
  value: string;
  unit?: string;
  /** Numbers only — see DialogHero's `numeric`. */
  numeric?: boolean;
  /** The one figure in the strip that is the reason you're looking. */
  tone?: DialogTone;
}

/**
 * The figures behind the reading. One strip, not a row of separate boxes: four
 * free-floating cards under a card read as four things of equal weight, when
 * they are one thing — the breakdown of the number above them. The hairline
 * grid is a gap over a darker ground, so it survives every theme's fills.
 *
 * Nothing in here should restate the hero. If the strip's first figure is the
 * same number as the headline, the strip is one figure shorter than it thinks.
 */
export function DialogTile({ label, value, unit, numeric = true, tone }: DialogTileSpec) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface-default px-ha-3 py-ha-3">
      <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={clsx(
          'truncate text-xl font-bold',
          numeric && 'font-mono tabular-nums',
          tone ? TONE_INK[tone] : 'text-text-primary',
        )}>{value}</span>
        {unit && <span className="shrink-0 text-xs font-medium text-text-secondary">{unit}</span>}
      </span>
    </div>
  );
}

export function DialogTiles({ tiles }: { tiles: DialogTileSpec[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className={clsx(
      // gap-px over surface-mid draws the dividers; the cells paint the rest.
      'grid w-full gap-px overflow-hidden rounded-ha-2xl bg-surface-mid',
      tiles.length === 1 ? 'grid-cols-1' : tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
      tiles.length >= 4 && 'lg:grid-cols-4',
    )}>
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

/**
 * A row's state is mono only when it is a *reading* — "100%", "22.3°", "3 days".
 * "Off", "Home", "Docked" are words, and words set in mono read as log output.
 */
const READING = /^[-+]?[0-9]/;

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
              <span className={clsx(
                'shrink-0 text-sm capitalize text-text-secondary',
                READING.test(row.state) && 'font-mono tabular-nums',
              )}>{row.state}</span>
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
        <p className="px-ha-1 text-xs text-text-secondary">
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
/**
 * What a summary looks like before it is anything: no readings, no rows, no
 * numbers to explain — one big glyph, what this summary would tell you, and the
 * button that starts picking. It's the first screen on an instance with nothing
 * set up yet, and the screen "Start over" in the setup step comes back to.
 */
export function IntroStep({
  icon,
  tone = 'active',
  eyebrow,
  headline,
  blurb,
  cta = 'Set it up',
  onStart,
}: {
  icon: string;
  tone?: DialogTone;
  eyebrow: string;
  /** The value proposition, in one line — what you get out of setting this up. */
  headline: string;
  /** How it gets there, in a sentence or two. */
  blurb: string;
  cta?: string;
  onStart: () => void;
}) {
  // In a sheet it shrinks to its own (short) content rather than parking a
  // dialog-sized slab of empty surface under three lines of text.
  const inSheet = useContainedSheet();
  return (
    <div className={clsx('flex flex-col overflow-hidden', inSheet ? 'h-auto max-h-full' : 'h-[min(70dvh,760px)] lg:h-[min(85vh,780px)]')}>
      <div className={clsx('flex min-h-0 flex-1 flex-col items-center justify-center gap-ha-4 py-ha-6 text-center', SHEET_PAD)}>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-surface-low">
          <Icon path={icon} size={44} className={TONE_INK[tone]} />
        </div>
        <div className="flex flex-col items-center gap-ha-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{eyebrow}</span>
          {/* No full stop — it's a display heading (see the house rule). */}
          <h2 className="text-2xl font-bold leading-tight text-text-primary">{headline}</h2>
          <p className="max-w-sm text-sm text-text-secondary">{blurb}</p>
        </div>
      </div>

      <div className={clsx('shrink-0 pb-ha-4 pt-ha-2', SHEET_PAD)}>
        <Button variant="primary" size="lg" icon={mdiCogOutline} block onClick={onStart}>{cta}</Button>
      </div>
    </div>
  );
}

export function SetupStep({
  eyebrow,
  title = 'Set it up',
  intro,
  slots,
  onToggle,
  onSave,
  onBack,
  onRestart,
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
  /** Back to the dialog this belongs to, dropping the draft. */
  onBack: () => void;
  /** Back to the intro screen — "what is this for again?", from the middle of picking. */
  onRestart?: () => void;
  canSave?: boolean;
  saveLabel?: string;
  /** What the button says while `canSave` is false — why it can't be pressed. */
  blockedLabel?: string;
  /** Extra controls under the slots (a price field, a switch…). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-[min(70dvh,760px)] flex-col overflow-hidden lg:h-[min(85vh,780px)]">
      {/* The one screen that keeps its words: it has to say what you're picking
          sensors for, and the arrow goes back to the reading, not out. */}
      <SheetHeader eyebrow={eyebrow} title={title} onClose={onBack} onBack={onBack} />

      <div className={clsx('min-h-0 flex-1 overflow-y-auto scrollbar-hide py-ha-2', SHEET_PAD)}>
        <div className="flex w-full flex-col gap-ha-2">
          <p className="px-ha-1 text-sm text-text-secondary">{intro}</p>
          {slots.map((slot) => (
            <Slot key={slot.key} slot={slot} onToggle={(id) => onToggle(slot.key, id)} />
          ))}
          {children}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-ha-1 px-ha-4 pb-ha-4 pt-ha-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className={clsx(
            'flex h-12 w-full items-center justify-center gap-ha-2 rounded-ha-xl text-sm font-semibold transition-colors',
            canSave
              ? 'bg-ha-blue text-white hover:brightness-110 active:scale-[0.98]'
              : 'cursor-not-allowed bg-surface-low text-text-tertiary',
          )}
        >
          <Icon path={mdiCheck} size={18} />
          {canSave ? saveLabel : blockedLabel ?? saveLabel}
        </button>
        {onRestart && (
          <Button variant="ghost" icon={mdiRestart} block onClick={onRestart}>Start over</Button>
        )}
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
    // On a card of its own: the chart used to sit bare on the sheet's ground
    // with a 11px label floating above it, which at panel width read as a stray
    // caption over an empty rectangle rather than as the dialog's second half.
    <div className="flex w-full flex-col gap-ha-2 rounded-ha-2xl bg-surface-default px-ha-3 py-ha-3">
      <div className="flex w-full items-center gap-ha-2">
        <span className={clsx(
          'truncate text-sm',
          hoveredBucket ? 'font-semibold text-ha-blue' : 'font-medium text-text-secondary',
        )}>{stamp}</span>
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
