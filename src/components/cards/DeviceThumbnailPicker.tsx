'use client';

import { useState } from 'react';
import { mdiAutoFix, mdiCheck, mdiChevronDown, mdiImageOffOutline } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { DEVICE_THUMBNAIL_GROUPS, deviceThumbnailPath } from '@/lib/deviceThumbnails';
import { SectionLabel } from '../ui/SectionLabel';

// Catalog label keyed by /devices/*.png path — labels the auto pick and the
// current selection in the collapsed row.
const THUMB_LABEL_BY_PATH: Record<string, string> = Object.fromEntries(
  DEVICE_THUMBNAIL_GROUPS.flatMap(g => g.items.map(it => [deviceThumbnailPath(it.file), it.label])),
);

export interface DeviceThumbnailPickerProps {
  /** Current override: undefined = auto, null = none (show the icon), string = a chosen png. */
  value: string | null | undefined;
  /** What "auto" resolves to for this device (null when nothing matches). */
  auto: string | null;
  /** mdi path shown when there's no image. */
  iconPath: string;
  onChange: (value: string | null | undefined) => void;
}

// Selected-badge for a thumbnail tile — a ha-blue check in the top-right corner.
function ThumbCheck() {
  return (
    <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-ha-blue flex items-center justify-center shadow">
      <Icon path={mdiCheck} size={11} className="text-white" />
    </span>
  );
}

/**
 * Product-render picker for a device card — a collapsed summary row that expands
 * into Auto / None plus the grouped catalog. Lives in the more-info settings
 * (cog) view; the card edit panel only deals with which entities show.
 */
export function DeviceThumbnailPicker({ value, auto, iconPath, onChange }: DeviceThumbnailPickerProps) {
  const [open, setOpen] = useState(false);

  const mode: 'auto' | 'none' | 'custom' = value === undefined ? 'auto' : value === null ? 'none' : 'custom';
  const currentSrc = mode === 'auto' ? auto : mode === 'custom' ? value! : null;
  const currentLabel =
    mode === 'none' ? 'No image'
      : mode === 'auto' ? (auto ? `Auto · ${THUMB_LABEL_BY_PATH[auto] ?? 'matched'}` : 'Auto · icon (no match)')
        : (THUMB_LABEL_BY_PATH[value!] ?? 'Custom');

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-ha-3 rounded-ha-2xl px-ha-3 py-ha-2 bg-surface-low hover:bg-surface-mid transition-colors text-left"
      >
        <div className="shrink-0 size-11 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden">
          {currentSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentSrc} alt="" className="size-full object-contain" />
          ) : (
            <Icon path={mode === 'none' ? mdiImageOffOutline : iconPath} size={20} className="text-text-tertiary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">{currentLabel}</p>
          <p className="text-xs text-text-tertiary">{open ? 'Tap an image below' : 'Tap to change'}</p>
        </div>
        <Icon path={mdiChevronDown} size={20} className={clsx('shrink-0 text-text-tertiary transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-ha-2 rounded-ha-xl border-2 border-surface-lower p-ha-2 flex flex-col gap-ha-3">
          {/* Auto + None — the two non-catalog choices. */}
          <div className="flex flex-wrap gap-ha-2">
            <button
              onClick={() => onChange(undefined)}
              title="Auto — based on the device type"
              className={clsx(
                'relative size-14 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden border-2 transition-colors',
                mode === 'auto' ? 'border-ha-blue' : 'border-transparent hover:border-surface-mid',
              )}
            >
              {auto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auto} alt="Auto" className="size-full object-contain p-1" />
              ) : (
                <Icon path={iconPath} size={22} className="text-text-tertiary" />
              )}
              <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-0.5 bg-black/45 py-0.5 text-[9px] font-semibold text-white">
                <Icon path={mdiAutoFix} size={9} className="text-white" />Auto
              </span>
              {mode === 'auto' && <ThumbCheck />}
            </button>

            <button
              onClick={() => onChange(null)}
              title="None — show the icon instead"
              className={clsx(
                'relative size-14 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden border-2 transition-colors',
                mode === 'none' ? 'border-ha-blue' : 'border-transparent hover:border-surface-mid',
              )}
            >
              <Icon path={mdiImageOffOutline} size={22} className="text-text-tertiary" />
              <span className="absolute bottom-0 inset-x-0 text-center bg-black/45 py-0.5 text-[9px] font-semibold text-white">None</span>
              {mode === 'none' && <ThumbCheck />}
            </button>
          </div>

          {/* Catalog, grouped. */}
          {DEVICE_THUMBNAIL_GROUPS.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-ha-1">
              <SectionLabel>{group}</SectionLabel>
              <div className="flex flex-wrap gap-ha-2">
                {items.map(({ file, label }) => {
                  const path = deviceThumbnailPath(file);
                  const selected = value === path;
                  return (
                    <button
                      key={file}
                      onClick={() => onChange(path)}
                      title={label}
                      className={clsx(
                        'relative size-14 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden border-2 transition-colors',
                        selected ? 'border-ha-blue' : 'border-transparent hover:border-surface-mid',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={path} alt={label} className="size-full object-contain p-1" />
                      {selected && <ThumbCheck />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
