'use client';

import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from 'react';
import { mdiClose } from '@mdi/js';
import { Icon } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — reusable docked panel with an EntityDetailPanel-style header (round
// icon avatar + larger title + optional subtitle + close), a scrollable body,
// and an optional drag-to-resize left edge. Consumers control display + position
// via `className`/`style` (e.g. `hidden lg:flex sticky` for a docked desktop
// rail, or `flex` inside a mobile sheet). Width is internal state when
// `resizable`; otherwise it comes from `className` (`w-[340px]`, `w-full`, …).
// ─────────────────────────────────────────────────────────────────────────────

export interface SidebarHeaderInfo {
  /** Round avatar icon (mdi path). Omit for a text-only header. */
  icon?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Renders the close (✕) button when provided. */
  onClose?: () => void;
  /** Extra buttons rendered to the left of the close button. */
  headerActions?: ReactNode;
}

export interface SidebarProps extends SidebarHeaderInfo {
  children: ReactNode;
  /** Show a draggable left edge to resize the panel width. */
  resizable?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Applied to the root element — set display/position here. */
  className?: string;
  style?: CSSProperties;
  /** Applied to the scrollable body wrapper (override default padding). */
  bodyClassName?: string;
}

export function SidebarHeader({ icon, title, subtitle, onClose, headerActions }: SidebarHeaderInfo) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-ha-4 pt-ha-4 pb-ha-3 shrink-0">
        <div className="flex items-center gap-ha-3 min-w-0 flex-1">
          {icon && (
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-mid text-text-secondary">
              <Icon path={icon} size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold leading-tight text-text-primary">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-text-tertiary">{subtitle}</p>}
          </div>
        </div>
        {(headerActions || onClose) && (
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-ha-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
              >
                <Icon path={mdiClose} size={22} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mx-ha-4 h-px bg-surface-lower shrink-0" />
    </>
  );
}

export function Sidebar({
  children,
  resizable = false,
  defaultWidth = 380,
  minWidth = 300,
  maxWidth = 560,
  className = '',
  style,
  bodyClassName,
  ...header
}: SidebarProps) {
  const [width, setWidth] = useState(defaultWidth);
  const widthRef = useRef(defaultWidth);

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;
      const onMove = (ev: PointerEvent) => {
        // Sidebar docks right, so dragging the left edge leftwards widens it.
        const next = Math.min(maxWidth, Math.max(minWidth, startW + (startX - ev.clientX)));
        widthRef.current = next;
        setWidth(next);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [minWidth, maxWidth],
  );

  return (
    <aside
      className={`relative flex-col overflow-hidden rounded-ha-3xl border border-surface-lower bg-surface-default shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)] ${className}`}
      style={{ ...(resizable ? { width } : null), ...style }}
    >
      {resizable && (
        <div
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="group absolute inset-y-0 left-0 z-20 w-2 cursor-col-resize"
        >
          <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-ha-blue/50" />
        </div>
      )}
      <SidebarHeader {...header} />
      <div className={bodyClassName ?? 'flex-1 overflow-y-auto px-ha-4 py-ha-4 scrollbar-hide'}>
        {children}
      </div>
    </aside>
  );
}
