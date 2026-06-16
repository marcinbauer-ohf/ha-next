'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiTune, mdiCheck } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export type DashboardGroupBy = 'area' | 'type' | 'category';

const GROUP_OPTIONS: { value: DashboardGroupBy; label: string }[] = [
  { value: 'area', label: 'Area' },
  { value: 'type', label: 'Device' },
  { value: 'category', label: 'Category' },
];

const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };
const POPOVER_SPRING = { type: 'spring' as const, stiffness: 460, damping: 32, mass: 0.7 };

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
  const fabRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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
      {/* Desktop: centered floating pill, same bottom offset as EditingToolbar. */}
      <div
        className="hidden lg:flex fixed z-[55] pointer-events-none inset-x-0 bottom-20 left-[76px] right-0 justify-center"
        style={{ paddingBottom: `calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))` }}
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={TOOLBAR_SPRING}
          className="pointer-events-auto px-ha-2 py-ha-2 rounded-ha-3xl bg-surface-default/95 backdrop-blur-md shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex items-center gap-ha-2"
        >
          {showFloors && (
            <SegmentedControl
              segments={[
                { value: '__all__', label: 'All' },
                ...floors.map(f => ({ value: f.floor_id, label: f.name })),
              ]}
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
              className="absolute bottom-full mb-ha-2 left-0 w-[min(78vw,20rem)] rounded-ha-3xl bg-surface-default/95 backdrop-blur-md border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] p-ha-4"
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
          className={`flex items-center justify-center p-ha-2 rounded-ha-3xl backdrop-blur-md border transition-colors shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] ${
            open || activeFilterCount > 0
              ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
              : 'border-surface-low/50 bg-surface-default/95 text-text-secondary'
          }`}
        >
          <span className="relative flex h-9 w-9 items-center justify-center">
            <Icon path={mdiTune} size={18} />
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
