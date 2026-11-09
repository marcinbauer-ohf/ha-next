'use client';

import { clsx } from 'clsx';
import { READING } from '@/lib/utils';
import { Icon } from '../ui/Icon';
import { IconBadge } from '../ui/IconBadge';
import type { SummaryCardProps } from '@/types';

const colorClasses = {
  primary: 'bg-surface-low',
  danger: 'bg-fill-danger-normal',
  success: 'bg-surface-low',
  yellow: 'bg-surface-low',
  violet: 'bg-surface-low',
  default: 'bg-surface-low',
};

const iconColorClasses = {
  primary: 'text-ha-blue',
  danger: 'text-red-600',
  success: 'text-green-600',
  yellow: 'text-yellow-600',
  violet: 'text-violet-500',
  default: 'text-text-secondary',
};


// Shared glass fill for the translucent chips/pills floating over the
// screensaver canvas — keep the whole family on this exact string so their
// transparency can't drift apart. Dark (black) glass with white icons/text so
// the chips read against any shader while still letting the scene peek through.
export const TRANSLUCENT_CHIP_FILL =
  'bg-black/55 border border-white/15 [--ha-hover-grow:rgba(0,0,0,0.55)] [--ha-hover-grow-edge:rgba(255,255,255,0.15)]';

// The chip family's own fill on an opaque surface — the screensaver pill
// translated: one step up from the surface it sits on, so the chip is a defined
// object without an outline. No hairline: it would stay at the old box while the
// hover band grows past it, and an edge means "selected" everywhere else in the
// system.
//
// Which step that is depends on the host, so it comes from `--ha-chip-fill`
// (declared in globals.css, where the host contract is written down) rather than
// naming a surface here. This used to be a hard `bg-surface-default`, which is
// correct on the page and invisible in any panel that is *itself*
// surface-default. The hover-grow band reads the same variable, so the grown
// edge can never come out a different colour than the chip it grew from.
//
// Exported because the People chip hand-rolls its own markup and has to stay on
// this exact fill.
export const OPAQUE_CHIP_FILL =
  'bg-[var(--ha-chip-fill)] [--ha-hover-grow:var(--ha-chip-fill)]';

// Pressable chips grow a hair under the pointer instead of brightening: on the
// dashboard's own light surface a brightness step is invisible, and the growth
// reads as the chip answering rather than as its fill changing. The growth is
// `ha-hover-grow`'s band, not a scale — the label and reading have to stay put,
// and a band never reflows the row either.
export const CHIP_PRESS =
  'cursor-pointer transition-all ha-hover-grow active:scale-95 motion-reduce:active:scale-100';

export function SummaryCard({ icon, title, state, color = 'default', compact = false, variant = 'filled', size = 'sm', translucent = false, onClick, className }: SummaryCardProps) {
  const translucentFill = TRANSLUCENT_CHIP_FILL;
  // Interactive glances render as a button with hover/press affordance.
  const Tag = onClick ? 'button' : 'div';
  const interactive = onClick ? CHIP_PRESS : '';

  if (compact) {
    const isLg = size === 'lg';
    const isMd = size === 'md';
    const isSm = !isLg && !isMd;

    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={clsx(
          'flex items-center transition-all',
          isLg ? 'gap-ha-3 px-ha-5 py-ha-3 rounded-ha-2xl' :
          isMd ? 'gap-ha-2 px-ha-4 py-2.5 rounded-ha-xl' :
          // Fixed height, not padding: the chips carry different innards
          // (badges, stacked avatars) and only a set height keeps the row even.
          // Insets come from that height, not from density: a 32px badge in a
          // 48px pill sits (48 − 32) / 2 = 8px from every edge it touches, 10px
          // from its text, and the round text end gets 18. Density scales the
          // space *between* chips, never the room inside one.
          'gap-2.5 pl-2 pr-[18px] h-12 rounded-full',
          'whitespace-nowrap',
          interactive,
          // A chip that carries a state tone stands up off the row; neutral
          // chips lie flat. Not over the screensaver, where the glass is the
          // chip's edge and a shadow would only muddy the scene under it.
          isSm && !translucent && color !== 'default' && 'ha-lift',
          translucent ? translucentFill
            : color === 'danger' ? `${colorClasses.danger} [--ha-hover-grow:var(--ha-color-fill-danger-normal)]`
            : OPAQUE_CHIP_FILL,
          className,
        )}
      >
        {/* sm takes the tinted badge, which carries the chip's colour. md/lg
            keep the bare glyph: their 22/28 icons sit off the badge's 32/40
            tiers, and a 40 badge would change those chips' height. */}
        {isSm ? (
          <IconBadge icon={icon} size={32} tone={translucent ? 'onImage' : color} />
        ) : (
          <div className={clsx('flex-shrink-0', translucent ? 'text-white' : iconColorClasses[color])}>
            <Icon path={icon} size={isLg ? 28 : 22} />
          </div>
        )}
        {/* No reading to show (an entity chip, which is just what it is): one
            line at the value's size — the label alone would sit small and lost
            in a 40px pill. */}
        {state === undefined ? (
          <span className={clsx(
            isSm ? 'font-semibold' : 'font-medium',
            translucent ? 'text-white' : 'text-text-primary',
            isLg ? 'text-xl' : isMd ? 'text-base' : 'text-xs',
          )}>{title}</span>
        ) : (
        /* Label above the value: the value alone ("3 on", "42 W") doesn't say
           what it's counting once the chips are read out of context.
           sm reads like a device card — the category names itself (13, 600,
           primary) and the status sits under it (13, 400, secondary); two 16px
           lines fill the 40px pill. md/lg keep the small label over a big
           value, which is what those sizes are for. */
        <div className={clsx('flex flex-col items-start', isSm ? 'leading-4' : 'leading-tight')}>
          <span className={clsx(
            isSm
              ? ['text-xs font-semibold', translucent ? 'text-white' : 'text-text-primary']
              : [translucent ? 'text-white/70' : 'text-text-secondary', isLg ? 'text-sm' : 'text-xs'],
          )}>{title}</span>
          {/* Mono for a reading ("21.2°C avg", "3 on"), the sans for a word
              ("All locked") — the device card's state line draws the same rule. */}
          <span className={clsx(
            'text-left',
            isSm
              ? ['text-xs font-normal', translucent ? 'text-white/70' : 'text-text-secondary']
              : ['font-semibold', translucent ? 'text-white' : 'text-text-primary', isLg ? 'text-xl' : 'text-base'],
          )}>{typeof state === 'string' && READING.test(state)
            ? (() => { const [, num, rest] = state.match(/^(\S+)(.*)$/)!; return <><span className="font-mono">{num}</span>{rest}</>; })()
            : state}</span>
        </div>
        )}
      </Tag>
    );
  }

  const isOutlined = variant === 'outlined';
  const isLg = size === 'lg';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-ha-3 p-ha-3 rounded-ha-xl transition-all w-full text-left',
        isLg ? 'p-ha-4' : 'p-ha-3',
        interactive,
        isOutlined ? OPAQUE_CHIP_FILL : colorClasses[color],
        className,
      )}
    >
      <div className={clsx('flex-shrink-0', iconColorClasses[color])}>
        <Icon path={icon} size={isLg ? 32 : 24} />
      </div>
      <div className="flex flex-col items-start min-w-0 flex-1">
        <span className={clsx('font-medium text-text-primary text-left', isLg ? 'text-base' : 'text-sm')}>{title}</span>
        <span className={clsx('text-text-secondary text-left', isLg ? 'text-sm' : 'text-xs')}>{state}</span>
      </div>
    </Tag>
  );
}

