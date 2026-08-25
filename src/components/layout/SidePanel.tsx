'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { clsx } from 'clsx';
import { Sidebar, type SidebarHeaderInfo } from '../ui/Sidebar';
import { SheetGrabber } from '../ui/SheetGrabber';
import { recede, useSheetStack } from '@/hooks/useSheetStack';

// ─────────────────────────────────────────────────────────────────────────────
// SidePanel — "the editor rail on a desktop, the same panel as a bottom sheet on
// a phone". The devices panel, the automation editor, the areas editor and the
// Home Center section editor each carried their own copy of this: same Sidebar,
// same scrim, same spring, same grabber, forty lines apiece. They had already
// drifted — one sheet ignored the overlay stack so it stayed put when a dialog
// opened over it, none of them could be dragged away or dismissed with Escape,
// and each grabber was a slightly different pill.
//
// One panel, both forms, one set of manners.
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_SPRING = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 1 };

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Header contents — icon, title, subtitle, actions. Its own `onClose` wins. */
  header: SidebarHeaderInfo;
  children: React.ReactNode;
  /**
   * How the desktop rail sits in the page:
   *  'sticky' pins below the settings header and scrolls with the column;
   *  'inset'  floats inside a full-bleed canvas with its own margins.
   */
  dock?: 'sticky' | 'inset';
  /** Drag the rail's left edge to resize it. */
  resizable?: boolean;
  /** Extra classes for the desktop rail only. */
  railClassName?: string;
}

export function SidePanel({
  open,
  onClose,
  header,
  children,
  dock = 'sticky',
  resizable = false,
  railClassName,
}: SidePanelProps) {
  const { above, below } = useSheetStack(open);
  const dragControls = useDragControls();

  // Escape closes the *sheet* — it covers the page, so it owns the keyboard
  // while it's up. The desktop rail is inline content beside the page, not a
  // modal, so Escape leaves it alone. Unless something opened over the sheet,
  // which owns the keyboard until it goes. Read through refs so the listener
  // isn't re-bound (and swapped mid-keypress) when the caller re-renders.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const aboveRef = useRef(above);
  useEffect(() => { aboveRef.current = above; }, [above]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || aboveRef.current > 0) return;
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const rail = open && (
    <Sidebar
      {...header}
      resizable={resizable}
      className={clsx(
        'ha-pane-in hidden flex-shrink-0 lg:flex',
        dock === 'sticky'
          // z-20 lifts the rail above the scroll column's z-10 fade gradients, so
          // the fade veils only the scrolling content and the docked rail stays crisp.
          ? 'sticky z-20'
          : 'mt-16 mr-ha-4 mb-ha-4 self-stretch',
        railClassName,
      )}
      style={
        dock === 'sticky'
          ? {
              top: 'calc(var(--settings-header-h, 0px) + 4px)',
              maxHeight: 'calc(100vh - var(--settings-header-h, 0px) - 24px)',
            }
          : undefined
      }
    >
      {children}
    </Sidebar>
  );

  // The sheet is portaled to the body: the page's pane-transition wrapper is
  // transformed while it animates, which would clip a fixed child to the page.
  const sheet = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="side-panel-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            // Lighter over a surface that already dimmed the page — two full
            // scrims bury the panel underneath instead of recessing it.
            className={clsx('lg:hidden fixed inset-0', below > 0 ? 'bg-black/40' : 'bg-black/70')}
            style={{ zIndex: 100 + below }}
            onClick={onClose}
          />
          <motion.div
            key="side-panel-sheet"
            initial={{ y: '100%' }}
            animate={recede(above)}
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
            className="lg:hidden fixed inset-x-0 bottom-0 px-ha-2"
            style={{
              zIndex: 100 + below,
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)',
              transformOrigin: 'top center',
            }}
          >
            <div
              className="pb-ha-2 pt-ha-1 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <SheetGrabber tone="light" />
            </div>
            <Sidebar {...header} className="flex max-h-[82vh]">
              {children}
            </Sidebar>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      {rail}
      {sheet}
    </>
  );
}
