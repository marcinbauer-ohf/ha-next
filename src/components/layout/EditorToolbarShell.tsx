'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };

/**
 * Shared chrome for the floating bottom editor toolbars (dashboard edit,
 * automation editor, areas & floors). Mobile: a full-width pill matching
 * MobileNav — same gradient hairline, inner padding, and --ha-edge-padding
 * offset from the screen edges and bottom. Desktop: a centered floating pill.
 *
 * Renders a motion.div with enter/exit variants but no portal and no
 * AnimatePresence — callers own mount/unmount (and portal when they need to
 * escape a transformed ancestor).
 */
export function EditorToolbarShell({ mobile, desktop }: { mobile: ReactNode; desktop: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.96 }}
      transition={TOOLBAR_SPRING}
      className="fixed z-[60] pointer-events-none inset-x-0 bottom-0 lg:left-[76px] lg:bottom-20 lg:right-0"
      style={{ paddingBottom: 'var(--ha-edge-padding)' }}
    >
      {/* Mobile: full-width pill matching MobileNav style */}
      <div className="lg:hidden px-edge pointer-events-auto">
        <div className="relative rounded-ha-3xl bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)]">
          <div className="relative rounded-[calc(var(--ha-radius-3xl)-1px)] bg-surface-default/95 px-ha-2 py-ha-2">
            {mobile}
          </div>
        </div>
      </div>

      {/* Desktop: centered floating pill */}
      <div className="hidden lg:flex justify-center pointer-events-auto">
        <div className="px-ha-2 py-ha-2 rounded-ha-3xl bg-surface-default/95 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex items-center gap-ha-1">
          {desktop}
        </div>
      </div>
    </motion.div>
  );
}
