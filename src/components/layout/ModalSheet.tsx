'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { clsx } from 'clsx';
import { useCloseOnScreensaver, useScreensaverActive } from '@/contexts';
import { useScrollFades } from '@/hooks/useScrollFades';
import { visibleFocusables } from '@/hooks/useFocusTrap';
import { recede, useSheetStack } from '@/hooks/useSheetStack';
import { SheetGrabber } from '../ui/SheetGrabber';
import { ContainedSheetContext } from './containedSheet';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width of the desktop modal card (default 560px) */
  maxWidth?: number;
  /** When this changes while open, the content crossfades (e.g. detail ↔ edit) */
  transitionKey?: string;
  /**
   * Accessible name for the dialog. Give it whatever the header would have said
   * — required reading for a screen reader when the dialog shows no title.
   */
  label?: string;
  /**
   * lg+ gets a sheet instead of the centered card: a drawer that drops out of
   * the dashboard panel's top edge, where the summary chips that open it live.
   * For dialogs that are read rather than worked in. Falls back to the
   * viewport-wide bottom sheet where there is no panel to sit in (the
   * screensaver).
   */
  contained?: boolean;
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 };
const SHEET_SPRING = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 1 };


/**
 * Desktop: centered floating card with scrim.
 * Mobile: bottom sheet that springs up; the grabber pill drags to dismiss.
 */
