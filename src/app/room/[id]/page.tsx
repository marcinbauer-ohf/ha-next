'use client';

import { use, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { mdiArrowLeft } from '@mdi/js';
import { clsx } from 'clsx';
import Link from 'next/link';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { CONTENT_EDGE, CONTENT_SHELL } from '@/lib/layout';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { PullToRevealPanel } from '@/components/sections';
import { DeviceSectionsView, DeviceGridSkeleton, AreaSummaryRow, type DeviceSection } from '@/components/sections';
import { Icon } from '@/components/ui/Icon';
import { ScrollIndexRail } from '@/components/ui/ScrollIndexRail';
import { ScrollFadeEdge } from '@/components/ui/ScrollFadeEdge';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useDevices, useAreasFloors, useDesktopImmersivePageLayout, useFeatureFlags, useFastScrollLabels, useIdleMarquee, useSectionCrumb, useScrollToEdges } from '@/hooks';
import { AreaEditorModal } from '@/components/areas/AreaEditorModal';
import { entityDomain, SECTION_ORDER, SECTION_TITLES, domainTypeIcon } from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';
import type { HassEntities } from '@/types';

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

  const areaName = areas.get(id) ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // The top bar's pencil edits what this page is about: the area itself.
  const { areas: areaEntries, floors, labels, editable, updateArea } = useAreasFloors();
  const area = useMemo(() => areaEntries.find(a => a.area_id === id) ?? null, [areaEntries, id]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  useEffect(() => {
    setHeader({
      title: areaName,
      subtitle: 'Home',
      contentGutter: true,
      editAction: area ? { label: `${areaName} settings`, onClick: openSettings } : undefined,
    });
  }, [setHeader, areaName, area, openSettings]);

  // Devices in this area, grouped into sections by device type
  const sections = useMemo(
    () => groupByType(devices.filter(d => d.areaId === id)),
    [devices, id],
  );
  const deviceCount = useMemo(() => sections.reduce((n, s) => n + s.devices.length, 0), [sections]);

  // What the summary chips above the grid read: this room's entities, keyed the
  // same way the entity store is, so every summary helper works unchanged.
  const areaEntities = useMemo(() => {
    const scoped: HassEntities = {};
    for (const device of devices) {
      if (device.areaId !== id) continue;
      for (const entity of device.entities) scoped[entity.entity_id] = entity;
    }
    return scoped;
  }, [devices, id]);

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
              className={`h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide select-none ${CONTENT_EDGE} pt-[calc(var(--app-topbar-clear)+var(--ha-space-4))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pt-ha-5 lg:pb-ha-5`}
              data-scrollable="dashboard"
            >
              <div className={CONTENT_SHELL}>
                <ApplicationViewNotice />

                {!loading && (
                  <AreaSummaryRow
                    entities={areaEntities}
                    areaName={areaName}
                    areaSensors={{ temperature: area?.temperature_entity_id, humidity: area?.humidity_entity_id }}
                  />
                )}

                {loading && <DeviceGridSkeleton />}

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
              sections={sections.map(s => ({ key: s.key, title: s.title, icon: domainTypeIcon(s.key), href: s.href }))}
              enabled={scrollIndexEnabled && !loading}
            />
          </div>
        </div>
      </div>

      <AreaEditorModal
        open={settingsOpen}
        initial={area}
        floors={floors}
        labels={labels}
        editable={editable}
        onClose={() => setSettingsOpen(false)}
        onSubmit={async (draft) => {
          if (!area) return;
          await updateArea(area.area_id, {
            name: draft.name.trim(),
            icon: draft.icon,
            floor_id: draft.floor_id,
            aliases: draft.aliases,
            labels: draft.labels,
            temperature_entity_id: draft.temperature_entity_id,
            humidity_entity_id: draft.humidity_entity_id,
          });
        }}
      />
    </>
  );
}
