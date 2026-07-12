'use client';

import { use, useEffect } from 'react';
import { NativeViewPlaceholder } from '@/components/layout/NativeViewPlaceholder';
import { CONTENT_SHELL } from '@/lib/layout';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { DashboardEditBorder } from '@/components/layout';
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
    setHeader({ title, icon: dashboard?.icon ?? undefined, contentGutter: true });
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
        <div className={`relative h-full bg-surface-lower overflow-hidden ${surfaceRoundingClass}`}>
          <ImmersiveDogEar />
          <ScreensaverDogEar />
          {/* Blue accent border fades in around the surface while editing */}
          <DashboardEditBorder roundedClassName={surfaceRoundingClass} />
          <div
            className="h-full overflow-y-auto px-ha-4 pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:px-0 lg:pt-ha-5 lg:pb-ha-5"
            data-scrollable="dashboard"
          >
            <div className={CONTENT_SHELL}>
              <NativeViewPlaceholder title={title} icon={dashboard?.icon ?? undefined} urlPath={`/${slug}`} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
