'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEditMode } from '@/contexts';
import { Icon } from '@/components/ui/Icon';
import {
  mdiMonitor,
  mdiTablet,
  mdiCellphone,
  mdiUndo,
  mdiRedo,
} from '@mdi/js';
import type { PreviewViewport } from '@/contexts/EditModeContext';

const VIEWPORTS: { key: PreviewViewport; icon: string; label: string }[] = [
  { key: 'desktop', icon: mdiMonitor, label: 'Desktop view' },
  { key: 'tablet', icon: mdiTablet, label: 'Tablet view' },
  { key: 'mobile', icon: mdiCellphone, label: 'Mobile view' },
];

const SPRING = { type: 'spring' as const, stiffness: 500, damping: 36, mass: 0.7 };
const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };

function ViewportButtons({ id, active, onChange }: { id: string; active: PreviewViewport; onChange: (v: PreviewViewport) => void }) {
  return (
    <div className="flex items-center">
      {VIEWPORTS.map(({ key, icon, label }) => (
        <button
          key={key}
          aria-label={label}
          onClick={() => onChange(key)}
          className="relative w-11 h-11 rounded-ha-xl flex items-center justify-center"
        >
          {active === key && (
            <motion.div
              layoutId={`${id}-indicator`}
              className="absolute inset-0 rounded-ha-xl bg-surface-mid"
              transition={SPRING}
            />
          )}
          <Icon
            path={icon}
            size={20}
            className={`relative z-10 transition-colors duration-150 ${active === key ? 'text-text-primary' : 'text-text-secondary'}`}
          />
        </button>
      ))}
    </div>
  );
}

export function EditingToolbar() {
  const { isEditing, exitEditMode, previewViewport, setPreviewViewport } = useEditMode();

  return (
    <AnimatePresence>
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.96 }}
          transition={TOOLBAR_SPRING}
          className="fixed z-[60] pointer-events-none inset-x-0 bottom-0 lg:left-[76px] lg:bottom-20 lg:right-0"
          style={{ paddingBottom: `calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))` }}
        >
          {/* Mobile: full-width pill matching MobileNav style */}
          <div className="lg:hidden px-edge pointer-events-auto">
            <div className="relative rounded-ha-3xl bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)]">
              <div className="relative rounded-[23px] bg-surface-default/95 backdrop-blur-md px-edge py-ha-3">
                <div className="flex items-center gap-ha-2">
                  <ViewportButtons id="mobile" active={previewViewport} onChange={setPreviewViewport} />

                  <div className="flex-1" />

                  <button aria-label="Undo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                    <Icon path={mdiUndo} size={20} />
                  </button>
                  <button aria-label="Redo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                    <Icon path={mdiRedo} size={20} />
                  </button>

                  <button
                    onClick={exitEditMode}
                    className="h-11 px-6 rounded-ha-pill bg-ha-blue text-white font-semibold text-sm active:scale-95 transition-transform"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: centered floating pill */}
          <div className="hidden lg:flex justify-center pointer-events-auto">
            <div className="px-ha-2 py-ha-2 rounded-ha-3xl bg-surface-default/95 backdrop-blur-md shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex items-center gap-ha-1">
              <ViewportButtons id="desktop" active={previewViewport} onChange={setPreviewViewport} />

              <div className="w-px h-6 bg-border-default mx-ha-1" />

              <button aria-label="Undo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                <Icon path={mdiUndo} size={20} />
              </button>
              <button aria-label="Redo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                <Icon path={mdiRedo} size={20} />
              </button>

              <button
                onClick={exitEditMode}
                className="h-11 px-6 rounded-ha-pill bg-ha-blue text-white font-semibold text-sm hover:bg-ha-blue/90 active:scale-95 transition-all ml-ha-1"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
