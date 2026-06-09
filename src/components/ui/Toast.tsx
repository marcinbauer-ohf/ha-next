'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Icon } from './Icon';

export interface ToastProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

const SPRING_CONTAINER = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.75 };
const SPRING_EXPAND    = { type: 'spring' as const, stiffness: 360, damping: 34, mass: 0.9 };
const FADE             = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const };

// Width of the icon-only state: px-4 (8px × 2) + icon 40px + gap-ha-3 on right side ≈ 68px
// Use a value that shows just the icon pill cleanly.
const ICON_ONLY_WIDTH = 68;

export function Toast({ icon, iconColor = 'text-ha-blue', title, subtitle, action, compact }: ToastProps & { compact?: boolean }) {
  // Compact card — used by the corner toast. Same pill on every breakpoint
  // (the default mobile variant expands to full width, which is wrong here).
  if (compact) {
    return (
      <div className="w-full px-ha-4 py-ha-3 rounded-ha-3xl bg-surface-default/95 backdrop-blur-md shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50">
        <div className="flex items-center gap-ha-3">
          <div className="shrink-0 w-10 h-10 rounded-ha-xl bg-surface-mid flex items-center justify-center">
            <Icon path={icon} size={20} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
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
              onClick={action.onClick}
              className="shrink-0 h-8 px-ha-3 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-xs font-semibold text-text-primary transition-colors active:scale-95"
            >
              {action.label}
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: pill expands from icon → full text ── */}
      <div className="lg:hidden px-edge">
        {/* Glass border ring */}
        <motion.div
          className="overflow-hidden rounded-ha-3xl bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)]"
          initial={{ width: ICON_ONLY_WIDTH }}
          animate={{ width: '100%' }}
          transition={{ ...SPRING_EXPAND, delay: 0.08 }}
        >
          {/* Inner pill */}
          <div className="relative rounded-[23px] bg-surface-default/95 backdrop-blur-md px-4 py-ha-3">
            <div className="flex items-center gap-ha-3">
              {/* Icon — visible immediately, anchors the animation */}
              <div className="shrink-0 w-10 h-10 rounded-ha-xl bg-surface-mid flex items-center justify-center">
                <Icon path={icon} size={20} className={iconColor} />
              </div>

              {/* Text — fades in after expansion */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...FADE, delay: 0.28 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-semibold text-text-primary leading-tight whitespace-nowrap">{title}</p>
                {subtitle && (
                  <p className="text-xs text-text-secondary mt-0.5 leading-tight whitespace-nowrap">{subtitle}</p>
                )}
              </motion.div>

              {/* Action — fades in last */}
              {action && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...FADE, delay: 0.36 }}
                  onClick={action.onClick}
                  className="shrink-0 h-8 px-ha-3 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-xs font-semibold text-text-primary transition-colors active:scale-95"
                >
                  {action.label}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Desktop: centered floating pill, no expand needed ── */}
      <div className="hidden lg:flex justify-center">
        <div className="px-ha-4 py-ha-3 rounded-ha-3xl bg-surface-default/95 backdrop-blur-md shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 min-w-[320px] max-w-[480px]">
          <div className="flex items-center gap-ha-3">
            <div className="shrink-0 w-10 h-10 rounded-ha-xl bg-surface-mid flex items-center justify-center">
              <Icon path={icon} size={20} className={iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...FADE, delay: 0.12 }}
                className="text-sm font-semibold text-text-primary leading-tight"
              >
                {title}
              </motion.p>
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...FADE, delay: 0.2 }}
                  className="text-xs text-text-secondary mt-0.5 leading-tight"
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
                onClick={action.onClick}
                className="shrink-0 h-8 px-ha-3 rounded-ha-pill bg-surface-mid hover:bg-surface-lower text-xs font-semibold text-text-primary transition-colors active:scale-95"
              >
                {action.label}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export type ToastPosition = 'bottom-center' | 'bottom-right';

export function ToastContainer({
  children,
  position = 'bottom-center',
}: {
  children: React.ReactNode;
  position?: ToastPosition;
}) {
  // Sit above the status bar / nav clearance, matching EditingToolbar.
  const bottom = `calc(var(--ha-space-3, 0.75rem) + env(safe-area-inset-bottom, 0px) + 4.75rem)`;

  if (position === 'bottom-right') {
    return <CornerToast>{children}</CornerToast>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={SPRING_CONTAINER}
      // Mobile: sit just above the nav bar (matching EditingToolbar's clearance)
      // Desktop: floating above status bar, offset left for sidebar
      className="fixed inset-x-0 z-[65] pointer-events-auto lg:left-[76px]"
      style={{ bottom }}
    >
      {children}
    </motion.div>
  );
}

// Corner toast is positioned relative to the dashboard's main content area by
// portaling into #toast-glow-root (absolute inset-0 inside <main>). Falls back
// to viewport-fixed when that root isn't mounted (non-dashboard routes).
function CornerToast({ children }: { children: React.ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById('toast-glow-root'));
  }, []);

  const node = (
    <motion.div
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.97 }}
      transition={SPRING_CONTAINER}
      className={`${root ? 'absolute' : 'fixed'} corner-toast z-[65] pointer-events-auto`}
    >
      {children}
    </motion.div>
  );

  return root ? createPortal(node, root) : node;
}
