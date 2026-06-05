'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MdiIcon } from './MdiIcon';

const ITEMS = [
  { key: 'device', label: 'Device', icon: 'mdi:devices', desc: 'Pair and set up a device', colorClass: 'bg-ha-blue/10 text-ha-blue' },
  { key: 'integration', label: 'Integration', icon: 'mdi:puzzle-outline', desc: 'Connect a service or platform', colorClass: 'bg-purple-500/10 text-purple-500' },
  { key: 'dashboard', label: 'Dashboard', icon: 'mdi:view-dashboard-outline', desc: 'Create a new dashboard', colorClass: 'bg-teal-500/10 text-teal-500' },
  { key: 'automation', label: 'Automation', icon: 'mdi:robot-happy-outline', desc: 'Automate your home', colorClass: 'bg-orange-500/10 text-orange-500' },
  { key: 'scene', label: 'Scene', icon: 'mdi:palette-outline', desc: 'Save a state snapshot', colorClass: 'bg-pink-500/10 text-pink-500' },
  { key: 'script', label: 'Script', icon: 'mdi:script-text-outline', desc: 'Create reusable actions', colorClass: 'bg-green-500/10 text-green-500' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function AddMenu({ isOpen, onClose, anchorRef }: Props) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    }
  }, [isOpen, anchorRef]);

  if (typeof document === 'undefined') return null;

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
            className="lg:hidden fixed inset-0 z-[199] bg-black/40 backdrop-blur-[2px]"
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
              className="hidden lg:block fixed z-[200] w-72 bg-surface-default rounded-ha-2xl shadow-2xl border border-surface-low/80 overflow-hidden"
              style={{
                top: anchorRect.bottom + 8,
                right: typeof window !== 'undefined' ? window.innerWidth - anchorRect.right : 16,
                transformOrigin: 'top right',
              }}
            >
              <div className="p-ha-2">
                {ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={onClose}
                    className="w-full flex items-center gap-ha-3 px-ha-3 py-ha-2.5 rounded-ha-xl hover:bg-surface-low transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-ha-lg flex items-center justify-center flex-shrink-0 ${item.colorClass}`}>
                      <MdiIcon icon={item.icon} size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-secondary truncate">{item.desc}</p>
                    </div>
                  </button>
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
              <div className="space-y-ha-1">
                {ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={onClose}
                    className="w-full flex items-center gap-ha-3 px-ha-3 py-ha-3 rounded-ha-xl hover:bg-surface-low active:bg-surface-low transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-ha-xl flex items-center justify-center flex-shrink-0 ${item.colorClass}`}>
                      <MdiIcon icon={item.icon} size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-secondary">{item.desc}</p>
                    </div>
                  </button>
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
