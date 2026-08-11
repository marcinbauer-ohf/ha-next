'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { mdiDotsHorizontal, mdiMenu, mdiPinOffOutline, mdiViewDashboard } from '@mdi/js';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { Icon } from '@/components/ui/Icon';
import { MdiIcon } from '@/components/ui/MdiIcon';
import { AskPill } from './DockAsk';
import { DOCK_DROPPABLE_ID, usesLovelace, type DockItem } from './dockItems';

/** Slot geometry — also drives how many pins fit, so it lives in one place. */
export const SLOT_PX = 44;
const GAP_PX = 8;
/** Dock's own horizontal padding (p-4 both sides). */
const DOCK_PADDING = 32;
/** Breathing room left at the window edges. */
const PAGE_MARGIN = 32;
/**
 * Everything right of the pins: gap + the hamburger/avatar pair. Fixed by
 * construction, and must be kept in step with that markup.
 */
const CLUSTER_PX = 56;

/**
 * How many slots fit on the row at this window width. The dock takes all the
 * space available, so 20 pins on a wide desktop simply all show; it only
 * contracts when they genuinely cannot fit. Mobile lands at 4 on its own.
 */
function fitCount(viewportWidth: number): number {
  const budget = viewportWidth - PAGE_MARGIN - DOCK_PADDING - CLUSTER_PX;
  return Math.max(1, Math.floor((budget + GAP_PX) / (SLOT_PX + GAP_PX)));
}

/** Marks which slot's surface is on screen right now. */
function ActiveDot() {
  return (
    <span className="pointer-events-none absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-neutral-800" />
  );
}

export function DockSlotIcon({ item, size = 22 }: { item: DockItem; size?: number }) {
  return item.mdiName ? (
    <MdiIcon icon={item.mdiName} size={size} />
  ) : (
    <Icon path={item.icon ?? mdiViewDashboard} size={size} />
  );
}

function PinnedSlot({
  item,
  active,
  pressed,
  fixed,
  onSelect,
  onContextMenu,
  onPressStart,
  onPressEnd,
}: {
  item: DockItem;
  active: boolean;
  /** Touch is holding this slot — shows the label, since there's no hover. */
  pressed: boolean;
  /** HA's default dashboard: can't be dragged out, reordered, or removed. */
  fixed?: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: fixed,
  });
  // dnd-kit owns onPointerDown; chain ours after it rather than replacing it.
  const dndPointerDown = listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined;
  /**
   * A dashboard opens onto the bare grey background, so its slot is bare too —
   * just the glyph. Pages and apps open as an overlay surface, so they carry a
   * filled tile: the slot previews what tapping it will do.
   */
  const bare = usesLovelace(item.id);

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={item.label}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      style={{
        width: SLOT_PX,
        height: SLOT_PX,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={clsx(
        'group/slot relative flex shrink-0 items-center justify-center rounded-2xl transition-all duration-150',
        !isDragging && 'hover:-translate-y-0.5 active:scale-95',
        // Outlined = opens onto the bare grey canvas; filled = opens a surface.
        bare
          ? active
            ? 'text-neutral-900 ring-1 ring-neutral-300'
            : 'text-neutral-400 ring-1 ring-black/[0.07] hover:text-neutral-700 hover:ring-neutral-300'
          : active
            ? 'bg-neutral-800 text-white shadow-[0_2px_8px_rgba(0,0,0,0.20)]'
            : 'bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-black/[0.04] hover:bg-neutral-200/70 hover:text-neutral-800',
        // The lifted original stays as a hole so the DragOverlay reads as the item.
        isDragging && 'opacity-25',
      )}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        dndPointerDown?.(e);
        onPressStart();
      }}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
    >
      <DockSlotIcon item={item} size={bare ? 24 : 22} />
      {/* Sits in the dock's bottom padding, so it needs no layout space. */}
      {active && !isDragging && <ActiveDot />}
      {/* Hover label on desktop; on touch it shows while the finger is down —
          a long-press can't be the trigger there because the TouchSensor already
          claims the hold to start a drag. z-20 lifts it over sibling slots. */}
      <span
        className={clsx(
          'pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg transition-opacity duration-150',
          isDragging ? 'opacity-0' : pressed ? 'opacity-100' : 'opacity-0 md:group-hover/slot:opacity-100',
        )}
      >
        {item.label}
      </span>
    </button>
  );
}

