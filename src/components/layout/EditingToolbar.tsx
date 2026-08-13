'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEditMode } from '@/contexts';
import { Icon } from '@/components/ui/Icon';
import { EditorToolbarShell, ToolbarPrimaryButton } from './EditorToolbarShell';
import { ResetDashboardDialog } from './ResetDashboardDialog';
import {
  mdiMonitor,
  mdiTablet,
  mdiCellphone,
  mdiUndo,
  mdiRedo,
  mdiBackupRestore,
} from '@mdi/js';
import type { PreviewViewport, PreviewOrientation } from '@/contexts/EditModeContext';

// glyphOrientation = how the MDI glyph is naturally drawn; the icon rotates
// whenever the preview orientation differs from it.
const VIEWPORTS: { key: PreviewViewport; icon: string; label: string; glyphOrientation?: PreviewOrientation }[] = [
  { key: 'desktop', icon: mdiMonitor, label: 'Desktop view' },
  { key: 'tablet', icon: mdiTablet, label: 'Tablet view', glyphOrientation: 'landscape' },
  { key: 'mobile', icon: mdiCellphone, label: 'Mobile view', glyphOrientation: 'portrait' },
];

const SPRING = { type: 'spring' as const, stiffness: 500, damping: 36, mass: 0.7 };

function ViewportButtons({ id, active, orientation, onChange, onToggleOrientation }: {
  id: string;
  active: PreviewViewport;
  orientation: PreviewOrientation;
  onChange: (v: PreviewViewport) => void;
  onToggleOrientation: () => void;
}) {
  return (
    // Grouped like the areas toolbar's List/Map switch — one recessed track
    // holds all three, so they read as a single either/or control rather than
    // three loose icon buttons. Same 40px segments + 2px track padding, which
    // lands the group at the toolbar's 44px control height.
    <div className="flex items-center rounded-ha-xl bg-surface-low p-0.5">
      {VIEWPORTS.map(({ key, icon, label, glyphOrientation }) => {
        const isActive = active === key;
        // Desktop has no orientation; tablet/mobile flip portrait/landscape
        // when tapped while already active.
        const rotatable = key !== 'desktop';
        const rotated = isActive && rotatable && glyphOrientation !== undefined && orientation !== glyphOrientation;
        return (
          <button
            key={key}
            aria-label={isActive && rotatable ? `${label} — rotate to ${orientation === 'portrait' ? 'landscape' : 'portrait'}` : label}
            onClick={() => (isActive && rotatable ? onToggleOrientation() : onChange(key))}
            className="relative w-10 h-10 rounded-ha-lg flex items-center justify-center"
          >
            {isActive && (
              <motion.div
                layoutId={`${id}-indicator`}
                className="absolute inset-0 rounded-ha-lg bg-surface-default"
                transition={SPRING}
              />
            )}
            <Icon
              path={icon}
              size={20}
              className={`relative z-10 transition-[color,transform] duration-200 ${rotated ? 'rotate-90' : 'rotate-0'} ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function EditingToolbar() {
  const { isEditing, exitEditMode, previewViewport, setPreviewViewport, previewOrientation, togglePreviewOrientation } = useEditMode();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
    <ResetDashboardDialog open={resetOpen} onClose={() => setResetOpen(false)} />
    <AnimatePresence>
      {isEditing && (
        <EditorToolbarShell
          mobile={
            <div className="flex items-center gap-ha-2">
              <button aria-label="Undo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                <Icon path={mdiUndo} size={20} />
              </button>
              <button aria-label="Redo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                <Icon path={mdiRedo} size={20} />
              </button>
              <button
                aria-label="Reset dashboard"
                onClick={() => setResetOpen(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary active:bg-surface-mid transition-colors"
              >
                <Icon path={mdiBackupRestore} size={20} />
              </button>

              <div className="flex-1" />

              <ToolbarPrimaryButton label="Done" onClick={exitEditMode} />
            </div>
          }
          desktop={
            <>
              <ViewportButtons
                id="desktop"
                active={previewViewport}
                orientation={previewOrientation}
                onChange={setPreviewViewport}
                onToggleOrientation={togglePreviewOrientation}
              />

              <div className="w-px h-6 bg-border-default mx-ha-1" />

              <button aria-label="Undo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                <Icon path={mdiUndo} size={20} />
              </button>
              <button aria-label="Redo" className="w-11 h-11 rounded-full flex items-center justify-center text-text-disabled opacity-40 cursor-default">
                <Icon path={mdiRedo} size={20} />
              </button>
              <button
                aria-label="Reset dashboard"
                onClick={() => setResetOpen(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-mid transition-colors"
              >
                <Icon path={mdiBackupRestore} size={20} />
              </button>

              <ToolbarPrimaryButton label="Done" onClick={exitEditMode} className="ml-ha-1" />
            </>
          }
        />
      )}
    </AnimatePresence>
    </>
  );
}
