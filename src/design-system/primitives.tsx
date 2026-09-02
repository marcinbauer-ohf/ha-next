'use client';

/**
 * Design-system primitives — the onboarding-v2 control language.
 * Pill-based, Onest semibold, spring-pressed. Light-only for now.
 */

import { useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconMinus,
  IconPlus,
  IconUser,
  IconX,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import { capColorFor, color, spring } from './tokens';

// ── Press: the base pressable — spring scale + brightness shift ──────────────
export function Press({
  className,
  style,
  onClick,
  children,
  brighten = false,
  'aria-label': ariaLabel,
}: {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
  /** Dark buttons lighten on press; light ones darken. */
  brighten?: boolean;
  'aria-label'?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      whileHover={{ filter: brighten ? 'brightness(1.35)' : 'brightness(0.93)' }}
      whileTap={{ scale: 0.93, filter: brighten ? 'brightness(1.7)' : 'brightness(0.9)' }}
      transition={spring.press}
      className={className}
      style={style}
    >
      {children}
    </motion.button>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
/** Full-width dark pill CTA with optional trailing arrow. */
export function CtaButton({
  label,
  onClick,
  arrow = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  arrow?: boolean;
  disabled?: boolean;
}) {
  return (
    <Press
      brighten
      onClick={disabled ? undefined : onClick}
      className={clsx(
        'obv2-cta w-full min-h-[52px] rounded-full flex items-center justify-between px-3 text-white transition-opacity',
        disabled && 'opacity-40 pointer-events-none',
      )}
      style={{ background: color.ink }}
    >
      <span className="size-[24px]" />
      <span className="text-[16px] font-semibold tracking-[-0.32px]">{label}</span>
      <span className="size-[24px] flex items-center justify-center">{arrow && <IconArrowRight size={20} />}</span>
    </Press>
  );
}

/** Round icon button. 44px chrome-sized by default; 38–40px inside fields. */
export function IconButton({
  'aria-label': ariaLabel,
  onClick,
  children,
  tone = 'field',
  size = 44,
}: {
  'aria-label': string;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: 'field' | 'white' | 'accent' | 'ink';
  size?: number;
}) {
  const bg = { field: color.field, white: color.white, accent: color.accent, ink: color.ink }[tone];
  return (
    <Press
      aria-label={ariaLabel}
      onClick={onClick}
      brighten={tone === 'accent' || tone === 'ink'}
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ background: bg, width: size, height: size }}
    >
      {children}
    </Press>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────────
/** The canonical pill text input. */
export function PillInput({
  value,
  onChange,
  placeholder,
  secret = false,
  delayFocus = false,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Password-style field with a show/hide eye. */
  secret?: boolean;
  /**
   * Choreograph the tap: fire onFocus (e.g. an artwork zoom) immediately but
   * hold the actual focus — and with it the keyboard — until it has landed.
   */
  delayFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full min-h-[56px] pl-5 pr-2 flex items-center gap-1">
      <input
        // Always type="text": iOS hangs its password-manager UI off
        // type="password"; the dots come from -webkit-text-security instead.
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize={secret ? 'off' : undefined}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => {
          if (!delayFocus) return;
          const el = e.currentTarget;
          if (document.activeElement === el) return;
          // Hopping between two inputs keeps the keyboard up — only
          // choreograph the keyboard-raising first focus.
          if (document.activeElement?.tagName === 'INPUT') return;
          e.preventDefault();
          onFocus?.();
          setTimeout(() => el.focus(), 360);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold tracking-[-0.34px] placeholder:text-[#989898]"
        style={{ color: color.text, WebkitTextSecurity: secret && !show ? 'disc' : undefined } as React.CSSProperties}
      />
      {secret && (
        <IconButton aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} tone="white" size={38}>
          {show ? <IconEyeOff size={17} color={color.text2} /> : <IconEye size={17} color={color.text2} />}
        </IconButton>
      )}
      {value && (
        <IconButton aria-label="Clear" onClick={() => onChange('')} tone="white" size={38}>
          <IconX size={17} color={color.text2} />
        </IconButton>
      )}
    </div>
  );
}

// ── Selection controls ───────────────────────────────────────────────────────
/** 42×26 switch. Safe inside tappable cards (stops propagation). */
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="w-[42px] h-[26px] shrink-0 rounded-full p-[3px] transition-colors duration-200"
      style={{ background: on ? color.accent : color.off }}
    >
      <span
        className="block size-[20px] rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(16px)' : undefined }}
      />
    </button>
  );
}

/** Label + optional description + Toggle. `highlight` tints the row. */
export function ToggleRow({
  label,
  description,
  on,
  onToggle,
  highlight = false,
}: {
  label: string;
  description?: string;
  on: boolean;
  onToggle: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={clsx('flex items-center justify-between gap-3 px-3 py-1.5', highlight && 'rounded-[16px] py-2')}
      style={{ background: highlight ? color.tint : undefined }}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-[16px] font-semibold tracking-[-0.32px]" style={{ color: color.text }}>
          {label}
        </span>
        {description && (
          <span className="text-[13px] tracking-[-0.26px]" style={{ color: color.text2 }}>
            {description}
          </span>
        )}
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

/** Toggle chip: icon swaps to a check when selected; optional "+" sub-action. */
export function Chip({
  label,
  icon: Icon,
  selected = false,
  onClick,
  onAdd,
  addLabel,
}: {
  label: string;
  icon?: TablerIcon;
  selected?: boolean;
  onClick?: () => void;
  /** Selected chips grow a "+" — e.g. "add another Bedroom". */
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <Press
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 rounded-[12px] whitespace-nowrap shrink-0',
        Icon ? 'p-2 pr-3' : 'px-3 py-2',
      )}
      style={{ background: selected ? color.accent : color.field, color: selected ? color.white : color.ink }}
    >
      {Icon && (selected ? <IconCheck size={22} /> : <Icon size={22} />)}
      <span className="text-[14px] font-semibold tracking-[-0.28px]">{label}</span>
      {selected && onAdd && (
        <span
          role="button"
          aria-label={addLabel ?? `Add another ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="-mr-1 flex size-[24px] items-center justify-center rounded-full bg-white/25"
        >
          <IconPlus size={15} />
        </span>
      )}
    </Press>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <Press onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-left" aria-label={label}>
      <span
        role="checkbox"
        aria-checked={checked}
        className="size-[26px] rounded-[9px] flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{ background: checked ? color.accent : color.off }}
      >
        {checked && <IconCheck size={17} color={color.white} />}
      </span>
      {label && (
        <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: color.text }}>
          {label}
        </span>
      )}
    </Press>
  );
}

export function Radio({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label?: string;
}) {
  return (
    <Press onClick={onSelect} className="flex items-center gap-2.5 text-left" aria-label={label}>
      <span
        role="radio"
        aria-checked={selected}
        className="size-[26px] rounded-full flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{ background: selected ? color.accent : color.off }}
      >
        <span
          className="size-[10px] rounded-full bg-white transition-transform duration-150"
          style={{ transform: selected ? 'scale(1)' : 'scale(0)' }}
        />
      </span>
      {label && (
        <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: color.text }}>
          {label}
        </span>
      )}
    </Press>
  );
}

/** Pill segments; the active one slides between them. */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full p-1 flex">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className="relative flex-1 min-w-0 h-[40px] rounded-full flex items-center justify-center px-2"
        >
          {opt === value && (
            <motion.span
              layoutId={`${id}-pill`}
              transition={spring.pop}
              className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            />
          )}
          <span
            className="relative text-[14px] font-semibold tracking-[-0.28px] truncate transition-colors duration-150"
            style={{ color: opt === value ? color.text : color.text2 }}
          >
            {opt}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Minus / count / plus, ends fade out at the limits. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const end = (disabled: boolean) =>
    clsx('size-[48px] rounded-full flex items-center justify-center transition-opacity', disabled && 'opacity-30 pointer-events-none');
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full min-h-[64px] p-2 flex items-center justify-between">
      <Press aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} className={end(value <= min)} style={{ background: color.accent }}>
        <IconMinus size={22} color="white" />
      </Press>
      <span className="text-[24px] font-semibold tracking-[-0.48px]" style={{ color: color.ink }}>
        {format ? format(value) : value}
      </span>
      <Press aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))} className={end(value >= max)} style={{ background: color.accent }}>
        <IconPlus size={22} color="white" />
      </Press>
    </div>
  );
}

/** Full-height pill slider — drag anywhere on the track (brightness/volume). */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.round(min + f * (max - min)));
  };
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, value + 1));
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, value - 1));
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
      className={clsx(
        'relative w-full h-[44px] rounded-full bg-[#f3f3f3] overflow-hidden touch-none cursor-pointer select-none',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color.accent }} />
      <span
        className="absolute top-1/2 -translate-y-1/2 w-[4px] h-[18px] rounded-full bg-white shadow-sm"
        style={{ left: `max(8px, calc(${pct}% - 12px))` }}
      />
    </div>
  );
}

// ── Status & feedback ────────────────────────────────────────────────────────
export type Status = 'on' | 'off' | 'warning' | 'error';
const STATUS_COLOR: Record<Status, string> = {
  on: color.accent,
  off: '#d4d4d4',
  warning: color.warn,
  error: color.danger,
};

export function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: STATUS_COLOR[status] }} />;
}

export function Badge({ label, status = 'off' }: { label: string; status?: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-[#f3f3f3]">
      <StatusDot status={status} />
      <span className="text-[12px] font-semibold tracking-[-0.24px]" style={{ color: color.text2 }}>
        {label}
      </span>
    </span>
  );
}

const BANNER_TONES = {
  info: { bg: color.tint, fg: color.accent, Icon: IconInfoCircle },
  warning: { bg: '#f9f1e4', fg: '#c98a2e', Icon: IconAlertTriangle },
  error: { bg: '#f9e9e7', fg: '#c25b5b', Icon: IconAlertCircle },
} as const;

export function Banner({
  kind = 'info',
  title,
  children,
}: {
  kind?: keyof typeof BANNER_TONES;
  title: string;
  children?: React.ReactNode;
}) {
  const t = BANNER_TONES[kind];
  return (
    <div className="flex items-start gap-3 rounded-[16px] px-3.5 py-3" style={{ background: t.bg }}>
      <t.Icon size={20} color={t.fg} className="shrink-0 mt-[1px]" />
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: color.text }}>
          {title}
        </span>
        {children && (
          <span className="text-[13px] tracking-[-0.26px]" style={{ color: color.text2 }}>
            {children}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-[8px] rounded-full bg-[#f3f3f3] overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color.accent }}
      />
    </div>
  );
}

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-label="Loading"
      className="inline-block rounded-full animate-spin shrink-0"
      style={{ width: size, height: size, border: `3px solid ${color.field}`, borderTopColor: color.accent }}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('block rounded-full bg-[#e6e6e6] animate-pulse', className)} />;
}

// ── Content ──────────────────────────────────────────────────────────────────
/** Icon-in-square + label (+ sub) + trailing (chevron when tappable). */
export function ListRow({
  icon: Icon,
  label,
  sub,
  trailing,
  onClick,
}: {
  icon?: TablerIcon;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {Icon && (
        <span className="size-[38px] rounded-[12px] bg-[#f3f3f3] flex items-center justify-center shrink-0">
          <Icon size={19} color={color.text2} />
        </span>
      )}
      <span className="flex-1 min-w-0 flex flex-col text-left">
        <span className="text-[15px] font-semibold tracking-[-0.3px] truncate" style={{ color: color.text }}>
          {label}
        </span>
        {sub && (
          <span className="text-[13px] truncate" style={{ color: color.textDim }}>
            {sub}
          </span>
        )}
      </span>
      {trailing ?? (onClick ? <IconChevronRight size={17} color={color.textDim} className="shrink-0" /> : null)}
    </>
  );
  return onClick ? (
    <Press onClick={onClick} className="flex items-center gap-3 px-2 py-1.5 rounded-[18px] w-full">
      {body}
    </Press>
  ) : (
    <div className="flex items-center gap-3 px-2 py-1.5">{body}</div>
  );
}

/** Cap-colored identity circle — same color as the person's key. */
export function Avatar({ seed, size = 30 }: { seed: string; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ background: capColorFor(seed), width: size, height: size }}
    >
      <IconUser size={Math.round(size * 0.63)} color={color.white} />
    </span>
  );
}
