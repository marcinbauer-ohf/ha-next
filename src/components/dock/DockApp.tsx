'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { mdiArrowLeft, mdiPencil, mdiPlus } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { getConnection, getPanels } from '@/lib/homeassistant';
import { DockBar, DockSlotIcon, SLOT_PX } from './DockBar';
import { DockScreensaver, useDockScreensaver } from './DockScreensaver';
import { HomeDashboard } from './HomeDashboard';
import { ProfilePanel } from './ProfilePanel';
import {
  ASK_ITEM,
  DOCK_DROPPABLE_ID,
  HOME_CENTER_ITEM,
  HOME_CENTER_ITEMS,
  PAGE_CATEGORIES,
  loadPins,
  panelsToCategories,
  resolveDockItem,
  savePins,
  usesLovelace,
  type DockCategory,
  type MenuMode,
  type DockItem,
} from './dockItems';

const DEMO_CATEGORIES: DockCategory[] = [
  {
    title: 'Dashboards',
    accent: '#f59e0b',
    items: [
      { id: 'dash:lovelace', label: 'Home', category: 'Dashboards', mdiName: 'mdi:home' },
      { id: 'dash:energy-dash', label: 'Energy', category: 'Dashboards', mdiName: 'mdi:lightning-bolt' },
    ],
  },
];

/**
 * The user's real dashboards and apps, straight from their instance — the same
 * credentials and socket the main prototype uses (HomeAssistantProvider wraps
 * every route). Demo mode gets the demo set; never both at once.
 */
