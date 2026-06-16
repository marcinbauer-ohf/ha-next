'use client';

import { useEffect, useRef, RefObject } from 'react';
import { usePullToRevealContext } from '@/contexts';
import { haptic } from '@/lib/haptics';

interface UsePullToRevealOptions {
  threshold?: number;
  maxPull?: number;
}

interface UsePullToRevealReturn {
  isPulling: boolean;
  pullDistance: number;
  isRevealed: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function usePullToReveal(
  handleRef: RefObject<HTMLElement | null>,
  options: UsePullToRevealOptions = {}
): UsePullToRevealReturn {
  const { threshold = 80, maxPull = 200 } = options;

  const {
    isPulling,
    pullDistance,
    isRevealed,
    open,
    close,
    toggle,
    setPulling,
    setPullDistance,
    setRevealed,
  } = usePullToRevealContext();

  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (isRevealed) {
        // When revealed, pull down to close
        if (diff > 0) {
          e.preventDefault();
          setPulling(true);
          setPullDistance(diff * 0.6);
        }
      } else {
        // When closed, pull down to open
        if (diff > 0) {
          e.preventDefault();
          setPulling(true);
          const resistance = 0.6;
          const resistedPull = Math.min(diff * resistance, maxPull);
          setPullDistance(resistedPull);
        } else {
          setPulling(false);
          setPullDistance(0);
        }
      }
    };

    const handleTouchEnd = () => {
      if (touchStartY.current === null) return;

      if (isRevealed) {
        // When revealed, check if we should close
        if (pullDistance >= threshold) {
          haptic('impact');
          setRevealed(false);
          setPullDistance(0);
        }
      } else {
        // When closed, check if we should reveal
        if (pullDistance >= threshold) {
          haptic('impact');
          setRevealed(true);
          setPullDistance(maxPull);
        } else {
          setPullDistance(0);
        }
      }

      setPulling(false);
      touchStartY.current = null;
    };

    handle.addEventListener('touchstart', handleTouchStart, { passive: true });
    handle.addEventListener('touchmove', handleTouchMove, { passive: false });
    handle.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', handleTouchStart);
      handle.removeEventListener('touchmove', handleTouchMove);
      handle.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleRef, threshold, maxPull, isRevealed, pullDistance, setPulling, setPullDistance, setRevealed]);

  return {
    isPulling,
    pullDistance,
    isRevealed,
    open,
    close,
    toggle,
  };
}
