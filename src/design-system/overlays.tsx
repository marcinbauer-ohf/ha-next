'use client';

/**
 * Design-system overlays — menus, toasts, scrims, dialogs.
 * Sheets stay app-side for now (they're layout-coupled); the pieces here are
 * the reusable chrome they're built from.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { IconX } from '@tabler/icons-react';
import { color, shadow, spring } from './tokens';
import { IconButton, Press } from './primitives';

/** Dimmed backdrop. Positioned by its parent (absolute inset-0). */
export function Scrim({ onClick, z = 'z-40' }: { onClick?: () => void; z?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={clsx('absolute inset-0 bg-black/25', z)}
    />
  );
}

/** 40×4 sheet grabber bar. */
export function Grabber({ onPointerDown, className }: { onPointerDown?: (e: React.PointerEvent) => void; className?: string }) {
  return (
    <div
      className={clsx('w-full pt-3 pb-2 shrink-0 flex justify-center', onPointerDown && 'cursor-grab touch-none', className)}
      onPointerDown={onPointerDown}
    >
      <div className="w-[40px] h-[4px] rounded-full bg-[#e6e6e6]" />
    </div>
  );
}

/** Anchored dropdown menu card. Parent must be `relative`. */
export function PopMenu({
  open,
  items,
  onPick,
  onPickItem,
  leading,
  align = 'left',
}: {
  open: boolean;
  items: string[];
  onPick: () => void;
  /** Optional per-item hook, called with the item index before onPick. */
  onPickItem?: (i: number) => void;
  /** Optional per-item leading adornment (e.g. a flag emoji). */
  leading?: string[];
  align?: 'left' | 'right';
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={spring.pop}
          className={clsx(
            'absolute top-[52px] z-10 bg-white rounded-[20px] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col min-w-[220px]',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {items.map((label, i) => (
            <Press
              key={label}
              onClick={() => {
                onPickItem?.(i);
                onPick();
              }}
              className="text-left px-4 py-3 rounded-[14px] text-[15px] font-semibold tracking-[-0.3px] hover:bg-[#f3f3f3] flex items-center gap-2.5"
              style={{ color: color.text }}
            >
              {leading?.[i] && <span className="text-[17px] leading-none">{leading[i]}</span>}
              <span>{label}</span>
            </Press>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The dark toast pill — presentational; lifetime/positioning is the app's. */
export function Toast({ children, leading }: { children: React.ReactNode; leading?: React.ReactNode }) {
  return (
    <div
      className="rounded-full px-5 py-3 text-[14px] font-semibold tracking-[-0.28px] text-white flex items-center gap-2.5 max-w-full"
      style={{ background: color.ink, boxShadow: shadow.toast }}
    >
      {leading}
      <span className="truncate">{children}</span>
    </div>
  );
}

/** Centered confirm dialog. Close is leftmost, per the house rule. */
export function Dialog({
  open,
  title,
  children,
  confirmLabel = 'OK',
  cancelLabel,
  onConfirm,
  onClose,
  danger = false,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <Scrim onClick={onClose} z="z-0" />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={spring.pop}
            className="relative w-full max-w-[360px] bg-white rounded-[32px] p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <IconButton aria-label="Close" onClick={onClose} size={40}>
                <IconX size={19} color={color.text2} />
              </IconButton>
            </div>
            <div className="px-2 flex flex-col gap-1">
              <span className="text-[19px] font-semibold tracking-[-0.38px]" style={{ color: color.text }}>
                {title}
              </span>
              {children && (
                <div className="text-[14px] tracking-[-0.28px]" style={{ color: color.text2 }}>
                  {children}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              {cancelLabel && (
                <Press
                  onClick={onClose}
                  className="flex-1 min-h-[48px] rounded-full bg-[#f3f3f3] text-[15px] font-semibold tracking-[-0.3px]"
                  style={{ color: color.text }}
                >
                  {cancelLabel}
                </Press>
              )}
              <Press
                brighten
                onClick={onConfirm}
                className="flex-1 min-h-[48px] rounded-full text-white text-[15px] font-semibold tracking-[-0.3px]"
                style={{ background: danger ? color.danger : color.ink }}
              >
                {confirmLabel}
              </Press>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
