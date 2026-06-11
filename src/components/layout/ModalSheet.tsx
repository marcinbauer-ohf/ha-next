'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width of the desktop modal card (default 560px) */
  maxWidth?: number;
  /** When this changes while open, the content crossfades (e.g. detail ↔ edit) */
  transitionKey?: string;
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 };
const SHEET_SPRING = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 1 };

/**
 * Desktop: centered floating card with scrim.
 * Mobile: bottom sheet that springs up.
 */
export function ModalSheet({ open, onClose, children, maxWidth = 560, transitionKey }: ModalSheetProps) {
  if (typeof document === 'undefined') return null;

  // Crossfade content when transitionKey changes (panel switch inside the open dialog)
  const content = transitionKey !== undefined ? (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex flex-col min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  ) : children;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center pointer-events-auto">
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
          />

          {/* Desktop: centered card — scales in from slightly below */}
          <motion.div
            key="desktop-card"
            initial={{ opacity: 0, scale: 0.90, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, y: 16 }}
            transition={SPRING}
            className="hidden lg:flex relative w-full flex-col bg-surface-default rounded-ha-3xl overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]"
            style={{ maxWidth, maxHeight: '85vh' }}
          >
            <div className="overflow-y-auto scrollbar-hide flex-1 flex flex-col">
              {content}
            </div>
          </motion.div>

          {/* Mobile: bottom sheet — springs up */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            className="lg:hidden relative w-full bg-surface-lower rounded-t-ha-3xl overflow-hidden"
            style={{ maxHeight: '82dvh' }}
          >
            <div className="flex justify-center py-ha-2">
              <div className="w-8 h-1 rounded-full bg-text-secondary/30" />
            </div>
            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(82dvh - 20px)' }}>
              {content}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
