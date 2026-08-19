'use client';

import type { ReactNode, Ref } from 'react';
import { clsx } from 'clsx';
import { Icon } from './Icon';
import { mdiMagnify, mdiClose } from '@mdi/js';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When provided and the field has a value, shows a clear (✕) button. */
  onClear?: () => void;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** Extra classes for the outer wrapper (e.g. `flex-1`). */
  className?: string;
  'aria-label'?: string;
  /**
   * 'lg' is the Spotlight one: tall, centred, big type. For a surface where
   * searching *is* the thing you came to do — the stores — and the field doubles
   * as the heading that says what you're searching.
   */
  size?: 'default' | 'lg';
  /** Overrides the leading glyph — a command palette swaps it per mode. */
  icon?: string;
  iconClassName?: string;
  /** Sits between the glyph and the input (a mode badge, say). */
  leading?: ReactNode;
  /** Sits at the trailing edge, before the clear button (an ESC hint, say). */
  trailing?: ReactNode;
  /**
   * 'lg' centres its text by default — right for a field that is also a heading,
   * wrong for one flanked by a badge and a hint. Pass 'start' for those.
   */
  align?: 'start' | 'center';
}

/**
 * Canonical search field used across the app (mobile bottom-nav search & settings,
 * desktop settings, card picker, …). Keeps every search input visually identical.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  onClear,
  autoFocus,
  inputRef,
  className,
  'aria-label': ariaLabel,
  size = 'default',
  icon = mdiMagnify,
  iconClassName,
  leading,
  trailing,
  align,
}: SearchFieldProps) {
  const lg = size === 'lg';
  const centred = (align ?? (lg ? 'center' : 'start')) === 'center';
  return (
    <div
      className={clsx(
        // Inset ring: an outset one gets clipped by sticky headers / scroll fades
        // the field sits under. Colour matches the editor toolbar's blue pill.
        //
        // The ring is always there and starts transparent, so taking focus only
        // changes its colour — a box-shadow that grows from nothing can't be
        // interpolated, one that recolours can. `ease-in-out-quint` is the app's
        // shared curve (globals.css).
        'flex items-center ring-2 ring-inset ring-transparent',
        'ease-in-out-quint transition-[box-shadow,background-color] duration-200',
        'focus-within:ring-[color-mix(in_srgb,var(--ha-color-blue)_62%,#000)]',
        // Heights match what a SheetHeader puts in the same place — its eyebrow
        // over its title, 44px on a phone and 50px on a desktop — so a surface
        // that swaps this field for a header doesn't shift under you.
        lg
          ? 'h-11 gap-ha-3 rounded-ha-3xl bg-surface-default px-ha-5 lg:h-[50px]'
          : 'h-12 gap-ha-3 rounded-ha-2xl bg-surface-low px-ha-4',
        className,
      )}
    >
      <Icon path={icon} size={lg ? 26 : 20} className={clsx('flex-shrink-0', iconClassName ?? 'text-text-secondary')} />
      {leading}
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // 16px on touch screens — anything smaller makes iOS Safari zoom the
        // whole view when the field takes focus.
        className={clsx(
          'flex-1 min-w-0 bg-transparent text-text-primary placeholder-text-tertiary outline-none',
          lg ? 'text-lg font-medium lg:text-xl' : 'text-base lg:text-sm',
          centred && 'text-center',
        )}
      />
      {trailing}
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="flex-shrink-0 -mr-1 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <Icon path={mdiClose} size={18} />
        </button>
      )}
    </div>
  );
}
