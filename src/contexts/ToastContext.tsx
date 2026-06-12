'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ToastStack, type ToastProps, type ToastStackItem } from '@/components/ui/Toast';
import { emitStatusPulse } from '@/lib/statusPulseBus';
import type { HomeCenterSectionId } from '@/lib/homeCenter';

interface ToastOptions extends ToastProps {
  /** Auto-dismiss delay in ms. Pass null to keep it up until dismissed. */
  duration?: number | null;
  /** Home Center section this toast relates to (connectivity, updates, …).
      When set, the status-bar clock widget pulses to point at where the
      same information lives. */
  statusSection?: HomeCenterSectionId;
}

interface ToastState extends ToastOptions {
  id: number;
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

function ToastGlow({ show, toastId }: { show: boolean; toastId: number }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById('toast-glow-root'));
  }, [show]);

  if (!root) return null;

  // Two responsive variants matching the stack's position: a short, wide
  // corner glow on desktop and a full-width bottom glow on mobile.
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key={`glow-corner-${toastId}`}
          className="hidden lg:block absolute bottom-0 pointer-events-none corner-toast-glow"
          style={{
            height: '15rem',
            background: 'radial-gradient(ellipse 85% 50% at 100% 100%, rgba(24,188,242,0.22) 0%, rgba(24,188,242,0.08) 48%, transparent 76%)',
            transformOrigin: '100% 100%',
          }}
          initial={{ scale: 0.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      {show && (
        <motion.div
          key={`glow-bottom-${toastId}`}
          className="lg:hidden absolute bottom-0 pointer-events-none dashboard-bottom-glow"
          style={{
            height: '40vh',
            background: 'radial-gradient(ellipse 80% 70% at 50% 100%, rgba(24,188,242,0.14) 0%, rgba(24,188,242,0.05) 55%, transparent 75%)',
            transformOrigin: '50% 100%',
          }}
          initial={{ scale: 0.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </AnimatePresence>,
    root
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const idRef = useRef(0);

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
    setToasts((prev) => [{ ...opts, id }, ...prev]);
    if (opts.statusSection) emitStatusPulse(opts.statusSection);
    // Actionable or duration:null toasts stay until acted on / explicitly
    // dismissed — don't auto-dismiss out from under a decision. The timer
    // keeps running while a toast waits behind the front card.
    if (!opts.action && opts.duration !== null) {
      timersRef.current.set(id, setTimeout(() => removeToast(id), opts.duration ?? 4000));
    }
    return id;
  }, [removeToast]);

  const dismiss = useCallback((id?: number) => {
    if (id != null) {
      removeToast(id);
      return;
    }
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    setToasts([]);
  }, [removeToast]);

  // Wire each toast's action/✕ to also pop it from the stack.
  const stackItems: ToastStackItem[] = toasts.map((t) => ({
    ...t,
    action: t.action
      ? { ...t.action, onClick: () => { t.action!.onClick(); removeToast(t.id); } }
      : undefined,
    onClose: () => { t.onClose?.(); removeToast(t.id); },
  }));

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: dismiss, isToastVisible: toasts.length > 0 }}>
      {children}

      {/* Radial glow — portaled into #toast-glow-root so it's clipped by the
          dashboard's overflow-hidden boundary and doesn't bleed into sidebar/topbar */}
      <ToastGlow show={toasts.length > 0} toastId={toasts[0]?.id ?? 0} />

      <ToastStack toasts={stackItems} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
