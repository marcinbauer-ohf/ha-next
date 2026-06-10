'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { Icon } from '../ui/Icon';
import { MdiIcon } from '../ui/MdiIcon';
import { HALogo } from '../ui/HALogo';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ContextMenu, type ContextMenuAction } from '../ui/ContextMenu';
import { useSidebarItems, useLongPress } from '@/hooks';
import { useSearchContext, useSidebarArrange, arrangeItems, type SidebarItem } from '@/contexts';
import { mdiMagnify, mdiClose, mdiCheck, mdiDragVariant, mdiDeleteOutline } from '@mdi/js';
import { clsx } from 'clsx';

const appPalettes = [
  { text: 'text-ha-blue' },
  { text: 'text-red-600' },
  { text: 'text-green-600' },
  { text: 'text-yellow-600' },
];

const getAppPalette = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % appPalettes.length;
  return appPalettes[index];
};

const formatTooltipLabel = (label: string) =>
  label
    .split(/\s+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(' ');

interface RailItemProps {
  item: SidebarItem;
  index: number;
  isActive: boolean;
  arranging: boolean;
  pinned: boolean;
  splitNavigationEnabled: boolean;
  onNavigate?: (href: string, options?: { openInSplit?: boolean }) => void;
  onEnterArrange: () => void;
  onRequestDelete: (item: SidebarItem) => void;
  onOpenMenu: (item: SidebarItem, x: number, y: number) => void;
  onHoverShow: (trigger: HTMLElement, content: string) => void;
  onHoverHide: () => void;
}

function RailItem({
  item,
  index,
  isActive,
  arranging,
  pinned,
  splitNavigationEnabled,
  onNavigate,
  onEnterArrange,
  onRequestDelete,
  onOpenMenu,
  onHoverShow,
  onHoverHide,
}: RailItemProps) {
  const isHome = item.urlPath === '/';
  const palette = item.isApp ? getAppPalette(item.id) : null;
  const longPress = useLongPress(onEnterArrange);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !arranging || pinned,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 60 : undefined,
    touchAction: arranging && !pinned ? 'none' : undefined,
  };

  const wobble = !arranging || pinned
    ? ''
    : isDragging
      ? 'ha-jiggle-frozen'
      : index % 2 === 0
        ? 'ha-jiggle'
        : 'ha-jiggle-alt';

  return (
    <div ref={setNodeRef} style={style} className="relative flex-shrink-0">
      <div className={wobble}>
        <Link
          href={item.urlPath}
          prefetch={false}
          scroll={false}
          {...(arranging && !pinned ? { ...attributes, ...listeners } : {})}
          {...(!arranging ? longPress.handlers : {})}
          onContextMenu={(event) => {
            event.preventDefault();
            if (!arranging) onOpenMenu(item, event.clientX, event.clientY);
          }}
          onClick={(event) => {
            if (longPress.consume()) {
              event.preventDefault();
              return;
            }
            if (arranging) {
              event.preventDefault();
              return;
            }
            if (!onNavigate) return;
            if (event.defaultPrevented) return;
            const isModifiedClick = event.metaKey || event.ctrlKey;
            if (isModifiedClick && !splitNavigationEnabled) return;
            event.preventDefault();
            onNavigate(item.urlPath, { openInSplit: splitNavigationEnabled && isModifiedClick });
          }}
          onMouseEnter={
            arranging
              ? undefined
              : (event) => onHoverShow(event.currentTarget, formatTooltipLabel(item.title))
          }
          onMouseLeave={arranging ? undefined : onHoverHide}
          className={clsx(
            'w-12 h-12 rounded-ha-xl transition-colors flex items-center justify-center select-none',
            isActive
              ? 'bg-surface-mid'
              : item.isApp
                ? 'bg-surface-low hover:bg-surface-mid'
                : 'hover:bg-surface-low',
            item.isApp && 'ha-app-icon-shell',
            item.isApp && isActive && 'ha-app-icon-shell-active',
            arranging && !pinned && 'cursor-grab active:cursor-grabbing'
          )}
        >
          {isHome ? (
            <HALogo size={26} />
          ) : (
            <MdiIcon
              icon={item.icon || (item.isApp ? 'mdi:application' : 'mdi:view-dashboard')}
              size={24}
              className={clsx(
                isActive
                  ? item.isApp && palette
                    ? palette.text
                    : 'text-ha-blue'
                  : item.isApp && palette
                    ? palette.text
                    : 'text-text-secondary',
                item.isApp && 'ha-app-icon-glyph'
              )}
            />
          )}
        </Link>
      </div>

      {arranging && !pinned && (
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRequestDelete(item);
          }}
          className="ha-arrange-badge absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md shadow-black/30 ring-2 ring-surface-default"
        >
          <Icon path={mdiClose} size={12} />
        </button>
      )}
    </div>
  );
}

