'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  mdiCheck, mdiViewListOutline, mdiMapOutline, mdiFloorPlan, mdiDevices,
  mdiShapeOutline, mdiLayersTripleOutline, mdiFilterOutline,
} from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { CATEGORY_ORDER, CATEGORY_TITLES, CATEGORY_ICONS, type DeviceCategory } from '@/lib/homeassistant/entityHelpers';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { GlowCanvas } from '@/components/ui/GlowCanvas';
import { useMobileNavOpen } from '@/lib/mobileNavOpenBus';

export type DashboardGroupBy = 'area' | 'type' | 'category';
export type DashboardListMapView = 'list' | 'map';

const GROUP_OPTIONS: { value: DashboardGroupBy; label: string; icon: string }[] = [
  { value: 'area', label: 'Area', icon: mdiFloorPlan },
  { value: 'type', label: 'Device', icon: mdiDevices },
  { value: 'category', label: 'Category', icon: mdiShapeOutline },
];

const VIEW_OPTIONS: { value: DashboardListMapView; label: string; icon: string }[] = [
  { value: 'list', label: 'List', icon: mdiViewListOutline },
  { value: 'map', label: 'Map', icon: mdiMapOutline },
];

const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };
const POPOVER_SPRING = { type: 'spring' as const, stiffness: 460, damping: 32, mass: 0.7 };

/**
 * A labelled group of option rows inside a soft inset card — the grouped-list
 * idiom shared by the desktop hover panel and the mobile popover.
 */
function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-ha-2 flex flex-col gap-0.5 rounded-ha-2xl bg-surface-low/40 p-1">
        {children}
      </div>
    </div>
  );
}

/**
 * One selectable row: leading glyph, label, and a trailing check when active.
 * Selected rows carry the brand tint; the rest stay quiet and lift on hover.
 */
function OptionRow({
  active,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex h-10 w-full items-center gap-ha-3 rounded-ha-xl px-ha-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-fill-primary-normal text-ha-blue'
          : 'text-text-secondary hover:bg-surface-default hover:text-text-primary'
      }`}
    >
      <Icon
        path={icon}
        size={18}
        className={active ? 'text-ha-blue' : 'text-text-tertiary group-hover:text-text-secondary'}
      />
      <span className="flex-1 text-left">{children}</span>
      <Icon
        path={mdiCheck}
        size={16}
        className={`shrink-0 transition-opacity ${active ? 'text-ha-blue opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}

// Dark ambient-glow colour (0–1 RGB) — matches the edit-mode dashboard glow
// (rgba(0,0,0,0.14)): a soft shadow tint, not a brand hue.
const GLOW_COLOR: [number, number, number] = [0, 0, 0];

/**
 * Ambient hover glow for the desktop filter pill — the dark mirror of the
 * connected toast's corner glow. Portaled into #toast-glow-root, the same
 * on-top layer the toast glow uses (z-62, clipped to the surface's rounded
 * bounds), so the bloom washes OVER the cards exactly like the toast/editor
 * glow rather than hiding behind them. Anchored to the panel's bottom-LEFT
 * corner where the pill sits, at the editor toolbar's faint-black weight.
 */
function FilterGlow({ show }: { show: boolean }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById('toast-glow-root'));
  }, [show]);

  if (!root) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="hidden lg:block absolute bottom-0 pointer-events-none corner-filter-glow"
          style={{ height: '19rem', transformOrigin: '0% 100%' }}
          initial={{ scale: 0.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlowCanvas className="w-full h-full" color={GLOW_COLOR} origin={[0, 1]} radius={[0.9, 0.62]} intensity={0.18} />
        </motion.div>
      )}
    </AnimatePresence>,
    root,
  );
}