export function ModalSheet({ open, onClose, children, maxWidth = 560, transitionKey, label, contained = false }: ModalSheetProps) {
  // The screensaver clears anything sitting over the main UI. Since most modals
  // and surfaces ride on ModalSheet, this covers them in one place.
  useCloseOnScreensaver(open, onClose);

  // Registration order is also paint order here: portals land in the body in
  // *mount* order, which has nothing to do with which dialog you opened last.
  const { above, below } = useSheetStack(open);
  const sunk = Math.min(above, 2);
  // Read by the key handler, which must not re-bind (and re-grab focus) just
  // because something opened on top.
  const aboveRef = useRef(above);
  useEffect(() => { aboveRef.current = above; }, [above]);
  // Same reason, and then some: this effect grabs focus on open and hands it back
  // on close, so it must run when `open` flips and at no other time. With
  // `onClose` in its deps it re-ran on every render of the caller — and every
  // re-run stole focus out of whatever you were typing in. See useCloseOnScreensaver.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  // Y where a touch started while the sheet's content was already scrolled to
  // the top; null once the gesture is claimed (or was never a candidate).
  const overscrollFrom = useRef<number | null>(null);
  const dragControls = useDragControls();
  // The lg breakpoint, same threshold the Assist-family sheets contain at.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (!contained) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [contained]);
  const screensaverUp = useScreensaverActive();
  // Which branch renders on lg. Never while the screensaver is up: the panel
  // this contains itself to sits underneath it, so a contained sheet opened from
  // a screensaver chip would render behind the screensaver.
  const sheetOnDesktop = contained && isDesktop && !screensaverUp;
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
      // Covered by another dialog: the keyboard belongs to the one on top. Both
      // listen on `document`, so stopPropagation up there can't reach a sibling
      // listener — Escape would otherwise close the whole stack at once.
      if (aboveRef.current > 0) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
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
  }, [open]);

  if (typeof document === 'undefined') return null;

  // The clip layer that bounds the dashboard panel. Read straight from the DOM
  // rather than held in state: it's a stable node that outlives every dialog, and
  // a mount-time probe would miss it — this sits deep enough in the tree to mount
  // before the panel paints, and would then stay viewport-wide forever. No clip
  // layer at all (the screensaver) is the same answer: viewport-wide sheet.
  const glowRoot = sheetOnDesktop ? document.getElementById('toast-glow-root') : null;
  const asSheet = glowRoot != null;

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
    <ContainedSheetContext.Provider value={asSheet}>
    <AnimatePresence>
      {open && (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={clsx(
            'flex justify-center pointer-events-auto outline-none',
            // Contained: a drawer hanging off the panel's top edge, which is
            // where the chips that open it are. Everywhere else: bottom sheet.
            asSheet ? 'absolute dashboard-panel-clip items-start' : 'fixed inset-0 items-end',
            !sheetOnDesktop && 'lg:items-center',
          )}
          style={{ zIndex: 200 + below }}
        >
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            // Lighter over a sheet that's already dimmed the page — two full
            // scrims would bury the card underneath instead of recessing it.
            className={clsx('absolute inset-0', below > 0 ? 'bg-black/40' : 'bg-black/70')}
            onClick={onClose}
          />

          {/* Desktop: centered card — pops in place. The dialog says where it
              came from with its words (eyebrow + title) and its glyph, not with a
              directional drift that's gone in 300ms and means nothing on a
              keyboard or voice open. */}
          {!sheetOnDesktop && <motion.div
            key="desktop-card"
            // `layout` eases the card's height between panels — popLayout pulls
            // the outgoing panel out of flow, so without it the card snaps to the
            // new height in one frame while the content is still fading.
            layout={transitionKey !== undefined ? 'size' : false}
            initial={{ opacity: 0, scale: 0.90, y: 16 }}
            // Covered: shrink back and lift, so the card underneath shows as a
            // shoulder above the new one rather than a shadow behind it.
            animate={{ opacity: 1, scale: 1 - sunk * 0.06, y: -sunk * 22 }}
            exit={{ opacity: 0, scale: 0.90, y: 16 }}
            transition={SPRING}
            className="hidden lg:flex relative w-full flex-col bg-surface-lower rounded-ha-3xl overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]"
            style={{ maxWidth, maxHeight: '90vh' }}
          >
            <div className="relative flex-1 flex flex-col min-h-0">
              <div className={clsx('absolute top-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-10 transition-opacity duration-300', desktopTop ? 'opacity-100' : 'opacity-0')} />
              <div className={clsx('absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-10 transition-opacity duration-300', desktopBottom ? 'opacity-100' : 'opacity-0')} />
              <div ref={attachDesktopFades} className="overflow-y-auto scrollbar-hide flex-1 flex flex-col">
                {content}
              </div>
            </div>
          </motion.div>}

          {/* Bottom sheet — springs up; drag the grabber down to dismiss. The
              contained variant is the same object flipped: it hangs off the
              panel's top edge and drags upward to dismiss. Either way it
              travels exactly its own height, so it fully clears the clip
              instead of leaving a sliver behind to fade out in place. */}
          <motion.div
            key="sheet"
            initial={{ y: asSheet ? '-100%' : '100%' }}
            // Covered: narrower and a nudge away from its anchored edge, so its
            // rounded free edge sticks out past the sheet that opened over it.
            animate={recede(above, asSheet)}
            exit={{ y: asSheet ? '-100%' : '100%' }}
            transition={SHEET_SPRING}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={asSheet ? { top: 0.9, bottom: 0 } : { top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              const away = asSheet ? -1 : 1;
              if (info.offset.y * away > 120 || info.velocity.y * away > 800) onClose();
            }}
            // Hairline on the free edge: in dark mode the sheet's surface is
            // close enough to the scrimmed page behind it that the rounded edge
            // disappears.
            className={clsx(
              'relative w-full bg-surface-lower overflow-hidden',
              !sheetOnDesktop && 'lg:hidden',
              asSheet
                // A drawer: flush with the panel's top edge, inset at the sides.
                ? 'flex flex-col mx-ha-6 rounded-b-ha-3xl border-x border-b border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)]'
                : 'rounded-t-ha-sheet border-t border-white/10',
            )}
            style={{
              maxHeight: asSheet ? 'calc(92% - var(--ha-space-6))' : '82dvh',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--ha-space-4, 16px))',
              transformOrigin: asSheet ? 'bottom center' : 'top center',
            }}
          >
            {!asSheet && (
              <div
                className="flex justify-center pt-ha-2 pb-0 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <SheetGrabber />
              </div>
            )}
            {/* Overscroll hands the gesture to the sheet: keep pulling down once
                the content is already at its top and the sheet comes with you,
                so dismissing never means aiming for the little grabber. */}
            {/* Pad past the home-indicator / gesture bar, plus a little breathing
                room so content never kisses the device's bottom edge. */}
            <div className={clsx('relative', asSheet && 'flex min-h-0 flex-1 flex-col')}>
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
                className={clsx('overflow-y-auto scrollbar-hide overscroll-contain', asSheet && 'min-h-0 flex-1')}
                style={{
                  // The padding lives on the sheet, not in here: inside the
                  // scrollport it counts toward scrollHeight, so a panel sized to
                  // fill the sheet always overflowed by exactly the padding —
                  // which is what pushed its header out of view on the phone.
                  // Contained, the flex column above already bounds it.
                  maxHeight: asSheet ? undefined : 'calc(82dvh - 20px - env(safe-area-inset-bottom, 0px) - var(--ha-space-4, 16px))',
                }}
              >
                {content}
              </div>
            </div>
            {/* The drawer's grab affordance sits on its free edge — the bottom
                one, since this variant hangs from the top. */}
            {asSheet && (
              <div
                className="flex shrink-0 justify-center pt-ha-1 pb-0 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <SheetGrabber />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </ContainedSheetContext.Provider>,
    asSheet ? glowRoot : document.body,
  );
}