export function DockBar({
  pins,
  activeId,
  profileOpen,
  hidden,
  fixedId,
  askVisible,
  dropActive,
  onSelect,
  onUnpin,
  onProfile,
  onAsk,
}: {
  pins: DockItem[];
  activeId: string | null;
  profileOpen: boolean;
  /** Slide out of the way while scrolling down (mobile). */
  hidden: boolean;
  /** HA's default dashboard — pinned permanently, so no remove affordances. */
  fixedId: string | null;
  /** False while the screensaver owns the pill — it can only exist in one place. */
  askVisible: boolean;
  /** True while a catalog item is being dragged, so the strip can invite a drop. */
  dropActive: boolean;
  onSelect: (item: DockItem) => void;
  onUnpin: (id: string) => void;
  onProfile: () => void;
  onAsk: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: DOCK_DROPPABLE_ID });
  const [menu, setMenu] = useState<{ x: number; y: number; item: DockItem } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const perRow = fitCount(viewport);
  const overflowing = pins.length > perRow;
  // When overflowing, the last slot is spent on the ⋯ button rather than a pin.
  const rowPins = overflowing ? pins.slice(0, Math.max(0, perRow - 1)) : pins;
  const restPins = overflowing ? pins.slice(Math.max(0, perRow - 1)) : [];

  return (
    <>
      {/* Slides fully clear of the bottom edge rather than fading, so it never
          sits half-visible over content. */}
      <div
        className={clsx(
          'pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 pb-[max(18px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out',
          hidden && 'translate-y-[130%]',
        )}
      >
        {/* The screensaver pill's resting place — same element, morphed down. */}
        {askVisible && <AskPill variant="chip" onOpen={onAsk} />}
        <div
          // Droppable covers the whole dock so releasing anywhere on it keeps the
          // pin; only a release clear of the dock dismisses.
          ref={setNodeRef}
          className={clsx(
            // Frosted rather than flat white, with a layered shadow so it reads as
            // floating above the canvas instead of pasted onto it.
            'pointer-events-auto flex items-center gap-2 rounded-[30px] bg-white/80 p-4 backdrop-blur-xl transition-shadow',
            isOver && dropActive
              ? 'ring-2 ring-[#18bcf2]/60 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.14)]'
              : 'ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.12),0_24px_48px_-16px_rgba(0,0,0,0.18)]',
          )}
          style={{ maxWidth: `calc(100vw - ${PAGE_MARGIN}px)` }}
        >
          {/* User space — grows to fill whatever width is available. */}
          <div className="flex items-center" style={{ gap: GAP_PX }}>
            <SortableContext items={rowPins.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
              {rowPins.map((item) => (
                <PinnedSlot
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  pressed={pressedId === item.id}
                  fixed={item.id === fixedId}
                  onSelect={() => onSelect(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (item.id === fixedId) return;
                    setMenu({ x: e.clientX, y: e.clientY, item });
                  }}
                  onPressStart={() => setPressedId(item.id)}
                  onPressEnd={() => setPressedId(null)}
                />
              ))}
            </SortableContext>

            {overflowing && (
              <button
                type="button"
                aria-label={`Show ${restPins.length} more pinned items`}
                onClick={() => setSheetOpen(true)}
                style={{ width: SLOT_PX, height: SLOT_PX }}
                // Filled like a page tile — it opens an overlay surface too.
                className="relative flex shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-black/[0.04] transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-200/70 hover:text-neutral-800 active:scale-95"
              >
                <Icon path={mdiDotsHorizontal} size={22} />
                {/* The active item may have overflowed into the sheet — keep the
                    indicator visible rather than letting it disappear. */}
                {restPins.some((p) => p.id === activeId) && <ActiveDot />}
              </button>
            )}

            {pins.length === 0 && (
              <span
                style={{ width: SLOT_PX, height: SLOT_PX }}
                className={clsx(
                  'flex shrink-0 items-center justify-center rounded-2xl border-2 border-dashed text-[10px]',
                  dropActive ? 'border-[#18bcf2] text-[#18bcf2]' : 'border-neutral-200 text-neutral-300',
                )}
              >
                +
              </span>
            )}
          </div>

          {/* The one fixture of the dock. The hamburger sits *behind* the face and
              peeks out to its left — one control, both meanings. */}
          <button
            type="button"
            aria-label="Menu, profile and settings"
            aria-expanded={profileOpen}
            onClick={onProfile}
            className="group relative flex shrink-0 items-center transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
          >
            <Icon
              path={mdiMenu}
              size={24}
              className={clsx(
                // Negative margin tucks its right edge under the avatar.
                'z-0 -mr-2 transition-colors',
                profileOpen ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-600',
              )}
            />
            {/* Wrapper so the dot centres under the face, not under the whole
                button — the hamburger sticking out left would skew it. */}
            <span className="relative z-10 flex">
              <img
                src="/dock-avatar.png"
                alt=""
                className="h-8 w-8 select-none overflow-hidden rounded-full object-cover"
              />
              {/* Same active marker the pinned slots use, instead of a ring. */}
              {profileOpen && <ActiveDot />}
            </span>
          </button>
        </div>

        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
            actions={[
              {
                label: `Remove ${menu.item.label} from dock`,
                icon: mdiPinOffOutline,
                danger: true,
                onSelect: () => onUnpin(menu.item.id),
              },
            ]}
          />
        )}
      </div>

      {/* The pins that didn't fit, as navigation. Bottom sheet on mobile,
          centered card on desktop — ModalSheet already handles both. */}
      <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} maxWidth={420}>
        <div className="px-5 pb-5 pt-1">
          <h2 className="mb-3 px-1 text-[17px] text-neutral-800">More pinned</h2>
          <div className="flex flex-col">
            {restPins.map((item) => (
              <div key={item.id} className="group flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setSheetOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left"
                >
                  <span
                    style={{ width: SLOT_PX, height: SLOT_PX }}
                    className={clsx(
                      'flex shrink-0 items-center justify-center rounded-2xl border bg-white',
                      activeId === item.id ? 'border-neutral-400 text-neutral-800' : 'border-neutral-200 text-neutral-500',
                    )}
                  >
                    <DockSlotIcon item={item} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-neutral-800">{item.label}</span>
                </button>
                {/* The default dashboard has no remove affordance anywhere. */}
                {item.id !== fixedId && (
                  <button
                    type="button"
                    onClick={() => onUnpin(item.id)}
                    aria-label={`Remove ${item.label} from dock`}
                    className="shrink-0 rounded-lg p-2 text-neutral-400 opacity-0 transition-all hover:text-neutral-700 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Icon path={mdiPinOffOutline} size={18} exact />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </ModalSheet>
    </>
  );
}
