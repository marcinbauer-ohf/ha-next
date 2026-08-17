'use client';

import type { ReactNode } from 'react';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useMobileToolbar } from '@/contexts';
import { useDesktopImmersivePageLayout } from '@/hooks';
import { CONTENT_EDGE } from '@/lib/layout';
import { ApplicationViewNotice } from './ApplicationViewNotice';
import { DashboardEditBorder } from './DashboardEditBorder';
import { ImmersiveDogEar } from './ImmersiveDogEar';
import { ScreensaverDogEar } from './ScreensaverDogEar';

interface AppSurfacePageProps {
  children: ReactNode;
  scrollClassName?: string;
}

export function AppSurfacePage({ children, scrollClassName = '' }: AppSurfacePageProps) {
  const { isRevealed } = usePullToRevealContext();
  // An editor toolbar mounted on this surface (automation editor, areas & floors)
  // gets the same focus treatment as dashboard edit mode: accent border here,
  // dimmed shell chrome in AppShell.
  const { toolbarActive } = useMobileToolbar();
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
              {/* Bottom pad clears the mobile nav pill. This surface only renders on
                settings routes, where MobileNav collapses its activity row and drag
                handle (pill ≈ 86px tall vs 148px elsewhere) — so 3rem keeps the same
                scroll-under tuck the 7rem pad gives dashboard pages. */}
            <main
                className={`${CONTENT_EDGE} pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(3rem+env(safe-area-inset-bottom,0px))] lg:pt-ha-5 lg:pb-ha-5 ${scrollClassName}`}
              >
                <ApplicationViewNotice />
                {children}
              </main>
            </div>
            {/* z-40 layer: the node-graph canvas portals into this root at z-30,
                so the border would otherwise be painted over by it. */}
            <div className="absolute inset-0 z-40 pointer-events-none">
              <DashboardEditBorder active={toolbarActive} roundedClassName={surfaceRoundingClass} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
