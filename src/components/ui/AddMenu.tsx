'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiChevronDown, mdiLayers } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from './Icon';
import { useAddContext, useCloseOnScreensaver } from '@/contexts';
import { useScrollFades } from '@/hooks/useScrollFades';
import { useHomeAssistant } from '@/hooks';
import { addableSettingsItems, isAdminOnlySlug, type AddableSettingsItem } from '@/components/profile/settingsNavigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

// A menu row. Most map 1:1 to a settings section (navigate on select); some
// sections expand into several create actions (Areas → Add area + Add floor)
// that open an editor in-place via the AddContext request channel.
interface AddMenuRow extends AddableSettingsItem {
  /** Stable key — slugs alone collide once a section expands into variants. */
  key: string;
  /** When set, select raises a create request for slug/variant (no navigation away). */
  variant?: string;
  /** Belongs to the hoisted primary group (drives the divider / collapse split). */
  contextGroup?: boolean;
}

// Sections that expose multiple create actions in the "+" menu.
function expandRow(item: AddableSettingsItem, contextGroup: boolean): AddMenuRow[] {
  if (item.slug === 'areas') {
    return [
      { ...item, key: 'areas:area', label: 'Area', variant: 'area', contextGroup },
      { ...item, key: 'areas:floor', label: 'Floor', icon: mdiLayers, variant: 'floor', contextGroup },
    ];
  }
  return [{ ...item, key: item.slug, contextGroup }];
}

