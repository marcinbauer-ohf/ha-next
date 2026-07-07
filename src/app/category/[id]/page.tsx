'use client';

import { use, useState, useEffect, useRef, useMemo } from 'react';
import { mdiArrowLeft } from '@mdi/js';
import { clsx } from 'clsx';
import Link from 'next/link';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { DeviceSectionsView, DeviceGridSkeleton, type DeviceSection } from '@/components/sections';
import { Icon } from '@/components/ui/Icon';
import { ScrollIndexRail } from '@/components/ui/ScrollIndexRail';
import { ScrollFadeEdge } from '@/components/ui/ScrollFadeEdge';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useDevices, useDesktopImmersivePageLayout, useFeatureFlags, useFastScrollLabels, useIdleMarquee, useSectionCrumb, useScrollToEdges } from '@/hooks';
import { entityCategory, CATEGORY_TITLES, AREA_ICON, type DeviceCategory } from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { id } = use(params);
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { devices, areas, loading } = useDevices();
  const { scrollIndexEnabled, fastScrollLabelsEnabled } = useFeatureFlags();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle, surfaceRoundingClass } = useDesktopImmersivePageLayout();

  const scrollableRef = useRef<HTMLElement | null>(null);
  const { scrollToTop, scrollToBottom } = useScrollToEdges(scrollableRef);
  // Prototype: big card-name overlay while flicking fast (see useFastScrollLabels).
  useFastScrollLabels(scrollableRef, fastScrollLabelsEnabled);
  // Truncated card names marquee while idle / scrolling slowly (see useIdleMarquee).
  useIdleMarquee(scrollableRef, true);
  // Section headers scroll away; the scrolled-past section's title reappears
  // in the top bar as a reversed breadcrumb (same pattern as the dashboard).
  useSectionCrumb(scrollableRef, !loading);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  const categoryName = CATEGORY_TITLES[id as DeviceCategory] ?? id.replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title: categoryName, subtitle: 'Home', contentGutter: true });
  }, [setHeader, categoryName]);

  // Devices whose primary entity belongs to this category, grouped into sections by area
  const sections = useMemo<DeviceSection[]>(() => {
    const matching = devices.filter(d => d.primaryEntity && entityCategory(d.primaryEntity) === id);
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
  }, [devices, areas, id]);

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
            {/* Top + bottom scroll fades. Top fade is desktop-only: on mobile
                the top bar's own gradient already fades the content. */}
            <ScrollFadeEdge edge="top" visible={showTopGradient} onClick={scrollToTop} className="hidden lg:block absolute top-0 left-14 right-14 h-12 bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />
            <ScrollFadeEdge edge="bottom" visible={showBottomGradient} onClick={scrollToBottom} className="absolute bottom-0 left-0 right-0 lg:left-14 lg:right-14 h-12 bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300" />


            {/* Back arrow — desktop left gutter. Dog-ear style: a persistent
                subtle edge gradient hints something's there; the icon itself
                only fades in on hover. */}
            <Link
              href="/"
              prefetch={false}
              aria-label="Back to Home"
              className="hidden lg:flex group absolute inset-y-0 left-0 w-14 z-10 items-center justify-center"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-9 rounded-l-ha-3xl bg-gradient-to-r from-text-tertiary/20 via-text-tertiary/[0.06] to-transparent opacity-70 transition-all duration-300 ease-out group-hover:w-14 group-hover:opacity-100"
              />
              <Icon
                path={mdiArrowLeft}
                size={16}
                className="relative text-text-secondary opacity-0 group-hover:opacity-100 group-hover:text-ha-blue group-hover:-translate-x-0.5 transition-all duration-300 ease-out"
              />
            </Link>

            <main
              ref={el => { scrollableRef.current = el; }}
              className="h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide select-none px-ha-3 pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:px-0 lg:pt-ha-5 lg:pb-ha-5"
              data-scrollable="dashboard"
            >
              <div className="max-w-[1536px] mx-auto lg:pl-14 lg:pr-ha-8 w-full">
                <ApplicationViewNotice />

                {loading && <DeviceGridSkeleton />}

                {!loading && deviceCount === 0 && (
                  <p className="text-sm text-text-secondary text-center py-ha-8">
                    No {categoryName.toLowerCase()} devices found.
                  </p>
                )}

                {!loading && deviceCount > 0 && <DeviceSectionsView sections={sections} />}
              </div>
            </main>

            <ScrollIndexRail
              scrollRef={scrollableRef}
              sections={sections.map(s => ({ key: s.key, title: s.title, icon: AREA_ICON, href: s.href }))}
              enabled={scrollIndexEnabled && !loading}
            />
          </div>
        </div>
      </div>
    </>
  );
}