function useLiveCategories(): DockCategory[] {
  const ha = useHomeAssistant();
  const [fetched, setFetched] = useState<DockCategory[]>([]);

  useEffect(() => {
    if (!ha.connected || ha.demoMode) return;
    let cancelled = false;
    getPanels()
      .then((panels) => {
        if (!cancelled) setFetched(panelsToCategories(panels));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ha.connected, ha.demoMode]);

  return ha.demoMode ? DEMO_CATEGORIES : fetched;
}

/**
 * The dashboard Home Assistant opens by default. It lives in per-user frontend
 * data (`frontend/get_user_data`, key `core`), which the frontend falls back to
 * `lovelace` for when unset — the built-in Overview. Sent over the existing
 * socket via getConnection() so this needs no addition to the shared lib.
 */
function useDefaultPanel(): string | null {
  const ha = useHomeAssistant();
  const [panel, setPanel] = useState<string | null>(null);

  useEffect(() => {
    if (!ha.connected || ha.demoMode) return;
    const conn = getConnection();
    if (!conn) return;
    let cancelled = false;
    conn
      .sendMessagePromise<{ value?: { defaultPanel?: string } | null }>({
        type: 'frontend/get_user_data',
        key: 'core',
      })
      .then((res) => {
        if (!cancelled) setPanel(res?.value?.defaultPanel ?? 'lovelace');
      })
      // Never set (or not permitted) — HA's own fallback is the Overview panel.
      .catch(() => {
        if (!cancelled) setPanel('lovelace');
      });
    return () => {
      cancelled = true;
    };
  }, [ha.connected, ha.demoMode]);

  return ha.demoMode ? 'lovelace' : panel;
}

export function DockApp() {
  // This spinoff is hardcoded to the Figma light palette, so shared themed
  // components it reuses (ModalSheet's surface tokens) must resolve light too —
  // otherwise a user on dark mode gets a near-black sheet under dark text.
  // Pinned while mounted, handed back on the way out.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-mode');
    root.setAttribute('data-mode', 'light');
    return () => {
      if (previous === null) root.removeAttribute('data-mode');
      else root.setAttribute('data-mode', previous);
    };
  }, []);

  const liveCategories = useLiveCategories();
  const [pinIds, setPinIds] = useState<string[]>(loadPins);
  /** The Lovelace dashboard on the grey background — also what titles the page. */
  const [selected, setSelected] = useState<DockItem | null>(null);
  /** Sub-page inside the dashboard (an area drill-in): what the top bar titles. */
  const [area, setArea] = useState<{ id: string; name: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  /** null = the mega menu's root; an item = its sub view inside the same surface. */
  const [menuView, setMenuView] = useState<DockItem | null>(null);
  const [menuMode, setMenuMode] = useState<MenuMode>('menu');
  const [dragging, setDragging] = useState<{ item: DockItem; fromCatalog: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [navHidden, setNavHidden] = useState(false);
  const lastYRef = useRef(0);
  const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < 768));

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /**
   * Hide-on-scroll-down, show-on-scroll-up. The usual rules apply: always show
   * near the top and at the very bottom (so a rubber-band bounce can't leave it
   * hidden), and only react once the gesture passes a threshold — `lastY` is
   * held until then so slow scrolls accumulate instead of being ignored.
   */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    setAtTop(y <= 4);

    if (y < 64 || y + el.clientHeight >= el.scrollHeight - 8) {
      setNavHidden(false);
      lastYRef.current = y;
      return;
    }
    const delta = y - lastYRef.current;
    if (Math.abs(delta) < 10) return;
    setNavHidden(delta > 0);
    lastYRef.current = y;
  };

  /** Chrome only auto-hides on mobile, where the space actually matters. */
  const chromeHidden = isMobile && navHidden;

  const liveItems = useMemo(() => liveCategories.flatMap((c) => c.items), [liveCategories]);
  /** Live dashboards and apps first, then every HA page — what search looks at. */
  const searchItems = useMemo(
    () => [...liveItems, ...PAGE_CATEGORIES.flatMap((c) => c.items)],
    [liveItems],
  );
  const defaultPanel = useDefaultPanel();
  /** HA's default dashboard — always in the dock, always first, never removable. */
  const defaultItem = useMemo(
    () => (defaultPanel ? liveItems.find((i) => i.id === `dash:${defaultPanel}`) ?? null : null),
    [defaultPanel, liveItems],
  );

  const pins = useMemo(() => {
    const resolved = pinIds
      .map((id) => resolveDockItem(id, liveItems))
      .filter((i): i is DockItem => Boolean(i));
    if (!defaultItem) return resolved;
    // Prepended rather than written into pinIds, so it can't be dragged out or
    // lost — and it's filtered from the rest in case it was pinned by hand too.
    return [defaultItem, ...resolved.filter((p) => p.id !== defaultItem.id)];
  }, [pinIds, liveItems, defaultItem]);

  /** Nothing picked yet = the default dashboard is what's on screen. */
  const activeDashboard = selected ?? defaultItem;

  const updatePins = (ids: string[]) => {
    setPinIds(ids);
    savePins(ids);
  };

  const togglePin = (id: string) =>
    updatePins(pinIds.includes(id) ? pinIds.filter((p) => p !== id) : [...pinIds, id]);

  /**
   * Lovelace views take over the grey background. Everything else — settings
   * pages, HA apps — rides on the overlay, in one of two shapes:
   *
   * - `page`: opened directly (a pinned dock item, a search hit). You asked for
   *   that thing, so it gets the whole surface — no menu column beside it.
   * - `menu`: browsing from the hamburger, where the list stays alongside.
   */
  const showItem = (item: DockItem, mode: MenuMode) => {
    if (usesLovelace(item.id)) {
      setSelected(item);
      // A different dashboard means the area drill-in no longer applies.
      setArea(null);
      // menuView is left alone: clearing it here would swap the panel back to
      // the root grid for the length of its exit animation.
      setMenuOpen(false);
      return;
    }
    // Tapping the item that's already showing closes it again.
    if (menuOpen && menuView?.id === item.id) {
      setMenuOpen(false);
      return;
    }
    setMenuView(item);
    setMenuMode(mode);
    setMenuOpen(true);
  };

  /** From the dock, search, or the overflow sheet — content only. */
  const open = (item: DockItem) => showItem(item, 'page');
  /** From a row inside the mega menu — keeps the list beside it. */
  const openFromMenu = (item: DockItem) => showItem(item, 'menu');

  const screensaver = useDockScreensaver();
  /** The ask pill and chip both land here: leave the saver, open the chat page. */
  const openAsk = () => {
    screensaver.dismiss();
    showItem(ASK_ITEM, 'page');
  };

  // The hamburger is the menu button: it always toggles, and opening lands on
  // Home Center rather than wherever the last sub view left off. Mobile shows the
  // list on its own instead — there, a default selection would cover it.
  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setMenuView(isMobile ? null : HOME_CENTER_ITEM);
    setMenuMode('menu');
    setMenuOpen(true);
  };

  /** Mobile back: a Home Center child returns to Home Center, not the root list. */
  const menuBack = () =>
    setMenuView(HOME_CENTER_ITEMS.some((i) => i.id === menuView?.id) ? HOME_CENTER_ITEM : null);

  // Touch needs a long-press to start a drag, otherwise it would swallow the
  // horizontal scroll of the pinned strip.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    const newId = active.data.current?.newId as string | undefined;
    const item = resolveDockItem(newId ?? String(active.id), liveItems);
    if (item) setDragging({ item, fromCatalog: Boolean(newId) });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const overId = over ? String(over.id) : null;
    const newId = active.data.current?.newId as string | undefined;

    // Dragged in from the profile window: drop on the strip to pin, and land on
    // a specific slot to choose the position.
    if (newId) {
      if (!overId || pinIds.includes(newId)) return;
      const at = pinIds.indexOf(overId);
      const next = [...pinIds];
      next.splice(at >= 0 ? at : next.length, 0, newId);
      updatePins(next);
      return;
    }

    const activeId = String(active.id);
    // Dropped clear of the dock entirely → dismiss it.
    if (!overId) {
      updatePins(pinIds.filter((p) => p !== activeId));
      return;
    }
    // Over the strip's padding rather than a sibling slot — nothing to reorder.
    if (overId === DOCK_DROPPABLE_ID || overId === activeId) return;
    updatePins(arrayMove(pinIds, pinIds.indexOf(activeId), pinIds.indexOf(overId)));
  };

  // The title is whatever is currently selected — the default dashboard until
  // you pick another.
  const title = activeDashboard?.label ?? 'Home';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="relative flex h-dvh flex-col overflow-hidden bg-[#f2f2f2] text-neutral-800">
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {/* The grey background is the Lovelace surface, always. Everything
              non-Lovelace rides on the mega menu overlay instead. Top padding
              leaves room for the overlaid bar; content then scrolls under it. */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto px-5 pb-[124px] pt-[84px] md:px-[13%] md:pt-[92px]"
          >
            <HomeDashboard
              areaId={area?.id ?? null}
              onOpenArea={(next) => {
                setArea(next);
                scrollRef.current?.scrollTo({ top: 0 });
              }}
            />
          </div>

          {/* Overlays the content with no background of its own, so there's no grey
              band — you see the content pass underneath. pointer-events-none lets
              scroll gestures through; only the pill takes clicks. */}
          <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 pt-5 md:px-[13%] md:pt-6">
            {/* Sub-page titles sit over scrolling content, so they get a scrim to
                stay readable. -z-10 keeps it behind the header's own children
                (the header is a stacking context: absolute + z-10). */}
            {area && (
              <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[112px] bg-gradient-to-b from-[#f2f2f2] via-[#f2f2f2]/85 to-transparent" />
            )}
            {area ? (
              // A sub-page keeps its header no matter the scroll position — it's
              // the only way back out.
              <div className="pointer-events-auto mt-1 flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setArea(null)}
                  aria-label="Back to dashboard"
                  className="-ml-2 shrink-0 rounded-full p-2 text-neutral-500 transition-colors hover:bg-white/70 hover:text-neutral-800"
                >
                  <Icon path={mdiArrowLeft} size={22} />
                </button>
                <h1 className="truncate text-[28px] font-normal leading-none tracking-tight text-neutral-500">
                  {area.name}
                </h1>
              </div>
            ) : (
              <h1
                className={clsx(
                  'mt-2 text-[28px] font-normal leading-none tracking-tight text-neutral-500 transition-opacity duration-200 ease-out',
                  // Only at the very top; any scroll at all takes it away.
                  atTop ? 'opacity-100' : 'opacity-0',
                )}
              >
                {title}
              </h1>
            )}
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white p-2 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
              {/* Both no-ops for now — the dock is what this prototype is about. */}
              <button
                type="button"
                aria-label="Add"
                className="rounded-full p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                <Icon path={mdiPlus} size={22} />
              </button>
              <button
                type="button"
                aria-label="Edit dashboard"
                className="rounded-full p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                <Icon path={mdiPencil} size={22} />
              </button>
            </div>
          </header>
          <AnimatePresence>
            {menuOpen && (
              // Invisible click-catcher for dismiss-on-outside-click. A scrim
              // rather than a document listener: its mousedown would fire before
              // a dock item's click and break the tap-again-to-close toggle.
              // Desktop only — the mobile panel is full-screen, so there is no
              // outside. Sits under the panel (z-20) and the dock (z-30).
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-[15] hidden md:block"
              />
            )}
            {menuOpen && (
              <ProfilePanel
                key="panel"
                liveCategories={liveCategories}
                searchItems={searchItems}
                pins={pinIds}
                fixedId={defaultItem?.id ?? null}
                view={menuView}
                mode={menuMode}
                onOpen={openFromMenu}
                onTogglePin={togglePin}
                onBack={menuBack}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </AnimatePresence>
        </main>

        <DockBar
          pins={pins}
          activeId={(menuOpen ? menuView?.id : null) ?? activeDashboard?.id ?? null}
          profileOpen={menuOpen}
          hidden={chromeHidden}
          fixedId={defaultItem?.id ?? null}
          askVisible={!screensaver.active}
          dropActive={Boolean(dragging?.fromCatalog)}
          onSelect={open}
          onUnpin={(id) => updatePins(pinIds.filter((p) => p !== id))}
          onProfile={toggleMenu}
          onAsk={openAsk}
        />

        <DockScreensaver
          active={screensaver.active}
          onDismiss={screensaver.dismiss}
          onAsk={openAsk}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div
            style={{ width: SLOT_PX, height: SLOT_PX }}
            className="flex items-center justify-center rounded-2xl bg-white text-neutral-700 ring-1 ring-black/[0.06] shadow-[0_10px_28px_-4px_rgba(0,0,0,0.25)]"
          >
            <DockSlotIcon item={dragging.item} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
