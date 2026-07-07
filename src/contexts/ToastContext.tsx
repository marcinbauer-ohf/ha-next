'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ToastStack, type ToastProps, type ToastStackItem } from '@/components/ui/Toast';
import { GlowCanvas } from '@/components/ui/GlowCanvas';
import { emitStatusPulse } from '@/lib/statusPulseBus';
import { haptic, type HapticKind } from '@/lib/haptics';
import type { HomeCenterSectionId } from '@/lib/homeCenter';
import { useNotificationCenter } from './NotificationCenterContext';

export interface ToastOptions extends ToastProps {
  /** Auto-dismiss delay in ms. Pass null to keep it up until dismissed. */
  duration?: number | null;
  /** Home Center section this toast relates to (connectivity, updates, …).
      When set, the status-bar clock widget pulses to point at where the
      same information lives. */
  statusSection?: HomeCenterSectionId;
  /** Fire a haptic pulse when this toast appears (e.g. 'error' on a failure). */
  haptic?: HapticKind;
  /**
   * For actionable toasts (`action`/`onClick`) that would otherwise stay until
   * acted on: after this many ms with no interaction, dismiss the toast (normal
   * exit animation) and pulse the status-bar command center to redirect
   * attention there. Pulses `statusSection` when set, otherwise a generic pulse.
   */
  idleDismiss?: number;
  /**
   * Also record this toast in the Notification Center (settings → Notifications)
   * so it survives dismissal. Closing the toast (✕ / idle) leaves the entry in
   * place to act on later; acting on the toast (action / onClick) clears it.
   */
  persist?: boolean;
}

interface ToastState extends ToastOptions {
  id: number;
  /** Notification Center entry id, when this toast was persisted. */
  centerId?: string;
  /** Timestamp (ms) this toast is scheduled to auto-dismiss, if it will. Drives
      the glow's fade-away shrink; absent for toasts that stay until acted on. */
  autoDismissAt?: number;
}

interface ToastContextValue {
  /** Show a toast; returns its id so callers can dismiss that specific toast.
      Multiple live toasts render as a card stack, newest in front. */
  showToast: (opts: ToastOptions) => number;
  /** Dismiss all toasts. Pass an id to only dismiss that toast. */
  dismissToast: (id?: number) => void;
  /** True while any toast is on screen — used to freeze the mobile nav auto-hide. */
  isToastVisible: boolean;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => 0,
  dismissToast: () => {},
  isToastVisible: false,
});

/** Over the toast's final seconds the glow eases down to this scale, so it
    visibly recedes before the card leaves — an affordance that it's fading. */
const GLOW_SHRINK_TARGET = 0.1;
/** Length of the shrink cue. Shorter-lived toasts shrink over their whole life. */
const GLOW_SHRINK_WINDOW_MS = 5000;

/**
 * Motion props for the inner "fade-away" shrink, captured once at mount so the
 * timer is anchored to the toast's real dismiss moment (not recomputed on
 * unrelated re-renders). Returns a no-op hold for toasts that never auto-dismiss.
 */
function useGlowShrink(dismissAt: number | null) {
  return useState(() => {
    if (dismissAt == null) return { animate: { scale: 1 } } as const;
    const remaining = dismissAt - Date.now();
    const delay = Math.max(0, remaining - GLOW_SHRINK_WINDOW_MS) / 1000;
    const duration = Math.max(0.001, Math.min(GLOW_SHRINK_WINDOW_MS, remaining) / 1000);
    return {
      initial: { scale: 1 },
      animate: { scale: GLOW_SHRINK_TARGET },
      transition: { delay, duration, ease: 'linear' as const },
    };
  })[0];
}

