'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast, ToastContainer, type ToastProps } from '@/components/ui/Toast';

interface ToastOptions extends ToastProps {
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((opts: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ ...opts, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), opts.duration ?? 4000);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {toast && (
          <ToastContainer key={toast.id}>
            <Toast
              icon={toast.icon}
              iconColor={toast.iconColor}
              title={toast.title}
              subtitle={toast.subtitle}
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
