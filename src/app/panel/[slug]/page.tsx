'use client';

import { use, useEffect } from 'react';
import { PullToRevealPanel } from '@/components/sections';
import { useSidebarItems } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';

interface PanelPageProps {
  params: Promise<{ slug: string }>;
}

export default function PanelPage({ params }: PanelPageProps) {
  const { slug } = use(params);
  const { items } = useSidebarItems();
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();

  // Find the panel info
  const panel = items.find(
    item => item.type === 'panel' && item.urlPath === `/panel/${slug}`
  );

  const title = panel?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title, icon: panel?.icon ?? undefined });
  }, [setHeader, title, panel?.icon]);

  return (
    <>
      {/* TopBar row - rendered by AppShell */}

      {/* Pull to reveal - drag handle between TopBar and dashboard (Mobile only) */}
      <PullToRevealPanel />

      {/* Main content row - shrinks as panel expands */}
      <div className={`min-h-0 overflow-hidden px-edge pb-20 mt-1 lg:mt-0 lg:pb-ha-0 lg:pr-edge transition-all duration-300 ease-out ${
        isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
      }`}>
        <div className="h-full bg-surface-lower overflow-hidden rounded-ha-3xl">
          <div className="h-full overflow-y-auto px-ha-3 py-ha-4 lg:pl-14 lg:pr-ha-5 lg:py-ha-5" data-scrollable="dashboard">
            {/* Skeleton list items */}
            <div className="space-y-ha-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="bg-surface-low rounded-ha-xl p-ha-3 flex items-center gap-ha-3">
                  <div className="w-12 h-12 rounded-ha-lg bg-surface-lower flex-shrink-0" />
                  <div className="flex-1 space-y-ha-2">
                    <div className="h-3 bg-surface-lower rounded-full w-2/3" />
                    <div className="h-2 bg-surface-lower rounded-full w-1/3" />
                  </div>
                  <div className="w-16 h-8 rounded-ha-lg bg-surface-lower" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
