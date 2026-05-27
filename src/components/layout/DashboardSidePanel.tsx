'use client';

import { createPortal } from 'react-dom';

interface DashboardSidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable dashboard side panel shell.
 * Desktop: slides in as a sibling rounded card (parent must be a flex row with gap).
 * Mobile:  portal bottom sheet.
 */
export function DashboardSidePanel({ open, onClose, children }: DashboardSidePanelProps) {
  return (
    <>
      {/* Desktop sibling panel */}
      <div
        className={`hidden lg:block overflow-hidden transition-[width] duration-300 ease-out flex-shrink-0 ${
          open ? 'w-80' : 'w-0'
        }`}
      >
        <div className="w-80 h-full bg-surface-default border border-surface-lower overflow-hidden rounded-ha-3xl">
          {children}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`lg:hidden fixed inset-0 z-[120] transition-opacity duration-300 ${
              open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
              className={`absolute bottom-0 left-0 right-0 bg-surface-lower rounded-t-ha-3xl transition-transform duration-300 ease-out ${
                open ? 'translate-y-0' : 'translate-y-full'
              }`}
              style={{ maxHeight: '80dvh' }}
            >
              <div className="flex justify-center py-ha-2">
                <div className="w-8 h-1 rounded-full bg-text-secondary/40" />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(80dvh - 20px)' }}>
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