export function Sidebar({
  onNavigate,
  splitNavigationEnabled = false,
}: {
  onNavigate?: (href: string, options?: { openInSplit?: boolean }) => void;
  splitNavigationEnabled?: boolean;
} = {}) {
  const pathname = usePathname();
  const { items, loading } = useSidebarItems();
  const { searchOpen, toggleSearch } = useSearchContext();
  const { arranging, enterArrange, exitArrange, order, hiddenIds, hideItem, reorderVisible } =
    useSidebarArrange();

  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const hoveredItemRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hideTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SidebarItem | null>(null);
  const [menu, setMenu] = useState<{ item: SidebarItem; x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState({
    content: '',
    top: 0,
    left: 0,
    visible: false,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Home is pinned first; the rest sort dashboards-before-apps, then the
  // session arrange order + soft-hides are layered on top.
  const homeItem = (items || []).find((it) => it && it.urlPath === '/');
  const defaultSorted = (items || [])
    .filter((it): it is SidebarItem => !!it && it.urlPath !== '/')
    .sort((a, b) => (a.isApp === b.isApp ? 0 : a.isApp ? 1 : -1));
  const displayItems = arrangeItems(defaultSorted, order, hiddenIds);
  const sortableIds = displayItems.map((it) => it.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortableIds, oldIndex, newIndex);
    reorderVisible(sortableIds, sortableIds, next);
  };

  const clearHideTooltipTimeout = () => {
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = null;
    }
  };

  const getTooltipPosition = (trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 132;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 34;
    const spacing = 8;

    let top = rect.top + rect.height / 2 - tooltipHeight / 2;
    let left = rect.right + spacing;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tooltipWidth > viewportWidth - 8) left = viewportWidth - tooltipWidth - 8;
    if (top < 8) top = 8;
    if (top + tooltipHeight > viewportHeight - 8) top = viewportHeight - tooltipHeight - 8;

    return { top, left };
  };

  const showTooltip = (trigger: HTMLElement, content: string) => {
    clearHideTooltipTimeout();
    hoveredItemRef.current = trigger;
    const nextPosition = getTooltipPosition(trigger);

    setTooltip((prev) => ({
      ...prev,
      content,
      top: nextPosition.top,
      left: nextPosition.left,
      visible: true,
    }));
  };

  const hideTooltipSoon = () => {
    clearHideTooltipTimeout();
    hideTooltipTimeoutRef.current = setTimeout(() => {
      hoveredItemRef.current = null;
      setTooltip((prev) => ({ ...prev, visible: false }));
      hideTooltipTimeoutRef.current = null;
    }, 90);
  };

  const hideTooltipNow = () => {
    clearHideTooltipTimeout();
    hoveredItemRef.current = null;
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  // Hide any tooltip the moment arrange mode begins.
  useEffect(() => {
    if (arranging) hideTooltipNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arranging]);

  // Monitor scroll position to show/hide gradients
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) return;

    const updateGradients = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 10;

      // Show top gradient if scrolled down from the top
      setShowTopGradient(scrollTop > threshold);

      // Show bottom gradient if there's more content below
      setShowBottomGradient(scrollTop + clientHeight < scrollHeight - threshold);
    };

    // Check on mount and when content changes
    updateGradients();

    // Listen to scroll events
    scrollElement.addEventListener('scroll', updateGradients);

    // Also check on resize
    window.addEventListener('resize', updateGradients);

    return () => {
      scrollElement.removeEventListener('scroll', updateGradients);
      window.removeEventListener('resize', updateGradients);
    };
  }, [items, loading]);

  useEffect(() => {
    const updateTooltipPosition = () => {
      if (!hoveredItemRef.current) return;
      const nextPosition = getTooltipPosition(hoveredItemRef.current);
      setTooltip((prev) => ({ ...prev, top: nextPosition.top, left: nextPosition.left }));
    };

    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearHideTooltipTimeout();
    };
  }, []);

  return (
    <>
      <aside
        className="hidden lg:flex flex-col items-center w-16 py-ha-2 h-full"
        data-component="Sidebar"
        onMouseLeave={hideTooltipNow}
      >
        {/* Search — becomes a Done button while arranging */}
        {arranging ? (
          <button
            onClick={exitArrange}
            aria-label="Done arranging"
            className="p-ha-3 rounded-ha-xl transition-colors mb-ha-4 bg-ha-blue text-white"
          >
            <Icon path={mdiCheck} size={24} />
          </button>
        ) : (
          <button
            onClick={toggleSearch}
            className={`p-ha-3 rounded-ha-xl transition-colors mb-ha-4 ${
              searchOpen
                ? 'bg-surface-mid text-text-primary'
                : 'hover:bg-surface-low text-text-secondary'
            }`}
          >
            <Icon path={mdiMagnify} size={24} />
          </button>
        )}

        {/* All items listed one-by-one with scroll gradients */}
        <div className="flex-1 relative w-full min-h-0 mask-linear-fade flex flex-col items-center">
          {/* Top gradient */}
          <div
            className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
              showTopGradient ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div
            ref={scrollableRef}
            onScroll={() => {
              const el = scrollableRef.current;
              if (el) {
                const { scrollTop, scrollHeight, clientHeight } = el;
                setShowTopGradient(scrollTop > 0);
                setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 1);
              }
            }}
            className="h-full w-full flex flex-col items-center gap-ha-2 overflow-y-auto scrollbar-hide py-2"
          >
            {loading ? (
              // Loading placeholders
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-12 h-12 flex-shrink-0 rounded-ha-xl bg-surface-low animate-pulse"
                  />
                ))}
              </>
            ) : (
              <>
                {homeItem && (
                  <RailItem
                    item={homeItem}
                    index={-1}
                    isActive={pathname === '/'}
                    arranging={arranging}
                    pinned
                    splitNavigationEnabled={splitNavigationEnabled}
                    onNavigate={onNavigate}
                    onEnterArrange={enterArrange}
                    onRequestDelete={setPendingDelete}
                    onOpenMenu={(item, x, y) => setMenu({ item, x, y })}
                    onHoverShow={showTooltip}
                    onHoverHide={hideTooltipSoon}
                  />
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    {displayItems.map((item, index) => {
                      const isActive =
                        pathname === item.urlPath ||
                        (item.urlPath !== '/' && pathname?.startsWith(item.urlPath));
                      return (
                        <RailItem
                          key={item.id}
                          item={item}
                          index={index}
                          isActive={!!isActive}
                          arranging={arranging}
                          pinned={false}
                          splitNavigationEnabled={splitNavigationEnabled}
                          onNavigate={onNavigate}
                          onEnterArrange={enterArrange}
                          onRequestDelete={setPendingDelete}
                          onOpenMenu={(item, x, y) => setMenu({ item, x, y })}
                          onHoverShow={showTooltip}
                          onHoverHide={hideTooltipSoon}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>

          {/* Bottom gradient */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface-default to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
              showBottomGradient ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {typeof document !== 'undefined' &&
          tooltip.content &&
          createPortal(
            <div
              ref={tooltipRef}
              className={clsx(
                'fixed z-[200] px-ha-2 py-ha-1 bg-surface-default border border-surface-lower rounded-ha-lg shadow-lg shadow-black/20 pointer-events-none text-xs text-text-primary whitespace-nowrap font-medium transition-[top,left,opacity,transform] duration-120 ease-out',
                tooltip.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              )}
              style={{
                top: `${tooltip.top}px`,
                left: `${tooltip.left}px`,
              }}
            >
              {tooltip.content}
            </div>,
            document.body
          )}
      </aside>

      {menu &&
        (() => {
          const actions: ContextMenuAction[] = [
            { label: 'Rearrange icons', icon: mdiDragVariant, onSelect: enterArrange },
          ];
          if (menu.item.urlPath !== '/') {
            actions.push({
              label: menu.item.isApp ? 'Uninstall' : 'Remove',
              icon: mdiDeleteOutline,
              danger: true,
              onSelect: () => setPendingDelete(menu.item),
            });
          }
          return (
            <ContextMenu x={menu.x} y={menu.y} actions={actions} onClose={() => setMenu(null)} />
          );
        })()}

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete
            ? `${pendingDelete.isApp ? 'Uninstall' : 'Remove'} ${pendingDelete.title}?`
            : ''
        }
        message="This only hides it here for now — your Home Assistant configuration isn't changed."
        confirmLabel={pendingDelete?.isApp ? 'Uninstall' : 'Remove'}
        cancelLabel="Keep"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) hideItem(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
