'use client';

import { useState, useEffect, useRef } from 'react';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { CONTENT_EDGE, CONTENT_SHELL } from '@/lib/layout';
import { NativeViewPlaceholder } from '@/components/layout/NativeViewPlaceholder';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useDesktopImmersivePageLayout, useScrollToEdges } from '@/hooks';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectChip } from '@/components/ui/SelectChip';
import { ScrollFadeEdge } from '@/components/ui/ScrollFadeEdge';
import { Icon } from '@/components/ui/Icon';
import { mdiFlash, mdiChartBoxOutline, mdiChartLine, mdiSolarPower, mdiCalendarClock } from '@mdi/js';

// The dashboard's tabs. Content is intentionally empty for now — these just
// switch which (as-yet-unbuilt) energy view you're looking at.
type EnergyTab = 'overview' | 'usage' | 'production';

const ENERGY_TABS = [
  { value: 'overview' as EnergyTab, label: 'Overview', icon: <Icon path={mdiChartBoxOutline} size={16} /> },
  { value: 'usage' as EnergyTab, label: 'Usage', icon: <Icon path={mdiChartLine} size={16} /> },
  { value: 'production' as EnergyTab, label: 'Production', icon: <Icon path={mdiSolarPower} size={16} /> },
];

// Date-range filter — same SelectChip control the tables use for sort/group.
const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
];

export default function EnergyDashboardPage() {
  const { isRevealed } = usePullToRevealContext();
  const [activeTab, setActiveTab] = useState<EnergyTab>('overview');
  const [dateRange, setDateRange] = useState('today');
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const { scrollToTop, scrollToBottom } = useScrollToEdges(scrollableRef);
  const { setHeader } = useHeader();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  useEffect(() => {
    setHeader({ title: 'Energy', icon: mdiFlash, contentGutter: true });
  }, [setHeader]);

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10;
      setShowTopGradient(scrollTop > threshold);

      const hasOverflow = scrollHeight > clientHeight + threshold;
      setShowBottomGradient(hasOverflow && scrollTop + clientHeight < scrollHeight - threshold);
    };

    updateGradients();
    scrollElement.addEventListener('scroll', updateGradients, { passive: true });
    window.addEventListener('resize', updateGradients);

    return () => {
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
    };
  }, []);

  const dateLabel = DATE_RANGES.find((r) => r.id === dateRange)?.label ?? 'Today';

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
        <div className={`h-full bg-surface-lower overflow-hidden relative ${surfaceRoundingClass}`}>
          <ImmersiveDogEar />
          <ScreensaverDogEar />
          {/* Top + bottom scroll fades — always mounted, opacity-driven (the
              standard pattern; top fade is desktop-only like the other pages). */}
          <ScrollFadeEdge edge="top" visible={showTopGradient} onClick={scrollToTop} className="hidden lg:block absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
          <ScrollFadeEdge edge="bottom" visible={showBottomGradient} onClick={scrollToBottom} className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
          <div
            ref={(el) => { scrollableRef.current = el; }}
            className={`h-full overflow-y-auto overscroll-none touch-pan-y relative ${CONTENT_EDGE} pt-[var(--app-topbar-clear)] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pt-ha-5 lg:pb-ha-5`}
            data-scrollable="dashboard"
          >
            {/* One wrapper for controls + content, matching the home dashboard's
                bounds (max-w-1536, lg:pl-14 lg:pr-ha-8) so the tabs line up with
                the content exactly like the home summary/tips do. */}
            <div className={CONTENT_SHELL}>

              {/* Controls row — sticky on mobile. Tabs (grouped button) on the
                  left, date-range filter on the right, wrapping on narrow widths. */}
              <div
                className="sticky top-0 pt-ha-2 pb-ha-4 z-30"
                style={{ background: 'linear-gradient(to bottom, var(--ha-color-surface-lower) 65%, transparent)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-ha-2">
                  <SegmentedControl segments={ENERGY_TABS} value={activeTab} onChange={setActiveTab} />
                  <SelectChip
                    icon={mdiCalendarClock}
                    prefix="Date"
                    valueLabel={dateLabel}
                    options={DATE_RANGES}
                    selectedId={dateRange}
                    onSelect={setDateRange}
                    align="right"
                  />
                </div>
              </div>

              {/* Tab content — intentionally empty for now: the standard dashboard
                  empty state until the energy views are wired up. */}
              <ApplicationViewNotice />
              <NativeViewPlaceholder title="Energy" icon={mdiFlash} urlPath="/energy" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
