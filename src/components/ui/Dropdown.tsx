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
    <div className={clsx('relative inline-flex', className)}>
      {/* Trigger mirrors a SegmentedControl's active segment for matching height. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center bg-surface-mid rounded-ha-xl p-[3px]"
      >
        <span className="flex items-center gap-1 rounded-ha-lg bg-surface-default px-ha-3 py-1.5 text-sm font-medium text-text-primary shadow-sm">
          {current?.label ?? ''}
          <Icon
            path={mdiChevronDown}
            size={14}
            className={clsx('shrink-0 transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
      </button>

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
