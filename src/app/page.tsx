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
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { mdiHomeAssistant, mdiChevronRight, mdiViewGrid, mdiCube, mdiAutoFix, mdiAccessPointNetwork, mdiWifi, mdiBluetooth, mdiZigbee, mdiZWave, mdiGraphOutline, mdiHexagonMultiple } from '@mdi/js';
import { clsx } from 'clsx';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const DashboardFloorView = dynamic(() => import('@/components/sections/DashboardFloorView'), { ssr: false });
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { DeferredCard } from '@/components/cards/DeferredCard';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { MobileSummaryRow } from '@/components/sections';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { PullToRevealPanel } from '@/components/sections';
import { useTheme, useImmersiveMode, useHomeAssistant, useDevices, useDeviceCardConfig, useFeatureFlags } from '@/hooks';
import { usePullToRevealContext, useHeader, useEditMode, useToast } from '@/contexts';
import { Icon } from '@/components/ui/Icon';
import { HALoader } from '@/components/ui/HALoader';
import { TipStack, type TipStackTip } from '@/components/ui/TipStack';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { OffscreenChangeHints } from '@/components/ui/OffscreenChangeHints';
import { ScrollIndexRail } from '@/components/ui/ScrollIndexRail';
import {
  entityDomain, friendlyName, entityLabel, stateLabel, isOn, TOGGLEABLE,
  domainIcon, deviceThumbnail, SECTION_ORDER, SECTION_TITLES,
  entityCategory, CATEGORY_ORDER, CATEGORY_TITLES,
  AREA_ICON, domainTypeIcon, CATEGORY_ICONS, type DeviceCategory,
} from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

// ── Section ───────────────────────────────────────────────────────────────────

