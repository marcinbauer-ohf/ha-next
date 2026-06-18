'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHomeCenterPrefs } from '@/hooks';
import { HOME_CENTER_SECTION_MAP, type HomeCenterSectionId } from '@/lib/homeCenter';
import { Icon } from '../ui/Icon';
import { mdiClose, mdiDragVertical, mdiLock } from '@mdi/js';

function SectionRow({ id }: { id: HomeCenterSectionId }) {
  const { isEnabled, toggle } = useHomeCenterPrefs();
  const def = HOME_CENTER_SECTION_MAP[id];
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  const enabled = isEnabled(id);
  const locked = Boolean(def?.locked);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!def) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-3 py-ha-2.5 ${
        enabled ? '' : 'opacity-60'
      } ${isDragging ? 'shadow-lg shadow-black/20 z-10 relative' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Reorder ${def.label}`}
        className="cursor-grab active:cursor-grabbing touch-none text-text-disabled hover:text-text-secondary transition-colors -ml-1"
        {...attributes}
        {...listeners}
      >
        <Icon path={mdiDragVertical} size={22} />
      </button>

      <div className="flex h-9 w-9 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary flex-shrink-0">
        <Icon path={def.icon} size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text-primary">{def.label}</div>
        <div className="mt-0.5 text-xs text-text-secondary truncate">{def.description}</div>
      </div>

      {locked ? (
        <div className="flex items-center gap-ha-2 text-text-tertiary" title="Always shown">
          <Icon path={mdiLock} size={15} />
          <span className="text-xs font-medium">Always on</span>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`${enabled ? 'Hide' : 'Show'} ${def.label}`}
          onClick={() => toggle(id)}
          className={`h-6 w-11 rounded-full px-0.5 flex items-center transition-colors flex-shrink-0 ${enabled ? 'bg-ha-blue/50' : 'bg-surface-mid'}`}
        >
          <div className={`h-5 w-5 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      )}
    </div>
  );
}

export function HomeCenterSectionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { order, setOrder, reset } = useHomeCenterPrefs();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as HomeCenterSectionId);
    const newIndex = order.indexOf(over.id as HomeCenterSectionId);
    if (oldIndex === -1 || newIndex === -1) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

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
            role="dialog"
            aria-modal="true"
            aria-label="Customize Home Center sections"
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-ha-3xl border border-surface-lower bg-surface-default shadow-2xl"
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-ha-4 border-b border-surface-lower p-ha-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Customize sections</h3>
                <p className="mt-ha-1 text-sm text-text-secondary">
                  Drag to reorder, and toggle which status sections appear — across Home Center, the dashboard status pop-up, and the screensaver.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
              >
                <Icon path={mdiClose} size={20} />
              </button>
            </div>

            {/* Sortable list */}
            <div className="overflow-y-auto p-ha-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  <div className="space-y-ha-2">
                    {order.map((id) => (
                      <SectionRow key={id} id={id} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-surface-lower p-ha-4">
              <button
                type="button"
                onClick={reset}
                className="rounded-ha-xl border border-surface-lower bg-surface-default px-ha-4 py-ha-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-low"
              >
                Reset to defaults
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
