'use client';

/**
 * Design-system primitives — the onboarding-v2 control language.
 * Pill-based, Onest semibold, spring-pressed. Light-only for now.
 */

import { useRef, useState } from 'react';
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
import { capColorFor, color, ease, spring } from './tokens';

// ── Press: the base pressable — spring scale + brightness shift ──────────────
export function Press({
  className,
  style,
  onClick,
  children,
  brighten = false,
  role,
  'aria-label': ariaLabel,
  'aria-checked': ariaChecked,
}: {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
  /** Dark buttons lighten on press; light ones darken. */
  brighten?: boolean;
  role?: React.AriaRole;
  'aria-label'?: string;
  'aria-checked'?: boolean;
}) {
  return (
    <motion.button
      type="button"
      role={role}
      aria-label={ariaLabel}
      aria-checked={ariaChecked}
      onClick={onClick}
      whileHover={{ filter: brighten ? 'brightness(1.15)' : 'brightness(0.93)' }}
      whileTap={{ scale: 0.97 }}
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
        'obv2-cta mt-3 w-full min-h-[52px] rounded-full flex items-center justify-between px-3 text-white transition-opacity',
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

/** Labeled pill button. `md` for chrome, `sm` for inline/compact spots. */
export function Button({
  label,
  onClick,
  size = 'md',
  tone = 'ink',
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  size?: 'md' | 'sm';
  tone?: 'ink' | 'field' | 'accent' | 'danger';
  disabled?: boolean;
}) {
  const bg = { ink: color.ink, field: color.field, accent: color.accent, danger: color.danger }[tone];
  return (
    <Press
      brighten={tone !== 'field'}
      onClick={disabled ? undefined : onClick}
      className={clsx(
        'rounded-full font-semibold shrink-0 transition-opacity',
        size === 'md' ? 'min-h-[44px] px-5 text-[15px] tracking-[-0.3px]' : 'min-h-[36px] px-4 text-[14px] tracking-[-0.28px]',
        disabled && 'opacity-40 pointer-events-none',
      )}
      style={{ background: bg, color: tone === 'field' ? color.text : color.white }}
    >
      {label}
    </Press>
  );
}

/** Round icon button. `md` (44px) for chrome, `sm` (36px) for compact spots;
 *  a number overrides (e.g. the 38px white circles inside fields). */
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
  size?: 'md' | 'sm' | number;
}) {
  const px = size === 'md' ? 44 : size === 'sm' ? 36 : size;
  const bg = { field: color.field, white: color.white, accent: color.accent, ink: color.ink }[tone];
  return (
    <Press
      aria-label={ariaLabel}
      onClick={onClick}
      brighten={tone === 'accent' || tone === 'ink'}
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ background: bg, width: px, height: px }}
    >
      {children}
    </Press>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────────
/** The canonical text input — 16px rounding per the shape rule. Accent ring
 *  on focus; a string in `error` paints a danger ring and prints the message
 *  under the field. `label` renders on top; without one the placeholder
 *  carries the meaning (fine for single-field steps, not for forms). */
export function TextField({
  value,
  onChange,
  placeholder,
  label,
  secret = false,
  error,
  delayFocus = false,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Small label above the field — use it whenever a screen has 2+ fields. */
  label?: string;
  /** Password-style field with a show/hide eye. */
  secret?: boolean;
  /** Danger ring; a string also renders as a caption below the field. */
  error?: string | boolean;
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
    <div className="w-full flex flex-col gap-1.5">
    {label && (
      <span className="px-5 text-[13px] font-semibold tracking-[-0.26px]" style={{ color: color.text2 }}>
        {label}
      </span>
    )}
    <div
      className={clsx(
        // Hover darkens like a chip; focus ring lands fast. Hover mutes while
        // focused so the ring reads clean.
        'w-full bg-[#f3f3f3] rounded-[16px] min-h-[56px] pl-5 pr-2 flex items-center gap-1',
        'transition-[box-shadow,filter] duration-100 not-focus-within:hover:brightness-[0.93]',
        error ? 'shadow-[0_0_0_2px_#d96c6c]' : 'focus-within:shadow-[0_0_0_2px_#009ac7]',
      )}
    >
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
    {typeof error === 'string' && error && (
      <span className="px-5 text-[13px] font-semibold tracking-[-0.26px]" style={{ color: color.danger }}>
        {error}
      </span>
    )}
    </div>
  );
}

