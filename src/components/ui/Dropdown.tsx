'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { mdiChevronDown } from '@mdi/js';
import { Icon } from './Icon';

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Which edge the menu aligns to. Default 'right'. */
  align?: 'left' | 'right';
  /**
   * 'pill' (default) — compact trigger that lines up beside a SegmentedControl.
   * 'row'  — a full-width list row: label on the left, value and chevron on the
   *          right, the whole row tappable. For a setting that owns its line.
   */
  variant?: 'pill' | 'row';
  /** Row variant only — the label that sits on the left of the row. */
  label?: string;
}

interface MenuPos {
  top: number;
  left?: number;
  right?: number;
  minWidth: number;
}

/**
 * A compact select styled to match SegmentedControl — the trigger mirrors a
 * single active segment (same `surface-mid` shell + `surface-default` pill) so
 * it lines up in height beside a SegmentedControl. The menu renders in a portal
 * with fixed positioning so it's never clipped by an overflow-hidden modal, and
 * follows the trigger on scroll/resize.
 */
export function Dropdown<T extends string>({
  options,
  value,
  onChange,
  className,
  align = 'right',
  variant = 'pill',
  label,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      minWidth: r.width,
      ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }),
    });
  }, [align]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const reposition = () => place();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true); // capture inner scrollers (modal body)
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, place]);

  return (
    <div className={clsx(variant === 'row' ? 'relative flex w-full' : 'relative inline-flex', className)}>
      {variant === 'row' ? (
        // A setting that owns its line: the whole row is the control, so the
        // target is the row rather than a small pill parked at its end.
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          className="flex h-12 w-full items-center justify-between gap-ha-3 rounded-ha-xl bg-surface-default px-ha-3 text-sm transition-colors hover:bg-surface-low"
        >
          <span className="truncate text-text-secondary">{label}</span>
          <span className="flex min-w-0 items-center gap-1 font-medium text-text-primary">
            <span className="truncate">{current?.label ?? ''}</span>
            <Icon
              path={mdiChevronDown}
              size={16}
              className={clsx('shrink-0 text-text-tertiary transition-transform duration-200', open && 'rotate-180')}
            />
          </span>
        </button>
      ) : (
        /* Trigger mirrors a SegmentedControl's active segment for matching height. */
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex items-center bg-surface-mid rounded-ha-xl p-[3px]"
        >
          <span className="flex items-center gap-1 rounded-ha-lg bg-surface-default px-ha-3 py-1.5 text-sm font-medium text-text-primary">
            {current?.label ?? ''}
            <Icon
              path={mdiChevronDown}
              size={14}
              className={clsx('shrink-0 transition-transform duration-200', open && 'rotate-180')}
            />
          </span>
        </button>
      )}

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right, minWidth: pos.minWidth }}
          className="ha-dropdown-in z-[1000] rounded-ha-xl bg-surface-default p-1 shadow-lg ring-1 ring-surface-lower"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={clsx(
                'flex w-full items-center whitespace-nowrap rounded-ha-lg px-ha-3 py-1.5 text-left text-sm font-medium transition-colors',
                opt.value === value
                  ? 'bg-surface-mid text-text-primary'
                  : 'text-text-secondary hover:bg-surface-low hover:text-text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
