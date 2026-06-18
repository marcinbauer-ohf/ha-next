'use client';

import type { ReactNode } from 'react';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext } from '@/contexts';
import { useDesktopImmersivePageLayout } from '@/hooks';
import { ApplicationViewNotice } from './ApplicationViewNotice';
import { ImmersiveDogEar } from './ImmersiveDogEar';
import { ScreensaverDogEar } from './ScreensaverDogEar';

interface AppSurfacePageProps {
  children: ReactNode;
  scrollClassName?: string;
}

export function AppSurfacePage({ children, scrollClassName = '' }: AppSurfacePageProps) {
  const { isRevealed } = usePullToRevealContext();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  return (
    <>
      <PullToRevealPanel />
      <div
        className={`min-h-0 overflow-hidden ${
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
        } ${contentPaddingClasses} ${contentTransitionClasses}`}
        style={contentStyle}
      >
        {/* Static surface-lower backdrop (paints instantly, no enter animation)
            sitting behind the animating surface. Without it the surface fades in
            from opacity 0 and briefly reveals the shell's surface-default behind
            it — a contrast flash on every page switch (most visible leaving the
            full-bleed settings workspace). Matching colour + rounding here means
            the fade reveals the same colour, so the transition reads as smooth. */}
        <div className={`relative h-full bg-surface-lower overflow-hidden ${surfaceRoundingClass}`}>
          <div id="app-surface-root" className={`ha-surface-enter relative h-full bg-surface-lower overflow-hidden ${surfaceRoundingClass}`}>
            <ImmersiveDogEar />
            <ScreensaverDogEar />
            <div
              className="h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide"
              data-scrollable="dashboard"
            >
              <main
                className={`px-ha-3 pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:px-0 lg:pt-ha-5 lg:pb-ha-5 ${scrollClassName}`}
              >
                <ApplicationViewNotice />
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