// ── Selection controls ───────────────────────────────────────────────────────
/** 42×26 switch. The knob snaps home like a physical toggle (ease.snap) and
 *  the whole control presses like everything else.
 *  Safe inside tappable cards (stops propagation). */
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={on}
      whileTap={{ scale: 0.97 }}
      transition={spring.press}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="w-[42px] h-[26px] shrink-0 rounded-full p-[3px]"
      style={{ background: on ? color.accent : color.off, transition: 'background-color 0.3s ease' }}
    >
      <span
        className="block size-[20px] rounded-full bg-white shadow-sm"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(0)', transition: `transform 0.3s ${ease.snap}` }}
      />
    </motion.button>
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
        'flex items-center gap-2 rounded-full whitespace-nowrap shrink-0',
        Icon ? 'p-2 pr-3.5' : 'px-3.5 py-2',
      )}
      style={{ background: selected ? color.accent : color.field, color: selected ? color.white : color.ink }}
    >
      {Icon && (selected ? <IconCheck size={22} /> : <Icon size={22} />)}
      <span className="text-[14px] font-semibold tracking-[-0.28px]">{label}</span>
      {/* the "+" slides in on select instead of popping the chip wider */}
      {onAdd && (
        <span
          role="button"
          aria-label={addLabel ?? `Add another ${label}`}
          onClick={
            selected
              ? (e) => {
                  e.stopPropagation();
                  onAdd();
                }
              : undefined
          }
          className={clsx(
            'flex h-[24px] items-center justify-center rounded-full bg-white/25 overflow-hidden',
            'transition-[width,opacity,margin] duration-200',
            selected ? 'w-[24px] opacity-100 -mr-1' : 'w-0 opacity-0 -ml-2 pointer-events-none',
          )}
        >
          <IconPlus size={15} className="shrink-0" />
        </span>
      )}
    </Press>
  );
}

/** Only the box is interactive (and presses); the label is plain text. */
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
    <span className="flex items-center gap-2.5">
      <Press
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="size-[26px] rounded-[9px] flex items-center justify-center shrink-0"
        style={{ background: checked ? color.accent : color.off, transition: 'background-color 0.15s ease' }}
      >
        {checked && <IconCheck size={17} color={color.white} />}
      </Press>
      {label && (
        <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: color.text }}>
          {label}
        </span>
      )}
    </span>
  );
}

/** Only the circle is interactive (and presses); the label is plain text. */
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
    <span className="flex items-center gap-2.5">
      <Press
        role="radio"
        aria-checked={selected}
        aria-label={label}
        onClick={onSelect}
        className="size-[26px] rounded-full flex items-center justify-center shrink-0"
        style={{ background: selected ? color.accent : color.off, transition: 'background-color 0.15s ease' }}
      >
        <span
          className="size-[10px] rounded-full bg-white transition-transform duration-150"
          style={{ transform: selected ? 'scale(1)' : 'scale(0)' }}
        />
      </Press>
      {label && (
        <span className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: color.text }}>
          {label}
        </span>
      )}
    </span>
  );
}

/** A group of pill buttons on a field track. No traveling background — the
 *  active state just lands where you click (long travel read slow) — and
 *  every segment hovers and presses like any other button. */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-full bg-[#f3f3f3] rounded-full p-1 flex gap-1">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Press
            key={opt}
            onClick={() => onChange(opt)}
            className={clsx(
              'flex-1 min-w-0 min-h-[40px] rounded-full px-2 flex items-center justify-center transition-colors duration-150',
              active ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'hover:bg-[#e9e9e9]',
            )}
          >
            <span
              className="text-[14px] font-semibold tracking-[-0.28px] truncate transition-colors duration-150"
              style={{ color: active ? color.text : color.text2 }}
            >
              {opt}
            </span>
          </Press>
        );
      })}
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
  // The whole control grows a touch while a drag is live — the grab affordance.
  const [pressed, setPressed] = useState(false);
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
        setPressed(true);
        set(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
      onPointerUp={() => setPressed(false)}
      onLostPointerCapture={() => setPressed(false)}
      className={clsx(
        'relative w-full h-[44px] rounded-full bg-[#f3f3f3] overflow-hidden touch-none cursor-pointer select-none',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color.accent }} />
      {/* only the handle reacts to the grab — it grows under the pointer */}
      <span
        className="absolute top-1/2 w-[4px] h-[18px] rounded-full bg-white shadow-sm"
        style={{
          left: `max(8px, calc(${pct}% - 12px))`,
          transform: `translateY(-50%) scale(${pressed ? 1.45 : 1})`,
          transition: 'transform 0.15s ease',
        }}
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
    <Press onClick={onClick} className="flex items-center gap-3 px-2 py-1.5 rounded-full w-full">
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
