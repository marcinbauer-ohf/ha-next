'use client';

import { use, useEffect } from 'react';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { PullToRevealPanel } from '@/components/sections';
import { useDesktopImmersivePageLayout, useSidebarItems } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = use(params);
  const { items } = useSidebarItems();
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  const dashboard = items.find(
    item => item.type === 'dashboard' && item.urlPath === `/dashboard/${slug}`
  );
  const title = dashboard?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title, icon: dashboard?.icon ?? undefined });
  }, [setHeader, title, dashboard?.icon]);

  return (
    <>
      <PullToRevealPanel />

      <div
        className={`min-h-0 overflow-hidden ${
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
        } ${contentPaddingClasses} ${contentTransitionClasses}`}
        style={contentStyle}
      >
        <div className={`h-full bg-surface-lower overflow-hidden ${surfaceRoundingClass}`}>
          <div
            className="h-full overflow-y-auto px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5"
            data-scrollable="dashboard"
          >
            <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
              <ApplicationViewNotice />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
