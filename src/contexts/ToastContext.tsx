'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Toast, ToastContainer, type ToastProps, type ToastPosition } from '@/components/ui/Toast';

interface ToastOptions extends ToastProps {
  duration?: number;
  position?: ToastPosition;
}

interface ToastState extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
  /** True while any toast is on screen — used to freeze the mobile nav auto-hide. */
  isToastVisible: boolean;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {}, isToastVisible: false });

function ToastGlow({ show, toastId, position }: { show: boolean; toastId: number; position: ToastPosition }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById('toast-glow-root'));
  }, [show]);

  if (!root) return null;

  const isCorner = position === 'bottom-right';

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key={`glow-${toastId}`}
          className={`absolute bottom-0 pointer-events-none ${isCorner ? 'right-0 w-2/3' : 'inset-x-0'}`}
          style={{
            height: '40vh',
            background: isCorner
              ? 'radial-gradient(ellipse 70% 70% at 100% 100%, rgba(24,188,242,0.16) 0%, rgba(24,188,242,0.05) 55%, transparent 75%)'
              : 'radial-gradient(ellipse 80% 70% at 50% 100%, rgba(24,188,242,0.14) 0%, rgba(24,188,242,0.05) 55%, transparent 75%)',
            transformOrigin: isCorner ? '100% 100%' : '50% 100%',
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((opts: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ ...opts, id: Date.now() });
    // Actionable toasts stay until the user acts (or it's replaced) — don't
    // auto-dismiss out from under a decision.
    if (!opts.action) {
      timerRef.current = setTimeout(() => setToast(null), opts.duration ?? 4000);
    }
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, isToastVisible: !!toast }}>
      {children}

      {/* Radial glow — portaled into #toast-glow-root so it's clipped by the
          dashboard's overflow-hidden boundary and doesn't bleed into sidebar/topbar */}
      <ToastGlow show={!!toast} toastId={toast?.id ?? 0} position={toast?.position ?? 'bottom-center'} />

      <AnimatePresence>
        {toast && (
          <ToastContainer key={toast.id} position={toast.position}>
            <Toast
              icon={toast.icon}
              iconColor={toast.iconColor}
              title={toast.title}
              subtitle={toast.subtitle}
              compact={toast.position === 'bottom-right'}
              action={toast.action ? { ...toast.action, onClick: () => { toast.action!.onClick(); dismiss(); } } : undefined}
            />
          </ToastContainer>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
