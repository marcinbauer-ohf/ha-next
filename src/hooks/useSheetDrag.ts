'use client';

import { useCallback, useRef, useState } from 'react';

interface UseSheetDragOptions {
  /** Called when the drag passes the dismiss threshold on release. */
  onClose: () => void;
  /** Downward travel (px) that triggers a close on release. */
  threshold?: number;
  /** Downward flick speed (px/ms) that triggers a close regardless of travel. */
  velocity?: number;
  /** Skip drag entirely (e.g. the desktop, non-sheet variant). */
  disabled?: boolean;
}

/**
 * Pointer-drag-to-dismiss for CSS-transition bottom sheets (the ones that
 * toggle `translate-y-full` on a `visible` flag rather than framer-motion).
 *
 * While dragging we drive an inline `translateY` and kill the transition so the
 * sheet tracks the finger 1:1. On release we clear the inline style — the
 * element's own CSS transition then animates it back to rest (snap-back) or,
 * once `onClose` flips the sheet's `visible` flag, out to `translate-y-full`
 * (dismiss). No hard jump either way. Only downward travel counts.
 */
export function useSheetDrag({ onClose, threshold = 110, velocity = 0.6, disabled = false }: UseSheetDragOptions) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const offsetRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);
  const velRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    // Primary pointer only; let interactive children (close button, links) work.
    if (e.button != null && e.button > 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTRef.current = e.timeStamp;
    velRef.current = 0;
    offsetRef.current = 0;
    setDragging(true);
    setOffset(0);
  }, [disabled]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    const next = Math.max(0, e.clientY - startYRef.current);
    const dt = e.timeStamp - lastTRef.current;
    if (dt > 0) velRef.current = (e.clientY - lastYRef.current) / dt;
    lastYRef.current = e.clientY;
    lastTRef.current = e.timeStamp;
    offsetRef.current = next;
    setOffset(next);
  }, []);

  const end = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    pointerIdRef.current = null;
    const shouldClose = offsetRef.current > threshold || velRef.current > velocity;
    setDragging(false);
    setOffset(0);
    offsetRef.current = 0;
    if (shouldClose) onClose();
  }, [onClose, threshold, velocity]);

  const handleProps = disabled
    ? {}
    : {
        onPointerDown,
        onPointerMove,
        onPointerUp: end,
        onPointerCancel: end,
      };

  // Applied to the sliding panel. While dragging, follow the finger with the
  // transition off; otherwise return nothing so the panel's own classes drive it.
  const dragStyle: React.CSSProperties = dragging
    ? { transform: `translateY(${offset}px)`, transition: 'none' }
    : {};

  return { handleProps, dragStyle, dragging, offset };
}
