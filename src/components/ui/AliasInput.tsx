'use client';

import { useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';
import { mdiClose, mdiPlus } from '@mdi/js';

interface AliasInputProps {
  /** Current aliases. */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Chip field for free-text aliases (HA area/floor aliases — alternate names
 * used by voice assistants). Enter or comma commits the current token; the
 * backspace key on an empty field removes the last chip.
 */
export function AliasInput({ value, onChange, placeholder = 'Add an alias…' }: AliasInputProps) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const t = raw.trim();
    if (!t || value.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...value, t]);
    setDraft('');
  };

  const remove = (alias: string) => onChange(value.filter((a) => a !== alias));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-low px-ha-3 py-ha-2 transition-colors focus-within:border-ha-blue/40 focus-within:ring-1 focus-within:ring-ha-blue/20">
      {value.map((alias) => (
        <span
          key={alias}
          className="inline-flex items-center gap-ha-1 rounded-full bg-surface-mid px-ha-2 py-0.5 text-[13px] font-medium text-text-primary"
        >
          {alias}
          <button
            type="button"
            onClick={() => remove(alias)}
            aria-label={`Remove ${alias}`}
            className="-mr-0.5 text-text-tertiary transition-colors hover:text-text-secondary"
          >
            <Icon path={mdiClose} size={14} exact />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent py-1 text-sm text-text-primary placeholder-text-tertiary outline-none"
      />
      {draft.trim() && (
        <button
          type="button"
          onClick={() => commit(draft)}
          aria-label="Add alias"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ha-blue transition-colors hover:bg-fill-primary-quiet"
        >
          <Icon path={mdiPlus} size={16} exact />
        </button>
      )}
    </div>
  );
}
