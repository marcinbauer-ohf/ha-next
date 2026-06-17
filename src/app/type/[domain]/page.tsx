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
import { useDevices, useDesktopImmersivePageLayout, useFeatureFlags } from '@/hooks';
import { entityDomain, SECTION_TITLES, AREA_ICON } from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

interface TypePageProps {
  params: Promise<{ domain: string }>;
}

export default function TypePage({ params }: TypePageProps) {
  const { domain } = use(params);
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { devices, areas, loading } = useDevices();
  const { scrollIndexEnabled } = useFeatureFlags();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  const scrollableRef = useRef<HTMLElement | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  const typeName = SECTION_TITLES[domain] ?? domain.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title: typeName, subtitle: 'Home' });
  }, [setHeader, typeName]);

  // Devices whose primary entity is of this domain, grouped into sections by area
  const sections = useMemo<DeviceSection[]>(() => {
    const matching = devices.filter(d => d.primaryEntity && entityDomain(d.primaryEntity) === domain);
    const byArea = new Map<string, HassDevice[]>();
    for (const device of matching) {
      const key = device.areaId ?? '__none__';
      if (!byArea.has(key)) byArea.set(key, []);
      byArea.get(key)!.push(device);
    }
    const out: DeviceSection[] = [];
    for (const [areaId, areaName] of areas) {
      if (byArea.has(areaId)) out.push({ key: areaId, title: areaName, href: `/room/${areaId}`, devices: byArea.get(areaId)! });
    }
    if (byArea.has('__none__')) out.push({ key: '__none__', title: 'Other', devices: byArea.get('__none__')! });
    return out;
  }, [devices, areas, domain]);

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
                    No {typeName.toLowerCase()} devices found.
                  </p>
                )}

                {!loading && deviceCount > 0 && <DeviceSectionsView sections={sections} />}
              </div>
            </main>

            <ScrollIndexRail
              scrollRef={scrollableRef}
              sections={sections.map(s => ({ key: s.key, title: s.title, icon: AREA_ICON }))}
              enabled={scrollIndexEnabled && !loading}
            />
          </div>
        </div>
      </div>
    </>
  );
}
