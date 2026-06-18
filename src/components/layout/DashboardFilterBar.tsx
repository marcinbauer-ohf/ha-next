'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { mdiCheck } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { GlowCanvas } from '@/components/ui/GlowCanvas';

export type DashboardGroupBy = 'area' | 'type' | 'category';

const GROUP_OPTIONS: { value: DashboardGroupBy; label: string }[] = [
  { value: 'area', label: 'Area' },
  { value: 'type', label: 'Device' },
  { value: 'category', label: 'Category' },
];

const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };
const POPOVER_SPRING = { type: 'spring' as const, stiffness: 460, damping: 32, mass: 0.7 };

/**
 * A single slim, text-free pill standing in for a selector group in the
 * minimized desktop bar. No selection state — just a compact placeholder.
 */
function MiniPill() {
  return <span className="h-1.5 w-8 rounded-full bg-text-secondary/35" />;
}

// Dark ambient-glow colour (0–1 RGB) — matches the edit-mode dashboard glow
// (rgba(0,0,0,0.14)): a soft shadow tint, not a brand hue.
const GLOW_COLOR: [number, number, number] = [0, 0, 0];

/**
 * Ambient hover glow for the desktop filter pill — the dark mirror of the
 * connected toast's corner glow. Portaled into #filter-glow-root, a layer that
 * sits BEHIND the dashboard cards (inside the surface's rounded clip), so the
 * bloom pools behind the content instead of washing over it. Anchored to the
 * panel's bottom-LEFT corner where the pill sits.
 */
function FilterGlow({ show }: { show: boolean }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById('filter-glow-root'));
  }, [show]);

  if (!root) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="hidden lg:block absolute bottom-0 left-0 pointer-events-none"
          style={{ width: 'min(88%, 44rem)', height: '19rem', transformOrigin: '0% 100%' }}
          initial={{ scale: 0.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlowCanvas className="w-full h-full" color={GLOW_COLOR} origin={[0, 1]} radius={[0.9, 0.62]} intensity={0.28} />
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
}

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
}: DashboardFilterBarProps) {
  const showFloors = floors.length >= 2;
  const hasFilters = showFloors || hasAreas;

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const floorSegments = [
    { value: '__all__', label: 'All' },
    ...floors.map(f => ({ value: f.floor_id, label: f.name })),
  ];

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
    <div className="flex flex-col gap-ha-4">
      {showFloors && (
        <div>
          <SectionLabel>Floor</SectionLabel>
          <div className="mt-ha-2 flex flex-wrap gap-ha-2">
            <Chip active={activeFloorId === null} onClick={() => setActiveFloorId(null)}>
              {activeFloorId === null && <Icon path={mdiCheck} size={13} />}
              All
            </Chip>
            {floors.map(f => (
              <Chip
                key={f.floor_id}
                active={activeFloorId === f.floor_id}
                onClick={() => setActiveFloorId(f.floor_id)}
              >
                {activeFloorId === f.floor_id && <Icon path={mdiCheck} size={13} />}
                {f.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {hasAreas && (
        <div>
          <SectionLabel>Group by</SectionLabel>
          <div className="mt-ha-2 flex flex-wrap gap-ha-2">
            {GROUP_OPTIONS.map(opt => (
              <Chip key={opt.value} active={groupBy === opt.value} onClick={() => setGroupBy(opt.value)}>
                {groupBy === opt.value && <Icon path={mdiCheck} size={13} />}
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Ambient hover glow — mirror of the connected-toast corner glow, clipped
          to the dashboard panel's bottom-left corner. */}
      <FilterGlow show={expanded} />

      {/* Desktop: floating pill pinned to the left, same bottom offset as
          EditingToolbar. Sits just past the nav rail, aligned with the content
          gutter. */}
      <div
        className="hidden lg:flex fixed z-[55] pointer-events-none bottom-20 left-[76px] right-0 justify-start pl-ha-8"
        style={{ paddingBottom: `calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))` }}
      >
        <motion.div
          layout
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            default: TOOLBAR_SPRING,
            layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
          }}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onFocusCapture={() => setExpanded(true)}
          onBlurCapture={() => setExpanded(false)}
          className={`pointer-events-auto rounded-ha-3xl bg-surface-default/95 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex items-center gap-ha-2 transition-[padding] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            expanded ? 'px-ha-2 py-ha-2' : 'px-ha-3 py-1.5'
          }`}
        >
          {expanded ? (
            <>
              {showFloors && (
                <SegmentedControl
                  segments={floorSegments}
                  value={activeFloorId ?? '__all__'}
                  onChange={v => setActiveFloorId(v === '__all__' ? null : v)}
                  className="max-w-[40vw] overflow-x-auto scrollbar-hide"
                />
              )}
              {showFloors && hasAreas && <div className="w-px h-6 bg-border-default" />}
              {hasAreas && (
                <SegmentedControl
                  segments={GROUP_OPTIONS}
                  value={groupBy}
                  onChange={v => setGroupBy(v as DashboardGroupBy)}
                />
              )}
            </>
          ) : (
            <>
              {showFloors && <MiniPill />}
              {showFloors && hasAreas && <div className="w-px h-3 bg-border-default" />}
              {hasAreas && <MiniPill />}
            </>
          )}
        </motion.div>
      </div>

      {/* Mobile: compact FAB bottom-left + popover above it. */}
      <div
        ref={fabRef}
        className="lg:hidden fixed z-[66] pointer-events-auto"
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
          {/* Compact mirror of the desktop collapsed bar: the two selector
              groups as stacked pills inside the floating square. */}
          <span className="relative flex h-9 w-9 flex-col items-center justify-center gap-1.5">
            {showFloors && <MiniPill />}
            {hasAreas && <MiniPill />}
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
