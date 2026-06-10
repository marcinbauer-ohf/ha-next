'use client';

import { useCallback, useRef } from 'react';

interface LongPressOptions {
  /** Hold duration before firing, in ms. */
  delay?: number;
  /** Movement (px) that cancels the hold — treats it as a scroll/drag instead. */
  moveTolerance?: number;
}

/**
 * Press-and-hold detector for touch + mouse + pen, plus right-click.
 *
 * Returns handlers to spread onto the element. `fire()` runs once the hold
 * survives `delay` without moving past `moveTolerance`. After a hold fires, the
 * next `consume()` returns true (and resets), so the element's own onClick can
 * swallow the trailing click (e.g. suppress navigation). Right-click is left to
 * the consumer (wire your own onContextMenu).
 */
export function useLongPress(fire: () => void, options: LongPressOptions = {}) {
  const { delay = 450, moveTolerance = 10 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const consumedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const start = useCallback(
    (x: number, y: number) => {
      clear();
      consumedRef.current = false;
      startRef.current = { x, y };
      timerRef.current = setTimeout(() => {
        consumedRef.current = true;
        timerRef.current = null;
        fire();
      }, delay);
    },
    [clear, delay, fire]
  );

  const move = useCallback(
    (x: number, y: number) => {
      const origin = startRef.current;
      if (!origin) return;
      if (Math.abs(x - origin.x) > moveTolerance || Math.abs(y - origin.y) > moveTolerance) {
        clear();
      }
    },
    [clear, moveTolerance]
  );

  /** True if a hold just fired (consuming the pending click); resets the flag. */
  const consume = useCallback(() => {
    if (!consumedRef.current) return false;
    consumedRef.current = false;
    return true;
  }, []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      // Ignore right-click; the consumer wires its own onContextMenu.
      if (e.button === 2) return;
      start(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => move(e.clientX, e.clientY),
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };

  return { handlers, consume, clear };
}
