'use client';

import { useCallback, useEffect, useMemo, useRef, useState, CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { mdiHomeAssistant, mdiChevronRight, mdiViewGrid, mdiCube, mdiAutoFix, mdiClose, mdiAccessPointNetwork } from '@mdi/js';
import { clsx } from 'clsx';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const DashboardFloorView = dynamic(() => import('@/components/sections/DashboardFloorView'), { ssr: false });
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { MobileSummaryRow } from '@/components/sections';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { PullToRevealPanel } from '@/components/sections';
import { useTheme, useImmersiveMode, useHomeAssistant, useDevices, useDeviceCardConfig } from '@/hooks';
import { usePullToRevealContext, useHeader, useEditMode, useToast } from '@/contexts';
import { Icon } from '@/components/ui/Icon';
import { HALoader } from '@/components/ui/HALoader';
import {
  entityDomain, friendlyName, entityLabel, stateLabel, isOn, TOGGLEABLE,
  domainIcon, SECTION_ORDER, SECTION_TITLES,
} from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

// ── Section ───────────────────────────────────────────────────────────────────

// Section only renders the sticky header; the grid is provided as children by the caller
function Section({ title, count, href, children }: { title: string; count: number; href?: string; children: React.ReactNode }) {
  if (count === 0) return null;

  return (
    <div>
      <div className="py-ha-2 mb-ha-1">
        {href ? (
          <Link href={href} prefetch={false} className="flex items-center gap-1 group w-fit">
            <span className="text-base font-semibold text-text-primary group-hover:text-ha-blue transition-colors">{title}</span>
            <Icon path={mdiChevronRight} size={16} className="text-text-tertiary group-hover:text-ha-blue transition-colors" />
          </Link>
        ) : (
          <span className="text-base font-semibold text-text-primary">{title}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function applyDeviceOrder(devices: HassDevice[], order?: string[]): HassDevice[] {
  if (!order?.length) return devices;
  const map = new Map(devices.map(d => [d.id, d]));
  const sorted = order.flatMap(id => map.has(id) ? [map.get(id)!] : []);
  const extra = devices.filter(d => !order.includes(d.id));
  return [...sorted, ...extra];
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Use translate-only transform (no scaleX/scaleY) to prevent distortion on
  // displaced cards that have overflow-hidden + border-radius compositing.
  const translateTransform = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: translateTransform,
        transition: isDragging ? 'none' : transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
        willChange: transform ? 'transform' : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function useMasonryCols() {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const update = () => setCols(window.innerWidth >= 1024 ? 3 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

export default function DashboardPage() {
  const { background } = useTheme();
  const masonryCols = useMasonryCols();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();
  const router = useRouter();
  const scrollableRef = useRef<HTMLElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [dashboardView, setDashboardView] = useState<'list' | '3d'>('list');
  const { isRevealed } = usePullToRevealContext();
  const { isEditing, toggleEditMode, previewViewport } = useEditMode();

  const gridCols = isEditing
    ? previewViewport === 'desktop' ? 'grid-cols-4'
    : previewViewport === 'tablet'  ? 'grid-cols-3'
    :                                  'grid-cols-2'
    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  const [sectionOrders, setSectionOrders] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('ha_device_order') ?? '{}'); }
    catch { return {}; }
  });

  const handleSectionReorder = useCallback((sectionKey: string, newIds: string[]) => {
    setSectionOrders(prev => {
      const next = { ...prev, [sectionKey]: newIds };
      localStorage.setItem('ha_device_order', JSON.stringify(next));
      return next;
    });
  }, []);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const { setHeader } = useHeader();
  const { toggleEntity, haUrl } = useHomeAssistant();
  const { showToast } = useToast();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');

  const { devices, areas, areaReg, floors, loading } = useDevices();
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'area' | 'type'>(() => {
    if (typeof window === 'undefined') return 'area';
    return (localStorage.getItem('ha_group_by') as 'area' | 'type') ?? 'area';
  });
  const { getConfig, setConfig } = useDeviceCardConfig();

  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ha_onboarding_v1') === 'done';
  });

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('ha_onboarding_v1', 'done');
    setOnboardingDismissed(true);
  }, []);

  const autoConfigureDevices = useCallback(() => {
    let count = 0;
    for (const device of devices) {
      if (!device.primaryEntity) continue;
      const existing = getConfig(device.id);
      if (existing.slots.length > 0) continue;
      const primary = device.primaryEntity;
      const others = device.entities.filter(e =>
        e.entity_id !== primary.entity_id &&
        e.state !== 'unavailable' &&
        e.state !== 'unknown'
      );
      const secondaries = others
        .filter(e => ['sensor', 'binary_sensor'].includes(e.entity_id.split('.')[0]))
        .slice(0, 2);
      setConfig(device.id, {
        slots: [
          { entity_id: primary.entity_id, size: 'lg', section: 'primary' },
          ...secondaries.map(e => ({ entity_id: e.entity_id, size: 'sm' as const, section: 'secondary' as const })),
        ],
      });
      count++;
    }
    dismissOnboarding();
    showToast({
      icon: mdiAutoFix,
      title: 'Auto-configured',
      subtitle: count > 0 ? `${count} device${count === 1 ? '' : 's'} set up` : 'No new devices to configure',
    });
  }, [devices, getConfig, setConfig, dismissOnboarding, showToast]);

  const handleSwitchTo3D = useCallback(() => {
    if (floors.length >= 1 && activeFloorId === null) {
      setActiveFloorId(floors[0].floor_id);
    }
    setDashboardView('3d');
  }, [floors, activeFloorId]);

  useEffect(() => {
    setHeader({ title: 'Home' });
  }, [setHeader]);

  // Demo: surface a simulated "new device detected" event as a corner toast
  // (bottom-right of the dashboard). Random one-shot for now — placeholder until
  // wired to real HA discovery / notification events.
  useEffect(() => {
    if (loading) return;
    const candidates = [
      'Living Room Speaker',
      'Hallway Motion Sensor',
      'Kitchen Smart Plug',
      'Bedroom Light Strip',
      'Front Door Lock',
      'Garage Temperature Sensor',
    ];
    const delay = 8000 + Math.random() * 12000; // 8–20s after load
    const timer = setTimeout(() => {
      const name = candidates[Math.floor(Math.random() * candidates.length)];
      showToast({
        icon: mdiAccessPointNetwork,
        title: 'New device detected',
        subtitle: name,
        position: 'bottom-right',
        action: { label: 'Set up', onClick: () => {} },
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [loading, showToast]);

  // Dashboard entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setDashboardReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Keyboard shortcut — immersive mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggleImmersiveMode(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleImmersiveMode]);

  // Scroll gradients — re-measured on scroll, resize, and content-size changes
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
    // Content height changes (devices load, masonry reflow, view switch) must re-measure.
    // Observe the scroll container AND every child — the tall card content is the
    // last child, so observing only firstElementChild misses growth.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach(child => ro.observe(child));
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [loading, dashboardView]);

  // Track sticky header height so section headers stick just below it
  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--dashboard-sticky-top',
        `${entry.contentRect.height}px`,
      );
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // area_id → floor_id lookup
  const areaFloorMap = useMemo<Map<string, string | null>>(
    () => new Map(areaReg.map(a => [a.area_id, a.floor_id ?? null])),
    [areaReg],
  );

  // Devices on the active floor — applies in BOTH area and type modes
  const floorDevices = useMemo(() => {
    if (!activeFloorId || floors.length < 2) return devices;
    return devices.filter(d => areaFloorMap.get(d.areaId ?? '') === activeFloorId);
  }, [devices, activeFloorId, floors, areaFloorMap]);

  const sections = useMemo(() => {
    type Sec = { key: string; title: string; devices: HassDevice[]; isArea: boolean };
    const ordered: Sec[] = [];

    if (areas.size > 0 && groupBy === 'area') {
      const byArea = new Map<string, HassDevice[]>();
      for (const device of floorDevices) {
        const key = device.areaId ?? '__none__';
        if (!byArea.has(key)) byArea.set(key, []);
        byArea.get(key)!.push(device);
      }
      for (const [areaId, areaName] of areas) {
        if (byArea.has(areaId)) ordered.push({ key: areaId, title: areaName, devices: byArea.get(areaId)!, isArea: true });
      }
      if (byArea.has('__none__')) ordered.push({ key: '__none__', title: 'Other', devices: byArea.get('__none__')!, isArea: true });
    } else {
      const byDomain = new Map<string, HassDevice[]>();
      for (const device of floorDevices) {
        if (!device.primaryEntity) continue;
        const domain = entityDomain(device.primaryEntity);
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain)!.push(device);
      }
      for (const domain of SECTION_ORDER) {
        if (byDomain.has(domain)) {
          ordered.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, devices: byDomain.get(domain)!, isArea: false });
          byDomain.delete(domain);
        }
      }
      for (const [domain, devs] of byDomain) {
        ordered.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, devices: devs, isArea: false });
      }
    }
    return ordered;
  }, [floorDevices, areas, groupBy]);

  const visibleSections = sections;

  const selectedDevice = useMemo(
    () => devices.find(d => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );
  // All visible entities for the selected device in stable order — panel uses this as its list
  const allPanelEntities = useMemo(() => {
    if (!selectedDevice) return [];
    const config = getConfig(selectedDevice.id);
    const visibleIds = config.slots.length === 0
      ? selectedDevice.entities.slice(0, 1).map(e => e.entity_id) // default: primary only
      : config.slots.filter(s => s.section === 'primary' || s.section === 'secondary').map(s => s.entity_id);
    return visibleIds.flatMap(id => {
      const e = selectedDevice.entities.find(ent => ent.entity_id === id);
      if (!e) return [];
      const dom = entityDomain(e);
      const isToggleable = TOGGLEABLE.has(dom);
      const isPressable = ['button', 'script', 'automation', 'input_button'].includes(dom);
      return [{
        entityId: e.entity_id,
        icon: domainIcon(e),
        name: entityLabel(e, selectedDevice.name),
        state: stateLabel(e),
        active: isOn(e),
        toggleable: isToggleable,
        pressable: isPressable,
        unit: (e.attributes.unit_of_measurement as string | undefined) ?? undefined,
        entityPicture: (() => { const p = e.attributes.entity_picture as string | undefined; return p ? (p.startsWith('http') ? p : `${haUrl}${p}`) : undefined; })(),
        onToggle: (isToggleable || isPressable) ? () => toggleEntity(e.entity_id, e.state) : undefined,
      }];
    });
  }, [selectedDevice, getConfig, toggleEntity]);

  function selectEntity(deviceId: string, entityId: string) {
    setSelectedDeviceId(deviceId);
    setSelectedEntityId(entityId);
    setPanelMode('entity');
  }
  function selectDeviceForEdit(deviceId: string) {
    setSelectedDeviceId(deviceId);
    setSelectedEntityId(null);
    setPanelMode('edit');
  }
  function closePanel() {
    setSelectedDeviceId(null);
    setSelectedEntityId(null);
    setPanelMode('entity');
  }

  const isImmersiveFixed = immersivePhase !== 'normal';
  const isMobileImmersive = immersiveMode && !isImmersiveFixed;

  const statusBarHeight = 'calc(var(--ha-space-2) + 48px + var(--ha-edge-padding))';
  const compensatingPadding = {
    paddingLeft: 'calc(2 * var(--ha-edge-padding) + 64px)',
    paddingTop: 'calc(var(--ha-edge-padding) + 64px)',
    paddingRight: 'var(--ha-edge-padding)',
    paddingBottom: 0,
  };
  const expandedPadding = {
    paddingLeft: 'var(--ha-edge-padding)',
    paddingTop: 'var(--ha-edge-padding)',
    paddingRight: 'var(--ha-edge-padding)',
    paddingBottom: 0,
  };

  const contentStyle: CSSProperties = isImmersiveFixed ? {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: statusBarHeight, zIndex: 5, margin: 0, overflow: 'hidden',
    ...(immersivePhase === 'expanded' ? { ...expandedPadding, transition: 'padding 300ms ease-out' }
      : { ...compensatingPadding, transition: immersivePhase === 'preparing' ? 'none' : 'padding 300ms ease-out' }),
  } : {};

  const contentPaddingClasses = isImmersiveFixed
    ? ''
    : isMobileImmersive
      ? 'pb-0 lg:px-edge lg:pb-ha-0 lg:pr-edge'
      : 'px-edge pt-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] pb-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] lg:pt-0 lg:pb-ha-0 lg:pr-edge';

  return (
    <>
      <PullToRevealPanel />

      <div
        className={clsx(
          'min-h-0 overflow-hidden',
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1',
          contentPaddingClasses,
          immersivePhase === 'normal' ? 'transition-[flex,height,opacity,padding] duration-300 ease-out lg:transition-[flex,height,opacity]' : '',
        )}
        style={contentStyle}
      >
        <div className="h-full flex">
          {/* Dashboard surface */}
          <div
            className={clsx(
              'flex-1 min-w-0 overflow-hidden transition-[opacity,transform,border-radius,background-color] duration-500 ease-out relative',
              dashboardReady ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.9]',
              isMobileImmersive ? 'bg-surface-lower rounded-none lg:rounded-ha-3xl' : 'bg-surface-lower rounded-ha-3xl',
            )}
          >
            {background !== 'image' && background !== 'gradient' && (
              <>
                <div className={clsx(
                  'absolute top-0 left-0 right-0 lg:left-0 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300',
                  showTopGradient ? 'opacity-100' : 'opacity-0',
                )} />
                <div className={clsx(
                  'absolute bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300',
                  showBottomGradient ? 'opacity-100' : 'opacity-0',
                )} />
              </>
            )}

            <main
              ref={el => { scrollableRef.current = el; }}
              className={clsx(
                'h-full overscroll-none touch-pan-y scrollbar-hide select-none',
                dashboardView === '3d' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto',
                dashboardView !== '3d' && 'pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-ha-5',
                isMobileImmersive ? 'px-ha-5' : 'px-ha-3',
                'lg:px-0',
              )}
              data-scrollable="dashboard"
            >
              {/* Sticky header: summary badges + optional floor tabs */}
              <div ref={stickyHeaderRef} className={clsx('z-[60]', dashboardView !== '3d' && 'sticky top-0')}>
                <MobileSummaryRow
                  fullBleed={isMobileImmersive}
                  noSticky
                  extraContent={
                    <div className="flex items-center gap-ha-2 min-w-0">
                      {/* Floors — scrollable when many, takes remaining width on the left */}
                      {floors.length >= 2 && (
                        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide -mx-ha-1 px-ha-1">
                          <SegmentedControl
                            segments={[
                              { value: '__all__', label: 'All' },
                              ...floors.map(f => ({ value: f.floor_id, label: f.name })),
                            ]}
                            value={activeFloorId ?? '__all__'}
                            onChange={v => setActiveFloorId(v === '__all__' ? null : v)}
                            className="w-max"
                          />
                        </div>
                      )}
                      {/* Room/Type — pinned to the right edge */}
                      {areas.size > 0 && (
                        <SegmentedControl
                          className="shrink-0 ml-auto"
                          segments={[
                            { value: 'area', label: 'Room' },
                            { value: 'type', label: 'Type' },
                          ]}
                          value={groupBy}
                          onChange={v => {
                            const next = v as 'area' | 'type';
                            localStorage.setItem('ha_group_by', next);
                            setGroupBy(next);
                          }}
                        />
                      )}
                      {/* 3D view toggle — hidden until home model is ready
                      <div className="ml-auto inline-flex items-center bg-surface-mid rounded-ha-xl p-[3px] gap-[2px]">
                        <button
                          onClick={() => setDashboardView('list')}
                          className={clsx(
                            'flex items-center justify-center w-8 h-7 rounded-ha-lg transition-all duration-200',
                            dashboardView === 'list'
                              ? 'bg-surface-default text-text-primary shadow-sm'
                              : 'text-text-secondary hover:text-text-primary',
                          )}
                          aria-label="List view"
                        >
                          <Icon path={mdiViewGrid} size={16} />
                        </button>
                        <button
                          onClick={handleSwitchTo3D}
                          className={clsx(
                            'flex items-center justify-center w-8 h-7 rounded-ha-lg transition-all duration-200',
                            dashboardView === '3d'
                              ? 'bg-surface-default text-text-primary shadow-sm'
                              : 'text-text-secondary hover:text-text-primary',
                          )}
                          aria-label="3D view"
                        >
                          <Icon path={mdiCube} size={16} />
                        </button>
                      </div>
                      */}
                    </div>
                  }
                />
              </div>

              {dashboardView === '3d' ? (
                <div className="flex-1 min-h-0">
                  <DashboardFloorView
                    sections={visibleSections}
                    onRoomClick={key => { if (key !== '__none__') router.push(`/room/${key}`); }}
                  />
                </div>
              ) : (
                <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full space-y-ha-6">
                  <ApplicationViewNotice />

                  {/* Onboarding banner — shown once on first connect */}
                  {!loading && devices.length > 0 && !onboardingDismissed && (
                    <div className="rounded-ha-2xl bg-ha-blue/8 border border-ha-blue/15 p-ha-4 flex items-start gap-ha-3">
                      <div className="w-9 h-9 rounded-ha-xl bg-ha-blue/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon path={mdiAutoFix} size={20} className="text-ha-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">Configure your dashboard</p>
                        <p className="text-sm text-text-secondary mt-0.5 leading-snug">
                          Auto-assign primary and sensor entities to each device card based on smart defaults.
                        </p>
                        <div className="flex gap-ha-2 mt-ha-3">
                          <button
                            onClick={autoConfigureDevices}
                            className="text-sm font-semibold text-white bg-ha-blue rounded-ha-xl px-ha-3 py-1.5 hover:bg-ha-blue/90 active:scale-95 transition-all"
                          >
                            Auto-configure
                          </button>
                          <button
                            onClick={dismissOnboarding}
                            className="text-sm text-text-secondary hover:text-text-primary transition-colors px-ha-2 py-1.5"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      <button onClick={dismissOnboarding} className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0 p-0.5">
                        <Icon path={mdiClose} size={18} />
                      </button>
                    </div>
                  )}

                  {loading && <HALoader className="mb-ha-5" />}

                  {loading && (() => {
                    const skeletons = [140, 88, 88, 88, 140, 88];
                    const colArrays: number[][] = Array.from({ length: masonryCols }, () => []);
                    skeletons.forEach((h, i) => colArrays[i % masonryCols].push(h));
                    return (
                      <div className="flex gap-ha-3 items-start">
                        {colArrays.map((col, ci) => (
                          <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-3">
                            {col.map((h, j) => (
                              <div key={j} className="rounded-ha-2xl bg-surface-low animate-pulse" style={{ height: h }} />
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {!loading && visibleSections.length === 0 && (
                    <p className="text-sm text-text-secondary text-center py-ha-8">
                      No devices found. Connect to Home Assistant to see your devices.
                    </p>
                  )}

                  {visibleSections.map(({ key, title, devices: sectionDevices, isArea }) => {
                    const orderedDevices = applyDeviceOrder(sectionDevices, sectionOrders[key]);
                    const orderedIds = orderedDevices.map(d => d.id);
                    const editGridClass = `grid gap-ha-3 items-start ${gridCols ?? 'grid-cols-2 lg:grid-cols-3'}`;

                    const renderCard = (device: HassDevice) => {
                      if (!device.primaryEntity) return null;
                      const config = getConfig(device.id);
                      const primarySlot = config.slots.find(s => s.section === 'primary');
                      const secondarySlots = config.slots.filter(s => s.section === 'secondary');
                      const displaySlots = config.slots.length === 0
                        ? [{ entity_id: device.primaryEntity.entity_id, size: 'lg' as const }]
                        : [
                            ...(primarySlot ? [{ entity_id: primarySlot.entity_id, size: 'lg' as const }] : []),
                            ...secondarySlots,
                          ];
                      const [primarySlotInfo, ...secondarySlotInfos] = displaySlots;
                      const primaryEntity = device.entities.find(e => e.entity_id === primarySlotInfo?.entity_id) ?? device.primaryEntity;

                      return (
                        <DeviceCardV2
                          selected={selectedDeviceId === device.id}
                          editMode={isEditing}
                          areaName={groupBy === 'type' ? (areas.get(device.areaId ?? '') ?? undefined) : undefined}
                          onLongPress={!isEditing ? () => { selectDeviceForEdit(device.id); toggleEditMode(); } : undefined}
                          primary={{
                            entityId: primaryEntity.entity_id,
                            icon: domainIcon(primaryEntity),
                            name: device.name,
                            state: stateLabel(primaryEntity),
                            lastChanged: primaryEntity.last_changed,
                            active: isOn(primaryEntity),
                            entityPicture: (() => { const p = primaryEntity.attributes.entity_picture as string | undefined; return p ? (p.startsWith('http') ? p : `${haUrl}${p}`) : undefined; })(),
                            unit: (primaryEntity.attributes.unit_of_measurement as string | undefined) ?? undefined,
                            toggleable: !isEditing && TOGGLEABLE.has(entityDomain(primaryEntity)),
                            onToggle: !isEditing && TOGGLEABLE.has(entityDomain(primaryEntity)) ? () => toggleEntity(primaryEntity.entity_id, primaryEntity.state) : undefined,
                            onClick: isEditing ? () => selectDeviceForEdit(device.id) : () => selectEntity(device.id, primaryEntity.entity_id),
                          }}
                          secondary={secondarySlotInfos.flatMap(slot => {
                            const e = device.entities.find(ent => ent.entity_id === slot.entity_id);
                            if (!e) return [];
                            const dom = entityDomain(e);
                            const isToggleable = TOGGLEABLE.has(dom);
                            const isPressable = ['button', 'script', 'automation', 'input_button'].includes(dom);
                            return [{
                              entityId: e.entity_id,
                              icon: domainIcon(e),
                              name: entityLabel(e, device.name),
                              state: stateLabel(e),
                              active: isOn(e),
                              size: slot.size,
                              toggleable: !isEditing && isToggleable,
                              pressable: !isEditing && isPressable,
                              onToggle: !isEditing && (isToggleable || isPressable) ? () => toggleEntity(e.entity_id, e.state) : undefined,
                              onClick: isEditing ? () => selectDeviceForEdit(device.id) : () => selectEntity(device.id, e.entity_id),
                            }];
                          })}
                        />
                      );
                    };

                    const handleDragEnd = (event: DragEndEvent) => {
                      const { active, over } = event;
                      if (!over || active.id === over.id) return;
                      const oldIndex = orderedIds.indexOf(active.id as string);
                      const newIndex = orderedIds.indexOf(over.id as string);
                      if (oldIndex === -1 || newIndex === -1) return;
                      handleSectionReorder(key, arrayMove(orderedIds, oldIndex, newIndex));
                    };

                    return (
                      <Section key={key} title={title} count={sectionDevices.length} href={key === '__none__' ? undefined : isArea ? `/room/${key}` : `/type/${key}`}>
                        {isEditing ? (
                          <DndContext
                            sensors={dndSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
                              <div className={editGridClass}>
                                {orderedDevices.map(device => (
                                  <SortableCard key={device.id} id={device.id}>
                                    {renderCard(device)}
                                  </SortableCard>
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        ) : (() => {
                          // Distribute items round-robin across columns so
                          // ordering is left-to-right and column heights
                          // never constrain each other (true flex masonry).
                          const colArrays: HassDevice[][] = Array.from(
                            { length: masonryCols }, () => []
                          );
                          orderedDevices.forEach((d, i) => colArrays[i % masonryCols].push(d));
                          return (
                            <div className="flex gap-ha-3 items-start">
                              {colArrays.map((col, ci) => (
                                <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-3">
                                  {col.map(device => (
                                    <div key={device.id}>{renderCard(device)}</div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </Section>
                    );
                  })}
                </div>
              )}
            </main>
          </div>

          {/* Entity detail / card edit — modal dialog */}
          <ModalSheet open={!!selectedDevice && (panelMode === 'entity' || panelMode === 'edit')} onClose={closePanel}>
            {selectedDevice && panelMode === 'entity' && allPanelEntities.length > 0 && (
              <EntityDetailPanel
                initialEntityId={selectedEntityId ?? allPanelEntities[0].entityId}
                entities={allPanelEntities}
                deviceName={selectedDevice.name}
                deviceMeta={{
                  deviceId: selectedDevice.id,
                  manufacturer: selectedDevice.manufacturer,
                  model: selectedDevice.model,
                  areaName: selectedDevice.areaId ? areas.get(selectedDevice.areaId) : undefined,
                  allEntities: selectedDevice.entities.map(e => ({
                    entityId: e.entity_id,
                    name: (e.attributes.friendly_name as string | undefined) ?? e.entity_id.split('.')[1],
                    domain: e.entity_id.split('.')[0],
                  })),
                }}
                onClose={closePanel}
                onEditCard={() => setPanelMode('edit')}
              />
            )}
            {selectedDevice && panelMode === 'edit' && (
              <DeviceCardEditPanel
                device={selectedDevice}
                config={getConfig(selectedDevice.id)}
                onSave={cfg => setConfig(selectedDevice.id, cfg)}
                onBack={isEditing ? closePanel : () => setPanelMode('entity')}
                onClose={closePanel}
                hideBack={!isEditing}
              />
            )}
          </ModalSheet>
        </div>
      </div>
    </>
  );
}
