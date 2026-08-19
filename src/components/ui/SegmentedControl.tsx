'use client';

import React from 'react';
import { clsx } from 'clsx';

interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /**
   * Icons only, with each segment's label kept as its accessible name — for a
   * switch whose options are self-evident as pictures (list / grid / table).
   */
  iconOnly?: boolean;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
  iconOnly = false,
}: SegmentedControlProps<T>) {
  return (
    // h-8 is the shared control height: this and a filter chip sit on the same
    // row in the stores and have to line up.
    //
    // Card surface + hairline, not surface-mid: mid is a hair off surface-lower in
    // light and *darker* than it in dark, so the control dissolved into whatever
    // page or dialog it sat on. A white card with an edge reads on both.
    <div className={clsx(
      'inline-flex h-8 items-center rounded-ha-xl border border-surface-lower bg-surface-default p-[3px] gap-[2px]',
      className,
    )}>
      {segments.map(seg => (
        <button
          key={seg.value}
          type="button"
          onClick={() => onChange(seg.value)}
          aria-label={iconOnly ? seg.label : undefined}
          title={iconOnly ? seg.label : undefined}
          aria-pressed={seg.value === value}
          className={clsx(
            'flex-1 flex h-full items-center justify-center gap-1 rounded-ha-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
            iconOnly ? 'w-8 px-0' : 'px-ha-3',
            // Picked reads as picked — literally the filter chips' selected tint,
            // so one visual language covers chips and switches. (`fill-primary-*`
            // resolves to plain white on some themes, which reads as nothing on a
            // white card.)
            seg.value === value
              ? 'bg-ha-blue/15 text-ha-blue'
              : 'text-text-secondary hover:bg-surface-low hover:text-text-primary',
          )}
        >
          {seg.icon}
          {!iconOnly && seg.label}
        </button>
      ))}
    </div>
  );
}