// Section only renders the sticky header; the grid is provided as children by the caller
function Section({ sectionKey, title, count, href, children }: { sectionKey: string; title: string; count: number; href?: string; children: React.ReactNode }) {
  if (count === 0) return null;

  return (
    <div
      data-section-key={sectionKey}
      style={{ scrollMarginTop: 'calc(var(--dashboard-sticky-top, 0px) + var(--ha-space-2))' }}
    >
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

// Resolve a (possibly sparse) order into device slots. `null` entries are
// intentional empty grid positions; ids that no longer exist resolve to empty
// slots so the surrounding layout doesn't shift when a device disappears.
// Devices not yet in the order are appended at the end.
function resolveSlots(devices: HassDevice[], order?: (string | null)[]): (HassDevice | null)[] {
  if (!order?.length) return [...devices];
  const map = new Map(devices.map(d => [d.id, d]));
  const placed = new Set<string>();
  const slots: (HassDevice | null)[] = order.map(id => {
    if (id && map.has(id)) { placed.add(id); return map.get(id)!; }
    return null;
  });
  for (const d of devices) if (!placed.has(d.id)) slots.push(d);
  while (slots.length && slots[slots.length - 1] === null) slots.pop();
  return slots;
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
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
        position: 'relative',
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

// One cell of the edit-mode placement grid. Every cell is a drop target;
// empty cells render as dashed placeholders, occupied cells highlight when
// another card hovers over them (drop = swap).
function GridSlot({ index, cardId, children }: { index: number; cardId?: string; children?: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `slot-${index}` });
  const isForeignOver = isOver && active?.id !== cardId;

  if (cardId) {
    return (
      <div ref={setNodeRef} className={clsx('rounded-ha-2xl transition-shadow', isForeignOver && 'ring-2 ring-ha-blue/70')}>
        {children}
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'self-stretch min-h-[88px] rounded-ha-2xl border-2 border-dashed transition-colors',
        isForeignOver
          ? 'border-ha-blue bg-ha-blue/10'
          : active ? 'border-text-tertiary/40 bg-surface-low/40' : 'border-text-tertiary/20',
      )}
    />
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
  const { isEditing, toggleEditMode, previewViewport, previewOrientation } = useEditMode();
  const { offscreenChangeHintsEnabled, scrollIndexEnabled } = useFeatureFlags();

  // Edit-mode grid must match the non-edit masonry column counts
  // (useMasonryCols: ≥1024px=3, below=2) so the layout doesn't reflow when
  // entering/exiting edit mode. Landscape tablet previews at 1024px → 3 cols.
  const editColCount = previewViewport === 'desktop' || (previewViewport === 'tablet' && previewOrientation === 'landscape') ? 3 : 2;
  const gridCols = isEditing
    ? editColCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
    : 'grid-cols-2 lg:grid-cols-3';

  // Per-section card placement. Entries may be null — an intentional empty
  // grid slot (sparse layout). Dense arrays (old format) still parse fine.
  const [sectionOrders, setSectionOrders] = useState<Record<string, (string | null)[]>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('ha_device_order') ?? '{}'); }
    catch { return {}; }
  });

  const handleSectionReorder = useCallback((sectionKey: string, newIds: (string | null)[]) => {
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
  const { toggleEntity, haUrl, demoMode, connecting, error: connectionError, saveCredentials, enableDemoMode } = useHomeAssistant();
  const { showToast } = useToast();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');

  const { devices, areas, areaReg, floors, loading } = useDevices();
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'area' | 'type' | 'category'>(() => {
    if (typeof window === 'undefined') return 'area';
    const saved = localStorage.getItem('ha_group_by');
    return saved === 'type' || saved === 'category' ? saved : 'area';
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

  // Connect-your-instance tip (demo mode only) + inline connection setup
  const [connectTipDismissed, setConnectTipDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ha_tip_connect_v1') === 'dismissed';
  });
  const [setupOpen, setSetupOpen] = useState(false);

  const dismissConnectTip = useCallback(() => {
    localStorage.setItem('ha_tip_connect_v1', 'dismissed');
    setConnectTipDismissed(true);
  }, []);

  const handleSetupSave = useCallback(async (url: string, token: string) => {
    try {
      await saveCredentials(url, token);
      setSetupOpen(false);
    } catch {
      // Connection error surfaces inside the setup screen via context error.
    }
  }, [saveCredentials]);

  const handleSetupUseDemo = useCallback(() => {
    enableDemoMode();
    setSetupOpen(false);
  }, [enableDemoMode]);

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

  // Dashboard tips, rendered as a dismissible card stack between the summary
  // row and the device sections. First run on demo data leads with "connect
  // your instance"; the auto-configure onboarding waits underneath.
  const tips = useMemo<TipStackTip[]>(() => {
    const list: TipStackTip[] = [];
    if (demoMode && !connectTipDismissed) {
      list.push({
        id: 'connect-ha',
        icon: mdiHomeAssistant,
        title: 'You’re exploring a demo home',
        body: 'These rooms and devices are sample data. Connect your Home Assistant instance to see your real home in this prototype.',
        actions: [
          { label: 'Connect my home', primary: true, onClick: () => setSetupOpen(true) },
          { label: 'Keep the demo', onClick: dismissConnectTip },
        ],
        onDismiss: dismissConnectTip,
      });
    }
    if (devices.length > 0 && !onboardingDismissed) {
      list.push({
        id: 'configure-dashboard',
        icon: mdiAutoFix,
        title: 'Configure your dashboard',
        body: 'Auto-assign primary and sensor entities to each device card based on smart defaults.',
        actions: [
          { label: 'Auto-configure', primary: true, onClick: autoConfigureDevices },
          { label: 'Dismiss', onClick: dismissOnboarding },
        ],
        onDismiss: dismissOnboarding,
      });
    }
    return list;
  }, [demoMode, connectTipDismissed, dismissConnectTip, devices.length, onboardingDismissed, autoConfigureDevices, dismissOnboarding]);

  const handleSwitchTo3D = useCallback(() => {
    if (floors.length >= 1 && activeFloorId === null) {
      setActiveFloorId(floors[0].floor_id);
    }
    setDashboardView('3d');
  }, [floors, activeFloorId]);

  useEffect(() => {
    setHeader({ title: 'Home' });
  }, [setHeader]);

  // Demo: surface simulated "new device detected" events as toasts — a few of
  // them, staggered, so the toast stacking (newest in front, older peeking
  // below) is visible. Placeholder until wired to real HA discovery /
  // notification events. Mimics what a discovery payload carries: a product
  // render, a manufacturer/model, and the transport (Wi-Fi / Bluetooth /
  // Zigbee / Z-Wave / Thread / Matter) it was found over.
  useEffect(() => {
    if (loading) return;
    const discoveries = [
      { name: 'Motion Sensor',      image: '/devices/motion_sensor.png',        manufacturer: 'Aqara',       model: 'P2',        protocol: 'Zigbee',    protocolIcon: mdiZigbee },
      { name: 'Smart Plug',         image: '/devices/smart_plug_us.png',        manufacturer: 'TP-Link',     model: 'Tapo P110', protocol: 'Wi-Fi',     protocolIcon: mdiWifi },
      { name: 'Door Lock',          image: '/devices/lock.png',                 manufacturer: 'Yale',        model: 'Assure 2',  protocol: 'Matter',    protocolIcon: mdiHexagonMultiple },
      { name: 'Climate Sensor',     image: '/devices/temp_humidity_sensor.png', manufacturer: 'SwitchBot',   model: 'Meter',     protocol: 'Bluetooth', protocolIcon: mdiBluetooth },
      { name: 'Light Strip',        image: '/devices/led_strip.png',            manufacturer: 'Govee',       model: 'H6199',     protocol: 'Wi-Fi',     protocolIcon: mdiWifi },
      { name: 'Radiator Valve',     image: '/devices/radiator_valve.png',       manufacturer: 'tado°',       model: 'V3+',       protocol: 'Thread',    protocolIcon: mdiGraphOutline },
      { name: 'Dome Camera',        image: '/devices/camera_dome.png',          manufacturer: 'Reolink',     model: 'E1 Pro',    protocol: 'Wi-Fi',     protocolIcon: mdiWifi },
      { name: 'Contact Sensor',     image: '/devices/contact_sensor.png',       manufacturer: 'SONOFF',      model: 'SNZB-04',   protocol: 'Zigbee',    protocolIcon: mdiZigbee },
      { name: 'Smart Bulb',         image: '/devices/bulb_e27.png',             manufacturer: 'Philips Hue', model: 'A60',       protocol: 'Zigbee',    protocolIcon: mdiZigbee },
      { name: 'Wall Switch',        image: '/devices/wall_switch.png',          manufacturer: 'Inovelli',    model: 'Blue 2-1',  protocol: 'Z-Wave',    protocolIcon: mdiZWave },
    ];
    // Pick 3 distinct devices and announce them 3s apart, starting 5s after load.
    const picked = [...discoveries].sort(() => Math.random() - 0.5).slice(0, 3);
    const timers = picked.map((d, i) =>
      setTimeout(() => {
        showToast({
          icon: mdiAccessPointNetwork,
          image: d.image,
          protocolIcon: d.protocolIcon,
          title: `New ${d.name}`,
          subtitle: `${d.model} • ${d.protocol} • Strong`,
          action: { label: 'Set up', onClick: () => {} },
        });
      }, 5000 + i * 3000)
    );
    return () => timers.forEach(clearTimeout);
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
    type Sec = { key: string; title: string; devices: HassDevice[]; kind: 'area' | 'type' | 'category' };
    const ordered: Sec[] = [];

    if (areas.size > 0 && groupBy === 'area') {
      const byArea = new Map<string, HassDevice[]>();
      for (const device of floorDevices) {
        const key = device.areaId ?? '__none__';
        if (!byArea.has(key)) byArea.set(key, []);
        byArea.get(key)!.push(device);
      }
      for (const [areaId, areaName] of areas) {
        if (byArea.has(areaId)) ordered.push({ key: areaId, title: areaName, devices: byArea.get(areaId)!, kind: 'area' });
      }
      if (byArea.has('__none__')) ordered.push({ key: '__none__', title: 'Other', devices: byArea.get('__none__')!, kind: 'area' });
    } else if (groupBy === 'category') {
      const byCat = new Map<string, HassDevice[]>();
      for (const device of floorDevices) {
        if (!device.primaryEntity) continue;
        const cat = entityCategory(device.primaryEntity);
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat)!.push(device);
      }
      for (const cat of CATEGORY_ORDER) {
        if (byCat.has(cat)) ordered.push({ key: cat, title: CATEGORY_TITLES[cat], devices: byCat.get(cat)!, kind: 'category' });
      }
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
          ordered.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, devices: byDomain.get(domain)!, kind: 'type' });
          byDomain.delete(domain);
        }
      }
      for (const [domain, devs] of byDomain) {
        ordered.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, devices: devs, kind: 'type' });
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
            {/* Immersive toggle — desktop only, a folded page corner ("dog-ear")
                in the surface corner. The parent's overflow-hidden + rounded
                corner clips it into the curve; clip-path keeps the hit area
                triangular so only the fold itself is clickable. */}
            {!isEditing && (
              <button
                onClick={() => toggleImmersiveMode()}
                aria-label={immersiveMode ? 'Exit immersive mode' : 'Enter immersive mode'}
                title={immersiveMode ? 'Exit immersive mode' : 'Immersive mode'}
                className={clsx(
                  'hidden lg:block absolute top-0 left-0 z-[70] transition-all duration-200',
                  // text-tertiary-based fill reads as a raised fold on both
                  // light and dark themes (surface-mid is darker than the
                  // surface-lower container in dark mode, so it won't work here)
                  'bg-gradient-to-br from-text-tertiary/25 via-text-tertiary/10 to-transparent',
                  'hover:from-text-tertiary/45 hover:via-text-tertiary/20',
                  immersiveMode ? 'w-10 h-10' : 'w-8 h-8 hover:w-10 hover:h-10',
                )}
                style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
              />
            )}

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
              {/* Summary chips scroll away; the filters block below them stays pinned */}
              <MobileSummaryRow
                  fullBleed={isMobileImmersive}
                  noSticky={dashboardView === '3d'}
                  extraRef={stickyHeaderRef}
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
                            { value: 'area', label: 'Area' },
                            { value: 'type', label: 'Device' },
                            { value: 'category', label: 'Category' },
                          ]}
                          value={groupBy}
                          onChange={v => {
                            const next = v as 'area' | 'type' | 'category';
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

              {dashboardView === '3d' ? (
                <div className="flex-1 min-h-0">
                  <DashboardFloorView
                    sections={visibleSections}
                    onRoomClick={key => { if (key !== '__none__') router.push(`/room/${key}`); }}
                  />
                </div>
              ) : (
                <div className={clsx(
                  'max-w-[1536px] mx-auto lg:px-ha-8 w-full space-y-ha-6',
                  // Reserve room for the scroll-index rail so its dots never
                  // sit on top of the cards, at any window width. (lg keeps
                  // the symmetric px-ha-8 gutter — the rail fits inside it.)
                  scrollIndexEnabled && !isEditing && visibleSections.length >= 2 && 'pr-2 md:pr-4 lg:pr-ha-8',
                )}>
                  <ApplicationViewNotice />

                  {/* Dismissible tip stack — connect-instance prompt, onboarding, … */}
                  {!loading && !isEditing && <TipStack tips={tips} />}

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

                  {/* Re-keyed on floor/grouping switch — plays a one-shot enter fade */}
                  <div key={`${groupBy}-${activeFloorId ?? 'all'}`} className="ha-view-enter space-y-ha-6">
                  {visibleSections.map(({ key, title, devices: sectionDevices, kind }) => {
                    const slots = resolveSlots(sectionDevices, sectionOrders[key]);
                    const editGridClass = `grid gap-ha-3 items-start ${gridCols ?? 'grid-cols-2 lg:grid-cols-3'}`;

                    const renderCard = (device: HassDevice) => {
                      if (!device.primaryEntity) return null;
                      const config = getConfig(device.id);
                      const primarySlot = config.slots.find(s => s.section === 'primary');
                      const secondarySlots = config.slots.filter(s => s.section === 'secondary');
                      const displaySlots: { entity_id: string; size: 'sm' | 'lg'; chart?: boolean }[] = config.slots.length === 0
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
                          areaName={groupBy !== 'area' ? (areas.get(device.areaId ?? '') ?? undefined) : undefined}
                          onLongPress={!isEditing ? () => { selectDeviceForEdit(device.id); toggleEditMode(); } : undefined}
                          primary={{
                            entityId: primaryEntity.entity_id,
                            icon: domainIcon(primaryEntity),
                            // Thumbnail represents the DEVICE, not the chosen primary
                            // slot — so a TV whose card is set to show its battery
                            // entity still renders the television image.
                            thumbnail: deviceThumbnail(device.primaryEntity),
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
                              unit: (e.attributes.unit_of_measurement as string | undefined) ?? undefined,
                              chart: slot.chart,
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

                    // Edit grid is a slot canvas: pad to full rows, and when
                    // every slot is taken open one extra empty row so cards
                    // always have somewhere to move.
                    const editCols = editColCount;
                    const paddedSlots = [...slots];
                    while (paddedSlots.length % editCols !== 0) paddedSlots.push(null);
                    if (paddedSlots.length === 0 || !paddedSlots.includes(null)) {
                      paddedSlots.push(...Array<null>(editCols).fill(null));
                    }

                    const handleDragEnd = (event: DragEndEvent) => {
                      const { active, over } = event;
                      if (!over) return;
                      const targetIndex = Number(String(over.id).replace('slot-', ''));
                      const sourceIndex = paddedSlots.findIndex(d => d?.id === active.id);
                      if (sourceIndex === -1 || Number.isNaN(targetIndex) || targetIndex === sourceIndex) return;
                      const ids: (string | null)[] = paddedSlots.map(d => d?.id ?? null);
                      // Drop on empty slot = place there; on another card = swap.
                      ids[sourceIndex] = ids[targetIndex];
                      ids[targetIndex] = active.id as string;
                      while (ids.length && ids[ids.length - 1] === null) ids.pop();
                      handleSectionReorder(key, ids);
                    };

                    return (
                      <Section key={key} sectionKey={key} title={title} count={sectionDevices.length} href={key === '__none__' ? undefined : kind === 'area' ? `/room/${key}` : kind === 'category' ? `/category/${key}` : `/type/${key}`}>
                        {isEditing ? (
                          <DndContext
                            sensors={dndSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <div className={editGridClass}>
                              {paddedSlots.map((device, i) => (
                                <GridSlot key={device ? device.id : `empty-${i}`} index={i} cardId={device?.id}>
                                  {device && (
                                    <DraggableCard id={device.id}>
                                      {renderCard(device)}
                                    </DraggableCard>
                                  )}
                                </GridSlot>
                              ))}
                            </div>
                          </DndContext>
                        ) : (() => {
                          // Distribute items by slot index across columns so
                          // ordering is left-to-right and column heights
                          // never constrain each other (true flex masonry).
                          // Empty slots keep a card in its chosen column but
                          // collapse vertically.
                          const colArrays: HassDevice[][] = Array.from(
                            { length: masonryCols }, () => []
                          );
                          slots.forEach((d, i) => { if (d) colArrays[i % masonryCols].push(d); });
                          return (
                            <div className="flex gap-ha-3 items-start">
                              {colArrays.map((col, ci) => (
                                <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-3">
                                  {col.map(device => (
                                    <DeferredCard key={device.id}>{renderCard(device)}</DeferredCard>
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
                </div>
              )}
            </main>

            <OffscreenChangeHints
              scrollRef={scrollableRef}
              enabled={offscreenChangeHintsEnabled && dashboardView === 'list' && !isEditing}
            />

            <ScrollIndexRail
              scrollRef={scrollableRef}
              sections={visibleSections.map(s => ({
                key: s.key,
                title: s.title,
                icon: s.kind === 'category' ? CATEGORY_ICONS[s.key as DeviceCategory]
                  : s.kind === 'type' ? domainTypeIcon(s.key)
                  : AREA_ICON,
              }))}
              enabled={scrollIndexEnabled && dashboardView === 'list' && !isEditing}
            />
          </div>

          {/* Entity detail / card edit — modal dialog */}
          <ModalSheet open={!!selectedDevice && (panelMode === 'entity' || panelMode === 'edit')} onClose={closePanel} maxWidth={640} transitionKey={panelMode}>
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

      {/* Connection setup — opened from the connect tip */}
      {setupOpen && (
        <SetupScreen
          onSave={handleSetupSave}
          onUseDemo={handleSetupUseDemo}
          error={connectionError}
          connecting={connecting}
          onClose={() => setSetupOpen(false)}
        />
      )}
    </>
  );
}
