'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  mdiCheck,
  mdiChevronRight,
  mdiDownload,
  mdiHistory,
  mdiMagnify,
  mdiOpenInNew,
  mdiStarFourPointsOutline,
} from '@mdi/js';
import { Icon } from './Icon';
import { IntegrationLogo } from './IntegrationLogo';
import { SearchField } from './SearchField';
import { SectionLabel } from './SectionLabel';
import { SegmentedControl } from './SegmentedControl';
import { ModalSheet } from '../layout/ModalSheet';
import { DialogFrame } from '../cards/dialogKit';

// ─────────────────────────────────────────────────────────────────────────────
// The store — one browse-and-add surface behind every "+ Add <big thing>" that
// isn't a form: applications, blueprints, and whatever comes next. Categories
// down the top, a featured shelf, a grid of cards, and a detail pane inside the
// same dialog. Callers only describe their items; the shell is shared so the
// two stores can't drift into two different experiences.
// ─────────────────────────────────────────────────────────────────────────────

export interface StoreItem {
  id: string;
  name: string;
  /** One line under the name — what it does, in plain words. */
  tagline: string;
  category: string;
  icon: string;
  /** Tile hue. Falls back to the HA blue. */
  accent?: string;
  /** Who made it — "Home Assistant", a community repo, a person. */
  source?: string;
  /** Small chips on the card: "Official", "Experimental", … */
  badges?: string[];
  installed?: boolean;
  /** Lifts the item onto the featured shelf above the grid. */
  featured?: boolean;
  /** Longer copy for the detail pane. Defaults to the tagline. */
  description?: string;
  /** Label/value pairs listed in the detail pane. */
  facts?: Array<{ label: string; value: string }>;
  /** "Learn more" target shown in the detail pane. */
  url?: string;
  /**
   * Brand domain on the Home Assistant brands CDN. Set it and the item wears its
   * real logo instead of `icon`, which stays as the fallback.
   */
  logoDomain?: string;
  /** Extra words search should match but the card doesn't show. */
  keywords?: string;
}

/** One chip in the filter row, e.g. "Devices" / "Services". */
export interface StoreFilter {
  id: string;
  label: string;
  match: (item: StoreItem) => boolean;
}

interface StoreOverlayProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  items: StoreItem[];
  onAdd: (item: StoreItem) => void;
  addLabel?: string;
  addedLabel?: string;
  /** Defaults to "Search <title>" — the big field is the heading. */
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Extra row under the grid — e.g. blueprints' "import from a URL". */
  footer?: React.ReactNode;
  /**
   * Sits above the featured shelf on the landing view, for what the caller
   * already knows about before anyone browses — the devices the home found on
   * its own. Hidden the moment you search or pick a category, like `featured`:
   * by then you're looking for something specific.
   */
  shelf?: React.ReactNode;
  /** One row of either/or chips, on top of the category rail. */
  filters?: StoreFilter[];
  /**
   * Names the items for a store big enough to browse two ways ("Brands"). Set it
   * and the store opens on a grid of categories, with a switch to the flat A→Z
   * list; leave it and the store is just the flat list, like Applications.
   */
  itemsLabel?: string;
  /**
   * Searches worth offering before anyone has typed — things the catalogue
   * answers well that browsing by category doesn't surface ("Doorbell").
   * Shown after whatever this person searched for last.
   */
  suggestions?: string[];
}

