'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Icon } from './Icon';

export interface ContextMenuAction {
  label: string;
  icon?: string;
  danger?: boolean;
  onSelect: () => void;
}

/**
 * Lightweight right-click popover. Renders at (x, y), clamps inside the
 * viewport, and closes on outside click / Esc / after an action runs.
 */
export function ContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Clamp into the viewport by mutating the node directly — avoids a state
  // round-trip (and the cascading-render it would trigger) for a transient popover.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    let left = x;
    let top = y;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      style={{ top: y, left: x, transformOrigin: 'top left' }}
      className="fixed z-[130] min-w-[188px] py-ha-1 bg-surface-default border border-surface-lower rounded-ha-xl shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-150"
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            action.onSelect();
            onClose();
          }}
          className={clsx(
            'w-full flex items-center gap-ha-3 px-ha-3 py-ha-2 text-sm text-left transition-colors',
            action.danger ? 'text-red-500 hover:bg-red-500/10' : 'text-text-primary hover:bg-surface-low'
          )}
        >
          {action.icon && (
            <Icon
              path={action.icon}
              size={18}
              className={action.danger ? 'text-red-500' : 'text-text-secondary'}
            />
          )}
          <span className="font-medium">{action.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
