'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiClose } from '@mdi/js';
import { Icon } from './Icon';
import { SectionLabel } from './SectionLabel';

export interface ToastProps {
  icon: string;
  iconColor?: string;
  /** Small uppercase eyebrow above the title naming the notification type
      (e.g. 'New device', 'Update', 'Repair') — same style as list section
      headers. Lets the user tell one toast kind from another at a glance. */
  caption?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  /** Whole-card tap handler. When set, the entire toast is the affordance
      (e.g. tap a discovery toast to enter device setup) and no action button
      is needed. The ✕ dismiss button still works independently. */
  onClick?: () => void;
  /** Called when the toast's dismiss (✕) button is pressed. */
  onClose?: () => void;
  /** Optional preview render (e.g. a discovered-device thumbnail) for the leading tile. */
  image?: string;
  /** Optional small protocol/connectivity icon badged onto the preview tile. */
  protocolIcon?: string;
  /**
   * Optional structured metadata rendered as a labelled chip row beneath the
   * header. Use this instead of overloading the subtitle when there are
   * several distinct facts to show.
   */
  details?: Array<{ label?: string; value: string; icon?: string }>;
}

const SPRING_CONTAINER = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.75 };
const SPRING_STACK     = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 };
const FADE             = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const };

export function Toast({ icon, iconColor = 'text-ha-blue', caption, title, subtitle, action, onClick, onClose, image, protocolIcon, details }: ToastProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!image && !imgError;
  const clickable = !!onClick;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      className={`w-full px-ha-3 py-ha-2 lg:px-ha-4 lg:py-ha-3 rounded-ha-3xl bg-surface-default/95 backdrop-blur-md shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50${clickable ? ' cursor-pointer hover:bg-surface-lower/95 active:scale-[0.99] transition-[background-color,transform]' : ''}`}
    >
      <div className="flex items-center gap-ha-3">
        <div className="shrink-0 relative w-9 h-9 lg:w-11 lg:h-11">
          <div className="w-full h-full rounded-ha-xl bg-surface-mid flex items-center justify-center overflow-hidden">
            {showImage ? (
              <img src={image} alt="" onError={() => setImgError(true)} className="w-full h-full object-contain p-0.5" />
            ) : (
              <Icon path={icon} size={18} className={iconColor} />
            )}
          </div>
          {protocolIcon && (
            <span className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-surface-default border border-surface-low flex items-center justify-center shadow-sm">
              <Icon path={protocolIcon} size={11} className="text-ha-blue" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {caption && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...FADE, delay: 0.08 }}
            >
              <SectionLabel className="text-[10px] mb-0.5 truncate">{caption}</SectionLabel>
            </motion.div>
          )}
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...FADE, delay: 0.12 }}
            className="text-sm font-semibold text-text-primary leading-tight truncate"
          >
            {title}
          </motion.p>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...FADE, delay: 0.2 }}
              className="text-xs text-text-secondary mt-0.5 leading-tight truncate"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
        {action && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...FADE, delay: 0.26 }}
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
            className="relative shrink-0 h-8 px-ha-3 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-xs font-semibold text-text-primary transition-colors active:scale-95 before:absolute before:-inset-2 before:content-['']"
          >
            {action.label}
          </motion.button>
        )}
        {onClose && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...FADE, delay: 0.32 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Dismiss"
            className="relative shrink-0 w-10 h-10 -mr-1.5 rounded-ha-pill flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-mid transition-colors active:scale-95 before:absolute before:-inset-3 before:content-['']"
          >
            <Icon path={mdiClose} size={18} />
          </motion.button>
        )}
      </div>

      {details && details.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...FADE, delay: 0.3 }}
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {details.map((d, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-ha-pill bg-surface-mid px-2 py-1 text-[11px] leading-none"
            >
              {d.icon && <Icon path={d.icon} size={12} className="text-text-tertiary" />}
              {d.label && <span className="text-text-tertiary">{d.label}</span>}
              <span className="font-semibold text-text-primary">{d.value}</span>
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export interface ToastStackItem extends ToastProps {
  id: number;
}

/** Vertical offset of each peeking card edge behind the front toast. */
const PEEK_STEP = 8;
/** How many waiting toasts may peek out below the front one. */
const MAX_PEEK = 2;

/**
 * Toasts rendered as a card stack (same mechanics as the dashboard TipStack):
 * the newest toast shows in full while up to two older ones peek out
 * underneath; dismissing the front card pops the next one into place.
 *
 * Positioning comes from `.corner-toast`: full-width centered above the nav on
 * mobile, pinned to the bottom-right of the dashboard surface on desktop. The
 * stack portals into #toast-glow-root (absolute inset-0 inside <main>) so it's
 * clipped to the dashboard content area; falls back to viewport-fixed on
 * routes where that root isn't mounted.
 */
export function ToastStack({ toasts }: { toasts: ToastStackItem[] }) {
  const show = toasts.length > 0;
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setRoot(document.getElementById('toast-glow-root'));
  }, [show]);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Desktop slides in from the right edge; mobile rises from the nav bar.
  const hidden = isDesktop
    ? { opacity: 0, x: 48, y: 0, scale: 0.96 }
    : { opacity: 0, x: 0, y: 20, scale: 0.96 };
  const exit = isDesktop
    ? { opacity: 0, x: 32, scale: 0.97 }
    : { opacity: 0, y: 16, scale: 0.97 };

  const node = (
    <AnimatePresence>
      {show && (
        <motion.div
          key="toast-stack"
          initial={hidden}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={exit}
          transition={SPRING_CONTAINER}
          className={`${root ? 'absolute' : 'fixed'} corner-toast z-[65] pointer-events-auto`}
        >
          <StackedCards toasts={toasts} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return root ? createPortal(node, root) : node;
}

function StackedCards({ toasts }: { toasts: ToastStackItem[] }) {
  const front = toasts[0];
  const peekCount = Math.min(Math.max(toasts.length - 1, 0), MAX_PEEK);

  return (
    <motion.div
      className="relative"
      animate={{ paddingBottom: peekCount > 0 ? peekCount * PEEK_STEP + 2 : 0 }}
      transition={SPRING_STACK}
    >
      {/* Peeking edges of the toasts waiting behind the front card */}
      <AnimatePresence initial={false}>
        {Array.from({ length: peekCount }, (_, i) => (
          <motion.div
            key={`peek-${i}`}
            className="absolute inset-0"
            style={{ zIndex: peekCount - i }}
            initial={{ y: i * PEEK_STEP, scaleX: 1 - i * 0.04, opacity: 0 }}
            animate={{ y: (i + 1) * PEEK_STEP, scaleX: 1 - (i + 1) * 0.04, opacity: 1 }}
            exit={{ y: i * PEEK_STEP, scaleX: 1 - i * 0.04, opacity: 0 }}
            transition={SPRING_STACK}
            aria-hidden
          >
            <div className="h-full rounded-ha-3xl bg-surface-default/95 backdrop-blur-md border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)]" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Front toast — keyed so a dismissal (or new arrival) swaps cards */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={front?.id ?? 'empty'}
          className="relative z-10"
          initial={{ y: PEEK_STEP, scaleX: 0.96, opacity: 0.6 }}
          animate={{ y: 0, scaleX: 1, opacity: 1 }}
          exit={{ y: -10, scale: 0.98, opacity: 0 }}
          transition={SPRING_STACK}
        >
          {front && <Toast {...front} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
