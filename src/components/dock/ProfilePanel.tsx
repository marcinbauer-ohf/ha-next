'use client';

import { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import {
  mdiArrowLeft,
  mdiClipboardCheckOutline,
  mdiClose,
  mdiPin,
  mdiPinOutline,
  mdiReload,
  mdiRestart,
} from '@mdi/js';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { ScrollFadeEdge } from '@/components/ui/ScrollFadeEdge';
import { HaPageFrame } from '@/components/layout/HaPageFrame';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks/useHomeAssistant';
import type { HassEntities } from '@/types';
import { useHomeName } from '@/lib/homeName';
import { DockSlotIcon } from './DockBar';
import { AskChatPane } from './DockAsk';
import {
  APPLICATIONS_ID,
  ASK_ID,
  HOME_CENTER_ID,
  HOME_CENTER_ITEMS,
  NOTIFICATIONS_ID,
  PAGE_CATEGORIES,
  orderCategories,
  type DockCategory,
  type DockItem,
  type MenuMode,
} from './dockItems';

function PageRow({
  item,
  pinned,
  active,
  fixed,
  badge,
  onOpen,
  onTogglePin,
}: {
  item: DockItem;
  pinned: boolean;
  active: boolean;
  /** HA's default dashboard — permanently docked, so the pin isn't a toggle. */
  fixed?: boolean;
  /** Live count, e.g. how many notifications are waiting. Hidden when zero. */
  badge?: number;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  // `new:` prefix marks this as a catalog source rather than an existing pin.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new:${item.id}`,
    data: { newId: item.id },
  });

  return (
    <div
      className={clsx(
        'group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors',
        active ? 'bg-neutral-200/70' : 'hover:bg-neutral-100',
        isDragging && 'opacity-40',
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-3 text-left active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {item.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- static asset in /public
          <img
            src="/dock-avatar.png"
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <DockSlotIcon item={item} size={20} />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-neutral-800">{item.label}</span>
          {item.description && (
            <span className="block truncate text-[12px] text-neutral-500">{item.description}</span>
          )}
        </span>
      </button>
      {badge ? (
        <span className="shrink-0 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
          {badge}
        </span>
      ) : null}
      {fixed ? (
        <span
          title="Your default dashboard — always in the dock"
          className="shrink-0 p-1.5 text-neutral-300"
        >
          <Icon path={mdiPin} size={16} exact />
        </span>
      ) : (
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={pinned ? `Unpin ${item.label} from the dock` : `Pin ${item.label} to the dock`}
          aria-pressed={pinned}
          className={clsx(
            'shrink-0 rounded-lg p-1.5 transition-all hover:text-neutral-600',
            pinned
              ? 'text-neutral-300'
              : 'text-neutral-200 opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
          )}
        >
          <Icon path={pinned ? mdiPin : mdiPinOutline} size={16} exact />
        </button>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  pins,
  activeId,
  fixedId,
  onOpen,
  onTogglePin,
}: {
  category: DockCategory;
  pins: string[];
  activeId?: string;
  fixedId: string | null;
  onOpen: (item: DockItem) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl bg-neutral-50 p-3">
      <div className="flex flex-col">
        {category.items.map((item) => (
          <PageRow
            key={item.id}
            item={item}
            pinned={pins.includes(item.id) || item.id === fixedId}
            active={activeId === item.id}
            fixed={item.id === fixedId}
            onOpen={() => onOpen(item)}
            onTogglePin={() => onTogglePin(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

interface NotificationRow {
  id: string;
  title: string;
  message?: string;
}

// Module scope: useHomeAssistantSelector caches by selector identity, so these
// must not be recreated per render.
const selectNotifications = (entities: HassEntities): NotificationRow[] =>
  Object.entries(entities)
    .filter(([id]) => id.startsWith('persistent_notification.'))
    .map(([id, entity]) => ({
      id,
      title:
        (entity.attributes.title as string | undefined) ||
        (entity.attributes.friendly_name as string | undefined) ||
        'Notification',
      message: entity.attributes.message as string | undefined,
    }));

const sameNotifications = (a: NotificationRow[], b: NotificationRow[]) =>
  a.length === b.length && a.every((n, i) => n.id === b[i].id && n.message === b[i].message);

const selectUpdateCount = (entities: HassEntities): number =>
  Object.entries(entities).filter(([id, e]) => id.startsWith('update.') && e.state === 'on').length;

/**
 * Home Center: the one place notifications, updates and repairs live. Counts are
 * live from the instance; the rows open into the pane beside (or over) this list.
 */
function HomeCenterList({
  pins,
  onOpen,
  onTogglePin,
}: {
  pins: string[];
  onOpen: (item: DockItem) => void;
  onTogglePin: (id: string) => void;
}) {
  const notifications = useHomeAssistantSelector(selectNotifications, sameNotifications);
  const updates = useHomeAssistantSelector(selectUpdateCount);
  // Repairs come from a WS command rather than entities, so there's no count
  // here — the row opens HA's own repairs page, which has the real list.
  const badges: Record<string, number | undefined> = {
    [NOTIFICATIONS_ID]: notifications.length,
    'page:updates': updates,
  };

  return (
    <div className="h-full overflow-y-auto rounded-xl bg-neutral-50 p-3">
      {HOME_CENTER_ITEMS.map((item) => (
        <PageRow
          key={item.id}
          item={item}
          pinned={pins.includes(item.id)}
          active={false}
          badge={badges[item.id]}
          onOpen={() => onOpen(item)}
          onTogglePin={() => onTogglePin(item.id)}
        />
      ))}
    </div>
  );
}

/** The live `persistent_notification.*` entities — HA has no page for these. */
function NotificationsPane() {
  const notifications = useHomeAssistantSelector(selectNotifications, sameNotifications);

  if (notifications.length === 0) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-neutral-300">
        Nothing needs your attention
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-xl bg-neutral-50 p-3">
      {notifications.map((notification) => (
        <article key={notification.id} className="rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <h3 className="text-[14px] font-medium text-neutral-800">{notification.title}</h3>
          {notification.message && (
            <p className="mt-1 whitespace-pre-line text-[13px] text-neutral-500">{notification.message}</p>
          )}
        </article>
      ))}
    </div>
  );
}

/**
 * The handful of system commands people reach for most. Only `homeassistant.*`
 * services, which exist on every install — the `hassio.host_reboot`/`host_shutdown`
 * pair is deliberately left out because it only exists on supervised installs and
 * `callService` swallows failures, so a Core user would get a silent no-op.
 * `homeassistant.stop` is out too: it kills the connection with no way back.
 */
const SYSTEM_COMMANDS: {
  label: string;
  detail: string;
  icon: string;
  domain: string;
  service: string;
  destructive?: boolean;
}[] = [
  {
    label: 'Restart Home Assistant',
    detail: 'Everything goes offline for a moment',
    icon: mdiRestart,
    domain: 'homeassistant',
    service: 'restart',
    destructive: true,
  },
  {
    label: 'Reload configuration',
    detail: 'Picks up config changes without a restart',
    icon: mdiReload,
    domain: 'homeassistant',
    service: 'reload_all',
  },
  {
    label: 'Check configuration',
    detail: 'Looks for problems before you restart',
    icon: mdiClipboardCheckOutline,
    domain: 'homeassistant',
    service: 'check_config',
  },
];

/**
 * Sits at the end of the menu column. Admin-only and hidden in demo mode, so it
 * never offers an action it can't actually perform. Every command confirms first
 * — a restart is disruptive and there's no undo.
 */
function SystemCommands() {
  const { callService, isAdmin, connected, demoMode } = useHomeAssistant();
  const [pending, setPending] = useState<(typeof SYSTEM_COMMANDS)[number] | null>(null);

  if (!isAdmin || !connected || demoMode) return null;

  return (
    <section className="rounded-2xl bg-neutral-50 p-3">
      <div className="flex flex-col">
        {SYSTEM_COMMANDS.map((command) => (
          <button
            key={command.service}
            type="button"
            onClick={() => setPending(command)}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-neutral-100"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <Icon path={command.icon} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-neutral-800">{command.label}</span>
              <span className="block truncate text-[12px] text-neutral-500">{command.detail}</span>
            </span>
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? ''}
        message={pending?.detail}
        confirmLabel={pending?.destructive ? 'Restart' : 'Run'}
        destructive={pending?.destructive}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void callService({ domain: pending.domain, service: pending.service });
          setPending(null);
        }}
      />
    </section>
  );
}

/**
 * The detail pane: the real Home Assistant page and nothing else. The item's
 * name and icon are already on the row that opened it, so no header here.
 */
function DetailPane({ item }: { item: DockItem }) {
  const { haUrl } = useHomeAssistant();
  const src = item.path && haUrl ? `${haUrl}${item.path}` : null;

  if (!src) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-neutral-300">
        {item.category} · no Home Assistant page to embed
      </div>
    );
  }

  return <HaPageFrame src={src} title={item.label} className="rounded-xl border border-neutral-200 bg-white" />;
}

/**
 * The window the avatar opens, and the single surface for everything that isn't
 * a Lovelace view. Desktop is master–detail: the menu itself is one column at a
 * third of the width, and the remaining two thirds show the selected item.
 * Mobile pushes the detail over the list, with a back arrow.
 */
export function ProfilePanel({
  liveCategories,
  searchItems,
  pins,
  fixedId,
  view,
  mode,
  onOpen,
  onTogglePin,
  onBack,
  onClose,
}: {
  /** Dashboards + apps read from the connected instance, shown above the pages. */
  liveCategories: DockCategory[];
  /** Everything the ask page can search: live dashboards + apps + every HA page. */
  searchItems: DockItem[];
  pins: string[];
  /** HA's default dashboard — shown as permanently pinned. */
  fixedId: string | null;
  /** null = nothing selected yet; an item = shown in the detail pane. */
  view: DockItem | null;
  /** 'page' = opened directly, so the content gets the whole surface. */
  mode: MenuMode;
  onOpen: (item: DockItem) => void;
  onTogglePin: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: true });
  const menuShown = mode === 'menu';
  // Same store the main prototype's dashboard title and Home Center hero read.
  const homeName = useHomeName();

  // Settings pages only. The live dashboards and apps would each be an unbounded
  // list, so they sit behind the "Dashboards" and "Applications" rows in My Home.
  const categories: DockCategory[] = orderCategories(PAGE_CATEGORIES);
  const appItems = liveCategories.find((c) => c.title === 'Apps')?.items ?? [];

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({
      top: el.scrollTop > 8,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 8,
    });
  };

  const scrollTo = (edge: 'top' | 'bottom') =>
    scrollRef.current?.scrollTo({
      top: edge === 'top' ? 0 : scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      // Mobile goes edge-to-edge and viewport-fixed so it covers the title bar —
      // `absolute` could only ever fill <main>, which starts below it. It runs the
      // full height, *under* the floating dock; the scroll areas inside carry
      // DOCK_CLEARANCE at the bottom so nothing ends up hidden behind it.
      // Desktop stays an inset card that stops short of the dock.
      className="fixed inset-x-0 bottom-0 top-0 z-20 flex flex-col overflow-hidden bg-white shadow-[0_20px_60px_rgba(0,0,0,0.14)] md:absolute md:inset-x-8 md:bottom-[108px] md:top-6 md:rounded-[28px]"
    >
      {/* Same behaviour as the dashboard's top bar: an overlay, not a row — the
          content scrolls under it. At the root the title is transparent and only
          shows at the very top of the list; a sub view keeps its title and gets a
          gradient so it stays readable over whatever passes beneath. Rendered
          after the content so it paints above it. */}
      <div className="flex min-h-0 flex-1 gap-0 pt-[calc(48px+env(safe-area-inset-top))] md:gap-2 md:pt-[56px]">
        {/* The menu: one column, a third of the width on desktop. Absent entirely
            when a page was opened directly — that content gets the whole surface. */}
        {/* Capped rather than a straight third, so the menu doesn't sprawl on a
            wide display — and shrink-0 keeps the detail pane from squeezing it. */}
        {menuShown && (
        <div
          className={clsx(
            'relative min-h-0 w-full md:w-1/3 md:max-w-[360px] md:shrink-0',
            view && 'hidden md:block',
          )}
        >
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            // Bottom clearance = the floating dock's footprint, so the last card
            // can still be scrolled out from under it.
            className="flex h-full flex-col gap-3 overflow-y-auto px-5 pb-[calc(104px+env(safe-area-inset-bottom))] md:pb-6 md:pr-2"
          >
            {categories.map((category) => (
              <CategoryCard
                key={category.title}
                category={category}
                pins={pins}
                activeId={view?.id}
                fixedId={fixedId}
                onOpen={onOpen}
                onTogglePin={onTogglePin}
              />
            ))}
            <SystemCommands />
          </div>
          <ScrollFadeEdge
            edge="top"
            visible={edges.top}
            onClick={() => scrollTo('top')}
            className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity"
          />
          <ScrollFadeEdge
            edge="bottom"
            visible={edges.bottom}
            onClick={() => scrollTo('bottom')}
            className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent transition-opacity"
          />
        </div>
        )}

        {/* Detail. Takes every pixel the menu leaves — min-w-0 is what actually
            lets it shrink; without it a flex child refuses to go below its
            content's intrinsic width and overflows the panel instead. With no
            menu beside it, it spans the full surface. */}
        <div
          className={clsx(
            // Same dock clearance on mobile, so the embedded page isn't cut off
            // behind the floating dock.
            'min-h-0 w-full min-w-0 flex-1 pb-[calc(104px+env(safe-area-inset-bottom))] md:pb-4',
            menuShown ? 'px-4 md:pl-0 md:pr-4' : 'px-4 md:px-4',
            menuShown && !view && 'hidden md:block',
          )}
        >
          {view?.id === ASK_ID ? (
            <AskChatPane items={searchItems} onOpen={onOpen} />
          ) : view?.id === HOME_CENTER_ID ? (
            <HomeCenterList pins={pins} onOpen={onOpen} onTogglePin={onTogglePin} />
          ) : view?.id === NOTIFICATIONS_ID ? (
            <NotificationsPane />
          ) : view?.id === APPLICATIONS_ID ? (
            <div className="h-full overflow-y-auto rounded-xl bg-neutral-50 p-3">
              {appItems.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-neutral-400">No apps on this instance.</p>
              ) : (
                appItems.map((app) => (
                  <PageRow
                    key={app.id}
                    item={app}
                    pinned={pins.includes(app.id)}
                    active={false}
                    onOpen={() => onOpen(app)}
                    onTogglePin={() => onTogglePin(app.id)}
                  />
                ))
              )}
            </div>
          ) : view ? (
            <DetailPane key={view.id} item={view} />
          ) : (
            <div className="grid h-full place-items-center text-[13px] text-neutral-300">
              Pick something from the menu
            </div>
          )}
        </div>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-5 md:pt-3">
        {/* Only a sub view gets the scrim — at the root the bar is transparent. */}
        {view && (
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[76px] bg-gradient-to-b from-white via-white/90 to-transparent md:h-[84px]" />
        )}
        {/* Back only where the sub view actually covers the list. */}
        {view && menuShown && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to menu"
            className="pointer-events-auto -ml-1.5 shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 md:hidden"
          >
            <Icon path={mdiArrowLeft} size={20} />
          </button>
        )}
        <div
          className={clsx(
            'min-w-0 flex-1 transition-opacity duration-200 ease-out',
            // Root level: the title behaves like the dashboard's — gone the moment
            // the list moves.
            menuShown && !view && edges.top ? 'opacity-0' : 'opacity-100',
          )}
        >
          {menuShown ? (
            // Two levels: where you are, under the home you're in.
            <>
              {view && <p className="truncate text-[11px] leading-tight text-neutral-500">{homeName}</p>}
              <h1 className="truncate text-[16px] leading-tight text-neutral-800 md:text-[18px]">
                {view ? view.label : homeName}
              </h1>
            </>
          ) : (
            <>
              <h1 className="truncate text-[16px] leading-tight text-neutral-800 md:text-[18px]">{view?.label}</h1>
              <p className="truncate text-[11px] leading-tight text-neutral-500">
                {view?.description ?? view?.category}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
        >
          <Icon path={mdiClose} size={20} />
        </button>
      </header>
    </motion.div>
  );
}
