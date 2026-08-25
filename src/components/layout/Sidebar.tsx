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
import { AppStatusBadge, appStatusDimmed, appStatusLabel } from '../ui/AppStatusBadge';
import { HALogo } from '../ui/HALogo';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ContextMenu, type ContextMenuAction } from '../ui/ContextMenu';
import { useSidebarItems, useLongPress, useRunShortcut, useHomeAssistant } from '@/hooks';
import { useSidebarArrange, arrangeItems, type SidebarItem, type AppStatus } from '@/contexts';
import { useDebugFlags } from '@/contexts';
import { SettingsGlyph } from '../ui/SettingsGlyph';
import { callService, uninstallAddon } from '@/lib/homeassistant';
import { useDashboardThumbnail } from '@/lib/dashboardThumbnails';
import { removeShortcut } from '@/lib/sidebarShortcuts';
import { ShortcutPicker } from '../ui/ShortcutPicker';
import { EditItemsButton } from '../ui/EditItemsButton';
import { mdiMinus, mdiCheck, mdiPlus, mdiPlusBoxOutline, mdiDragVariant, mdiDeleteOutline, mdiMinusCircleOutline, mdiPlay, mdiStop, mdiRestart, mdiDownload } from '@mdi/js';
import { shortcutHint, useIsMacPlatform } from '@/lib/keyboardShortcuts';
import { clsx } from 'clsx';
import { haptic } from '@/lib/haptics';

// HA's own sidebar glyphs — a panel with its rail, plus the direction chevron.
// The subpaths are concatenated into one `d` (all non-overlapping, so nonzero
// winding renders them exactly as the separate <path>s in the source SVG did)
// because <Icon> takes a single path string.
//
// The bare panel is the resting state and the chevron only appears on hover:
// at rest the button says "this is the sidebar", on hover it says which way it
// is about to move. Showing the chevron all the time asks you to read a
// direction you were not looking for.
const sidebarOpenIcon =
  'M17.5996 18C17.6245 18 17.7075 17.9887 17.8086 17.8623C17.9143 17.7301 18 17.5122 18 17.25V6.75C18 6.48779 17.9143 6.26987 17.8086 6.1377C17.7075 6.01132 17.6245 6 17.5996 6L6.40039 6C6.37549 6 6.29251 6.01132 6.19141 6.1377C6.08568 6.26987 6 6.48779 6 6.75L6 17.25C6 17.5122 6.08568 17.7301 6.19141 17.8623C6.29251 17.9887 6.37549 18 6.40039 18L17.5996 18ZM6.40039 20C5.68269 20 5.05291 19.6423 4.62891 19.1123C4.20955 18.5881 4 17.916 4 17.25L4 6.75C4 6.08399 4.20956 5.4119 4.62891 4.8877C5.05291 4.35769 5.68269 4 6.40039 4L17.5996 4C18.3173 4 18.9471 4.35769 19.3711 4.8877C19.7904 5.4119 20 6.08399 20 6.75V17.25C20 17.916 19.7904 18.5881 19.3711 19.1123C18.9471 19.6423 18.3173 20 17.5996 20H6.40039Z' +
  ' M7 8C7 7.44772 7.44772 7 8 7C8.55229 7 9 7.44772 9 8V16C9 16.5523 8.55229 17 8 17C7.44772 17 7 16.5523 7 16V8Z';

const sidebarExpandIcon =
  'M11.293 7.29297C11.6835 6.90244 12.3165 6.90244 12.707 7.29297L16.707 11.293C17.0976 11.6835 17.0976 12.3165 16.707 12.707L12.707 16.707C12.3165 17.0976 11.6835 17.0976 11.293 16.707C10.9024 16.3165 10.9024 15.6835 11.293 15.293L14.5859 12L11.293 8.70703C10.9024 8.31651 10.9024 7.68349 11.293 7.29297Z ' +
  sidebarOpenIcon;