export function AddMenu({ isOpen, onClose, anchorRef }: Props) {
  const router = useRouter();
  const { isAdmin } = useHomeAssistant();
  const { contextSlug, requestAdd } = useAddContext();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { attach: attachDropdownFades, showTop: dropdownTop, showBottom: dropdownBottom } = useScrollFades<HTMLDivElement>();
  const { attach: attachSheetFades, showTop: sheetTop, showBottom: sheetBottom } = useScrollFades<HTMLDivElement>();

  useCloseOnScreensaver(isOpen, onClose);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    }
    if (isOpen) setExpanded(false);
  }, [isOpen, anchorRef]);

  // Hoist the current settings section's create action(s) to the top (e.g.
  // viewing Areas → Area / Floor first); the rest stay in settings order.
  // With no section context (e.g. on the dashboard) hoist the most common
  // create targets — integration / device / automation / scene — and collapse
  // the rest behind a "Show more options" row.
  const items = useMemo<AddMenuRow[]>(() => {
    const allowed = addableSettingsItems.filter((i) => isAdmin || !isAdminOnlySlug(i.slug));
    const hit = contextSlug ? allowed.find((i) => i.slug === contextSlug) : undefined;
    if (hit) {
      const rest = allowed.filter((i) => i.slug !== contextSlug);
      return [...expandRow(hit, true), ...rest.flatMap((i) => expandRow(i, false))];
    }
    const hoisted = ['integrations', 'devices', 'automations', 'scenes'];
    const priority = hoisted
      .map((slug) => allowed.find((i) => i.slug === slug))
      .filter((i): i is AddableSettingsItem => Boolean(i));
    const rest = allowed.filter((i) => !hoisted.includes(i.slug));
    return [
      ...priority.flatMap((i) => expandRow(i, true)),
      ...rest.flatMap((i) => expandRow(i, false)),
    ];
  }, [contextSlug, isAdmin]);

  const primary = useMemo(() => items.filter((i) => i.contextGroup), [items]);
  const rest = useMemo(() => items.filter((i) => !i.contextGroup), [items]);
  // Only the no-context (dashboard) menu collapses; inside a settings section
  // the full list is always visible with the section's actions hoisted.
  const collapsed = !contextSlug && !expanded;

  const handleSelect = (item: AddMenuRow) => {
    onClose();
    if (item.variant) requestAdd(item.slug, item.variant);
    router.push(`/settings/${item.slug}`);
  };

  if (typeof document === 'undefined') return null;

  const renderRow = (item: AddMenuRow, size: 'sm' | 'lg') => {
    const tile = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        className="w-full flex items-center gap-ha-3 px-ha-3 py-ha-3 rounded-ha-xl transition-colors text-left hover:bg-surface-low active:bg-surface-low"
      >
        <div
          className={`${tile} rounded-ha-lg flex items-center justify-center flex-shrink-0`}
          style={{ backgroundColor: `${item.accent}24`, color: item.accent }}
        >
          <Icon path={item.icon} size={size === 'lg' ? 22 : 20} />
        </div>
        <p className="text-sm font-medium text-text-primary">{item.label}</p>
      </button>
    );
  };

  const renderShowMore = (size: 'sm' | 'lg') => {
    const tile = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-ha-3 px-ha-3 py-ha-3 rounded-ha-xl transition-colors text-left hover:bg-surface-low active:bg-surface-low"
      >
        <div className={`${tile} rounded-ha-lg flex items-center justify-center flex-shrink-0 bg-surface-low text-text-secondary`}>
          <Icon path={mdiChevronDown} size={size === 'lg' ? 22 : 20} />
        </div>
        <p className="text-sm font-medium text-text-secondary">Show more options</p>
      </button>
    );
  };

  // Primary rows, then either the collapsed "Show more options" row or the
  // divider + remaining rows (animated open when revealed by the expander).
  const renderList = (size: 'sm' | 'lg') => (
    <>
      {primary.map((item) => renderRow(item, size))}
      {collapsed ? (
        renderShowMore(size)
      ) : (
        <>
          <div className="my-ha-1 mx-ha-3 border-t border-surface-low/30" />
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {rest.map((item) => renderRow(item, size))}
            </motion.div>
          ) : (
            rest.map((item) => renderRow(item, size))
          )}
        </>
      )}
    </>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-[199] bg-black/70"
            onClick={onClose}
          />
          {/* Desktop click-outside capture */}
          <div
            className="hidden lg:block fixed inset-0 z-[199]"
            onClick={onClose}
          />

          {/* Desktop dropdown */}
          {anchorRect && (
            <motion.div
              key="dropdown"
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block fixed z-[200] w-64 bg-surface-default rounded-ha-2xl shadow-2xl border border-surface-low/80 overflow-hidden"
              style={{
                top: anchorRect.bottom + 8,
                right: typeof window !== 'undefined' ? window.innerWidth - anchorRect.right : 16,
                transformOrigin: 'top right',
              }}
            >
              <div className="relative">
                <div className={clsx('absolute top-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-b from-surface-default via-surface-default/60 to-transparent z-10 transition-opacity duration-300', dropdownTop ? 'opacity-100' : 'opacity-0')} />
                <div className={clsx('absolute bottom-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-t from-surface-default via-surface-default/60 to-transparent z-10 transition-opacity duration-300', dropdownBottom ? 'opacity-100' : 'opacity-0')} />
                <div ref={attachDropdownFades} className="p-ha-2 max-h-[min(70vh,560px)] overflow-y-auto scrollbar-hide">
                  {renderList('sm')}
                </div>
              </div>
            </motion.div>
          )}

          {/* Mobile bottom sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden fixed inset-x-0 bottom-0 z-[200] bg-surface-default rounded-t-ha-3xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            <div className="flex justify-center pt-ha-3 pb-ha-1">
              <div className="w-8 h-1 rounded-full bg-text-secondary/30" />
            </div>
            <div className="px-ha-4 pt-ha-2 pb-ha-3">
              <h3 className="text-base font-semibold text-text-primary mb-ha-3 px-ha-1">Add</h3>
              <div className="relative">
                <div className={clsx('absolute top-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-b from-surface-default via-surface-default/60 to-transparent z-10 transition-opacity duration-300', sheetTop ? 'opacity-100' : 'opacity-0')} />
                <div className={clsx('absolute bottom-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-t from-surface-default via-surface-default/60 to-transparent z-10 transition-opacity duration-300', sheetBottom ? 'opacity-100' : 'opacity-0')} />
                <div ref={attachSheetFades} className="space-y-ha-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
                  {renderList('lg')}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
