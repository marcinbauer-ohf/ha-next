'use client';

import type { ReactNode } from 'react';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext } from '@/contexts';
import { useDesktopImmersivePageLayout } from '@/hooks';
import { ApplicationViewNotice } from './ApplicationViewNotice';

interface AppSurfacePageProps {
  children: ReactNode;
  scrollClassName?: string;
}

export function AppSurfacePage({ children, scrollClassName = '' }: AppSurfacePageProps) {
  const { isRevealed } = usePullToRevealContext();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle } = useDesktopImmersivePageLayout();

  return (
    <>
      <PullToRevealPanel />
      <div
        className={`min-h-0 overflow-hidden ${
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1'
        } ${contentPaddingClasses} ${contentTransitionClasses}`}
        style={contentStyle}
      >
        <div className="h-full bg-surface-lower overflow-hidden rounded-ha-3xl">
          <div
            className="h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide"
            data-scrollable="dashboard"
          >
            <main
              className={`px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5 ${scrollClassName}`}
            >
              <ApplicationViewNotice />
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
