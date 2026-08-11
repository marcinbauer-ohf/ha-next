'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { clsx } from 'clsx';
import { useCloseOnScreensaver } from '@/contexts';
import { lastPointerPoint } from '@/lib/lastPointer';
import { useScrollFades } from '@/hooks/useScrollFades';
import { visibleFocusables } from '@/hooks/useFocusTrap';

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
 * Mobile: bottom sheet that springs up; the grabber pill drags to dismiss.
 */
export function ModalSheet({ open, onClose, children, maxWidth = 560, transitionKey }: ModalSheetProps) {
  // The screensaver clears anything sitting over the main UI. Since most modals
  // and surfaces ride on ModalSheet, this covers them in one place.
  useCloseOnScreensaver(open, onClose);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  // Y where a touch started while the sheet's content was already scrolled to
  // the top; null once the gesture is claimed (or was never a candidate).
  const overscrollFrom = useRef<number | null>(null);
  const dragControls = useDragControls();
  const { attach: attachDesktopFades, showTop: desktopTop, showBottom: desktopBottom } = useScrollFades<HTMLDivElement>();
  const { attach: attachMobileFades, showTop: mobileTop, showBottom: mobileBottom } = useScrollFades<HTMLDivElement>();

  // Dialog keyboard contract: Escape closes, Tab cycles inside the dialog, and
  // focus returns to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    containerRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = visibleFocusables(container);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || active === container)) {
        e.preventDefault();
        first.focus();
      } else if (active && !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  // Grow the desktop card out of whatever was clicked. The offset is damped —
  // the card drifts *from that direction* rather than literally flying across
  // the screen — and falls back to a plain centred pop when there's no fresh
  // pointer (keyboard, a toast action, the screensaver closing something).
  const origin = (() => {
    const p = open ? lastPointerPoint() : null;
    if (!p) return { dx: 0, dy: 16, transformOrigin: 'center' };
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return {
      dx: (p.x - cx) * 0.35,
      dy: (p.y - cy) * 0.35,
      transformOrigin: `${((p.x / window.innerWidth) * 100).toFixed(1)}% ${((p.y / window.innerHeight) * 100).toFixed(1)}%`,
    };
  })();

  // Crossfade content when transitionKey changes (panel switch inside the open
  // dialog). Deliberately gentle: the two panels share a header, so a big slide
  // makes a swap that is mostly the *same* dialog look like a different one.
  // The outgoing panel leaves faster than the incoming arrives, and the card
  // itself carries a `layout` animation so the height eases instead of snapping.
  const content = transitionKey !== undefined ? (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut', delay: 0.05 } }}
        exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.1, ease: 'easeIn' } }}
        className="flex flex-col min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  ) : children;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center pointer-events-auto outline-none"
        >
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />

          {/* Desktop: centered card — grows from wherever you clicked */}
          <motion.div
            key="desktop-card"
            // `layout` eases the card's height between panels — popLayout pulls
            // the outgoing panel out of flow, so without it the card snaps to the
            // new height in one frame while the content is still fading.
            layout={transitionKey !== undefined ? 'size' : false}
            initial={{ opacity: 0, scale: 0.90, x: origin.dx, y: origin.dy }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, x: origin.dx, y: origin.dy }}
            transition={SPRING}
            className="hidden lg:flex relative w-full flex-col bg-surface-lower rounded-ha-3xl overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]"
            style={{ maxWidth, maxHeight: '85vh', transformOrigin: origin.transformOrigin }}
          >
            <div className="relative flex-1 flex flex-col min-h-0">
              <div className={clsx('absolute top-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-10 transition-opacity duration-300', desktopTop ? 'opacity-100' : 'opacity-0')} />
              <div className={clsx('absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-10 transition-opacity duration-300', desktopBottom ? 'opacity-100' : 'opacity-0')} />
              <div ref={attachDesktopFades} className="overflow-y-auto scrollbar-hide flex-1 flex flex-col">
                {content}
              </div>
            </div>
          </motion.div>

          {/* Mobile: bottom sheet — springs up; drag the grabber down to dismiss */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 800) onClose();
            }}
            className="lg:hidden relative w-full bg-surface-lower rounded-t-ha-3xl overflow-hidden"
            style={{
              maxHeight: '82dvh',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--ha-space-4, 16px))',
            }}
          >
            <div
              className="flex justify-center py-ha-2 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-8 h-1 rounded-full bg-text-secondary/30" />
            </div>
            {/* Overscroll hands the gesture to the sheet: keep pulling down once
                the content is already at its top and the sheet comes with you,
                so dismissing never means aiming for the little grabber. */}
            {/* Pad past the home-indicator / gesture bar, plus a little breathing
                room so content never kisses the device's bottom edge. */}
            <div className="relative">
              <div className={clsx('absolute top-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-10 transition-opacity duration-300', mobileTop ? 'opacity-100' : 'opacity-0')} />
              <div className={clsx('absolute bottom-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-10 transition-opacity duration-300', mobileBottom ? 'opacity-100' : 'opacity-0')} />
              <div
                ref={(el) => { attachMobileFades(el); mobileScrollRef.current = el; }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse') return;
                  // Charts, timelines and sliders own their gesture — scrubbing
                  // one must never turn into "close the sheet".
                  if ((e.target as Element | null)?.closest?.('[data-sheet-drag="none"]')) {
                    overscrollFrom.current = null;
                    return;
                  }
                  overscrollFrom.current = (mobileScrollRef.current?.scrollTop ?? 0) <= 0 ? e.clientY : null;
                }}
                onPointerMove={(e) => {
                  if (overscrollFrom.current === null) return;
                  // Only a downward pull, and only while still pinned at the top.
                  if ((mobileScrollRef.current?.scrollTop ?? 0) > 0) { overscrollFrom.current = null; return; }
                  if (e.clientY - overscrollFrom.current < 12) return;
                  overscrollFrom.current = null;
                  dragControls.start(e);
                }}
                onPointerUp={() => { overscrollFrom.current = null; }}
                onPointerCancel={() => { overscrollFrom.current = null; }}
                className="overflow-y-auto scrollbar-hide overscroll-contain"
                style={{
                  // The padding lives on the sheet, not in here: inside the
                  // scrollport it counts toward scrollHeight, so a panel sized to
                  // fill the sheet always overflowed by exactly the padding —
                  // which is what pushed its header out of view on the phone.
                  maxHeight: 'calc(82dvh - 20px - env(safe-area-inset-bottom, 0px) - var(--ha-space-4, 16px))',
                }}
              >
                {content}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
