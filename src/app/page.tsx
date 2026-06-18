'use client';

import { useCallback, useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
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
import { mdiHomeAssistant, mdiViewGrid, mdiCube, mdiAutoFix, mdiStar, mdiViewAgenda } from '@mdi/js';
import { clsx } from 'clsx';

const DashboardFloorView = dynamic(() => import('@/components/sections/DashboardFloorView'), { ssr: false });
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { DeferredCard } from '@/components/cards/DeferredCard';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { MobileSummaryRow } from '@/components/sections';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { ImmersiveDogEar } from '@/components/layout/ImmersiveDogEar';
import { ScreensaverDogEar } from '@/components/layout/ScreensaverDogEar';
import { DashboardFilterBar } from '@/components/layout/DashboardFilterBar';
import { PullToRevealPanel } from '@/components/sections';
import { useImmersiveMode, useHomeAssistant, useDevices, useDeviceCardConfig, useFeatureFlags, useFavorites, useFastScrollLabels } from '@/hooks';
import { usePullToRevealContext, useHeader, useEditMode, useToast } from '@/contexts';
import { NavChevron } from '@/components/ui';
import { HALoader } from '@/components/ui/HALoader';
import { TipStack, type TipStackTip } from '@/components/ui/TipStack';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { OffscreenChangeHints } from '@/components/ui/OffscreenChangeHints';
import { ScrollIndexRail } from '@/components/ui/ScrollIndexRail';
import {
  entityDomain, friendlyName, entityLabel, stateLabel, isOn, TOGGLEABLE,
  domainIcon, deviceThumbnail, deviceFeedEntity, SECTION_ORDER, SECTION_TITLES,
  entityCategory, CATEGORY_ORDER, CATEGORY_TITLES,
  AREA_ICON, domainTypeIcon, CATEGORY_ICONS, type DeviceCategory,
} from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

// ── Section ───────────────────────────────────────────────────────────────────

// Section renders a NON-sticky header that scrolls away naturally; the grid is
// provided as children by the caller. As the header leaves the top of the
// scroll area, the dashboard republishes its title into the top bar as a
// reversed breadcrumb (see DashboardPage's section-tracking effect).
function Section({ sectionKey, title, count, href, children }: { sectionKey: string; title: string; count: number; href?: string; children: React.ReactNode }) {
  if (count === 0) return null;

  return (
    <div
      data-section-key={sectionKey}
      data-section-title={title}
      // Land jumps (scroll rail) below the top scroll fade, not under it. The
      // fade is h-12 (3rem) anchored at --app-topbar-clear, so clear both.
      style={{ scrollMarginTop: 'calc(var(--app-topbar-clear, 0px) + var(--dashboard-sticky-top, 0px) + 3rem + var(--ha-space-2))' }}
    >
      <div className="-mx-ha-1 px-ha-1 py-ha-2 mb-ha-1" data-section-header>
        {href ? (
          <Link href={href} prefetch={false} className="flex items-center gap-1 group w-fit">
            <span className="text-xl font-semibold text-text-primary group-hover:text-ha-blue transition-colors">{title}</span>
            <NavChevron size={18} className="text-text-tertiary group-hover:text-ha-blue" />
          </Link>
        ) : (
          <span className="text-xl font-semibold text-text-primary">{title}</span>
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
function GridSlot({ droppableId, dragId, children }: { droppableId: string; dragId?: string; children?: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: droppableId });
  const isForeignOver = isOver && active?.id !== dragId;

  if (dragId) {
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

// ── Edit-mode drag ids ──────────────────────────────────────────────────────
// One DndContext spans every section in edit mode, so drag/drop ids must encode
// which section they belong to. A device favorited also shows in its group, so
// its two card instances need distinct drag ids (`f::` vs `g::`).
const FAVORITES_KEY = '__favorites__';
const slotId = (section: string, index: number) => `s::${section}::${index}`;
const cardDragId = (section: string, deviceId: string) =>
  section === FAVORITES_KEY ? `f::${deviceId}` : `g::${section}::${deviceId}`;

function parseSlotId(id: string): { section: string; index: number } | null {
  if (!id.startsWith('s::')) return null;
  const rest = id.slice(3);
  const i = rest.lastIndexOf('::');
  if (i === -1) return null;
  return { section: rest.slice(0, i), index: Number(rest.slice(i + 2)) };
}

function parseCardDragId(id: string): { fromFav: boolean; section: string; deviceId: string } | null {
  if (id.startsWith('f::')) return { fromFav: true, section: FAVORITES_KEY, deviceId: id.slice(3) };
  if (id.startsWith('g::')) {
    const rest = id.slice(3);
    const i = rest.indexOf('::');
    if (i === -1) return null;
    return { fromFav: false, section: rest.slice(0, i), deviceId: rest.slice(i + 2) };
  }
  return null;
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
  const masonryCols = useMasonryCols();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();
  const router = useRouter();
  const scrollableRef = useRef<HTMLElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [dashboardView, setDashboardView] = useState<'list' | '3d'>('list');
  const { isRevealed } = usePullToRevealContext();
  const { isEditing, toggleEditMode, previewViewport, previewOrientation } = useEditMode();
  const { offscreenChangeHintsEnabled, scrollIndexEnabled, fastScrollLabelsEnabled } = useFeatureFlags();

  // Prototype: overlay each card with its name while flicking fast (list view,
  // not editing). Toggles a class on the scroll container — no per-card renders.
  useFastScrollLabels(scrollableRef, fastScrollLabelsEnabled && dashboardView === 'list' && !isEditing);

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
  const { setHeader, setSectionCrumb } = useHeader();
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
  // Floor + grouping live in the floating DashboardFilterBar. Count tracks
  // deviation from the defaults.
  const setGroupByPersisted = useCallback((next: 'area' | 'type' | 'category') => {
    localStorage.setItem('ha_group_by', next);
    setGroupBy(next);
  }, []);
  const activeFilterCount = (activeFloorId ? 1 : 0) + (groupBy !== 'area' ? 1 : 0);
  const { getConfig, setConfig } = useDeviceCardConfig();
  const { isFavorite, toggleFavorite } = useFavorites();

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

  // Reversed breadcrumb: track which section header has scrolled above the top
  // of the scroll area and publish its title to the top bar (under "Home").
  // Section headers no longer pin, so the top bar carries the "where am I"
  // context instead. The active section is the last one whose header top has
  // crossed above the reading line (scroll container top + any sticky chrome).
  useEffect(() => {
    const el = scrollableRef.current;
    if (!el || dashboardView !== 'list') {
      setSectionCrumb(undefined);
      return;
    }
    let lastTop = el.scrollTop;
    const update = () => {
      const stickyTopVar = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--dashboard-sticky-top'),
      ) || 0;
      const line = el.getBoundingClientRect().top + stickyTopVar + 1;
      let active: string | undefined;
      el.querySelectorAll<HTMLElement>('[data-section-key]').forEach((node) => {
        if (node.getBoundingClientRect().top <= line) {
          active = node.dataset.sectionTitle ?? undefined;
        }
      });
      // Roll direction is inverted from scroll: scrolling DOWN rolls the new
      // section in from the bottom, scrolling UP from the top.
      const goingDown = el.scrollTop > lastTop;
      lastTop = el.scrollTop;
      setSectionCrumb(active, !goingDown);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      setSectionCrumb(undefined);
    };
  }, [dashboardView, loading, groupBy, activeFloorId, isEditing, setSectionCrumb]);

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

  // Favorites — a flat band pinned above the grouped sections. Built from
  // floorDevices so it respects the active floor filter, but ignores groupBy
  // (it's its own section, not a grouping mode). Ordered like other sections.
  const favoriteDevices = useMemo(
    () => resolveSlots(
      floorDevices.filter(d => d.primaryEntity && isFavorite(d.id)),
      sectionOrders['__favorites__'],
    ).filter((d): d is HassDevice => d !== null),
    [floorDevices, isFavorite, sectionOrders],
  );

  // Devices for any section key (favorites included) — used by the shared
  // edit-mode drag handler to reconstruct a section's slot layout on drop.
  const sectionDevicesByKey = useMemo(() => {
    const m = new Map<string, HassDevice[]>();
    for (const s of sections) m.set(s.key, s.devices);
    m.set(FAVORITES_KEY, favoriteDevices);
    return m;
  }, [sections, favoriteDevices]);

  // Rebuild the padded slot list for a section and move `deviceId` into the
  // dropped slot (same logic as the old per-section handler, generalised).
  const reorderWithin = useCallback((section: string, targetIndex: number, deviceId: string) => {
    const devices = sectionDevicesByKey.get(section) ?? [];
    const slots = resolveSlots(devices, sectionOrders[section]);
    const paddedSlots = [...slots];
    while (paddedSlots.length % editColCount !== 0) paddedSlots.push(null);
    if (paddedSlots.length === 0 || !paddedSlots.includes(null)) {
      paddedSlots.push(...Array<null>(editColCount).fill(null));
    }
    const sourceIndex = paddedSlots.findIndex(d => d?.id === deviceId);
    if (sourceIndex === -1 || Number.isNaN(targetIndex) || targetIndex === sourceIndex) return;
    const ids: (string | null)[] = paddedSlots.map(d => d?.id ?? null);
    ids[sourceIndex] = ids[targetIndex];
    ids[targetIndex] = deviceId;
    while (ids.length && ids[ids.length - 1] === null) ids.pop();
    handleSectionReorder(section, ids);
  }, [sectionDevicesByKey, sectionOrders, editColCount, handleSectionReorder]);

  // Single drag handler for the whole edit-mode dashboard. Cross-section drags
  // only carry meaning for favorites: into the band favorites a device, out of
  // it unfavorites. Same-section drags reorder; other cross-section drags noop.
  const handleEditDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const slot = parseSlotId(String(over.id));
    const card = parseCardDragId(String(active.id));
    if (!slot || !card) return;

    if (card.fromFav && slot.section !== FAVORITES_KEY) {
      if (isFavorite(card.deviceId)) toggleFavorite(card.deviceId); // drag out → unfavorite
      return;
    }
    if (!card.fromFav && slot.section === FAVORITES_KEY) {
      if (!isFavorite(card.deviceId)) toggleFavorite(card.deviceId); // drag in → favorite
      return;
    }
    if (slot.section === card.section) {
      reorderWithin(card.section, slot.index, card.deviceId);
    }
  }, [isFavorite, toggleFavorite, reorderWithin]);

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

  // Renders a single device card. Hoisted so both the grouped sections and the
  // favorites band can use it. `forceArea` shows the area chip even in area
  // grouping (favorites are ungrouped, so the chip tells you where each lives).
  // The entity id the card tags itself with (DeviceCardV2's data-entity-id).
  // Mirrors renderCard's primary-slot resolution so the deferred placeholder
  // can carry the same id, keeping offscreen cards locatable while unmounted.
  const cardPrimaryEntityId = useCallback((device: HassDevice): string | undefined => {
    if (!device.primaryEntity) return undefined;
    const config = getConfig(device.id);
    const primarySlot = config.slots.find(s => s.section === 'primary');
    const firstId = config.slots.length === 0 ? device.primaryEntity.entity_id : primarySlot?.entity_id;
    return device.entities.find(e => e.entity_id === firstId)?.entity_id ?? device.primaryEntity.entity_id;
  }, [getConfig]);

  const renderCard = useCallback((device: HassDevice, opts?: { forceArea?: boolean }) => {
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
    // Camera/media feed shown as the card hero; clicking opens
    // that entity so the modal shows the feed too.
    const feedEntity = deviceFeedEntity(device.entities);
    const feedImage = feedEntity?.attributes.entity_picture
      ? (() => { const p = feedEntity.attributes.entity_picture as string; return p.startsWith('http') ? p : `${haUrl}${p}`; })()
      : undefined;
    const openEntity = feedEntity ?? primaryEntity;

    return (
      <DeviceCardV2
        selected={selectedDeviceId === device.id}
        editMode={isEditing}
        areaName={(opts?.forceArea || groupBy !== 'area') ? (areas.get(device.areaId ?? '') ?? undefined) : undefined}
        feedImage={feedImage}
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
          onClick: isEditing ? () => selectDeviceForEdit(device.id) : () => selectEntity(device.id, openEntity.entity_id),
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
  }, [getConfig, haUrl, selectedDeviceId, isEditing, groupBy, areas, toggleEntity, toggleEditMode]);

  const selectedDevice = useMemo(
    () => devices.find(d => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );
  // All visible entities for the selected device in stable order — panel uses this as its list
  const allPanelEntities = useMemo(() => {
    if (!selectedDevice) return [];
    const config = getConfig(selectedDevice.id);
    const baseIds = config.slots.length === 0
      ? selectedDevice.entities.slice(0, 1).map(e => e.entity_id) // default: primary only
      : config.slots.filter(s => s.section === 'primary' || s.section === 'secondary').map(s => s.entity_id);
    // Always include the camera/media feed entity (and put it first) so opening
    // the device shows its feed even if that entity isn't a configured slot.
    const feed = deviceFeedEntity(selectedDevice.entities);
    const visibleIds = feed && !baseIds.includes(feed.entity_id)
      ? [feed.entity_id, ...baseIds]
      : baseIds;
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

      {/* Floating filter/grouping controls — hidden in edit mode (EditingToolbar
          owns the bottom) and in 3D view. */}
      {!isEditing && dashboardView === 'list' && (
        <DashboardFilterBar
          floors={floors}
          hasAreas={areas.size > 0}
          activeFloorId={activeFloorId}
          setActiveFloorId={setActiveFloorId}
          groupBy={groupBy}
          setGroupBy={setGroupByPersisted}
          activeFilterCount={activeFilterCount}
        />
      )}

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
              'flex-1 min-w-0 overflow-hidden transition-[opacity,transform,border-radius,background-color] duration-[400ms] ease-out relative',
              // Soft fade + small rise on land instead of a scale zoom — reads as
              // a calm settle rather than a pop when arriving from another page.
              dashboardReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
              isMobileImmersive ? 'bg-surface-lower rounded-none lg:rounded-ha-3xl' : 'bg-surface-lower rounded-ha-3xl',
            )}
          >
            {/* Ambient-glow layer for the filter pill's hover bloom. First child
                so it paints behind the cards (DashboardFilterBar portals into it);
                inherits the surface's rounded overflow clip. */}
            <div id="filter-glow-root" className="absolute inset-0 overflow-hidden pointer-events-none" />

            {/* Immersive toggle — desktop-only "dog-ear" fold. Hidden while
                editing the dashboard grid. See ImmersiveDogEar. */}
            {!isEditing && <ImmersiveDogEar />}
            {!isEditing && <ScreensaverDogEar />}

            {/* Top + bottom scroll fades — blend overflowing content into the
                surface. Top fade is desktop-only: on mobile the top bar's own
                gradient already fades the content, so this would double up. */}
            <div
              className={clsx(
                'hidden lg:block absolute left-0 right-0 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300',
                showTopGradient ? 'opacity-100' : 'opacity-0',
              )}
              style={{ top: 'var(--app-topbar-clear, 0px)' }}
            />
            <div className={clsx(
              'absolute bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20 transition-opacity duration-300',
              showBottomGradient ? 'opacity-100' : 'opacity-0',
            )} />

            <main
              ref={el => { scrollableRef.current = el; }}
              className={clsx(
                'h-full overscroll-none touch-pan-y scrollbar-hide select-none',
                // Clear the frosted overlay bar on mobile (0 on desktop).
                'pt-[var(--app-topbar-clear)] lg:pt-0',
                dashboardView === '3d' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto',
                dashboardView !== '3d' && 'pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-ha-5',
                'px-ha-3',
                'lg:px-0',
              )}
              data-scrollable="dashboard"
            >
              {/* Summary chips scroll away. Floor + grouping moved into the
                  floating DashboardFilterBar (desktop pill / mobile FAB). */}
              <MobileSummaryRow
                  fullBleed={isMobileImmersive}
                  noSticky={dashboardView === '3d'}
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
                  // Clearance for the floating DashboardFilterBar pill on desktop.
                  !isEditing && (floors.length >= 2 || areas.size > 0) && 'lg:pb-28',
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
                      <div className="flex gap-ha-4 items-start">
                        {colArrays.map((col, ci) => (
                          <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-4">
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

                  {/* Favorites band + grouped sections share one DndContext so
                      cards can be dragged across sections in edit mode (drop in
                      the Favorites band = favorite; drag a favorite out =
                      unfavorite). In view mode there are no draggables, so the
                      context is inert. */}
                  {!loading && (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleEditDragEnd}
                  >
                  {/* Favorites — flat band above the grouped sections. Cross-cuts
                      grouping; respects the active floor filter. In edit mode it's
                      always shown as a drop target, even when empty. */}
                  {(isEditing || favoriteDevices.length > 0) && (
                    <Section sectionKey={FAVORITES_KEY} title="Favorites" count={isEditing ? Math.max(1, favoriteDevices.length) : favoriteDevices.length}>
                      {isEditing ? (() => {
                        const slots = resolveSlots(favoriteDevices, sectionOrders[FAVORITES_KEY]);
                        const paddedSlots = [...slots];
                        while (paddedSlots.length % editColCount !== 0) paddedSlots.push(null);
                        if (paddedSlots.length === 0 || !paddedSlots.includes(null)) {
                          paddedSlots.push(...Array<null>(editColCount).fill(null));
                        }
                        return (
                          <>
                            {favoriteDevices.length === 0 && (
                              <p className="text-sm text-text-tertiary mb-ha-2">Drag devices here to favorite them.</p>
                            )}
                            <div className={`grid gap-ha-4 items-start ${gridCols ?? 'grid-cols-2 lg:grid-cols-3'}`}>
                              {paddedSlots.map((device, i) => (
                                <GridSlot key={device ? device.id : `fav-empty-${i}`} droppableId={slotId(FAVORITES_KEY, i)} dragId={device ? cardDragId(FAVORITES_KEY, device.id) : undefined}>
                                  {device && (
                                    <DraggableCard id={cardDragId(FAVORITES_KEY, device.id)}>
                                      {renderCard(device, { forceArea: true })}
                                    </DraggableCard>
                                  )}
                                </GridSlot>
                              ))}
                            </div>
                          </>
                        );
                      })() : (() => {
                        const colArrays: HassDevice[][] = Array.from({ length: masonryCols }, () => []);
                        favoriteDevices.forEach((d, i) => colArrays[i % masonryCols].push(d));
                        return (
                          <div className="flex gap-ha-4 items-start">
                            {colArrays.map((col, ci) => (
                              <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-4">
                                {col.map(device => (
                                  <DeferredCard key={device.id} entityId={cardPrimaryEntityId(device)}>{renderCard(device, { forceArea: true })}</DeferredCard>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </Section>
                  )}

                  {/* Re-keyed on floor/grouping switch — plays a one-shot enter fade */}
                  <div key={`${groupBy}-${activeFloorId ?? 'all'}`} className="ha-view-enter space-y-ha-8">
                  {visibleSections.map(({ key, title, devices: sectionDevices, kind }) => {
                    const slots = resolveSlots(sectionDevices, sectionOrders[key]);
                    const editGridClass = `grid gap-ha-4 items-start ${gridCols ?? 'grid-cols-2 lg:grid-cols-3'}`;

                    // Edit grid is a slot canvas: pad to full rows, and when
                    // every slot is taken open one extra empty row so cards
                    // always have somewhere to move.
                    const editCols = editColCount;
                    const paddedSlots = [...slots];
                    while (paddedSlots.length % editCols !== 0) paddedSlots.push(null);
                    if (paddedSlots.length === 0 || !paddedSlots.includes(null)) {
                      paddedSlots.push(...Array<null>(editCols).fill(null));
                    }

                    return (
                      <Section key={key} sectionKey={key} title={title} count={sectionDevices.length} href={key === '__none__' ? undefined : kind === 'area' ? `/room/${key}` : kind === 'category' ? `/category/${key}` : `/type/${key}`}>
                        {isEditing ? (
                          <div className={editGridClass}>
                            {paddedSlots.map((device, i) => (
                              <GridSlot key={device ? device.id : `empty-${i}`} droppableId={slotId(key, i)} dragId={device ? cardDragId(key, device.id) : undefined}>
                                {device && (
                                  <DraggableCard id={cardDragId(key, device.id)}>
                                    {renderCard(device)}
                                  </DraggableCard>
                                )}
                              </GridSlot>
                            ))}
                          </div>
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
                            <div className="flex gap-ha-4 items-start">
                              {colArrays.map((col, ci) => (
                                <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-4">
                                  {col.map(device => (
                                    <DeferredCard key={device.id} entityId={cardPrimaryEntityId(device)}>{renderCard(device)}</DeferredCard>
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
                  </DndContext>
                  )}
                </div>
              )}
            </main>

            <OffscreenChangeHints
              scrollRef={scrollableRef}
              enabled={offscreenChangeHintsEnabled && dashboardView === 'list' && !isEditing}
            />

            <ScrollIndexRail
              scrollRef={scrollableRef}
              sections={[
                // Summary chips sit at the very top, so their tick leads the
                // rail. Dashboard glyph distinguishes it from the favorites star.
                { key: '__summaries__', title: 'Summaries', icon: mdiViewAgenda, markerIcon: mdiViewAgenda },
                // Favorites band renders above the grouped sections, so its
                // tick leads the rail when any favorite is visible.
                ...(!isEditing && favoriteDevices.length > 0
                  ? [{ key: '__favorites__', title: 'Favorites', icon: mdiStar, markerIcon: mdiStar }]
                  : []),
                ...visibleSections.map(s => ({
                  key: s.key,
                  title: s.title,
                  icon: s.kind === 'category' ? CATEGORY_ICONS[s.key as DeviceCategory]
                    : s.kind === 'type' ? domainTypeIcon(s.key)
                    : AREA_ICON,
                })),
              ]}
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
                isFavorite={isFavorite(selectedDevice.id)}
                onToggleFavorite={() => toggleFavorite(selectedDevice.id)}
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
      <SetupScreen
        open={setupOpen}
        onSave={handleSetupSave}
        onUseDemo={handleSetupUseDemo}
        error={connectionError}
        connecting={connecting}
        onClose={() => setSetupOpen(false)}
      />
    </>
  );
}
