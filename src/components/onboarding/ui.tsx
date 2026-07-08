'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui';
import { mdiArrowRight } from '@mdi/js';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Poppins display stack — the screensaver clock's face, reused for hero copy. */
export const DISPLAY_FONT: React.CSSProperties = {
  fontFamily: 'var(--ha-font-family-base, var(--font-poppins)), system-ui, sans-serif',
};

/** Staggered entrance for a step's hero block: fade + gentle rise. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Big centered step question, screensaver-scale type. Focusable (-1) so the
    flow can move screen-reader focus to the new question on step change. */
export function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      tabIndex={-1}
      className="text-[2rem] leading-[1.12] md:text-4xl lg:text-5xl font-semibold tracking-tight text-text-primary text-balance focus:outline-none"
      style={DISPLAY_FONT}
    >
      {children}
    </h1>
  );
}

export function StepSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base md:text-lg text-text-secondary leading-relaxed text-balance">
      {children}
    </p>
  );
}

/** Primary pill CTA — the screensaver status-pill language, promoted to a button. */
export function PrimaryPill({
  children,
  onClick,
  disabled,
  busy,
  withArrow = true,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  withArrow?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    // While busy the button stays enabled-but-guarded (aria-disabled) so
    // keyboard focus isn't ejected to <body> mid-request.
    <button
      type={type}
      onClick={busy ? undefined : onClick}
      disabled={disabled}
      aria-disabled={busy || disabled}
      className="group inline-flex items-center justify-center gap-ha-2 h-13 min-h-[52px] px-8 rounded-ha-pill bg-ha-blue text-white text-base font-semibold shadow-md shadow-ha-blue/20 transition-all hover:brightness-110 active:scale-[0.97] disabled:bg-surface-low disabled:text-text-disabled disabled:shadow-none disabled:cursor-not-allowed aria-disabled:cursor-wait"
    >
      {children}
      {withArrow && !busy && (
        <Icon
          path={mdiArrowRight}
          size={19}
          className="transition-transform group-hover:translate-x-0.5"
        />
      )}
      {busy && (
        <span
          aria-hidden
          className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
        />
      )}
    </button>
  );
}

/** Quiet secondary action under the primary pill. */
export function QuietButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 px-4 rounded-ha-pill text-[15px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-low/70 transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}
