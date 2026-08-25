'use client';

import { mdiChevronLeft, mdiChevronRight, mdiCalendarBlankOutline, mdiCompare } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EditorToolbarShell } from './EditorToolbarShell';
import {
  ENERGY_PERIODS,
  formatPeriod,
  isCurrentPeriod,
  shiftPeriod,
  startOfPeriod,
  toDateInputValue,
  type EnergyPeriod,
} from '@/lib/energyPeriod';

/**
 * The energy dashboard's period navigator, in the shared floating toolbar —
 * neutral tone, since this is something you browse with rather than an editor
 * that takes the screen over.
 *
 * Same controls as Home Assistant's own energy dashboard: step the window with
 * the arrows, jump to any date, switch the window length, and compare against
 * the period before.
 */
export function EnergyToolbar({
  period,
  anchor,
  compare,
  onPeriodChange,
  onAnchorChange,
  onCompareChange,
}: {
  period: EnergyPeriod;
  /** Any date inside the shown window — the toolbar snaps it to the period. */
  anchor: Date;
  compare: boolean;
  onPeriodChange: (period: EnergyPeriod) => void;
  onAnchorChange: (anchor: Date) => void;
  onCompareChange: (compare: boolean) => void;
}) {
  const atNow = isCurrentPeriod(anchor, period);
  const label = formatPeriod(anchor, period);

  const step = (direction: 1 | -1) => onAnchorChange(shiftPeriod(anchor, period, direction));

  // The date jump is a native picker behind the calendar glyph — the OS control
  // is better than anything we'd build, and it costs nothing.
  const datePicker = (
    <div className="relative">
      <IconButton icon={mdiCalendarBlankOutline} label="Jump to a date" size="lg" tone="quiet" />
      <input
        type="date"
        aria-label="Jump to a date"
        value={toDateInputValue(startOfPeriod(anchor, period))}
        max={toDateInputValue(new Date())}
        onChange={(e) => {
          const picked = e.target.valueAsDate;
          // Read as local midnight; valueAsDate is UTC-based.
          if (picked) onAnchorChange(new Date(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate()));
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );

  const stepper = (
    <div className="flex items-center gap-ha-1">
      <IconButton icon={mdiChevronLeft} label={`Previous ${period}`} size="lg" tone="quiet" onClick={() => step(-1)} />
      <span className="min-w-[9.5rem] text-center text-sm font-semibold text-text-primary tabular-nums">
        {label}
      </span>
      <IconButton
        icon={mdiChevronRight}
        label={`Next ${period}`}
        size="lg"
        tone="quiet"
        disabled={atNow}
        onClick={() => step(1)}
      />
    </div>
  );

  const compareToggle = (
    <button
      type="button"
      aria-pressed={compare}
      onClick={() => onCompareChange(!compare)}
      className={`inline-flex h-10 items-center gap-ha-2 rounded-ha-xl px-ha-3 text-sm font-medium transition-colors ${
        compare ? 'bg-ha-blue/15 text-ha-blue' : 'text-text-secondary hover:bg-surface-low hover:text-text-primary'
      }`}
    >
      <Icon path={mdiCompare} size={18} exact />
      <span>Compare</span>
    </button>
  );

  const periodSwitch = (
    <SegmentedControl segments={ENERGY_PERIODS} value={period} onChange={onPeriodChange} />
  );

  return (
    <EditorToolbarShell
      tone="neutral"
      mobile={
        <div className="flex flex-col gap-ha-2">
          <div className="flex items-center justify-between gap-ha-1">
            <IconButton icon={mdiChevronLeft} label={`Previous ${period}`} size="lg" tone="quiet" onClick={() => step(-1)} />
            <span className="flex-1 text-center text-sm font-semibold text-text-primary tabular-nums">{label}</span>
            <IconButton
              icon={mdiChevronRight}
              label={`Next ${period}`}
              size="lg"
              tone="quiet"
              disabled={atNow}
              onClick={() => step(1)}
            />
            {datePicker}
          </div>
          <div className="flex items-center justify-between gap-ha-2">
            {periodSwitch}
            {/* Icon-only on a phone — the labelled version pushes the row past
                the pill at 375px. */}
            <IconButton
              icon={mdiCompare}
              label="Compare with the previous period"
              size="lg"
              tone={compare ? 'accent' : 'quiet'}
              filled={compare}
              onClick={() => onCompareChange(!compare)}
              aria-pressed={compare}
            />
          </div>
        </div>
      }
      desktop={
        <>
          {stepper}
          {datePicker}
          <div className="mx-ha-1 h-6 w-px bg-border-default" />
          {periodSwitch}
          {compareToggle}
        </>
      }
    />
  );
}
