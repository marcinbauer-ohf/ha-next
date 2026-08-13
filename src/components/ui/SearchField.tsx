'use client';

import type { Ref } from 'react';
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
}: SearchFieldProps) {
  return (
    <div
      className={clsx(
        // Inset ring: an outset one gets clipped by sticky headers / scroll fades
        // the field sits under. Colour matches the editor toolbar's blue pill.
        'flex items-center gap-ha-3 px-ha-4 h-12 rounded-ha-2xl bg-surface-low transition-colors focus-within:ring-2 focus-within:ring-inset focus-within:ring-[color-mix(in_srgb,var(--ha-color-blue)_62%,#000)]',
        className,
      )}
    >
      <Icon path={mdiMagnify} size={20} className="text-text-secondary flex-shrink-0" />
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
        className="flex-1 min-w-0 bg-transparent text-base lg:text-sm text-text-primary placeholder-text-tertiary outline-none"
      />
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
