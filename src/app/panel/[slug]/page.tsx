'use client';

import { use, useEffect } from 'react';
import { NativeViewPlaceholder } from '@/components/layout/NativeViewPlaceholder';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { useDesktopImmersivePageLayout, useSidebarItems } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';

interface PanelPageProps {
  params: Promise<{ slug: string }>;
}

export default function PanelPage({ params }: PanelPageProps) {
  const { slug } = use(params);
  const { items } = useSidebarItems();
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  // Find the panel info
  const panel = items.find(
    item => item.type === 'panel' && item.urlPath === `/panel/${slug}`
  );

  const title = panel?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title, icon: panel?.icon ?? undefined, contentGutter: true });
  }, [setHeader, title, panel?.icon]);


  return (
    <>
      {/* TopBar row - rendered by AppShell */}

      {/* Pull to reveal - drag handle between TopBar and dashboard (Mobile only) */}
      <PullToRevealPanel />

      {/* Main content row - shrinks as panel expands */}
      <div
        className={`min-h-0 overflow-hidden ${
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
        } ${contentPaddingClasses} ${contentTransitionClasses}`}
        style={contentStyle}
      >
        <div className={`relative h-full bg-surface-lower overflow-hidden ${surfaceRoundingClass}`}>
          <ImmersiveDogEar />
          <ScreensaverDogEar />
          <div className="h-full overflow-y-auto px-ha-4 pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:px-0 lg:pt-ha-5 lg:pb-ha-5" data-scrollable="dashboard">
            <div className="max-w-[1536px] mx-auto lg:pl-14 lg:pr-ha-8 w-full">
              <NativeViewPlaceholder title={title} icon={panel?.icon ?? undefined} urlPath={`/${slug}`} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
