'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  mdiCheck, mdiViewListOutline, mdiMapOutline, mdiFloorPlan, mdiDevices,
  mdiShapeOutline, mdiLayersTripleOutline, mdiFilterOutline,
  mdiFilterRemoveOutline, mdiClose,
} from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { CATEGORY_ORDER, CATEGORY_TITLES, CATEGORY_ICONS, type DeviceCategory } from '@/lib/homeassistant/entityHelpers';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { GlowCanvas } from '@/components/ui/GlowCanvas';
import { useElementById } from '@/hooks/useElementById';

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
 * - Mobile: a compact FAB pinned bottom-left. Tapping it opens a popover above
 *   the button with the full set of grouping/floor options.
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

  // Clear every filter that contributes to activeFilterCount back to default:
  // All floors, group-by-area, all categories. Leaves the list/map view as-is
  // (a view choice, not a filter — see activeFilterCount in page.tsx).
  const resetFilters = () => {
    setActiveFloorId(null);
    setGroupBy('area');
    setMapCategory('all');
  };

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fabRef = useRef<HTMLSpanElement>(null);
  // Where the mobile popover hangs: just above the filter button, on the
  // screen's right gutter. Read once, on the tap that opens it.
  const [anchor, setAnchor] = useState<{ bottom: number } | null>(null);
  const toggleMobile = () => {
    const r = fabRef.current?.getBoundingClientRect();
    if (r) setAnchor({ bottom: window.innerHeight - r.top + 8 });
    setOpen(o => !o);
  };
  const popoverRef = useRef<HTMLDivElement>(null);
  // Clip layer for the desktop pill — same on-top portal layer FilterGlow uses
  // (#toast-glow-root), so the pill's drop shadow is clipped to the grey panel.
  const [glowRoot, setGlowRoot] = useState<HTMLElement | null>(null);
  // The bottom nav's floating-action slot — the filter button lives there on a
  // phone, beside the plus.
  const topSlot = useElementById('mobile-fab-filter');

  useEffect(() => {
    setGlowRoot(document.getElementById('toast-glow-root'));
  }, []);

  // The map can only show one floor at a time (floors share the same grid
  // space), so it drops the "All" option and defaults to the first floor.
  const effectiveFloor = mapView ? (activeFloorId ?? floors[0]?.floor_id ?? null) : activeFloorId;

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
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={resetFilters}
          className="flex h-10 w-full items-center justify-center gap-ha-2 rounded-ha-xl text-sm font-medium text-text-secondary transition-colors hover:bg-surface-default hover:text-text-primary"
        >
          <Icon path={mdiFilterRemoveOutline} size={16} />
          Reset filters
        </button>
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
          onFocus={() => setExpanded(true)}
          onBlur={() => setExpanded(false)}
          className={`rounded-ha-3xl bg-surface-default/95 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex items-center transition-[padding] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            expanded ? 'flex-col items-start w-[15rem] max-h-[60vh] overflow-y-auto scrollbar-hide px-ha-4 py-ha-3 gap-ha-4' : 'p-ha-3'
          }`}
        >
          {expanded ? (
            optionGroups
          ) : (
            // Collapsed = one pill surface. Hover-to-expand lives ONLY on the
            // filter glyph, so reaching for the X never triggers the panel.
            <div className="flex items-center">
              <span
                className="flex items-center justify-center"
                onMouseEnter={() => setExpanded(true)}
              >
                <Icon
                  path={mdiFilterOutline}
                  size={20}
                  className={activeFilterCount > 0 ? 'text-ha-blue' : 'text-text-secondary'}
                />
              </span>
              <AnimatePresence initial={false}>
                {activeFilterCount > 0 && (
                  <motion.button
                    key="desktop-clear"
                    type="button"
                    aria-label="Clear filters"
                    onClick={resetFilters}
                    // Don't let focusing the X bubble up and expand the panel
                    // (which would unmount the X and drop focus).
                    onFocus={(e) => e.stopPropagation()}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="group/clear flex items-center overflow-hidden"
                  >
                    <span className="mx-ha-2 h-5 w-px shrink-0 bg-text-tertiary/40" />
                    <Icon
                      path={mdiClose}
                      size={18}
                      className="shrink-0 text-text-secondary transition-colors group-hover/clear:text-text-primary"
                    />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
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

      {/* Mobile: a small floating button bottom-right, beside the plus, riding
          on the nav bar (the slot lives in MobileNav and drops with the bar
          when it tucks away). A dot marks an active filter; the popover rises
          from the button and carries the reset. */}
      {topSlot && createPortal(
        <span ref={fabRef} className="relative inline-flex lg:hidden">
          <button
            type="button"
            aria-label="Filters"
            aria-expanded={open}
            onClick={toggleMobile}
            className={`flex h-12 w-12 items-center justify-center rounded-ha-2xl border bg-surface-default shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] transition-[color,transform] active:scale-95 motion-reduce:active:scale-100 ${
              open || activeFilterCount > 0 ? 'border-ha-blue/40 text-ha-blue' : 'border-text-primary/[0.08] text-text-secondary'
            }`}
          >
            <Icon path={mdiFilterOutline} size={24} />
          </button>
          {activeFilterCount > 0 && (
            <span aria-hidden className="pointer-events-none absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-ha-blue ring-2 ring-surface-default" />
          )}
        </span>,
        topSlot,
      )}
      {topSlot && createPortal(
        <AnimatePresence>
          {open && anchor && (
            <motion.div
              ref={popoverRef}
              key="filter-popover"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={POPOVER_SPRING}
              style={{ transformOrigin: 'bottom right', bottom: anchor.bottom, right: 'var(--spacing-edge, 12px)' }}
              className="lg:hidden fixed z-[66] w-[min(78vw,20rem)] max-h-[calc(100dvh-12rem)] overflow-y-auto scrollbar-hide rounded-ha-3xl bg-surface-default border border-text-primary/[0.06] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] p-ha-4"
            >
              {optionGroups}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
