'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Icon } from './Icon';

export interface ContextMenuAction {
  label: string;
  icon?: string;
  danger?: boolean;
  /** Draw a divider above this row — groups the rows that follow it. */
  separator?: boolean;
  /** Inert row: still says what's going on, but there's nothing to press. */
  disabled?: boolean;
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

  // z-210 sits above ModalSheet (z-200) — the menu also opens inside dialogs.

  return createPortal(
    <div
      ref={ref}
      style={{ top: y, left: x, transformOrigin: 'top left' }}
      // A long menu (every entity on a device) has to stay reachable: cap it to
      // the viewport and scroll inside. The clamp above measures offsetHeight,
      // so the cap is what it clamps against.
      className="fixed z-[210] max-h-[calc(100dvh-16px)] overflow-y-auto min-w-[188px] py-ha-1 bg-surface-default border border-surface-lower rounded-ha-xl shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-150"
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, i) => (
        <div key={i}>
          {action.separator && i > 0 && (
            <div className="my-ha-1 h-px bg-surface-lower" aria-hidden />
          )}
          <button
            type="button"
            disabled={action.disabled}
            onClick={() => {
              action.onSelect();
              onClose();
            }}
            className={clsx(
              'w-full flex items-center gap-ha-3 px-ha-3 py-ha-2 text-sm text-left transition-colors',
              action.disabled
                ? 'text-text-tertiary cursor-default'
                : action.danger
                  ? 'text-red-500 hover:bg-red-500/10'
                  : 'text-text-primary hover:bg-surface-low'
            )}
          >
            {action.icon && (
              <Icon
                path={action.icon}
                size={18}
                className={
                  action.disabled
                    ? 'text-text-tertiary'
                    : action.danger
                      ? 'text-red-500'
                      : 'text-text-secondary'
                }
              />
            )}
            <span className="font-medium">{action.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
