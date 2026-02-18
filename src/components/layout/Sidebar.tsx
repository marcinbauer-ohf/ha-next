'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { MdiIcon } from '../ui/MdiIcon';
import { Tooltip } from '../ui/Tooltip';
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

export function Sidebar() {
  const pathname = usePathname();
  const { items, loading } = useSidebarItems();
  const { searchOpen, toggleSearch } = useSearchContext();
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

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

  return (
    <aside className="hidden lg:flex flex-col items-center w-16 py-ha-2 h-full" data-component="Sidebar">
      {/* Logo - links to home dashboard */}
      <Link href="/" className="h-12 flex items-center justify-center mb-ha-4">
        <HALogo size={32} />
      </Link>

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
              .filter(item => item && item.urlPath !== '/')
              .sort((a, b) => {
                // Dashboards first, then apps
                if (a.isApp === b.isApp) return 0;
                return a.isApp ? 1 : -1;
              })
              .map((item) => {
                if (!item) return null;
                const isActive = pathname === item.urlPath ||
                  (item.urlPath !== '/' && pathname?.startsWith(item.urlPath));
                const palette = item.isApp ? getAppPalette(item.id) : null;

                return (
                  <Tooltip key={item.id} content={item.title} placement="right">
                    <Link
                      href={item.urlPath}
                      scroll={false}
                      className={clsx(
                        'w-12 h-12 flex-shrink-0 rounded-ha-xl transition-colors flex items-center justify-center',
                        isActive
                           ? (item.isApp ? 'bg-ha-blue' : 'bg-fill-primary-normal')
                           : (item.isApp && palette ? palette.bg : 'hover:bg-surface-low')
                      )}
                    >
                      <MdiIcon
                        icon={item.icon || (item.isApp ? 'mdi:application' : 'mdi:view-dashboard')}
                        size={24}
                        className={clsx(
                          isActive
                            ? item.isApp ? 'text-white' : 'text-ha-blue'
                            : item.isApp && palette ? palette.text : 'text-text-secondary'
                        )}
                      />
                    </Link>
                  </Tooltip>
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
    </aside>
  );
}
