'use client';

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
import { mdiDragHorizontalVariant, mdiLock } from '@mdi/js';
import { Button } from '../ui';

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
      className={`flex items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-3 py-2.5 ${
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
        <Icon path={mdiDragHorizontalVariant} size={22} />
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

/**
 * Body-only editor for the Home Center section list — the reorder/toggle list
 * plus a reset action. Rendered inside the shared right-side <Sidebar> chrome
 * (docked rail on desktop, bottom sheet on mobile), so it owns no header/close.
 */
export function HomeCenterSectionsBody() {
  const { order, setOrder, reset } = useHomeCenterPrefs();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as HomeCenterSectionId);
    const newIndex = order.indexOf(over.id as HomeCenterSectionId);
    if (oldIndex === -1 || newIndex === -1) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <div className="space-y-ha-4">
      <p className="text-sm text-text-secondary">
        Drag to reorder, and toggle which status sections appear — across Home Center, the dashboard status pop-up, and the screensaver.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-ha-2">
            {order.map((id) => (
              <SectionRow key={id} id={id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="ghost" onClick={reset} block className="border border-surface-lower">
        Reset to defaults
      </Button>
    </div>
  );
}