// ── Recent searches ─────────────────────────────────────────────────────────
// Kept per store, and only written when a search *worked* — the query that was
// in the field when you opened something. A query you typed and abandoned is a
// wrong turn, and offering it back is offering the wrong turn again.
const RECENTS_MAX = 4;
const recentsKey = (title: string) => `ha_store_recents_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

function readRecents(title: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(recentsKey(title));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string').slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecents(title: string, list: string[]): void {
  try {
    window.localStorage.setItem(recentsKey(title), JSON.stringify(list.slice(0, RECENTS_MAX)));
  } catch {
    // A full or blocked store just means no history; nothing here is worth a throw.
  }
}

// The brand store holds ~1,500 items and the grid isn't virtualised, so the
// unfiltered list shows a first slice and says so. Every category is smaller than
// this, so picking one — or searching — always shows the whole of it.
const GRID_CAP = 240;

/**
 * A filter chip. There is no "All" chip: showing everything is what no selection
 * looks like, and clicking the chip you're on takes you back to it. Saves a chip
 * per row, and the rows are already the widest thing in the dialog.
 *
 * Picked shows a check and a tinted fill, never a solid one — the same treatment
 * the filter chips wear everywhere else (see DataListView). A solid blue pill
 * reads as "the button to press", which is the opposite of what it means.
 */
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        // h-8 to match SegmentedControl — they share the row.
        'inline-flex h-8 flex-shrink-0 items-center gap-ha-1 rounded-full px-ha-3 text-sm font-medium transition-colors',
        active ? 'bg-ha-blue/15 text-ha-blue' : 'bg-surface-low text-text-secondary hover:bg-surface-mid',
      )}
    >
      {active && <Icon path={mdiCheck} size={15} />}
      {label}
    </button>
  );
}

/** "1 brand", "24 brands" — itemsLabel is the plural, so one loses the s. */
function countNoun(count: number, itemsLabel = 'Items'): string {
  const plural = itemsLabel.toLowerCase();
  return count === 1 ? plural.replace(/s$/, '') : plural;
}

/**
 * A way in, rather than a thing: a category to browse or a search to run. Same
 * tile either way — glyph, name, how much is behind it.
 */
function PickTile({
  label,
  meta,
  icon,
  accent = '#18bcf2',
  onOpen,
}: {
  label: string;
  meta: string;
  icon: string;
  accent?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-ha-xl"
        style={{ backgroundColor: `${accent}24`, color: accent }}
      >
        <Icon path={icon} size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-text-primary">{label}</p>
        <p className="mt-0.5 text-[13px] text-text-tertiary">{meta}</p>
      </div>
      <Icon path={mdiChevronRight} size={18} className="flex-shrink-0 text-text-disabled" />
    </button>
  );
}

/**
 * An item's face: its real brand logo when it has one, otherwise the accent-
 * tinted mdi tile. `plain` drops the tint for the featured card, whose whole
 * background is already the accent.
 */
function ItemGlyph({ item, tile, size, plain }: { item: StoreItem; tile: string; size: number; plain?: boolean }) {
  const accent = item.accent ?? '#18bcf2';
  const box = `${tile} flex flex-shrink-0 items-center justify-center overflow-hidden`;
  if (item.logoDomain) {
    return <IntegrationLogo domain={item.logoDomain} fallbackIcon={item.icon} tileClass={box} iconSize={size} />;
  }
  return (
    <div
      className={plain ? `${box} bg-surface-default` : box}
      style={plain ? { color: accent } : { backgroundColor: `${accent}24`, color: accent }}
    >
      <Icon path={item.icon} size={size} />
    </div>
  );
}

function ItemTile({ item, onOpen }: { item: StoreItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <ItemGlyph item={item} tile="h-11 w-11 rounded-ha-xl" size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">{item.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-text-tertiary">{item.source ?? item.category}</p>
        </div>
        {item.installed && (
          <span className="flex-shrink-0 text-green-500" title="Already added">
            <Icon path={mdiCheck} size={18} />
          </span>
        )}
      </div>
      <p className="mt-ha-3 line-clamp-2 text-[13px] leading-snug text-text-secondary">{item.tagline}</p>
      {item.badges && item.badges.length > 0 && (
        <div className="mt-ha-3 flex flex-wrap gap-ha-1">
          {item.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-surface-low px-ha-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function FeaturedCard({ item, onOpen }: { item: StoreItem; onOpen: () => void }) {
  const accent = item.accent ?? '#18bcf2';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-[260px] flex-shrink-0 flex-col justify-between gap-ha-3 overflow-hidden rounded-ha-2xl p-ha-4 text-left transition-transform active:scale-[0.98]"
      style={{ background: `linear-gradient(140deg, ${accent}2e, ${accent}0d)` }}
    >
      <div className="flex items-center gap-ha-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
        <Icon path={mdiStarFourPointsOutline} size={13} />
        Worth a look
      </div>
      <div>
        <ItemGlyph item={item} tile="h-10 w-10 rounded-ha-xl" size={22} plain />
        <p className="mt-ha-2 truncate text-sm font-semibold text-text-primary">{item.name}</p>
        <p className="line-clamp-2 text-[13px] leading-snug text-text-secondary">{item.tagline}</p>
      </div>
    </button>
  );
}

function DetailPane({
  item,
  onAdd,
  addLabel,
  addedLabel,
}: {
  item: StoreItem;
  onAdd: () => void;
  addLabel: string;
  addedLabel: string;
}) {
  // Going back is the header's arrow (DialogFrame's onBack) — no second control.
  return (
    <div className="flex flex-col gap-ha-4 pb-ha-4">
      <div className="flex items-start gap-ha-4 rounded-ha-2xl bg-surface-low p-ha-4">
        <ItemGlyph item={item} tile="h-14 w-14 rounded-ha-2xl" size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight text-text-primary">{item.name}</p>
          <p className="text-[13px] text-text-tertiary">{item.source ?? item.category}</p>
          {item.badges && item.badges.length > 0 && (
            <div className="mt-ha-2 flex flex-wrap gap-ha-1">
              {item.badges.map((badge) => (
                <span key={badge} className="rounded-full bg-surface-default px-ha-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={item.installed}
          className={clsx(
            'flex flex-shrink-0 items-center gap-ha-2 rounded-full px-ha-4 py-ha-2 text-sm font-semibold transition-colors',
            item.installed
              ? 'bg-surface-default text-text-tertiary'
              : 'bg-ha-blue text-white hover:brightness-105 active:brightness-95',
          )}
        >
          <Icon path={item.installed ? mdiCheck : mdiDownload} size={16} />
          {item.installed ? addedLabel : addLabel}
        </button>
      </div>

      <p className="text-sm leading-relaxed text-text-secondary">{item.description ?? item.tagline}</p>

      {item.facts && item.facts.length > 0 && (
        <div className="grid grid-cols-2 gap-ha-2">
          {item.facts.map((fact) => (
            <div key={fact.label} className="rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3">
              <p className="text-[13px] text-text-tertiary">{fact.label}</p>
              <p className="truncate text-sm font-semibold text-text-primary">{fact.value}</p>
            </div>
          ))}
        </div>
      )}

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-ha-2 rounded-full bg-surface-low px-ha-4 py-ha-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <Icon path={mdiOpenInNew} size={15} />
          Learn more
        </a>
      )}
    </div>
  );
}

export function StoreOverlay({
  open,
  onClose,
  eyebrow,
  title,
  items,
  onAdd,
  addLabel = 'Add',
  addedLabel = 'Added',
  searchPlaceholder,
  emptyLabel = 'Nothing matches that search.',
  footer,
  shelf,
  filters,
  itemsLabel,
  suggestions,
}: StoreOverlayProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [filterId, setFilterId] = useState<string | null>(null);
  // Only ever 'categories' in a store that offers the switch (itemsLabel set).
  const [byCategory, setByCategory] = useState(Boolean(itemsLabel));
  const [openId, setOpenId] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Read once the store is actually opened — localStorage is a client-only thing
  // and there's no reason to touch it for a dialog nobody has opened.
  const [readFor, setReadFor] = useState<string | null>(null);
  if (open && readFor !== title) {
    setReadFor(title);
    setRecents(readRecents(title));
  }

  const q = query.trim().toLowerCase();
  const activeFilter = filters?.find((f) => f.id === filterId) ?? null;

  // The filter narrows what the categories are counted from, so the two controls
  // agree: pick Services and a category tile promises only services.
  const pool = useMemo(
    () => (activeFilter ? items.filter(activeFilter.match) : items),
    [items, activeFilter],
  );

  const categories = useMemo(
    () => [...new Set(pool.map((i) => i.category))].sort((a, b) => a.localeCompare(b)),
    [pool],
  );

  const visible = useMemo(
    () => pool.filter((i) =>
      (!category || i.category === category) &&
      (!q || `${i.name} ${i.tagline} ${i.source ?? ''} ${i.category} ${i.keywords ?? ''}`.toLowerCase().includes(q))),
    [pool, category, q],
  );
  const featured = useMemo(
    () => (q || category ? [] : pool.filter((i) => i.featured && !i.installed).slice(0, 4)),
    [pool, q, category],
  );

  const shown = visible.length > GRID_CAP ? visible.slice(0, GRID_CAP) : visible;

  // Searching is looking for one thing, so it always lands in the list — whichever
  // way you were browsing.
  const showCategories = byCategory && !q && !category;

  const hasFilters = Boolean(filters && filters.length > 0);
  // The big field is the store's heading, so it has to name where you actually
  // are: the whole store at the top, the category once you've picked one, the
  // filter's own words when that's all you've narrowed by. A field that still
  // says "Search devices & services" while you're standing in Lights & shades is
  // promising a search it isn't going to run.
  const scope = category ?? activeFilter?.label ?? title;
  const placeholder = searchPlaceholder ?? `Search ${scope.toLowerCase()}`;

  const selected = openId ? items.find((i) => i.id === openId) ?? null : null;

  const close = () => {
    setOpenId(null);
    onClose();
  };

  const openCategory = (c: string) => {
    setCategory(c);
    setByCategory(false);
  };

  /** Opening an item is the proof a search worked, so that's when it's kept. */
  const openItem = (id: string) => {
    setOpenId(id);
    const term = query.trim();
    if (!term) return;
    const next = [term, ...recents.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, RECENTS_MAX);
    setRecents(next);
    writeRecents(title, next);
  };

  // Searches worth offering: what this person looked for last, then what the
  // caller suggests, minus any duplicate. Each carries how much it would find, so
  // it's a promise rather than a guess.
  const searchIdeas = useMemo(() => {
    const terms = [
      ...recents.map((label) => ({ label, recent: true })),
      ...(suggestions ?? [])
        .filter((sug) => !recents.some((r) => r.toLowerCase() === sug.toLowerCase()))
        .map((label) => ({ label, recent: false })),
    ];
    return terms.map((t) => {
      const needle = t.label.toLowerCase();
      const count = items.filter((i) =>
        `${i.name} ${i.tagline} ${i.source ?? ''} ${i.category} ${i.keywords ?? ''}`.toLowerCase().includes(needle),
      ).length;
      return { ...t, count };
    }).filter((t) => t.count > 0).slice(0, 9);
  }, [recents, suggestions, items]);

  // Focusing the field is asking "what can I search for?", so the answer takes
  // the place of the browse content until you type or pick.
  const showIdeas = searchFocused && !q && searchIdeas.length > 0;

  // Browse ⇄ detail swaps in place, with no ModalSheet transitionKey: that
  // crossfade pops the outgoing pane out of flow, and since each pane carries
  // its own DialogFrame you see two headers and two bodies stacked mid-swap.
  // The drill instead animates the body alone, with the same `ha-pane-in` the
  // settings master-detail uses: in from the right, back in from the left. Keying
  // the wrapper is what replays it (a CSS animation only runs on mount).

  return (
    <ModalSheet open={open} onClose={close} maxWidth={1200} label={selected ? selected.name : title}>
      <DialogFrame
        size="large"
        // Browsing needs no header: the big search field says what this is, and
        // Escape / the scrim / a pull on the grabber all close it. Drilling into
        // an item brings one back, for its name and the way back out.
        headerless={!selected}
        eyebrow={eyebrow}
        title={selected ? selected.name : ''}
        onClose={close}
        onBack={selected ? () => setOpenId(null) : undefined}
        // Search and filters stay put; only the shelf and the grid scroll.
        stickyTop={selected ? undefined : (
          <>
            <div onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}>
            <SearchField size="lg" value={query} onChange={setQuery} placeholder={placeholder} />
          </div>

            {/* One row of controls: what to show on the left, how to browse it on
                the right. Same height on both, so they read as one set. */}
            {(hasFilters || itemsLabel) && (
              <div className="flex items-center gap-ha-3">
                {hasFilters && (
                  <div className="-mx-1 flex min-w-0 flex-1 gap-ha-2 overflow-x-auto scrollbar-hide px-1">
                    {filters?.map((f) => (
                      <FilterChip
                        key={f.id}
                        label={f.label}
                        active={f.id === filterId}
                        onClick={() => setFilterId(f.id === filterId ? null : f.id)}
                      />
                    ))}
                  </div>
                )}
                {itemsLabel && (
                  <SegmentedControl
                    className="ml-auto flex-shrink-0"
                    segments={[
                      { value: 'categories', label: 'Categories' },
                      { value: 'items', label: itemsLabel },
                    ]}
                    value={byCategory ? 'categories' : 'items'}
                    onChange={(v) => {
                      setByCategory(v === 'categories');
                      // Going back to the categories grid means letting go of the
                      // one you drilled into, or it would show a single tile.
                      if (v === 'categories') setCategory(null);
                    }}
                  />
                )}
              </div>
            )}

            {/* Categories — a horizontal rail so a long list never wraps into a
                wall. Redundant while the categories grid is the view. */}
            {!showCategories && (
              <div className="-mx-1 flex gap-ha-2 overflow-x-auto scrollbar-hide px-1">
                {categories.map((c) => (
                  <FilterChip
                    key={c}
                    label={c}
                    active={c === category}
                    onClick={() => setCategory(c === category ? null : c)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      >
        {selected ? (
          <div key={`detail:${selected.id}`} className="ha-pane-in">
            <DetailPane
              item={selected}
              onAdd={() => onAdd(selected)}
              addLabel={addLabel}
              addedLabel={addedLabel}
            />
          </div>
        ) : (
          <div key="browse" className="ha-pane-in ha-pane-in--back flex flex-col gap-ha-4 pb-ha-4">
            {/* Field focused, nothing typed: the body answers "what can I search
                for?" instead of showing what to browse. mousedown is swallowed so
                picking one doesn't blur the field out from under the click. */}
            {showIdeas ? (
              <div
                key="ideas"
                className="ha-pane-in flex flex-col gap-ha-3"
                onMouseDown={(e) => e.preventDefault()}
              >
                <SectionLabel>{recents.length > 0 ? 'Pick up where you left off' : 'Try searching for'}</SectionLabel>
                <div className="grid grid-cols-1 gap-ha-3 sm:grid-cols-2 lg:grid-cols-3">
                  {searchIdeas.map((idea) => (
                    <PickTile
                      key={`${idea.recent ? 'recent' : 'try'}:${idea.label}`}
                      label={idea.label}
                      meta={`${idea.count} ${countNoun(idea.count, itemsLabel)}${idea.recent ? ' · searched before' : ''}`}
                      icon={idea.recent ? mdiHistory : mdiMagnify}
                      onOpen={() => setQuery(idea.label)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
            {shelf && !q && !category && shelf}

            {featured.length > 0 && (
              <div className="-mx-1 flex gap-ha-3 overflow-x-auto scrollbar-hide px-1 pb-1">
                {featured.map((item) => (
                  <FeaturedCard key={item.id} item={item} onOpen={() => openItem(item.id)} />
                ))}
              </div>
            )}

            {showCategories ? (
              <div className="grid grid-cols-1 gap-ha-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => {
                  const inside = pool.filter((i) => i.category === c);
                  return (
                    <PickTile
                      key={c}
                      label={c}
                      meta={`${inside.length} ${countNoun(inside.length, itemsLabel)}`}
                      icon={inside[0].icon}
                      accent={inside[0].accent}
                      onOpen={() => openCategory(c)}
                    />
                  );
                })}
              </div>
            ) : visible.length === 0 ? (
              <p className="py-ha-6 text-center text-sm text-text-tertiary">{emptyLabel}</p>
            ) : (
              <div className="grid grid-cols-1 gap-ha-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.map((item) => (
                  <ItemTile key={item.id} item={item} onOpen={() => openItem(item.id)} />
                ))}
              </div>
            )}

            {!showCategories && shown.length < visible.length && (
              <p className="text-center text-[13px] text-text-tertiary">
                Showing {shown.length} of {visible.length}. Pick a category or search to see the rest.
              </p>
            )}
              </>
            )}

            {footer}
          </div>
        )}
      </DialogFrame>
    </ModalSheet>
  );
}
