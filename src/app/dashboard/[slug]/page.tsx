'use client';

import { use, useEffect } from 'react';
import { PullToRevealPanel } from '@/components/sections';
import { useSidebarItems } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = use(params);
  const { items } = useSidebarItems();
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();

  // Find the dashboard info
  const dashboard = items.find(
    item => item.type === 'dashboard' && item.urlPath === `/dashboard/${slug}`
  );

  const title = dashboard?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title, icon: dashboard?.icon ?? undefined });
  }, [setHeader, title, dashboard?.icon]);


  return (
    <>
      {/* TopBar row - rendered by AppShell */}

      {/* Pull to reveal - drag handle between TopBar and dashboard (Mobile only) */}
      <PullToRevealPanel />

      {/* Main content row - shrinks as panel expands */}
      <div className={`min-h-0 overflow-hidden px-edge mt-[calc(var(--ha-space-1)*(1-var(--mobile-ui-hidden-padding,0)))] pt-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] pb-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] lg:mt-0 lg:pt-0 lg:pb-ha-0 lg:pr-edge transition-all duration-300 ease-out ${
        isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
      }`}>
        <div className="h-full bg-surface-lower overflow-hidden rounded-ha-3xl">
          <div className="h-full overflow-y-auto px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5" data-scrollable="dashboard">
            <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
              {/* Skeleton cards grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-surface-low rounded-ha-xl p-ha-3 space-y-ha-2">
                    <div className="flex items-center gap-ha-2">
                      <div className="w-10 h-10 rounded-full bg-surface-lower" />
                      <div className="flex-1 space-y-ha-1">
                        <div className="h-3 bg-surface-lower rounded-full w-3/4" />
                        <div className="h-2 bg-surface-lower rounded-full w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Skeleton section */}
              <div className="mt-ha-6">
                <div className="h-4 bg-surface-low rounded-full w-32 mb-ha-3" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-surface-low rounded-ha-xl p-ha-4 space-y-ha-3">
                      <div className="flex justify-between items-center">
                        <div className="h-3 bg-surface-lower rounded-full w-24" />
                        <div className="w-8 h-8 rounded-ha-lg bg-surface-lower" />
                      </div>
                      <div className="h-16 bg-surface-lower rounded-ha-lg" />
                      <div className="flex gap-ha-2">
                        <div className="h-2 bg-surface-lower rounded-full flex-1" />
                        <div className="h-2 bg-surface-lower rounded-full w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* More skeleton cards */}
              <div className="mt-ha-6">
                <div className="h-4 bg-surface-low rounded-full w-24 mb-ha-3" />
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-ha-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="bg-surface-low rounded-ha-xl p-ha-2 aspect-square flex flex-col items-center justify-center gap-ha-2">
                      <div className="w-8 h-8 rounded-full bg-surface-lower" />
                      <div className="h-2 bg-surface-lower rounded-full w-3/4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
