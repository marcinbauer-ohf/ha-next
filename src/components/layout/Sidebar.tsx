'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { MdiIcon } from '../ui/MdiIcon';
import { HALogo } from '../ui/HALogo';
import { useSidebarItems } from '@/hooks';
import { useSearchContext } from '@/contexts';
import { mdiMagnify } from '@mdi/js';

export function Sidebar() {
  const pathname = usePathname();
  const { items, loading } = useSidebarItems();
  const { searchOpen, toggleSearch } = useSearchContext();
  const scrollableRef = useRef<HTMLElement | null>(null);
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
    <aside className="hidden lg:flex flex-col items-center w-16 bg-surface-default py-ha-3 h-full" data-component="Sidebar">
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
      <div className="flex-1 relative w-full min-h-0">
        {/* Top gradient */}
        <div 
          className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
            showTopGradient ? 'opacity-100' : 'opacity-0'
          }`} 
        />

        <nav 
          ref={scrollableRef}
          className="h-full w-full flex flex-col items-center gap-ha-2 overflow-y-auto scrollbar-hide"
        >
          {loading ? (
            // Loading placeholders
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="w-12 h-12 flex-shrink-0 rounded-ha-xl bg-surface-low animate-pulse" />
              ))}
            </>
          ) : (
            [...items]
              .filter(item => item.urlPath !== '/')
              .sort((a, b) => {
                // Dashboards first, then apps
                if (a.isApp === b.isApp) return 0;
                return a.isApp ? 1 : -1;
              })
              .map((item) => {
              const isActive = pathname === item.urlPath ||
                (item.urlPath !== '/' && pathname.startsWith(item.urlPath));

              return (
                <Link
                  key={item.id}
                  href={item.urlPath}
                  scroll={false}
                  className={`w-12 h-12 flex-shrink-0 rounded-ha-xl transition-colors flex items-center justify-center ${
                    item.isApp
                      ? isActive ? 'bg-ha-blue' : 'bg-surface-lower'
                      : isActive ? 'bg-fill-primary-normal' : 'hover:bg-surface-low'
                  }`}
                  title={item.title}
                >
                  <MdiIcon
                    icon={item.icon || (item.isApp ? 'mdi:application' : 'mdi:view-dashboard')}
                    size={24}
                    className={item.isApp
                      ? isActive ? 'text-white' : 'text-text-secondary'
                      : isActive ? 'text-ha-blue' : 'text-text-secondary'
                    }
                  />
                </Link>
              );
            })
          )}
        </nav>

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
