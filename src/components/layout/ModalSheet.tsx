'use client';

import { createPortal } from 'react-dom';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width of the desktop modal card (default 420px) */
  maxWidth?: number;
}

/**
 * Desktop: centered floating card with scrim.
 * Mobile: bottom sheet (same as DashboardSidePanel).
 */
export function ModalSheet({ open, onClose, children, maxWidth = 420 }: ModalSheetProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end lg:items-center justify-center transition-all duration-300 ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Scrim */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Desktop: centered card */}
      <div
        className={`hidden lg:flex relative w-full flex-col bg-surface-default rounded-ha-3xl overflow-hidden shadow-2xl transition-all duration-300 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{ maxWidth, maxHeight: '80vh' }}
      >
        <div className="overflow-y-auto scrollbar-hide flex-1 flex flex-col">
          {children}
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className={`lg:hidden relative w-full bg-surface-lower rounded-t-ha-3xl overflow-hidden transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '82dvh' }}
      >
        <div className="flex justify-center py-ha-2">
          <div className="w-8 h-1 rounded-full bg-text-secondary/30" />
        </div>
        <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(82dvh - 20px)' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
