'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiLayers } from '@mdi/js';
import { Icon } from './Icon';
import { useAddContext, useCloseOnScreensaver } from '@/contexts';
import { addableSettingsItems, type AddableSettingsItem } from '@/components/profile/settingsNavigation';

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
  /** Belongs to the hoisted current-section group (drives the divider). */
  contextGroup?: boolean;
}

// Sections that expose multiple create actions in the "+" menu.
function expandRow(item: AddableSettingsItem, contextGroup: boolean): AddMenuRow[] {
  if (item.slug === 'areas') {
    return [
      { ...item, key: 'areas:area', label: 'Add area', variant: 'area', contextGroup },
      { ...item, key: 'areas:floor', label: 'Add floor', icon: mdiLayers, variant: 'floor', contextGroup },
    ];
  }
  return [{ ...item, key: item.slug, contextGroup }];
}

export function AddMenu({ isOpen, onClose, anchorRef }: Props) {
  const router = useRouter();
  const { contextSlug, requestAdd } = useAddContext();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useCloseOnScreensaver(isOpen, onClose);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    }
  }, [isOpen, anchorRef]);

  // Hoist the current settings section's create action(s) to the top (e.g.
  // viewing Areas → Add area / Add floor first); the rest stay in settings order.
  const items = useMemo<AddMenuRow[]>(() => {
    const hit = contextSlug ? addableSettingsItems.find((i) => i.slug === contextSlug) : undefined;
    if (!hit) return addableSettingsItems.flatMap((i) => expandRow(i, false));
    const rest = addableSettingsItems.filter((i) => i.slug !== contextSlug);
    return [...expandRow(hit, true), ...rest.flatMap((i) => expandRow(i, false))];
  }, [contextSlug]);

  // Key of the last hoisted item, so the divider sits after the whole group.
  const lastContextKey = useMemo(() => {
    const ctx = items.filter((i) => i.contextGroup);
    return ctx.length ? ctx[ctx.length - 1].key : null;
  }, [items]);

  const handleSelect = (item: AddMenuRow) => {
    onClose();
    if (item.variant) requestAdd(item.slug, item.variant);
    router.push(`/settings/${item.slug}`);
  };

  if (typeof document === 'undefined') return null;

  const renderRow = (item: AddMenuRow, _index: number, size: 'sm' | 'lg') => {
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
            className="lg:hidden fixed inset-0 z-[199] bg-black/40-[2px]"
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
              <div className="p-ha-2 max-h-[min(70vh,560px)] overflow-y-auto scrollbar-hide">
                {items.map((item, i) => (
                  <div key={item.key}>
                    {renderRow(item, i, 'sm')}
                    {item.key === lastContextKey && (
                      <div className="my-ha-1 mx-ha-3 border-t border-surface-low/30" />
                    )}
                  </div>
                ))}
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
              <div className="space-y-ha-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
                {items.map((item, i) => (
                  <div key={item.key}>
                    {renderRow(item, i, 'lg')}
                    {item.key === lastContextKey && (
                      <div className="my-ha-1 mx-ha-3 border-t border-surface-low/30" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
