'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useDesktopImmersivePageLayout, useEnergyMetrics, useScrollToEdges } from '@/hooks';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ScrollFadeEdge } from '@/components/ui/ScrollFadeEdge';
import { SectionLabel } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { PowerAttributionChart } from '@/components/sections';
import { mdiFlash, mdiChartLine, mdiPowerPlugOutline } from '@mdi/js';
import type { HassEntity } from '@/types';

type EnergyTab = 'now' | 'all';

const ENERGY_SEGMENTS = [
  { value: 'now' as EnergyTab, label: 'Now' },
  { value: 'all' as EnergyTab, label: 'All' },
];

function wattsOf(e: HassEntity): number {
  const v = parseFloat(e.state);
  if (!Number.isFinite(v)) return NaN;
  const unit = ((e.attributes.unit_of_measurement as string | undefined) ?? '').toLowerCase();
  return unit.startsWith('kw') ? v * 1000 : v;
}

function formatWatts(w: number): string {
  return w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`;
}

function sensorName(e: HassEntity): string {
  return (e.attributes.friendly_name as string | undefined) ?? e.entity_id.split('.')[1].replace(/_/g, ' ');
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-low rounded-ha-xl p-ha-3 h-24 flex flex-col justify-between">
      <span className="text-xs font-medium text-text-tertiary">{label}</span>
      <div className="min-w-0">
        <span className="text-xl font-semibold text-text-primary">{value}</span>
        {sub && <span className="ml-1 text-xs text-text-tertiary">{sub}</span>}
      </div>
    </div>
  );
}

function NowContent() {
  const { watts, kwhToday, meter, powerSensors } = useEnergyMetrics();

  // Per-device draw, meter excluded — the whole-home total isn't a "device".
  const activeDevices = useMemo(() => {
    return powerSensors
      .filter((e) => e.entity_id !== meter?.entity_id)
      .map((e) => ({ entity: e, watts: wattsOf(e) }))
      .filter((d) => Number.isFinite(d.watts) && d.watts > 0)
      .sort((a, b) => b.watts - a.watts)
      .slice(0, 8);
  }, [powerSensors, meter]);
  const maxDeviceWatts = activeDevices[0]?.watts ?? 0;

  return (
    <div className="space-y-ha-4">
      {/* Power attribution — meter curve with per-device on-spans overlaid */}
      <PowerAttributionChart />

      {/* Live breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-ha-3">
        <StatCard label="Current draw" value={watts != null ? formatWatts(watts) : '—'} />
        <StatCard label="Energy today" value={kwhToday != null ? kwhToday.toFixed(1) : '—'} sub={kwhToday != null ? 'kWh' : undefined} />
        <StatCard label="Power sensors" value={String(powerSensors.length)} />
        <StatCard
          label="Top consumer"
          value={activeDevices[0] ? formatWatts(activeDevices[0].watts) : '—'}
          sub={activeDevices[0] ? sensorName(activeDevices[0].entity) : undefined}
        />
      </div>

      {/* Active Devices — live power sensors, largest draw first */}
      <div>
        <SectionLabel className="mb-ha-2">Active Devices</SectionLabel>
        {activeDevices.length === 0 ? (
          <div className="bg-surface-low rounded-ha-xl p-ha-4 flex items-center gap-ha-3">
            <Icon path={mdiPowerPlugOutline} size={20} className="text-text-tertiary flex-shrink-0" />
            <p className="text-sm text-text-secondary">No devices are reporting power draw right now.</p>
          </div>
        ) : (
          <div className="space-y-ha-2">
            {activeDevices.map(({ entity, watts: w }) => (
              <div key={entity.entity_id} className="bg-surface-low rounded-ha-xl h-16 px-ha-4 flex items-center gap-ha-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate capitalize">{sensorName(entity)}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-lower overflow-hidden">
                    <div
                      className="h-full rounded-full bg-ha-blue/70"
                      style={{ width: `${maxDeviceWatts > 0 ? Math.max(4, (w / maxDeviceWatts) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-text-primary tabular-nums">{formatWatts(w)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AllContent() {
  // Long-term statistics need HA's recorder/statistics API, which this
  // prototype doesn't consume yet — say so instead of faking loading cards.
  return (
    <div className="flex flex-col items-center justify-center gap-ha-3 rounded-ha-2xl bg-surface-low px-ha-6 py-ha-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-ha-2xl bg-surface-lower text-text-tertiary">
        <Icon path={mdiChartLine} size={28} />
      </span>
      <p className="text-sm font-semibold text-text-primary">History isn&apos;t wired up yet</p>
      <p className="max-w-sm text-sm text-text-tertiary">
        Long-term consumption, production, and per-device statistics will come from Home Assistant&apos;s
        energy statistics. For live data, check the Now tab.
      </p>
    </div>
  );
}

export default function EnergyDashboardPage() {
  const { isRevealed } = usePullToRevealContext();
  const [activeTab, setActiveTab] = useState<EnergyTab>('now');
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
          <ScrollFadeEdge edge="top" visible={showTopGradient} onClick={scrollToTop} className="hidden lg:block absolute top-0 left-0 right-0 lg:left-14 lg:right-ha-5 h-12 bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
          <ScrollFadeEdge edge="bottom" visible={showBottomGradient} onClick={scrollToBottom} className="absolute bottom-0 left-0 right-0 lg:left-14 lg:right-ha-5 h-12 bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
          <div
            ref={(el) => { scrollableRef.current = el; }}
            className="h-full overflow-y-auto overscroll-none touch-pan-y relative px-ha-4 pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5"
            data-scrollable="dashboard"
          >

            {/* Tabs - sticky on mobile */}
            <div
              className="sticky top-[var(--app-topbar-clear)] lg:top-0 -mx-ha-3 px-ha-3 lg:-ml-14 lg:pl-14 lg:-mr-ha-5 lg:pr-ha-5 pt-ha-1 pb-ha-3 z-30"
              style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--ha-color-surface-lower) 80%, transparent), transparent)' }}
            >
              <SegmentedControl segments={ENERGY_SEGMENTS} value={activeTab} onChange={setActiveTab} />
            </div>

            {/* Tab content */}
            <div className="max-w-[1240px] mx-auto lg:px-0 w-full">
              <ApplicationViewNotice />
              {activeTab === 'now' ? <NowContent /> : <AllContent />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
