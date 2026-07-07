'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseIdleTimerOptions {
  timeout: number; // in milliseconds
  onIdle?: () => void;
  onActive?: () => void;
}

export function useIdleTimer({ timeout, onIdle, onActive }: UseIdleTimerOptions) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Mirror of isIdle readable from the stable resetTimer callback. Depending on
  // the state directly would recreate resetTimer when idle fires, re-running the
  // listener effect — which restarts the timer and bounces isIdle back to false,
  // so onIdle would re-fire every `timeout` ms for as long as the user is away
  // (and onActive would fire with no activity at all).
  const isIdleRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  const onActiveRef = useRef(onActive);

  // Keep refs updated
  useEffect(() => {
    onIdleRef.current = onIdle;
    onActiveRef.current = onActive;
  }, [onIdle, onActive]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      onActiveRef.current?.();
    }

    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
      onIdleRef.current?.();
    }, timeout);
  }, [timeout]);

  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'touchmove',
      'wheel',
    ];

    // Start the timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]);

  const wake = useCallback(() => {
    if (isIdleRef.current) {
      resetTimer();
    }
  }, [resetTimer]);

  return { isIdle, wake, resetTimer };
}
