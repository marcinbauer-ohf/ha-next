'use client';

import { Icon } from '@/components/ui';
import { mdiArrowRight } from '@mdi/js';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Poppins display stack — the screensaver clock's face, reused for hero copy. */
export const DISPLAY_FONT: React.CSSProperties = {
  fontFamily: 'var(--ha-font-family-base, var(--font-poppins)), system-ui, sans-serif',
};

/** The flow's regular text field: filled, rounded, blue focus ring. */
export const FIELD_CLASS =
  'w-full h-13 min-h-[52px] px-ha-4 rounded-ha-xl bg-surface-low/80 backdrop-blur-sm border border-surface-lower text-text-primary text-base placeholder:text-text-tertiary select-text focus:outline-none focus:ring-2 focus:ring-ha-blue/40 focus:border-ha-blue/60 transition-colors disabled:opacity-50';

/** The same field, inflated to hero scale — so it still reads as "type here". */
export const BIG_FIELD_CLASS =
  'w-full max-w-[520px] h-[76px] md:h-[92px] px-ha-5 rounded-ha-3xl bg-surface-low/80 backdrop-blur-sm border-2 border-surface-lower text-center text-4xl md:text-5xl font-semibold tracking-tight text-text-primary placeholder:text-text-tertiary/60 select-text caret-ha-blue focus:outline-none focus:ring-2 focus:ring-ha-blue/40 focus:border-ha-blue/60 transition-colors';

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
