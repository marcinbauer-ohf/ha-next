'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { Chip } from './Chip';
import { mdiChevronDown, mdiCheck } from '@mdi/js';

export interface SelectChipOption {
  id: string;
  label: string;
}

/**
 * A chip that opens a radio-style popover of options below it. Extracted from
 * DataListView so any filter row (tables, dashboards, …) can reuse the exact
 * same control — icon + "Prefix: Value" + chevron, options in a card popover.
 *
 * Pass an array to `selectedId` for multi-select: `onSelect` then means "toggle
 * this id" and the popover stays open so several can be picked in one go.
 */
export function SelectChip({
  icon,
  prefix,
  valueLabel,
  options,
  selectedId,
  onSelect,
  align = 'left',
}: {
  icon: string;
  prefix: string;
  valueLabel: string;
  options: SelectChipOption[];
  selectedId: string | string[];
  onSelect: (id: string) => void;
  /** Which edge the popover hangs from. Default left. */
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const multi = Array.isArray(selectedId);
  const selectedIds = Array.isArray(selectedId) ? selectedId : [selectedId];

  return (
    <div className="relative">
      <Chip active={open} onClick={() => setOpen((v) => !v)}>
        <Icon path={icon} size={14} />
        <span>{prefix}: {valueLabel}</span>
        <Icon path={mdiChevronDown} size={13} className="opacity-70" />
      </Chip>
      {open && (
        <>
          {/* Backdrop to capture outside clicks. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          {/* Scrolls once the list is long — a home's sensor lists run to
              dozens of entries and ran off the bottom of the screen.
              ponytail: no search field; add one if a list gets long enough that
              scrolling an alphabetical list stops being enough. */}
          <div
            className={`absolute top-full z-50 mt-ha-1 max-h-[min(50vh,320px)] min-w-[180px] overflow-y-auto rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-1 shadow-[0_18px_42px_-20px_rgba(15,23,42,0.4)] ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {options.map((opt) => {
              const selected = selectedIds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onSelect(opt.id); if (!multi) setOpen(false); }}
                  className={`flex w-full items-center gap-ha-2 rounded-ha-xl px-ha-3 py-ha-2 text-left text-sm transition-colors ${
                    selected ? 'font-semibold text-text-primary' : 'text-text-primary hover:bg-surface-low'
                  }`}
                >
                  <span className="flex-1">{opt.label}</span>
                  {selected && <Icon path={mdiCheck} size={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
