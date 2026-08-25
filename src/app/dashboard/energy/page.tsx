'use client';

import { useState, useEffect } from 'react';
import { NativeViewPlaceholder } from '@/components/layout/NativeViewPlaceholder';
import { CONTENT_EDGE, CONTENT_SHELL } from '@/lib/layout';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useDesktopImmersivePageLayout } from '@/hooks';
import { EnergyToolbar } from '@/components/layout/EnergyToolbar';
import type { EnergyPeriod } from '@/lib/energyPeriod';
import { mdiFlash } from '@mdi/js';

/**
 * Energy. The views themselves aren't built in here yet — the page shows the
 * same preview placeholder every unrendered dashboard does — but the period
 * navigator in the floating toolbar is real, and is what the views will read
 * once they land.
 */
export default function EnergyDashboardPage() {
  const { isRevealed } = usePullToRevealContext();
  // Which window the energy views will cover — driven by the floating toolbar.
  const [period, setPeriod] = useState<EnergyPeriod>('day');
  const [anchor, setAnchor] = useState(() => new Date());
  const [compare, setCompare] = useState(false);
  const { setHeader } = useHeader();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  useEffect(() => {
    setHeader({ title: 'Energy', icon: mdiFlash, contentGutter: true });
  }, [setHeader]);

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
          <div
            // Extra bottom room over the other dashboards: the floating period
            // toolbar sits in it.
            className={`h-full overflow-y-auto ${CONTENT_EDGE} pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(11rem+env(safe-area-inset-bottom,0px))] lg:pt-ha-5 lg:pb-28`}
            data-scrollable="dashboard"
          >
            <div className={CONTENT_SHELL}>
              <NativeViewPlaceholder title="Energy" icon={mdiFlash} urlPath="/energy" />
            </div>
          </div>
        </div>
      </div>

      <EnergyToolbar
        period={period}
        anchor={anchor}
        compare={compare}
        onPeriodChange={setPeriod}
        onAnchorChange={setAnchor}
        onCompareChange={setCompare}
      />
    </>
  );
}