const sidebarCollapseIcon =
  'M15.707 7.29297C15.3165 6.90244 14.6835 6.90244 14.293 7.29297L10.293 11.293C9.90244 11.6835 9.90244 12.3165 10.293 12.707L14.293 16.707C14.6835 17.0976 15.3165 17.0976 15.707 16.707C16.0976 16.3165 16.0976 15.6835 15.707 15.293L12.4141 12L15.707 8.70703C16.0976 8.31651 16.0976 7.68349 15.707 7.29297Z ' +
  sidebarOpenIcon;

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
  expanded: boolean;
  splitNavigationEnabled: boolean;
  onNavigate?: (href: string, options?: { openInSplit?: boolean }) => void;
  onRunShortcut?: (item: SidebarItem) => void;
  onEnterArrange: () => void;
  onRequestDelete: (item: SidebarItem) => void;
  onOpenMenu: (item: SidebarItem, x: number, y: number) => void;
  onHoverShow: (
    trigger: HTMLElement,
    content: string,
    opts?: { shortcut?: string; urlPath?: string },
  ) => void;
  onHoverHide: () => void;
}

function RailItem({
  item,
  index,
  isActive,
  arranging,
  pinned,
  expanded,
  splitNavigationEnabled,
  onNavigate,
  onRunShortcut,
  onEnterArrange,
  onRequestDelete,
  onOpenMenu,
  onHoverShow,
  onHoverHide,
}: RailItemProps) {
  const isHome = item.urlPath === '/';
  const palette = item.isApp ? getAppPalette(item.id) : null;
  const dimmed = appStatusDimmed(item.appStatus);
  // A dimmed icon with a marker is only legible once something names it.
  const statusTooltip = item.appStatus
    ? `${formatTooltipLabel(item.title)} — ${appStatusLabel(item.appStatus)}`
    : formatTooltipLabel(item.title);
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
          // Action / link shortcuts run instead of navigating.
          if (item.shortcut && item.shortcut.kind !== 'view') {
            event.preventDefault();
            onRunShortcut?.(item);
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
          // Expanded rows carry their own label — the hover tooltip is a
          // rail-only affordance.
          arranging || expanded
            ? undefined
            : (event) =>
                onHoverShow(event.currentTarget, statusTooltip, {
                  shortcut: isHome ? 'H' : undefined,
                  urlPath: item.urlPath,
                })
        }
        onMouseLeave={arranging || expanded ? undefined : onHoverHide}
        className={clsx(
          // Rows are always full-width with a fixed 48px icon slot at the
          // left, so nothing re-flows when the rail's width animates — in
          // rail mode the row IS the 48px tile. Apps carry their background
          // on the icon tile only (see the span below), dashboards on the
          // whole row.
          'group h-12 w-full rounded-ha-xl transition-colors flex items-center select-none',
          !item.isApp && (isActive ? 'bg-surface-mid' : 'hover:bg-surface-low'),
          arranging && !pinned && 'cursor-grab active:cursor-grabbing'
        )}
      >
        <span
          className={clsx(
            'relative w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-ha-xl transition-colors',
            wobble,
            item.isApp &&
              (isActive ? 'bg-surface-mid' : 'bg-surface-low group-hover:bg-surface-mid'),
            item.isApp && 'ha-app-icon-shell',
            item.isApp && isActive && 'ha-app-icon-shell-active'
          )}
        >
          {/* Shortcut marker — a turned-down page corner, the same fold the
              dog-ears use, so "this one is yours" reads as a texture instead of
              a second badge competing with the status marker below. It gets its
              own inset clip layer because the tile itself can't be
              overflow-hidden: the status badge hangs past its bottom edge. */}
          {item.isShortcut && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-ha-xl"
            >
              <span
                className="absolute top-0 right-0 h-4 w-4 bg-gradient-to-bl from-text-tertiary/40 via-text-tertiary/15 to-transparent transition-all duration-300 ease-out group-hover:h-5 group-hover:w-5"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
              />
            </span>
          )}
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
                item.isApp && 'ha-app-icon-glyph',
                dimmed && 'opacity-40 saturate-0'
              )}
            />
          )}
          {item.appStatus && <AppStatusBadge status={item.appStatus} />}
        </span>
        {/* Always mounted: at rail width the flex-1 slot collapses to zero
            and the label clips away, so expanding/collapsing reveals it
            smoothly instead of popping it in and out. */}
        <span
          className={clsx(
            'min-w-0 flex-1 truncate pl-3 pr-3 text-left text-sm font-medium transition-opacity duration-200',
            expanded ? 'opacity-100' : 'opacity-0',
            isActive ? 'text-text-primary' : 'text-text-secondary'
          )}
        >
          {formatTooltipLabel(item.title)}
        </span>
      </Link>

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
          className="ha-arrange-badge absolute -top-1 left-[34px] z-10 w-[18px] h-[18px] rounded-full bg-gray-500 text-white flex items-center justify-center shadow-md shadow-black/30 ring-1 ring-surface-default"
        >
          <Icon path={mdiMinus} size={11} exact />
        </button>
      )}
    </div>
  );
}

