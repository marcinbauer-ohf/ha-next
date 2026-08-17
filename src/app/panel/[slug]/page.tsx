'use client';

import { use, useEffect } from 'react';
import { NativeViewPlaceholder } from '@/components/layout/NativeViewPlaceholder';
import { CONTENT_EDGE, CONTENT_SHELL } from '@/lib/layout';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { HaPageFrame } from '@/components/layout/HaPageFrame';
import { useDesktopImmersivePageLayout, useSidebarItems, useHomeAssistant } from '@/hooks';
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

  // Live instance only: demo mode has no instance to frame, so it keeps the
  // placeholder rather than showing someone else's home.
  const { haUrl, connected, demoMode } = useHomeAssistant();
  const embedSrc = connected && haUrl && !demoMode ? `${haUrl}/${slug}` : null;

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
          {/* The app's own screen from the connected instance. Only the frame
              scrolls — HA handles that inside — so no scroll container here. */}
          {embedSrc ? (
            <div className={`h-full ${CONTENT_EDGE} pt-[var(--app-topbar-clear)] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pt-ha-5 lg:pb-ha-5`}>
              <HaPageFrame src={embedSrc} title={title} />
            </div>
          ) : (
            <div className={`h-full overflow-y-auto ${CONTENT_EDGE} pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pt-ha-5 lg:pb-ha-5`} data-scrollable="dashboard">
              <div className={CONTENT_SHELL}>
                <NativeViewPlaceholder title={title} icon={panel?.icon ?? undefined} urlPath={`/${slug}`} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