interface DashboardFilterBarProps {
  floors: { floor_id: string; name: string }[];
  hasAreas: boolean;
  activeFloorId: string | null;
  setActiveFloorId: (id: string | null) => void;
  groupBy: DashboardGroupBy;
  setGroupBy: (g: DashboardGroupBy) => void;
  activeFilterCount: number;
  /** List ↔ Map view of the dashboard. Map needs drawn areas to be useful. */
  listMapView: DashboardListMapView;
  setListMapView: (v: DashboardListMapView) => void;
  /** Only offer the Map toggle when there's at least one drawn room. */
  hasMap: boolean;
  /** Map view only: focus chips on a single device category ('all' = no filter). */
  mapCategory: DeviceCategory | 'all';
  setMapCategory: (c: DeviceCategory | 'all') => void;
}

const CATEGORY_OPTIONS: { value: DeviceCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_TITLES[c] })),
];

/**
 * Floating filter/grouping controls for the home dashboard, sharing the
 * EditingToolbar idiom.
 *
 * - Desktop: a centered floating pill near the bottom (Floor + Group by
 *   segmented controls), offset past the nav rail like EditingToolbar.
 * - Mobile: a compact FAB pinned bottom-left, sharing the row with the corner
 *   toast (which sits to its right — see --corner-toast-left-inset). Tapping it
 *   opens a popover above the button with the full set of grouping/floor
 *   options.
 */