function CornerGlow({ dismissAt }: { dismissAt: number | null }) {
  const shrink = useGlowShrink(dismissAt);
  return (
    <motion.div
      className="hidden lg:block absolute bottom-0 pointer-events-none corner-toast-glow"
      style={{ height: '19rem', transformOrigin: '100% 100%' }}
      initial={{ scale: 0.15, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.4, opacity: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div className="w-full h-full" style={{ transformOrigin: '100% 100%' }} {...shrink}>
        <GlowCanvas
          className="w-full h-full"
          origin={[1, 1]}
          radius={[0.9, 0.62]}
          intensity={0.85}
        />
      </motion.div>
    </motion.div>
  );
}

function BottomGlow({ dismissAt }: { dismissAt: number | null }) {
  const shrink = useGlowShrink(dismissAt);
  return (
    <motion.div
      className="lg:hidden absolute bottom-0 pointer-events-none dashboard-bottom-glow"
      style={{ height: '40vh', transformOrigin: '50% 100%' }}
      initial={{ scale: 0.15, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.4, opacity: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="w-full h-full"
        style={{
          transformOrigin: '50% 100%',
          background: 'radial-gradient(ellipse 80% 70% at 50% 100%, rgba(24,188,242,0.14) 0%, rgba(24,188,242,0.05) 55%, transparent 75%)',
        }}
        {...shrink}
      />
    </motion.div>
  );
}

function ToastGlow({ show, toastId, dismissAt }: { show: boolean; toastId: number; dismissAt: number | null }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById('toast-glow-root'));
  }, [show]);

  if (!root) return null;

  // Two responsive variants matching the stack's position: a short, wide
  // corner glow on desktop and a full-width bottom glow on mobile. Keyed on the
  // front toast id so a card swap replays the entrance + shrink cue.
  return createPortal(
    <AnimatePresence>
      {show && <CornerGlow key={`glow-corner-${toastId}`} dismissAt={dismissAt} />}
      {show && <BottomGlow key={`glow-bottom-${toastId}`} dismissAt={dismissAt} />}
    </AnimatePresence>,
    root
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const idRef = useRef(0);
  const { addNotification, removeNotification } = useNotificationCenter();

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    const id = ++idRef.current;
    // Record persisted toasts in the Notification Center up front, so the entry
    // exists the moment the toast appears — surviving any later dismissal.
    const centerId = opts.persist ? `toast-${id}` : undefined;
    if (centerId) {
      addNotification({
        id: centerId,
        title: opts.title,
        message: opts.subtitle,
        caption: opts.caption,
        icon: opts.icon,
        image: opts.image,
        onAct: opts.onClick ?? opts.action?.onClick,
      });
    }
    // Anchor when this toast will leave, so the glow can shrink toward it.
    const autoDismiss = !opts.action && !opts.onClick && opts.duration !== null;
    let autoDismissAt: number | undefined;
    if (autoDismiss) autoDismissAt = Date.now() + (opts.duration ?? 4000);
    else if (opts.idleDismiss != null) autoDismissAt = Date.now() + opts.idleDismiss;

    setToasts((prev) => [{ ...opts, id, centerId, autoDismissAt }, ...prev]);
    if (opts.statusSection) emitStatusPulse(opts.statusSection);
    if (opts.haptic) haptic(opts.haptic);
    // Actionable or duration:null toasts stay until acted on / explicitly
    // dismissed — don't auto-dismiss out from under a decision. The timer
    // keeps running while a toast waits behind the front card.
    if (autoDismiss) {
      timersRef.current.set(id, setTimeout(() => removeToast(id), opts.duration ?? 4000));
    } else if (opts.idleDismiss != null) {
      // Actionable toast left untouched: nudge attention to the command center
      // and let it dismiss with its usual exit animation.
      timersRef.current.set(id, setTimeout(() => {
        emitStatusPulse(opts.statusSection);
        removeToast(id);
      }, opts.idleDismiss));
    }
    return id;
  }, [removeToast, addNotification]);

  const dismiss = useCallback((id?: number) => {
    if (id != null) {
      removeToast(id);
      return;
    }
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    setToasts([]);
  }, [removeToast]);

  // Wire each toast's action/✕ to also pop it from the stack. Acting on a toast
  // (action button or whole-card tap) means it's handled, so clear its
  // Notification Center entry; closing it (✕ / idle) leaves the entry to act on
  // later from settings → Notifications.
  const stackItems: ToastStackItem[] = toasts.map((t) => ({
    ...t,
    action: t.action
      ? { ...t.action, onClick: () => { t.action!.onClick(); if (t.centerId) removeNotification(t.centerId); removeToast(t.id); } }
      : undefined,
    onClick: t.onClick
      ? () => { t.onClick!(); if (t.centerId) removeNotification(t.centerId); removeToast(t.id); }
      : undefined,
    onClose: () => { t.onClose?.(); removeToast(t.id); },
  }));

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: dismiss, isToastVisible: toasts.length > 0 }}>
      {children}

      {/* Radial glow — portaled into #toast-glow-root so it's clipped by the
          dashboard's overflow-hidden boundary and doesn't bleed into sidebar/topbar */}
      <ToastGlow show={toasts.length > 0} toastId={toasts[0]?.id ?? 0} dismissAt={toasts[0]?.autoDismissAt ?? null} />

      <ToastStack toasts={stackItems} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
