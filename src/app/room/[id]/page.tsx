'use client';

import { use, useState, useEffect, useRef, useMemo } from 'react';
import { mdiArrowLeft } from '@mdi/js';
import { clsx } from 'clsx';
import Link from 'next/link';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { DeviceSectionsView, type DeviceSection } from '@/components/sections';
import { Icon } from '@/components/ui/Icon';
import { HALoader } from '@/components/ui/HALoader';
import { ScrollIndexRail } from '@/components/ui/ScrollIndexRail';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useDevices, useDesktopImmersivePageLayout, useFeatureFlags, useFastScrollLabels } from '@/hooks';
import { entityDomain, SECTION_ORDER, SECTION_TITLES, domainTypeIcon } from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

// Group a device list into sections by primary-entity domain, in canonical order.
function groupByType(list: HassDevice[]): DeviceSection[] {
  const byDomain = new Map<string, HassDevice[]>();
  for (const device of list) {
    if (!device.primaryEntity) continue;
    const domain = entityDomain(device.primaryEntity);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(device);
  }
  const sections: DeviceSection[] = [];
  for (const domain of SECTION_ORDER) {
    if (byDomain.has(domain)) {
      sections.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, href: `/type/${domain}`, devices: byDomain.get(domain)! });
      byDomain.delete(domain);
    }
  }
  for (const [domain, devs] of byDomain) {
    sections.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, href: `/type/${domain}`, devices: devs });
  }
  return sections;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { devices, areas, loading } = useDevices();
  const { scrollIndexEnabled, fastScrollLabelsEnabled } = useFeatureFlags();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  const scrollableRef = useRef<HTMLElement | null>(null);
  // Prototype: big card-name overlay while flicking fast (see useFastScrollLabels).
  useFastScrollLabels(scrollableRef, fastScrollLabelsEnabled);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  const areaName = areas.get(id) ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title: areaName, subtitle: 'Home' });
  }, [setHeader, areaName]);

  // Devices in this area, grouped into sections by device type
  const sections = useMemo(
    () => groupByType(devices.filter(d => d.areaId === id)),
    [devices, id],
  );
  const deviceCount = useMemo(() => sections.reduce((n, s) => n + s.devices.length, 0), [sections]);

  useEffect(() => {
    const el = scrollableRef.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTopGradient(scrollTop > 10);
      setShowBottomGradient(scrollHeight > clientHeight + 10 && scrollTop + clientHeight < scrollHeight - 10);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach(child => ro.observe(child));
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); ro.disconnect(); };
  }, [loading]);

  return (
    <>
      <PullToRevealPanel />

      <div
        className={clsx(
          'min-h-0 overflow-hidden',
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1',
          contentPaddingClasses,
          contentTransitionClasses,
        )}
        style={contentStyle}
      >
        <div className="h-full flex">
          <div className={`flex-1 min-w-0 bg-surface-lower overflow-hidden relative ${surfaceRoundingClass}`}>
            <ImmersiveDogEar />
            <ScreensaverDogEar />
            {/* Bottom scroll fade. (Top fade lives inside <main> below so it sits
                under the sticky section headers instead of over them.) */}
            <div className={clsx('absolute bottom-0 left-0 right-0 lg:left-14 lg:right-14 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300', showBottomGradient ? 'opacity-100' : 'opacity-0')} />

            {/* Back arrow — desktop left gutter */}
            <Link
              href="/"
              prefetch={false}
              className="hidden lg:flex group absolute inset-y-0 left-0 w-14 z-10 items-center justify-center"
            >
              <div className="absolute inset-0 rounded-l-ha-3xl bg-gradient-to-r from-transparent to-transparent group-hover:from-ha-blue/[0.06] group-hover:to-transparent transition-all duration-500 delay-0 group-hover:delay-150" />
              <Icon
                path={mdiArrowLeft}
                size={16}
                className="relative opacity-15 group-hover:opacity-100 group-hover:text-ha-blue group-hover:-translate-x-0.5 transition-all duration-500 delay-0 group-hover:delay-150 text-text-primary"
              />
            </Link>

            <main
              ref={el => { scrollableRef.current = el; }}
              className="h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide select-none px-ha-3 pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:px-0 lg:pt-ha-5 lg:pb-ha-5"
              data-scrollable="dashboard"
            >
              {/* Top scroll fade hangs off each sticky section header (in
                  DeviceSectionsView) so it tracks the pinned header. */}
              <div className="max-w-[1536px] mx-auto lg:px-ha-8 w-full">
                <ApplicationViewNotice />

                {loading && <HALoader className="mb-ha-5" />}

                {!loading && deviceCount === 0 && (
                  <p className="text-sm text-text-secondary text-center py-ha-8">
                    No devices in this area.
                  </p>
                )}

                {!loading && deviceCount > 0 && <DeviceSectionsView sections={sections} />}
              </div>
            </main>

            <ScrollIndexRail
              scrollRef={scrollableRef}
              sections={sections.map(s => ({ key: s.key, title: s.title, icon: domainTypeIcon(s.key) }))}
              enabled={scrollIndexEnabled && !loading}
            />
          </div>
        </div>
      </div>
    </>
  );
}