export function DashboardFilterBar({
  floors,
  hasAreas,
  activeFloorId,
  setActiveFloorId,
  groupBy,
  setGroupBy,
  activeFilterCount,
  listMapView,
  setListMapView,
  hasMap,
  mapCategory,
  setMapCategory,
}: DashboardFilterBarProps) {
  const showFloors = floors.length >= 2;
  // In Map view the group-by options don't apply (the floor plan is fixed).
  const mapView = listMapView === 'map';
  const showGroup = hasAreas && !mapView;
  const hasFilters = showFloors || hasAreas || hasMap;

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // The opened mobile bottom-nav sheet dims the UI; this FAB floats above its
  // scrim, so fade it out while the sheet is up and back in after.
  const navOpen = useMobileNavOpen();
  const fabRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Clip layer for the desktop pill — same on-top portal layer FilterGlow uses
  // (#toast-glow-root), so the pill's drop shadow is clipped to the grey panel.
  const [glowRoot, setGlowRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setGlowRoot(document.getElementById('toast-glow-root'));
  }, []);

  // The map can only show one floor at a time (floors share the same grid
  // space), so it drops the "All" option and defaults to the first floor.
  const effectiveFloor = mapView ? (activeFloorId ?? floors[0]?.floor_id ?? null) : activeFloorId;

  // Reserve the FAB's footprint on the left so the corner toast slides in to
  // its right instead of overlapping. Cleared on unmount so other routes keep
  // a full-width toast.
  useEffect(() => {
    if (!hasFilters) return;
    const el = fabRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--corner-toast-left-inset', `${el.offsetWidth + 8}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--corner-toast-left-inset');
    };
  }, [hasFilters]);

  // Dismiss the popover on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || fabRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!hasFilters) return null;

  const optionGroups = (
    <div className="flex w-full flex-col gap-ha-4">
      {hasMap && (
        <OptionGroup label="View">
          {VIEW_OPTIONS.map(opt => (
            <OptionRow key={opt.value} icon={opt.icon} active={listMapView === opt.value} onClick={() => setListMapView(opt.value)}>
              {opt.label}
            </OptionRow>
          ))}
        </OptionGroup>
      )}
      {showFloors && (
        <OptionGroup label="Floor">
          {!mapView && (
            <OptionRow icon={mdiLayersTripleOutline} active={activeFloorId === null} onClick={() => setActiveFloorId(null)}>
              All
            </OptionRow>
          )}
          {floors.map(f => (
            <OptionRow
              key={f.floor_id}
              icon={mdiLayersTripleOutline}
              active={effectiveFloor === f.floor_id}
              onClick={() => setActiveFloorId(f.floor_id)}
            >
              {f.name}
            </OptionRow>
          ))}
        </OptionGroup>
      )}
      {showGroup && (
        <OptionGroup label="Group by">
          {GROUP_OPTIONS.map(opt => (
            <OptionRow key={opt.value} icon={opt.icon} active={groupBy === opt.value} onClick={() => setGroupBy(opt.value)}>
              {opt.label}
            </OptionRow>
          ))}
        </OptionGroup>
      )}
      {mapView && (
        <OptionGroup label="Category">
          {CATEGORY_OPTIONS.map(opt => (
            <OptionRow
              key={opt.value}
              icon={opt.value === 'all' ? mdiShapeOutline : CATEGORY_ICONS[opt.value]}
              active={mapCategory === opt.value}
              onClick={() => setMapCategory(opt.value)}
            >
              {opt.label}
            </OptionRow>
          ))}
        </OptionGroup>
      )}
    </div>
  );

  // Desktop: floating pill pinned to the panel's bottom-left, same bottom
  // offset as EditingToolbar. Portaled into #toast-glow-root inside a clip
  // layer matching the grey panel (.dashboard-panel-clip) so its drop shadow
  // is clipped by the panel edge instead of washing into the white gutter.
  // Falls back to viewport-fixed (unclipped) if the root isn't mounted.
  const desktopPill = (
      <div
        className={`hidden lg:flex z-[63] pointer-events-none justify-start ${
          glowRoot
            ? 'absolute dashboard-panel-clip pl-ha-5'
            : 'fixed bottom-20 left-[76px] right-0 pl-ha-8'
        }`}
        style={{
          paddingBottom: glowRoot
            ? 'var(--ha-space-5)'
            : `calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {/* Hover buffer — a transparent padded zone carries the hover state so a
            small mouse slip off the visible pill doesn't collapse it. Aligned to
            the bottom so the pill grows upward from its resting spot. */}
        <div
          className="pointer-events-auto self-end p-ha-3 -m-ha-3"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
        <motion.div
          layout
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            default: TOOLBAR_SPRING,
            layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
          }}
          onFocusCapture={() => setExpanded(true)}
          onBlurCapture={() => setExpanded(false)}
          className={`rounded-ha-3xl bg-surface-default/95 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex flex-col items-start transition-[padding] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            expanded ? 'w-[15rem] max-h-[60vh] overflow-y-auto scrollbar-hide px-ha-4 py-ha-3 gap-ha-4' : 'p-ha-3'
          }`}
        >
          {expanded ? (
            optionGroups
          ) : (
            <span className="relative flex items-center justify-center">
              <Icon path={mdiFilterOutline} size={20} className="text-text-secondary" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ha-blue px-1 text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </span>
          )}
        </motion.div>
        </div>
      </div>
  );

  return (
    <>
      {/* Ambient hover glow — mirror of the connected-toast corner glow, clipped
          to the dashboard panel's bottom-left corner. */}
      <FilterGlow show={expanded} />

      {glowRoot ? createPortal(desktopPill, glowRoot) : desktopPill}

      {/* Mobile: compact FAB bottom-left + popover above it. */}
      <div
        ref={fabRef}
        className={`lg:hidden fixed z-[66] transition-opacity duration-150 ease-out ${
          navOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
        style={{
          left: 'var(--spacing-edge, 12px)',
          bottom: 'calc(var(--mobile-nav-height, 6rem) + var(--ha-space-2, 0.5rem))',
        }}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              key="filter-popover"
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={POPOVER_SPRING}
              style={{ transformOrigin: 'bottom left' }}
              className="absolute bottom-full mb-ha-2 left-0 w-[min(78vw,20rem)] rounded-ha-3xl bg-surface-default/95 border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] p-ha-4"
            >
              {optionGroups}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Square FAB matching the mobile corner toast's height (py-ha-2 + 36px tile),
            same drop shadow as the toast / EditingToolbar. */}
        <button
          type="button"
          aria-label="Filters"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className={`flex items-center justify-center p-ha-2 rounded-ha-3xl border transition-colors shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] ${
            open || activeFilterCount > 0
              ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
              : 'border-surface-low/50 bg-surface-default/95 text-text-secondary'
          }`}
        >
          <span className="relative flex h-9 w-9 items-center justify-center">
            <Icon path={mdiFilterOutline} size={22} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ha-blue px-1 text-[10px] font-bold leading-none text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
        </button>
      </div>
    </>
  );
}
