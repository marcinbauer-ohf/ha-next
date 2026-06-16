'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

interface RollingTextProps {
  /** The text to display. When it changes, the old text rolls out while the new one rolls in. */
  text: string;
  className?: string;
  /**
   * Axis of the roll. `vertical` (default) is the dashboard-card-value motion —
   * old line slides up, new line rises in. `horizontal` slides the old line out
   * sideways and the new one in from the opposite edge — used for the top-bar
   * title when drilling into / out of a detail screen (where a back arrow shows).
   */
  direction?: 'vertical' | 'horizontal';
  /**
   * Horizontal only: reverse the slide so the new text enters from the LEFT
   * (old exits right). Used for "back" navigation so it mirrors the forward
   * drill-in. Ignored when `direction` is vertical.
   */
  reverse?: boolean;
}

/**
 * Rolls an entire string as one block on change — the same vertical-slide
 * motion the dashboard card values use (see RollingDigit), but for arbitrary
 * text instead of per-digit.
 *
 * `direction='horizontal'` swaps the axis: old text slides out sideways while
 * the new one eases in from the opposite edge with an opacity crossfade. The
 * two lines overlap in one grid cell (so the box stays sized to the widest
 * line, not the sum). `reverse` flips the slide direction for back navigation.
 *
 * The direction/reverse in effect are LATCHED when an animation starts, because
 * the caller's signal (e.g. "are we on a detail screen") flips back on the very
 * next render — we must keep animating with the direction the change began with.
 */
export function RollingText({ text, className = '', direction = 'vertical', reverse = false }: RollingTextProps) {
  const [current, setCurrent] = useState(text);
  const [next, setNext] = useState<string | null>(null);
  // 0 = pre-animation (old in place, new staged off-edge); 1 = animated through.
  const [progress, setProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Latched at animation start so a mid-flight prop flip can't change the axis.
  const [anim, setAnim] = useState<{ horizontal: boolean; reverse: boolean }>({ horizontal: false, reverse: false });

  useEffect(() => {
    if (text !== current && next === null) {
      setNext(text);
      setAnim({ horizontal: direction === 'horizontal', reverse });
      // Double RAF so the browser paints the staged incoming line before animating.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          setProgress(1);
        });
      });
    }
  }, [text, current, next, direction, reverse]);

  const handleTransitionEnd = () => {
    setIsTransitioning(false);
    setProgress(0);
    if (next !== null) {
      setCurrent(next);
      setNext(null);
    }
  };

  // Use the latched axis while animating; fall back to live props when idle.
  const horizontal = isTransitioning || next !== null ? anim.horizontal : direction === 'horizontal';

  if (horizontal) {
    // Old slides out + fades, new eases in from a short offset + fades in; both
    // pinned to one grid cell. A small travel (TRAVEL%) plus the opacity
    // crossfade keeps the text from flying in from fully off-screen. No edge
    // mask here — it would visibly fade the title's own characters.
    const dir = anim.reverse ? -1 : 1; // forward: new from right; back: new from left
    const transitionAll = isTransitioning && 'transition-[transform,opacity] duration-500 ease-in-out-quint';
    // Fade gutters live in padding OUTSIDE the text: the box is widened by
    // GUTTER on each side (pulled back with a matching negative margin so layout
    // doesn't shift), and the mask fades exactly those gutters. At rest the text
    // sits between the gutters, so it's crisp; the sliding text travels exactly
    // one gutter width into the fade and disappears there. overflow-hidden clips
    // the rest so it can't bleed over the back arrow.
    const GUTTER_EM = 1;
    const GUTTER = `${GUTTER_EM}em`;
    const edgeMask = `linear-gradient(to right, transparent, black ${GUTTER}, black calc(100% - ${GUTTER}), transparent)`;
    return (
      <span
        className={clsx('relative grid overflow-hidden align-top', className)}
        style={{
          height: '1em',
          lineHeight: 1,
          paddingInline: GUTTER,
          marginInline: `-${GUTTER}`,
          maskImage: edgeMask,
          WebkitMaskImage: edgeMask,
        }}
        aria-label={text}
        onTransitionEnd={handleTransitionEnd}
      >
        <span
          className={clsx('col-start-1 row-start-1 flex items-center whitespace-nowrap', transitionAll)}
          style={{ height: '1em', transform: `translateX(${-progress * GUTTER_EM * dir}em)`, opacity: 1 - progress }}
        >
          {current}
        </span>
        {next !== null && (
          <span
            className={clsx('col-start-1 row-start-1 flex items-center whitespace-nowrap', transitionAll)}
            style={{ height: '1em', transform: `translateX(${(1 - progress) * GUTTER_EM * dir}em)`, opacity: progress }}
          >
            {next}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={clsx('relative inline-block overflow-hidden align-top', className)}
      style={{
        height: '1em',
        lineHeight: 1,
        maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
      }}
      aria-label={text}
    >
      <span
        className={clsx('flex flex-col', isTransitioning && 'transition-transform duration-500 ease-in-out-quint')}
        style={{ transform: `translateY(${-progress * 50}%)` }}
        onTransitionEnd={handleTransitionEnd}
      >
        <span className="flex items-center whitespace-nowrap" style={{ height: '1em' }}>
          {current}
        </span>
        {next !== null && (
          <span className="flex items-center whitespace-nowrap" style={{ height: '1em' }}>
            {next}
          </span>
        )}
      </span>
    </span>
  );
}
