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
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={clsx(
      'inline-flex items-center bg-surface-mid rounded-ha-xl p-[3px] gap-[2px]',
      className,
    )}>
      {segments.map(seg => (
        <button
          key={seg.value}
          onClick={() => onChange(seg.value)}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1 px-ha-3 py-1.5 rounded-ha-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
            seg.value === value
              ? 'bg-surface-default text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {seg.icon}
          {seg.label}
        </button>
      ))}
    </div>
  );
}
