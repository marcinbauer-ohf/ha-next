'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCloseOnScreensaver, useToast } from '@/contexts';
import { haptic } from '@/lib/haptics';
import { Icon } from '@/components/ui/Icon';
import { ListSection } from '@/components/ui';
import { mdiCheck, mdiBackupRestore } from '@mdi/js';
import { Button } from '../ui';

// Each option maps a human choice to the localStorage keys it clears. Reset is
// destructive (edit mode saves on the spot — there's no cancel buffer), so the
// dialog lets the user pick exactly which customizations to wipe.
const RESET_OPTIONS: { key: string; label: string; description: string; storageKeys: string[] }[] = [
  {
    key: 'cards',
    label: 'Device cards',
    description: 'The controls and photos shown on each card',
    storageKeys: ['ha_device_card_configs'],
  },
  {
    key: 'favorites',
    label: 'Favorites',
    description: 'The favorited devices section',
    storageKeys: ['ha_favorites'],
  },
  {
    key: 'layout',
    label: 'Order & grouping',
    description: 'Card order, grouping, and list/map view',
    storageKeys: ['ha_device_order', 'ha_group_by', 'ha_dashboard_view', 'ha_map_category'],
  },
];

export function ResetDashboardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(RESET_OPTIONS.map(o => o.key)));

  useCloseOnScreensaver(open, onClose);

  // Reset selection to "all" each time the dialog opens.
  useEffect(() => {
    if (open) setSelected(new Set(RESET_OPTIONS.map(o => o.key)));
  }, [open]);

  const anySelected = selected.size > 0;

  const handleConfirm = () => {
    if (!anySelected) return;
    haptic('warning');
    try {
      for (const opt of RESET_OPTIONS) {
        if (selected.has(opt.key)) opt.storageKeys.forEach(k => localStorage.removeItem(k));
      }
    } catch {
      /* ignore */
    }
    onClose();
    showToast({ title: 'Dashboard reset', subtitle: 'Reloading with defaults…', icon: mdiBackupRestore });
    // Hooks read these keys into state on mount, so a reload is the reliable
    // way to re-derive the dashboard from scratch (mirrors prototypeReset).
    setTimeout(() => window.location.reload(), 650);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            className="relative bg-surface-default rounded-ha-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-surface-lower"
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="p-ha-5 pb-ha-3">
              <h3 className="text-lg font-semibold text-text-primary">Reset dashboard?</h3>
              <p className="mt-ha-2 text-sm text-text-secondary leading-relaxed">
                Choose what to restore to defaults. This can’t be undone.
              </p>
            </div>

            <div className="px-ha-4 pb-ha-2">
              <ListSection>
              {RESET_OPTIONS.map(opt => {
                const checked = selected.has(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => {
                      haptic('select');
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(opt.key)) next.delete(opt.key);
                        else next.add(opt.key);
                        return next;
                      });
                    }}
                    className="w-full px-ha-4 py-ha-3 flex items-center gap-ha-3 text-left hover:bg-surface-low transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary">{opt.label}</div>
                      <div className="mt-0.5 text-xs text-text-secondary">{opt.description}</div>
                    </div>
                    <div
                      className={`h-6 w-6 shrink-0 rounded-ha-md flex items-center justify-center transition-colors ${
                        checked ? 'bg-red-500 text-white' : 'bg-surface-mid text-transparent'
                      }`}
                    >
                      <Icon path={mdiCheck} size={16} />
                    </div>
                  </button>
                );
              })}
              </ListSection>
            </div>

            <div className="flex gap-ha-2 p-ha-4 pt-ha-3">
              <Button onClick={onClose} className="flex-1">Cancel</Button>
              <Button
                variant="danger"
                onClick={handleConfirm}
                disabled={!anySelected}
                className="flex-1"
              >
                Reset
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
