'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MdiIcon } from '../ui/MdiIcon';
import { HALogo } from '../ui/HALogo';
import { useSidebarItems } from '@/hooks';
import { usePullToRevealContext } from '@/contexts';
import { clsx } from 'clsx';

const appPalettes = [
  { bg: 'bg-[var(--ha-color-fill-primary-normal)]', text: 'text-ha-blue' },
  { bg: 'bg-[var(--ha-color-fill-danger-normal)]', text: 'text-red-600' },
  { bg: 'bg-[var(--ha-color-fill-success-normal)]', text: 'text-green-600' },
  { bg: 'bg-[var(--ha-color-yellow-95)]', text: 'text-yellow-600' },
];

const getAppPalette = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % appPalettes.length;
  return appPalettes[index];
};

export function PullToRevealPanel() {
  const pathname = usePathname();
  const { items } = useSidebarItems();
  const {
    pullDistance,
    isRevealed,
    isPulling,
    close: onClose,
    setPulling,
    setPullDistance,
    setRevealed,
  } = usePullToRevealContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const threshold = 80;
  const maxPull = 200;
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  // Refs for overscroll tracking (persists across effect re-runs)
  const overscrollStartY = useRef<number | null>(null);
  const overscrollStartX = useRef<number | null>(null);
  const overscrollStartedAtTop = useRef(false);
  const overscrollIsTracking = useRef(false);
  const pullDistanceRef = useRef(pullDistance);
  const isRevealedRef = useRef(isRevealed);
  const isPullingRef = useRef(isPulling);
  const handleIsActive = useRef(false); // Track when handle is being dragged

  // Keep refs in sync with state
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRevealedRef.current = isRevealed;
  }, [isRevealed]);

  useEffect(() => {
    isPullingRef.current = isPulling;
  }, [isPulling]);

  // Touch event handlers for the drag handle
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      handleIsActive.current = true;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (isRevealedRef.current) {
        // When revealed, dragging up closes the panel
        if (diff < 0) {
          e.preventDefault();
          setPulling(true);
          setPullDistance(Math.abs(diff));
        }
      } else {
        // When closed, dragging down opens the panel
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

      const currentPullDistance = pullDistanceRef.current;
      const revealed = isRevealedRef.current;

      if (revealed) {
        if (currentPullDistance >= threshold) {
          setRevealed(false);
        }
        setPullDistance(0);
      } else {
        if (currentPullDistance >= threshold) {
          setRevealed(true);
          setPullDistance(maxPull);
        } else {
          setPullDistance(0);
        }
      }

      setPulling(false);
      touchStartY.current = null;
      handleIsActive.current = false;
    };

    // Add listeners directly to handle with non-passive touchstart for better control
    handle.addEventListener('touchstart', handleTouchStart, { passive: false });
    handle.addEventListener('touchmove', handleTouchMove, { passive: false });
    handle.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', handleTouchStart);
      handle.removeEventListener('touchmove', handleTouchMove);
      handle.removeEventListener('touchend', handleTouchEnd);
    };
  }, [threshold, maxPull, setPulling, setPullDistance, setRevealed]);

  // Overscroll detection on dashboard - open panel when pulling down at top
  useEffect(() => {
    const handle = handleRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      // Skip if handle is being used
      if (handleIsActive.current) return;

      // Skip if touch originated from the handle
      if (handle && handle.contains(e.target as Node)) {
        return;
      }

      const scrollable = document.querySelector('[data-scrollable="dashboard"]') as HTMLElement;

      if (isRevealedRef.current) {
        // When panel is open, track touches anywhere to close
        overscrollStartY.current = e.touches[0].clientY;
        overscrollIsTracking.current = true;
        // Reset stale pull distance from the opening gesture (but only if not using handle)
        if (!handleIsActive.current) {
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
        return;
      }

      if (!scrollable) return;

      // Check if we're at the top when touch starts
      if (scrollable.scrollTop <= 0) {
        overscrollStartY.current = e.touches[0].clientY;
        overscrollStartX.current = e.touches[0].clientX;
        overscrollStartedAtTop.current = true;
        overscrollIsTracking.current = true;
      } else {
        overscrollStartedAtTop.current = false;
        overscrollIsTracking.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Skip if handle is being used
      if (handleIsActive.current) return;
      // Skip if touch originated from the handle
      if (handle && handle.contains(e.target as Node)) return;
      if (!overscrollIsTracking.current || overscrollStartY.current === null || overscrollStartX.current === null) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const pullDelta = currentY - overscrollStartY.current;
      const deltaX = Math.abs(currentX - overscrollStartX.current);

      // Check for horizontal dominance or buffer if not already pulling
      if (!isPullingRef.current) {
        // If scrolling horizontally more than vertically, stop tracking
        if (deltaX > Math.abs(pullDelta)) {
          overscrollIsTracking.current = false;
          return;
        }
        
        // BUFFER: Ignore small vertical movements (e.g. < 10px) to prevent accidental pulls
        if (Math.abs(pullDelta) < 10) {
          return;
        }
      }

      if (isRevealedRef.current) {
        // When revealed, pulling down closes
        if (pullDelta > 0) {
          e.preventDefault();
          setPulling(true);
          setPullDistance(pullDelta * 0.5);
        }
      } else if (overscrollStartedAtTop.current) {
        // When closed and started at top, pulling down opens
        if (pullDelta > 0) {
          e.preventDefault();
          setPulling(true);
          const resistance = 0.5;
          // Apply buffer to smoothen the start
          const effectivePull = Math.max(0, pullDelta - 10);
          const resistedPull = Math.min(effectivePull * resistance, maxPull);
          setPullDistance(resistedPull);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Skip if handle is being used
      if (handleIsActive.current) return;
      // Skip if touch originated from the handle
      if (handle && handle.contains(e.target as Node)) return;
      if (!overscrollIsTracking.current) return;

      const currentPullDistance = pullDistanceRef.current;
      const revealed = isRevealedRef.current;

      if (revealed) {
        // When revealed, close if pulled enough
        if (currentPullDistance > threshold) {
          setRevealed(false);
        }
        setPullDistance(0);
        setPulling(false);
      } else {
        // When closed, open if pulled enough
        if (currentPullDistance >= threshold) {
          setRevealed(true);
          setPullDistance(maxPull);
        } else {
          setPullDistance(0);
        }
        setPulling(false);
      }

      overscrollStartY.current = null;
      overscrollStartX.current = null;
      overscrollStartedAtTop.current = false;
      overscrollIsTracking.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [threshold, maxPull, setPulling, setPullDistance, setRevealed]);

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement || !isRevealed) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10; // Small threshold to account for rounding

      // Show top gradient if scrolled down from the top
      setShowTopGradient(scrollTop > threshold);

      // Show bottom gradient if there's more content below AND we have overflow
      const hasOverflow = scrollHeight > clientHeight + threshold;
      setShowBottomGradient(hasOverflow && scrollTop + clientHeight < scrollHeight - threshold);
    };

    // Check on mount and when content changes
    updateGradients();

    // Listen to scroll events
    scrollElement.addEventListener('scroll', updateGradients);

    // Also check on resize
    window.addEventListener('resize', updateGradients);

    return () => {
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
    };
  }, [isRevealed]);

    // Separate dashboards and apps
    const dashboards = items.filter(item => !item.isApp);
    const apps = items.filter(item => item.isApp);

    // Height includes content + handle bar area
    const handleHeight = 12;

    // When pulling to close (revealed + pulling), shrink based on pull distance
    // When revealed normally, use flex-1
    // When opening, use pull distance
    const getHeight = () => {
      if (isRevealed && isPulling && pullDistance > 0) {
        // Shrinking while closing - use calc to reduce from full height
        return `calc(100% - ${pullDistance}px)`;
      }
      if (isRevealed) return '100%';
      if (pullDistance > 0) {
        return `${pullDistance + handleHeight}px`;
      }
      return `${handleHeight}px`;
    };

    return (
      <div
        ref={containerRef}
        className={`lg:hidden overflow-hidden transition-[height] duration-300 ease-out ${isRevealed ? 'flex-1' : ''}`}
        style={{ height: getHeight() }}
      >
        <div className={`h-full flex flex-col ${isRevealed ? 'pb-[calc(50px+env(safe-area-inset-bottom,0px))]' : 'justify-end'}`}>
          {/* Expandable content area - only visible when revealed */}
          {isRevealed ? (
            <div className="flex-1 flex flex-col mx-0 bg-surface-default border-b border-surface-lower shadow-xl overflow-hidden relative">
                {/* Scroll gradients */}
                {showTopGradient && (
                  <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-b from-surface-default via-surface-default/60 to-transparent z-20 transition-opacity duration-300" />
                )}
                {showBottomGradient && (
                  <div className="absolute bottom-ha-5 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-surface-default via-surface-default/60 to-transparent z-20 transition-opacity duration-300" />
                )}
                <div
                  ref={scrollableRef}
                  className="flex-1 overflow-y-auto"
                >
                  {/* Dashboards section */}
                  <div className="p-ha-3">
                    <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-ha-3">Dashboards</div>
                    <div className="grid grid-cols-3 gap-ha-3">
                      {dashboards.map((dashboard) => (
                        <Link
                          key={dashboard.id}
                          href={dashboard.urlPath}
                          onClick={onClose}
                          className="flex flex-col group"
                        >
                          {/* Mobile aspect ratio preview card */}
                          <div className="w-full aspect-[3/4] bg-surface-lower rounded-ha-xl overflow-hidden">
                            {/* Placeholder content */}
                            <div className="p-ha-2 space-y-ha-1">
                              <div className="h-2 bg-surface-low rounded-full w-full" />
                              <div className="h-2 bg-surface-low rounded-full w-3/4" />
                              <div className="h-3 bg-surface-low rounded-ha-lg w-full mt-ha-2" />
                              <div className="h-3 bg-surface-low rounded-ha-lg w-full" />
                            </div>
                          </div>
                          {/* Icon and name below card - left aligned */}
                          <div className="flex items-center gap-ha-1 mt-ha-1">
                            {dashboard.icon ? (
                              <MdiIcon
                                icon={dashboard.icon}
                                size={24}
                                className="text-text-secondary flex-shrink-0"
                              />
                            ) : (
                              <HALogo size={24} />
                            )}
                            <span className="text-[10px] text-text-secondary truncate">{dashboard.title}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border-default mx-ha-3" />

                  {/* Applications section */}
                  <div className="p-ha-3">
                    <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-ha-2">Applications</div>
                    <div className="flex flex-wrap gap-ha-1">
                      {apps.map((app) => {
                        const isActive = pathname === app.urlPath ||
                          (app.urlPath !== '/' && pathname.startsWith(app.urlPath));
                        const palette = getAppPalette(app.id);

                        return (
                          <Link
                            key={app.id}
                            href={app.urlPath}
                            onClick={onClose}
                            className="p-ha-1 rounded-ha-xl hover:bg-surface-low transition-colors flex items-center justify-center"
                            title={app.title}
                          >
                            {/* App-style icon with rounded background */}
                            <div className={clsx(
                              'w-10 h-10 rounded-ha-xl flex items-center justify-center transition-colors',
                              isActive ? 'bg-ha-blue' : palette.bg
                            )}>
                              <MdiIcon
                                icon={app.icon || 'mdi:application'}
                                size={22}
                                className={isActive ? 'text-white' : 'text-text-secondary'}
                              />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Drag handle bar - inside the content surface with larger margin */}
                <div
                  ref={handleRef}
                  className="flex justify-center py-ha-2 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
                >
                  <div className="w-8 h-1 rounded-full bg-text-secondary/60" />
                </div>
            </div>
          ) : (
            /* Drag handle bar - standalone when collapsed */
            <div
              ref={handleRef}
              className="flex justify-center py-1 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
            >
              <div className="w-8 h-1 rounded-full bg-text-secondary/60" />
            </div>
          )}
        </div>
      </div>
    );
}
