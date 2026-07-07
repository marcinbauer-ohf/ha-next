'use client';

import { clsx } from 'clsx';
import type { CSSProperties } from 'react';

interface ScrollFadeEdgeProps {
  /** Which edge this fade sits on — drives the label and reads only as semantic. */
  edge: 'top' | 'bottom';
  /** Only shown — and only clickable — while content overflows this edge. */
  visible: boolean;
  onClick: () => void;
  /** Page-specific gradient, position, height, z, and transition classes. */
  className?: string;
  style?: CSSProperties;
}

/**
 * The standard top/bottom scroll gradient, upgraded from a decorative overlay
 * into a tap target: clicking the fade smooth-scrolls the container to that
 * edge. Non-interactive and out of the tab order while hidden so it never
 * intercepts clicks on the content underneath.
 *
 * The caller owns the visual classes (gradient direction, insets, height) so
 * each surface keeps its existing look; this component only adds the shared
 * interaction + visibility behaviour.
 */
export function ScrollFadeEdge({ edge, visible, onClick, className, style }: ScrollFadeEdgeProps) {
  return (
    <button
      type="button"
      aria-label={edge === 'top' ? 'Scroll to top' : 'Scroll to bottom'}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      style={style}
      className={clsx(
        className,
        visible ? 'opacity-100 pointer-events-auto cursor-pointer' : 'opacity-0 pointer-events-none',
      )}
    />
  );
}
