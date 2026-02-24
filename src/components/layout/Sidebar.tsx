'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { MdiIcon } from '../ui/MdiIcon';
import { HALogo } from '../ui/HALogo';
import { useSidebarItems } from '@/hooks';
import { useSearchContext } from '@/contexts';
import { mdiMagnify } from '@mdi/js';
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

const formatTooltipLabel = (label: string) =>
  label
    .split(/\s+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(' ');

export function Sidebar({ onNavigate }: { onNavigate?: (href: string) => void } = {}) {
  const pathname = usePathname();
  const { items, loading } = useSidebarItems();
  const { searchOpen, toggleSearch } = useSearchContext();

  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const hoveredItemRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hideTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [tooltip, setTooltip] = useState({
    content: '',
    top: 0,
    left: 0,
    visible: false,
  });

  const clearHideTooltipTimeout = () => {
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = null;
    }
  };

  const getTooltipPosition = (trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 132;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 34;
    const spacing = 8;

    let top = rect.top + rect.height / 2 - tooltipHeight / 2;
    let left = rect.right + spacing;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tooltipWidth > viewportWidth - 8) left = viewportWidth - tooltipWidth - 8;
    if (top < 8) top = 8;
    if (top + tooltipHeight > viewportHeight - 8) top = viewportHeight - tooltipHeight - 8;

    return { top, left };
  };

  const showTooltip = (trigger: HTMLElement, content: string) => {
    clearHideTooltipTimeout();
    hoveredItemRef.current = trigger;
    const nextPosition = getTooltipPosition(trigger);

    setTooltip((prev) => ({
      ...prev,
      content,
      top: nextPosition.top,
      left: nextPosition.left,
      visible: true,
    }));
  };

  const hideTooltipSoon = () => {
    clearHideTooltipTimeout();
    hideTooltipTimeoutRef.current = setTimeout(() => {
      hoveredItemRef.current = null;
      setTooltip((prev) => ({ ...prev, visible: false }));
      hideTooltipTimeoutRef.current = null;
    }, 90);
  };

  const hideTooltipNow = () => {
    clearHideTooltipTimeout();
    hoveredItemRef.current = null;
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10;

      // Show top gradient if scrolled down from the top
      setShowTopGradient(scrollTop > threshold);

      // Show bottom gradient if there's more content below
      setShowBottomGradient(scrollTop + clientHeight < scrollHeight - threshold);
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
  }, [items, loading]);

  useEffect(() => {
    const updateTooltipPosition = () => {
      if (!hoveredItemRef.current) return;
      const nextPosition = getTooltipPosition(hoveredItemRef.current);
      setTooltip((prev) => ({ ...prev, top: nextPosition.top, left: nextPosition.left }));
    };

    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearHideTooltipTimeout();
    };
  }, []);

  return (
    <aside
      className="hidden lg:flex flex-col items-center w-16 py-ha-2 h-full"
      data-component="Sidebar"
      onMouseLeave={hideTooltipNow}
    >
      {/* Search */}
      <button
        onClick={toggleSearch}
        className={`p-ha-3 rounded-ha-xl transition-colors mb-ha-4 ${
          searchOpen ? 'bg-fill-primary-normal text-ha-blue' : 'hover:bg-surface-low text-text-secondary'
        }`}
      >
        <Icon path={mdiMagnify} size={24} />
      </button>

      {/* All items listed one-by-one with scroll gradients */}
      <div className="flex-1 relative w-full min-h-0 mask-linear-fade flex flex-col items-center">
        {/* Top gradient */}
        <div 
          className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
            showTopGradient ? 'opacity-100' : 'opacity-0'
          }`} 
        />

        <div 
          ref={scrollableRef}
          onScroll={() => {
            const el = scrollableRef.current;
            if (el) {
              const { scrollTop, scrollHeight, clientHeight } = el;
              setShowTopGradient(scrollTop > 0);
              setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 1);
            }
          }}
          className="h-full w-full flex flex-col items-center gap-ha-2 overflow-y-auto scrollbar-hide py-2"
        >
          {/* ... existing list items mapping ... */}
          {loading ? (
            // Loading placeholders
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="w-12 h-12 flex-shrink-0 rounded-ha-xl bg-surface-low animate-pulse" />
              ))}
            </>
          ) : (
            (items || [])
              .filter(item => !!item)
              .sort((a, b) => {
                // Home first, then other dashboards, then apps
                if (a.urlPath === '/') return -1;
                if (b.urlPath === '/') return 1;
                if (a.isApp === b.isApp) return 0;
                return a.isApp ? 1 : -1;
              })
              .map((item) => {
                if (!item) return null;
                const isHome = item.urlPath === '/';
                const isActive = pathname === item.urlPath ||
                  (!isHome && item.urlPath !== '/' && pathname?.startsWith(item.urlPath));
                const palette = item.isApp ? getAppPalette(item.id) : null;

                return (
                  <Link
                    key={item.id}
                    href={item.urlPath}
                    scroll={false}
                    onClick={onNavigate ? (event) => {
                      event.preventDefault();
                      onNavigate(item.urlPath);
                    } : undefined}
                    onMouseEnter={(event) => showTooltip(event.currentTarget, formatTooltipLabel(item.title))}
                    onMouseLeave={hideTooltipSoon}
                    className={clsx(
                      'w-12 h-12 flex-shrink-0 rounded-ha-xl transition-colors flex items-center justify-center',
                      isActive
                         ? (item.isApp ? 'bg-ha-blue' : 'bg-fill-primary-normal')
                         : (item.isApp && palette ? palette.bg : 'hover:bg-surface-low'),
                      item.isApp && 'ha-app-icon-shell',
                      item.isApp && isActive && 'ha-app-icon-shell-active'
                    )}
                  >
                    {isHome ? (
                      <HALogo size={26} />
                    ) : (
                      <MdiIcon
                        icon={item.icon || (item.isApp ? 'mdi:application' : 'mdi:view-dashboard')}
                        size={24}
                        className={clsx(
                          isActive
                            ? item.isApp ? 'text-white' : 'text-ha-blue'
                            : item.isApp && palette ? palette.text : 'text-text-secondary',
                          item.isApp && 'ha-app-icon-glyph'
                        )}
                      />
                    )}
                  </Link>
                );
              })
          )}
        </div>

        {/* Bottom gradient */}
        <div 
          className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
            showBottomGradient ? 'opacity-100' : 'opacity-0'
          }`} 
        />
      </div>

      {typeof document !== 'undefined' && tooltip.content && createPortal(
        <div
          ref={tooltipRef}
          className={clsx(
            'fixed z-[200] px-ha-2 py-ha-1 bg-surface-default border border-surface-lower rounded-ha-lg shadow-lg shadow-black/20 pointer-events-none text-xs text-text-primary whitespace-nowrap font-medium transition-[top,left,opacity,transform] duration-120 ease-out',
            tooltip.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
          style={{
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
          }}
        >
          {tooltip.content}
        </div>,
        document.body
      )}
    </aside>
  );
}