export function Sidebar({
  onNavigate,
  splitNavigationEnabled = false,
  expanded = false,
  onToggleExpanded,
  onProfileToggle,
}: {
  onNavigate?: (href: string, options?: { openInSplit?: boolean }) => void;
  splitNavigationEnabled?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  /** Settings entry. Only rendered when the bottom bar is hidden (debug flag). */
  onProfileToggle?: () => void;
} = {}) {
  const pathname = usePathname();
  const sidebarShortcut = shortcutHint('global.sidebar', useIsMacPlatform());
  const { items, loading, refreshAppStatuses, setAppStatusOverride } = useSidebarItems();
  const { arranging, enterArrange, exitArrange, order, hiddenIds, hideItem, restoreItem, reorderVisible } =
    useSidebarArrange();

  // Arranging a collapsed rail means dragging 48px tiles with no names on them,
  // so entering arrange opens the rail — and leaving it puts the rail back the
  // way it was, since the width was ours to borrow, not to keep.
  // Uninstall is the one action that can't be walked back, so a failure has to
  // put the icon back rather than leave the rail claiming the app is gone.
  const uninstallApp = async (item: SidebarItem) => {
    if (demoMode || !item.addonSlug) return;
    try {
      await uninstallAddon(item.addonSlug);
      refreshAppStatuses();
    } catch (err) {
      console.error('Uninstall failed:', err);
      restoreItem(item.id);
    }
  };

  const [railBorrowed, setRailBorrowed] = useState(false);
  const startArrange = () => {
    if (!expanded && onToggleExpanded) {
      setRailBorrowed(true);
      onToggleExpanded();
    }
    enterArrange();
  };
  // Restoring on the way out is an effect, not part of a Done handler: Esc also
  // leaves arrange mode (see SidebarArrangeContext) and the rail has to snap
  // back either way. rAF-wrapped so the compiler lint doesn't read it as a
  // set-state-in-effect cascade.
  useEffect(() => {
    if (arranging || !railBorrowed || !onToggleExpanded) return;
    const frame = requestAnimationFrame(() => {
      setRailBorrowed(false);
      onToggleExpanded();
    });
    return () => cancelAnimationFrame(frame);
  }, [arranging, railBorrowed, onToggleExpanded]);

  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const hoveredItemRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hideTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    item: SidebarItem;
    /** Apps distinguish taking the icon off the rail from uninstalling. */
    mode: 'remove' | 'uninstall';
  } | null>(null);
  const [menu, setMenu] = useState<{ item: SidebarItem; x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState({
    content: '',
    shortcut: undefined as string | undefined,
    urlPath: '',
    top: 0,
    left: 0,
    visible: false,
  });
  // `hideHomeCenter` drops the desktop bottom bar, so the settings avatar that
  // normally lives there moves to the foot of the rail; `sidebarPreviews` picks
  // the tooltip's shape.
  const { hideHomeCenterEnabled, sidebarPreviewsEnabled } = useDebugFlags();
  // The hook stays mounted either way (it also warms the snapshot cache); the
  // flag only decides whether the tooltip renders the rich card or a label pill.
  const capturedThumb = useDashboardThumbnail(tooltip.urlPath);
  const previewThumb = sidebarPreviewsEnabled ? capturedThumb : null;

  const { isAdmin, demoMode } = useHomeAssistant();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [pickerOpen, setPickerOpen] = useState(false);
  const runShortcut = useRunShortcut();

  // Shortcuts delete instantly — they're trivial to recreate from the picker,
  // so no confirmation. Dashboards and apps keep the confirm dialog.
  const requestDelete = (item: SidebarItem, mode: 'remove' | 'uninstall') => {
    if (item.isShortcut) {
      haptic('impact');
      removeShortcut(item.id);
      return;
    }
    setPendingDelete({ item, mode });
  };

  // Home is pinned first; the rest is one freely-mixable list. Default order
  // ranks dashboards → apps → shortcuts (new shortcuts appear at the end,
  // right where the "+" tile sits), then the shared arrange order +
  // soft-hides layer on top — the mobile sheet renders the same single list.
  const homeItem = (items || []).find((it) => it && it.urlPath === '/');
  const rank = (it: SidebarItem) => (it.isShortcut ? 2 : it.isApp ? 1 : 0);
  const defaultSorted = (items || [])
    .filter((it): it is SidebarItem => !!it && it.urlPath !== '/')
    .sort((a, b) => rank(a) - rank(b));
  const displayItems = arrangeItems(defaultSorted, order, hiddenIds);
  const sortableIds = displayItems.map((it) => it.id);
  // Hidden items resurface (dimmed, restorable) while arranging — HA-style
  // visibility toggles rather than one-way removal.
  const hiddenRailItems = defaultSorted.filter((it) => hiddenIds.has(it.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    haptic('impact');
    reorderVisible(sortableIds, sortableIds, arrayMove(sortableIds, oldIndex, newIndex));
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

  const showTooltip = (
    trigger: HTMLElement,
    content: string,
    opts?: { shortcut?: string; urlPath?: string },
  ) => {
    // Touch devices synthesize mouseenter on tap; the hover tooltip/preview is a
    // pointer affordance only — never surface it without a real hovering cursor.
    if (
      typeof window !== 'undefined' &&
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      return;
    }
    clearHideTooltipTimeout();
    hoveredItemRef.current = trigger;
    const nextPosition = getTooltipPosition(trigger);

    setTooltip((prev) => ({
      ...prev,
      content,
      shortcut: opts?.shortcut,
      urlPath: opts?.urlPath ?? '',
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

  // Hide any tooltip the moment arrange mode begins or the rail switches
  // between icon-only and expanded (⌘B can fire mid-hover, leaving the pill
  // orphaned over the content). rAF-wrapped so the compiler lint doesn't see
  // a synchronous setState-in-effect.
  useEffect(() => {
    const raf = requestAnimationFrame(() => hideTooltipNow());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arranging, expanded]);

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

  // The preview card is taller than the label pill, so re-measure and re-center
  // whenever the tooltip's content (and thus its height) changes while visible.
  useEffect(() => {
    if (!tooltip.visible || !hoveredItemRef.current) return;
    const next = getTooltipPosition(hoveredItemRef.current);
    setTooltip((prev) =>
      prev.top === next.top && prev.left === next.left
        ? prev
        : { ...prev, top: next.top, left: next.left }
    );
  }, [tooltip.content, tooltip.urlPath, previewThumb, tooltip.visible]);

  useEffect(() => {
    return () => {
      clearHideTooltipTimeout();
    };
  }, []);

  return (
    <>
      <aside
        className={clsx(
          'hidden lg:flex flex-col items-center py-ha-2 h-full overflow-hidden transition-[width] duration-300 ease-out',
          // Icon-only rail vs expanded rail with labels — the auto grid
          // column in AppShell follows this width as it animates.
          expanded ? 'w-56' : 'w-16'
        )}
        data-component="Sidebar"
        onMouseLeave={hideTooltipNow}
      >
        {/* Pinned home / HA logo — stays put while the rest of the rail scrolls.
            Its center sits 32px below the sidebar top (py-ha-2 + half the 48px
            tile), matching the app bar title's vertical center so the two align.
            It stays visible (pinned, inert) while arranging — the Done button
            lives in the bottom slot. */}
        {!loading &&
          homeItem && (
            <div className="flex-shrink-0 mb-ha-2 w-full px-2">
              <RailItem
                item={homeItem}
                index={-1}
                isActive={pathname === '/'}
                arranging={arranging}
                pinned
                expanded={expanded}
                splitNavigationEnabled={splitNavigationEnabled}
                onNavigate={onNavigate}
                onEnterArrange={startArrange}
                onRequestDelete={(item) => requestDelete(item, 'remove')}
                onOpenMenu={(item, x, y) => setMenu({ item, x, y })}
                onHoverShow={showTooltip}
                onHoverHide={hideTooltipSoon}
              />
            </div>
          )}

        {/* The rest of the rail (dashboards + apps) scrolls, with the top/bottom
            fades preserved and applied to the scrolling items only. */}
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
            className="h-full w-full flex flex-col items-stretch gap-ha-2 overflow-y-auto scrollbar-hide py-2 px-2"
          >
            {loading ? (
              // Loading placeholders
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full flex-shrink-0 rounded-ha-xl bg-surface-low animate-pulse"
                  />
                ))}
              </>
            ) : (
              <>
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
                          expanded={expanded}
                          splitNavigationEnabled={splitNavigationEnabled}
                          onNavigate={onNavigate}
                          onRunShortcut={(it) => it.shortcut && runShortcut(it.shortcut)}
                          onEnterArrange={startArrange}
                          onRequestDelete={(it) => requestDelete(it, 'remove')}
                          onOpenMenu={(it, x, y) => setMenu({ item: it, x, y })}
                          onHoverShow={showTooltip}
                          onHoverHide={hideTooltipSoon}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
                {/* "+" appears while arranging; the context menu covers the
                    non-arranging path. */}
                {arranging && (
                  <button
                    type="button"
                    aria-label="Add shortcut"
                    onClick={() => setPickerOpen(true)}
                    className="h-12 w-full flex-shrink-0 rounded-ha-xl border border-dashed border-text-tertiary/40 text-text-tertiary hover:text-text-secondary hover:bg-surface-low transition-colors flex items-center"
                  >
                    <span className="w-12 flex-shrink-0 flex items-center justify-center">
                      <Icon path={mdiPlus} size={20} />
                    </span>
                    <span
                      className={clsx(
                        'min-w-0 flex-1 truncate pl-3 pr-3 text-left text-sm font-medium transition-opacity duration-200',
                        expanded ? 'opacity-100' : 'opacity-0'
                      )}
                    >
                      Add shortcut
                    </span>
                  </button>
                )}
                {/* Hidden items — dimmed with a restore "+", so hiding is a
                    toggle (HA-style), never a dead end. */}
                {arranging && hiddenRailItems.length > 0 && (
                  <>
                    <div className="h-px flex-shrink-0 bg-border-default mx-1" aria-hidden />
                    {hiddenRailItems.map((item) => (
                      <div key={item.id} className="relative w-full flex-shrink-0">
                        <div className="h-12 w-full rounded-ha-xl flex items-center opacity-40 select-none">
                          <span className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                            <MdiIcon
                              icon={item.icon || (item.isApp ? 'mdi:application' : 'mdi:view-dashboard')}
                              size={24}
                              className="text-text-secondary"
                            />
                          </span>
                          <span
                            className={clsx(
                              'min-w-0 flex-1 truncate pl-3 pr-3 text-left text-sm font-medium text-text-secondary transition-opacity duration-200',
                              expanded ? 'opacity-100' : 'opacity-0'
                            )}
                          >
                            {formatTooltipLabel(item.title)}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Show ${item.title}`}
                          onClick={() => {
                            haptic('impact');
                            restoreItem(item.id);
                          }}
                          className="ha-arrange-badge absolute -top-1 -right-1 z-10 w-[18px] h-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-black/30 ring-1 ring-surface-default"
                        >
                          <Icon path={mdiPlus} size={11} exact />
                        </button>
                      </div>
                    ))}
                  </>
                )}
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

        {/* Bottom pinned slot. While arranging it holds the Done button so
            the exit affordance sits in the same place on desktop and mobile;
            otherwise the expand/collapse toggle lives here. */}
        {arranging && (
          <div className="flex-shrink-0 mt-ha-2 w-full px-2">
            <button
              onClick={exitArrange}
              aria-label="Done arranging"
              className="h-12 w-full rounded-ha-xl transition-colors flex items-center bg-ha-blue text-white"
            >
              <span className="w-12 flex-shrink-0 flex items-center justify-center">
                <Icon path={mdiCheck} size={24} />
              </span>
              <span
                className={clsx(
                  'min-w-0 flex-1 truncate pl-3 pr-3 text-left text-sm font-medium transition-opacity duration-200',
                  expanded ? 'opacity-100' : 'opacity-0'
                )}
              >
                Done
              </span>
            </button>
          </div>
        )}
        {/* The pencil tile is narrower than the w-12 tiles above and below it,
            so it gets its own w-12 lane to centre in — otherwise it sits off the
            rail's icon axis (and centring it in the full slot would swing it out
            to the middle of the expanded rail). */}
        {!arranging && (
          <div className="flex-shrink-0 mt-ha-2 w-full px-2">
            <span className="w-12 flex justify-center">
            <EditItemsButton
              variant="rail"
              onClick={startArrange}
              onMouseEnter={(event) =>
                showTooltip(event.currentTarget, 'Edit Sidebar')
              }
              onMouseLeave={hideTooltipSoon}
            />
            </span>
          </div>
        )}
        {!arranging && onToggleExpanded && (
          <div className="flex-shrink-0 mt-ha-1 w-full px-2">
            <button
              type="button"
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={() => {
                hideTooltipNow();
                onToggleExpanded();
              }}
              onMouseEnter={(event) =>
                showTooltip(event.currentTarget, expanded ? 'Collapse Sidebar' : 'Expand Sidebar', {
                  shortcut: sidebarShortcut,
                })
              }
              onMouseLeave={hideTooltipSoon}
              className="group w-12 h-10 rounded-ha-xl transition-colors flex items-center justify-center text-text-disabled hover:bg-surface-low hover:text-text-primary"
            >
              {/* Cross-fade rather than a swapped `path`: both glyphs share the
                  panel outline, so only the chevron appears to arrive. */}
              <span className="relative flex h-6 w-6 items-center justify-center">
                <Icon path={sidebarOpenIcon} size={24} className="absolute transition-opacity duration-150 group-hover:opacity-0" />
                <Icon
                  path={expanded ? sidebarCollapseIcon : sidebarExpandIcon}
                  size={24}
                  className="absolute opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                />
              </span>
            </button>
          </div>
        )}
        {!arranging && hideHomeCenterEnabled && onProfileToggle && (
          <div className="flex-shrink-0 mt-ha-1 w-full px-2">
            <button
              type="button"
              aria-label="Toggle settings"
              onClick={onProfileToggle}
              onMouseEnter={(event) => showTooltip(event.currentTarget, 'Settings', { shortcut: 'S' })}
              onMouseLeave={hideTooltipSoon}
              className="group w-full h-10 rounded-ha-xl transition-colors flex items-center hover:bg-surface-low"
            >
              <span className="w-12 flex-shrink-0 flex items-center justify-center">
                <SettingsGlyph active={pathname.startsWith('/settings')} />
              </span>
              <span
                className={clsx(
                  'min-w-0 flex-1 truncate pl-3 pr-3 text-left text-sm font-medium text-text-primary transition-opacity duration-200',
                  expanded ? 'opacity-100' : 'opacity-0'
                )}
              >
                Settings
              </span>
            </button>
          </div>
        )}

        {typeof document !== 'undefined' &&
          tooltip.content &&
          createPortal(
            previewThumb ? (
              // Rich preview: a snapshot thumbnail of the view, captured on
              // edit-exit / first visit, with the label + shortcut beneath it.
              <div
                ref={tooltipRef}
                className={clsx(
                  'fixed z-[200] w-56 overflow-hidden bg-surface-default border border-surface-lower rounded-ha-lg shadow-xl shadow-black/30 pointer-events-none transition-opacity duration-150',
                  tooltip.visible ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  top: `${tooltip.top}px`,
                  left: `${tooltip.left}px`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewThumb.dataUrl}
                  alt=""
                  aria-hidden
                  className="block h-32 w-full object-cover object-top bg-surface-lower"
                />
                <div className="flex items-center gap-ha-2 px-ha-2 py-1.5 border-t border-surface-lower text-xs text-text-primary font-medium">
                  <span className="truncate">{tooltip.content}</span>
                  {tooltip.shortcut && (
                    <kbd className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-ha-md bg-surface-low border border-surface-lower text-[11px] leading-4 font-medium text-text-secondary">
                      {tooltip.shortcut}
                    </kbd>
                  )}
                </div>
              </div>
            ) : (
              <div
                ref={tooltipRef}
                className={clsx(
                  'fixed z-[200] flex items-center gap-ha-2 px-ha-2 py-ha-1 bg-surface-default border border-surface-lower rounded-ha-lg shadow-lg shadow-black/20 pointer-events-none text-xs text-text-primary whitespace-nowrap font-medium',
                  tooltip.visible ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  top: `${tooltip.top}px`,
                  left: `${tooltip.left}px`,
                }}
              >
                {tooltip.content}
                {tooltip.shortcut && (
                  <kbd className="px-1.5 py-0.5 rounded-ha-md bg-surface-low border border-surface-lower text-[11px] leading-4 font-medium text-text-secondary">
                    {tooltip.shortcut}
                  </kbd>
                )}
              </div>
            ),
            document.body
          )}
      </aside>

      {menu &&
        (() => {
          const actions: ContextMenuAction[] = [];
          // Whatever the icon's status marker is saying, the menu leads with the
          // fix for it: start what's stopped, run the update that's waiting,
          // report the install that's already running. Admin only, and only for
          // panels matched to a real add-on. The `addon_*` services also answer
          // to `app_*` on new cores — keep the older names, they work on both.
          const status = menu.item.appStatus?.kind;
          if (menu.item.addonSlug && isAdmin) {
            const slug = menu.item.addonSlug;
            const itemId = menu.item.id;
            const updateEntityId = menu.item.updateEntityId;
            // Pressing a command swaps the marker for the pulsing dot straight
            // away — the Supervisor takes a couple of seconds to report back,
            // and silence in between reads as "nothing happened".
            const busyUntilConfirmed = () => {
              setAppStatusOverride(itemId, { kind: 'busy' });
              setTimeout(refreshAppStatuses, 2000);
            };
            // Demo has no Supervisor: the same commands pulse, then settle on
            // the result, so the flow is walkable instead of erroring out.
            const demoSettle = (result: AppStatus | undefined) => {
              setAppStatusOverride(itemId, { kind: 'busy' });
              setTimeout(() => setAppStatusOverride(itemId, result), 1400);
            };
            const run = (service: string, demoResult: AppStatus | undefined) => async () => {
              if (demoMode) {
                demoSettle(demoResult);
                return;
              }
              busyUntilConfirmed();
              await callService({ domain: 'hassio', service, serviceData: { addon: slug } });
            };

            if (status === 'installing' || status === 'busy') {
              const progress = menu.item.appStatus?.progress;
              actions.push({
                label:
                  status === 'busy'
                    ? 'Working…'
                    : progress == null
                      ? 'Installing…'
                      : `Installing… ${Math.round(progress)}%`,
                icon: mdiDownload,
                disabled: true,
                onSelect: () => {},
              });
            } else if (status === 'stopped' || status === 'error') {
              actions.push({ label: 'Start', icon: mdiPlay, onSelect: run('addon_start', undefined) });
            } else {
              if (status === 'update' && updateEntityId) {
                actions.push({
                  label: 'Update',
                  icon: mdiDownload,
                  onSelect: async () => {
                    if (demoMode) {
                      demoSettle({ kind: 'installing', progress: null });
                      return;
                    }
                    busyUntilConfirmed();
                    await callService({
                      domain: 'update',
                      service: 'install',
                      target: { entity_id: updateEntityId },
                    });
                  },
                });
              }
              actions.push({ label: 'Restart', icon: mdiRestart, onSelect: run('addon_restart', menu.item.appStatus) });
              actions.push({ label: 'Stop', icon: mdiStop, onSelect: run('addon_stop', { kind: 'stopped' }) });
            }
          }
          actions.push(
            {
              label: 'Rearrange icons',
              icon: mdiDragVariant,
              separator: actions.length > 0,
              onSelect: startArrange,
            },
            { label: 'Add shortcut…', icon: mdiPlusBoxOutline, onSelect: () => setPickerOpen(true) },
          );
          if (menu.item.isShortcut) {
            actions.push({
              label: 'Remove',
              icon: mdiDeleteOutline,
              danger: true,
              onSelect: () => requestDelete(menu.item, 'remove'),
            });
          } else if (menu.item.urlPath !== '/') {
            if (menu.item.isApp) {
              // Apps distinguish clearing the icon off the rail from
              // uninstalling the app itself.
              actions.push({
                label: 'Remove from sidebar',
                icon: mdiMinusCircleOutline,
                onSelect: () => setPendingDelete({ item: menu.item, mode: 'remove' }),
              });
              // Only offered where it can actually happen: a matched add-on and
              // the rights to remove it. Everything else gets the sidebar-only
              // option above, which is all this app can honestly promise.
              if (menu.item.addonSlug && isAdmin) {
                actions.push({
                  label: 'Uninstall',
                  icon: mdiDeleteOutline,
                  danger: true,
                  onSelect: () => setPendingDelete({ item: menu.item, mode: 'uninstall' }),
                });
              }
            } else {
              actions.push({
                label: 'Remove',
                icon: mdiDeleteOutline,
                danger: true,
                onSelect: () => setPendingDelete({ item: menu.item, mode: 'remove' }),
              });
            }
          }
          return (
            <ContextMenu x={menu.x} y={menu.y} actions={actions} onClose={() => setMenu(null)} />
          );
        })()}

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete
            ? `${pendingDelete.mode === 'uninstall' ? 'Uninstall' : 'Remove'} ${pendingDelete.item.title}?`
            : ''
        }
        message={
          pendingDelete?.mode === 'uninstall'
            ? `${pendingDelete.item.title} will be removed from your home for good, along with its settings and data. You'd have to install it again to get it back.`
            : pendingDelete?.item.isApp
              ? 'Takes it off your sidebar — the app stays installed.'
              : 'Hides it from your sidebar — bring it back anytime while rearranging.'
        }
        confirmLabel={pendingDelete?.mode === 'uninstall' ? 'Uninstall' : 'Remove'}
        cancelLabel="Keep"
        destructive={pendingDelete?.mode === 'uninstall' || !pendingDelete?.item.isApp}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete?.mode === 'uninstall') void uninstallApp(pendingDelete.item);
          if (pendingDelete) hideItem(pendingDelete.item.id);
          setPendingDelete(null);
        }}
      />

      <ShortcutPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
