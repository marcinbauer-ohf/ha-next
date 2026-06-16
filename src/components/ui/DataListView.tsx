'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { CountBadge } from './CountBadge';
import { Chip } from './Chip';
import { ModalSheet } from '../layout/ModalSheet';
import { SearchField } from './SearchField';
import { SectionLabel } from './SectionLabel';
import { mdiSortVariant, mdiViewAgendaOutline, mdiCheck, mdiChevronDown, mdiFormatListBulleted, mdiViewGridOutline, mdiTune, mdiClose } from '@mdi/js';

export type DataListLayout = 'list' | 'grid';

// ─────────────────────────────────────────────────────────────────────────────
// Generic, config-driven list view: search + sort + group + facet filters, all
// in a card. Built to be reused across Home Assistant's big lists (integrations,
// entities, people, …) — a data type only has to describe itself via a
// DataListConfig<T>; the view handles all the control state and rendering.
// ─────────────────────────────────────────────────────────────────────────────

export interface DataListSortOption<T> {
  id: string;
  label: string;
  compare: (a: T, b: T) => number;
}

export interface DataListGroupOption<T> {
  id: string;
  label: string;
  /** Bucket an item: a stable key plus the heading shown for that bucket. */
  groupOf: (item: T) => { key: string; title: string };
  /** Optional ordering of buckets by key. Defaults to title A→Z. */
  compareGroups?: (a: { key: string; title: string }, b: { key: string; title: string }) => number;
}

export interface DataListFilterChip<T> {
  id: string;
  label: string;
  predicate: (item: T) => boolean;
  /** Enabled on first render. */
  defaultActive?: boolean;
}

/**
 * A set of related filter chips over one dimension.
 * - `facet`: OR within the group — an item passes if it matches ANY enabled chip
 *   (e.g. status: Active / Disabled / Ignored). No chip enabled ⇒ nothing passes.
 * - `predicate`: AND — every enabled chip's predicate must pass (independent flags).
 */
export interface DataListFilterGroup<T> {
  id: string;
  mode: 'facet' | 'predicate';
  chips: DataListFilterChip<T>[];
}

export interface DataListConfig<T> {
  /** Stable React key per item. */
  keyOf: (item: T) => string;
  /** Text matched against the search query (case-insensitive substring). */
  searchText: (item: T) => string;
  searchPlaceholder?: string;
  sortOptions?: DataListSortOption<T>[];
  /** Group choices. A "None" option is always offered and is the default. */
  groupOptions?: DataListGroupOption<T>[];
  /** Group selected initially (by id). Defaults to "none". */
  defaultGroupId?: string;
  filterGroups?: DataListFilterGroup<T>[];
  renderRow: (item: T) => React.ReactNode;
  /**
   * Optional tile renderer. When provided, a list/grid layout toggle appears and
   * "grid" lays tiles out responsively. Without it, only the list layout exists.
   */
  renderCard?: (item: T) => React.ReactNode;
  defaultLayout?: DataListLayout;
  /** Tailwind grid-cols classes for the tiled layout. */
  gridColsClassName?: string;
  emptyLabel?: string;
  /** Background token for the sticky header gradient. Default surface-default. */
  bg?: 'surface-default' | 'surface-lower';
  /**
   * Key of the item last drilled into. When set, that row/tile is marked
   * (tint + accent) and scrolled into view — so returning from a detail view
   * shows which item you came back from.
   */
  highlightKey?: string;
}

interface Bucket<T> {
  key: string;
  title: string;
  items: T[];
}

const NONE_GROUP_ID = 'none';

/** A chip that opens a radio-style popover of options below it. */
function SelectChip({
  icon,
  prefix,
  valueLabel,
  options,
  selectedId,
  onSelect,
}: {
  icon: string;
  prefix: string;
  valueLabel: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Chip active={open} onClick={() => setOpen((v) => !v)}>
        <Icon path={icon} size={14} />
        <span>{prefix}: {valueLabel}</span>
        <Icon path={mdiChevronDown} size={13} className="opacity-70" />
      </Chip>
      {open && (
        <>
          {/* Backdrop to capture outside clicks. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-ha-1 min-w-[180px] rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-1 shadow-[0_18px_42px_-20px_rgba(15,23,42,0.4)]">
            {options.map((opt) => {
              const selected = opt.id === selectedId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onSelect(opt.id); setOpen(false); }}
                  className={`flex w-full items-center gap-ha-2 rounded-ha-xl px-ha-3 py-ha-2 text-left text-sm transition-colors ${
                    selected ? 'text-ha-blue font-semibold' : 'text-text-primary hover:bg-surface-low'
                  }`}
                >
                  <span className="flex-1">{opt.label}</span>
                  {selected && <Icon path={mdiCheck} size={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Segmented list/grid layout switch. */
function LayoutToggle({ layout, onChange }: { layout: DataListLayout; onChange: (l: DataListLayout) => void }) {
  const modes: Array<{ id: DataListLayout; icon: string; label: string }> = [
    { id: 'list', icon: mdiFormatListBulleted, label: 'List view' },
    { id: 'grid', icon: mdiViewGridOutline, label: 'Grid view' },
  ];
  return (
    <div className="ml-auto inline-flex h-10 items-center rounded-ha-xl border border-surface-lower bg-surface-default p-0.5">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-label={mode.label}
          aria-pressed={layout === mode.id}
          onClick={() => onChange(mode.id)}
          className={`flex h-9 w-9 items-center justify-center rounded-ha-lg transition-colors ${
            layout === mode.id ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:bg-surface-low'
          }`}
        >
          <Icon path={mode.icon} size={16} />
        </button>
      ))}
    </div>
  );
}

export function DataListView<T>({ items, config }: { items: T[]; config: DataListConfig<T> }) {
  const {
    keyOf,
    searchText,
    searchPlaceholder = 'Search…',
    sortOptions = [],
    groupOptions = [],
    defaultGroupId = NONE_GROUP_ID,
    filterGroups = [],
    renderRow,
    renderCard,
    defaultLayout = 'list',
    gridColsClassName = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    emptyLabel = 'Nothing to show.',
    bg = 'surface-default',
    highlightKey,
  } = config;

  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState(sortOptions[0]?.id ?? '');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [layout, setLayout] = useState<DataListLayout>(defaultLayout);
  // Mobile: filters live in a bottom sheet instead of the inline row.
  const [sheetOpen, setSheetOpen] = useState(false);

  // The chip keys ("groupId:chipId") enabled on first render — also the target
  // for "Reset" and the baseline the mobile badge counts deviations from.
  const defaultEnabled = useMemo(() => {
    const set = new Set<string>();
    for (const group of filterGroups) {
      for (const chip of group.chips) {
        if (chip.defaultActive) set.add(`${group.id}:${chip.id}`);
      }
    }
    return set;
  }, [filterGroups]);

  // Enabled filter chips, keyed "groupId:chipId".
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(defaultEnabled));

  const toggleChip = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resetFilters = () => setEnabled(new Set(defaultEnabled));

  // How many filter chips differ from their default — drives the mobile badge so
  // it reads "filters applied", not "chips enabled" (facets default to all-on).
  let activeFilterCount = 0;
  for (const k of enabled) if (!defaultEnabled.has(k)) activeFilterCount++;
  for (const k of defaultEnabled) if (!enabled.has(k)) activeFilterCount++;

  // Filter chips — shared by the desktop row and the mobile sheet.
  const filterChips = filterGroups.flatMap((group) =>
    group.chips.map((chip) => {
      const key = `${group.id}:${chip.id}`;
      const active = enabled.has(key);
      return (
        <Chip key={key} active={active} onClick={() => toggleChip(key)}>
          {active && <Icon path={mdiCheck} size={13} />}
          {chip.label}
        </Chip>
      );
    }),
  );

  const hasControls = sortOptions.length > 0 || groupOptions.length > 0 || filterGroups.length > 0 || !!renderCard;
  const hasFilterableControls = sortOptions.length > 0 || groupOptions.length > 0 || filterGroups.length > 0;

  const groups = useMemo<Bucket<T>[]>(() => {
    const q = query.trim().toLowerCase();

    // 1. search
    let rows = q ? items.filter((it) => searchText(it).toLowerCase().includes(q)) : items.slice();

    // 2. filter groups
    for (const group of filterGroups) {
      const enabledChips = group.chips.filter((c) => enabled.has(`${group.id}:${c.id}`));
      if (group.mode === 'facet') {
        // OR within group; no enabled chip ⇒ nothing passes.
        rows = rows.filter((it) => enabledChips.some((c) => c.predicate(it)));
      } else {
        // AND of enabled predicates.
        rows = rows.filter((it) => enabledChips.every((c) => c.predicate(it)));
      }
    }

    // 3. sort
    const sort = sortOptions.find((s) => s.id === sortId);
    if (sort) rows.sort(sort.compare);

    // 4. group
    const groupOpt = groupOptions.find((g) => g.id === groupId);
    if (!groupOpt) return [{ key: NONE_GROUP_ID, title: '', items: rows }];

    const buckets = new Map<string, Bucket<T>>();
    for (const it of rows) {
      const { key, title } = groupOpt.groupOf(it);
      if (!buckets.has(key)) buckets.set(key, { key, title, items: [] });
      buckets.get(key)!.items.push(it);
    }
    const ordered = [...buckets.values()];
    ordered.sort(
      groupOpt.compareGroups
        ? (a, b) => groupOpt.compareGroups!({ key: a.key, title: a.title }, { key: b.key, title: b.title })
        : (a, b) => a.title.localeCompare(b.title),
    );
    return ordered;
  }, [items, query, enabled, filterGroups, sortId, sortOptions, groupId, groupOptions, searchText]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const grouped = groupId !== NONE_GROUP_ID && groupOptions.length > 0;

  const groupChoices = [{ id: NONE_GROUP_ID, label: 'None' }, ...groupOptions.map((g) => ({ id: g.id, label: g.label }))];
  const fromBg = bg === 'surface-lower' ? 'from-surface-lower' : 'from-surface-default';
  const solidBg = bg === 'surface-lower' ? 'bg-surface-lower' : 'bg-surface-default';

  // Publish the sticky controls bar's height so group headers can pin *below*
  // it (stacked sticky), not behind it.
  const rootRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const ctrl = controlsRef.current;
    if (!root || !ctrl) return;
    const apply = () => root.style.setProperty('--datalist-controls-h', `${ctrl.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(ctrl);
    return () => ro.disconnect();
  }, []);

  // Bring the last-opened row/tile into view when the list (re)mounts with a
  // highlight — e.g. coming back from a detail view. `block: 'nearest'` keeps it
  // still if the row is already visible.
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlightKey) return;
    highlightRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightKey]);

  return (
    <div ref={rootRef}>
      {/* Controls — sticky so they stay reachable on long lists. In settings'
          second column the title pins above, so offset by its measured height
          (`--settings-header-h`); 0 everywhere else.

          When this is the page's top element (mobile/full-page settings route),
          the scroll container's top padding (`--list-top-pad`, set by the shell)
          is scrollable space *above* the sticky, so it would drift ~16px before
          pinning. A negative margin cancels that gap (pins with no drift) and an
          equal inner padding keeps the search in place, its opaque bg covering
          the band so scrolled rows can't peek through. Both collapse to 0 in the
          two-column panel, where the title already absorbs the gap. The `+ha-1`
          is the original top breathing room shared with the nav column search. */}
      <div
        ref={controlsRef}
        className={`sticky z-30 ${solidBg} pb-ha-2`}
        style={{
          top: 'var(--settings-header-h, 0px)',
          marginTop: 'calc(-1 * var(--list-top-pad, 0px))',
          paddingTop: 'calc(var(--list-top-pad, 0px) + var(--ha-space-1))',
        }}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          onClear={() => setQuery('')}
        />
        {hasControls && (
          <>
            {/* Desktop: every control inline. Wraps only as a last resort on wide
                tablets; phones use the sheet below instead. */}
            <div className="mt-ha-3 hidden flex-wrap items-center gap-ha-2 md:flex">
              {sortOptions.length > 0 && (
                <SelectChip
                  icon={mdiSortVariant}
                  prefix="Sort"
                  valueLabel={sortOptions.find((s) => s.id === sortId)?.label ?? ''}
                  options={sortOptions.map((s) => ({ id: s.id, label: s.label }))}
                  selectedId={sortId}
                  onSelect={setSortId}
                />
              )}
              {groupOptions.length > 0 && (
                <SelectChip
                  icon={mdiViewAgendaOutline}
                  prefix="Group"
                  valueLabel={groupChoices.find((g) => g.id === groupId)?.label ?? 'None'}
                  options={groupChoices}
                  selectedId={groupId}
                  onSelect={setGroupId}
                />
              )}
              {filterGroups.length > 0 && (
                <>
                  <span className="mx-ha-1 h-6 w-px bg-surface-lower" aria-hidden />
                  {filterChips}
                </>
              )}
              {renderCard && <LayoutToggle layout={layout} onChange={setLayout} />}
            </div>

            {/* Mobile: a single "Filters" trigger (sort/group/facets live in the
                sheet) keeps the row to one line; the layout toggle stays inline. */}
            <div className="mt-ha-3 flex items-center gap-ha-2 md:hidden">
              {hasFilterableControls && (
                <Chip active={sheetOpen} onClick={() => setSheetOpen(true)}>
                  <Icon path={mdiTune} size={14} />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-ha-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ha-blue px-1 text-[10px] font-bold leading-none text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </Chip>
              )}
              {renderCard && <LayoutToggle layout={layout} onChange={setLayout} />}
            </div>
          </>
        )}
        {/* fade for rows scrolling under the sticky controls */}
        <div className={`h-4 bg-gradient-to-b ${fromBg} to-transparent pointer-events-none -mb-4`} />
      </div>

      {/* Mobile filter sheet — reuses the app's ModalSheet (springs up, portals
          to <body> at z-200 so it clears the z-50 bottom nav). Sort/group render
          as tap-chips (not SelectChip) so their popovers can't z-fight the sheet,
          and facets reuse the same chips as the desktop row. */}
      {hasFilterableControls && (
        <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <div className="px-ha-4 pb-ha-6">
            <div className="mb-ha-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Filters</h3>
              <div className="flex items-center gap-ha-3">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-semibold text-ha-blue"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setSheetOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-ha-lg text-text-secondary hover:bg-surface-low"
                >
                  <Icon path={mdiClose} size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-ha-4">
              {sortOptions.length > 0 && (
                <div>
                  <SectionLabel>Sort</SectionLabel>
                  <div className="mt-ha-2 flex flex-wrap gap-ha-2">
                    {sortOptions.map((s) => (
                      <Chip key={s.id} active={s.id === sortId} onClick={() => setSortId(s.id)}>
                        {s.id === sortId && <Icon path={mdiCheck} size={13} />}
                        {s.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {groupOptions.length > 0 && (
                <div>
                  <SectionLabel>Group by</SectionLabel>
                  <div className="mt-ha-2 flex flex-wrap gap-ha-2">
                    {groupChoices.map((g) => (
                      <Chip key={g.id} active={g.id === groupId} onClick={() => setGroupId(g.id)}>
                        {g.id === groupId && <Icon path={mdiCheck} size={13} />}
                        {g.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {filterGroups.length > 0 && (
                <div>
                  <SectionLabel>Filter</SectionLabel>
                  <div className="mt-ha-2 flex flex-wrap gap-ha-2">{filterChips}</div>
                </div>
              )}
            </div>
          </div>
        </ModalSheet>
      )}

      {total === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-ha-8">{emptyLabel}</p>
      ) : (
        <div className="space-y-ha-5 pt-ha-2">
          {groups.map((bucket) => (
            <div key={bucket.key} className="space-y-ha-2">
              {grouped && bucket.title && (
                <div
                  className={`sticky z-20 ${solidBg} flex items-center gap-ha-2 px-ha-1 py-ha-1`}
                  style={{ top: 'calc(var(--settings-header-h, 0px) + var(--datalist-controls-h, 0px))' }}
                >
                  <SectionLabel>{bucket.title}</SectionLabel>
                  <CountBadge count={bucket.items.length} />
                </div>
              )}
              {layout === 'grid' && renderCard ? (
                <div className={`grid gap-ha-3 ${gridColsClassName}`}>
                  {bucket.items.map((item) => {
                    const hl = highlightKey != null && keyOf(item) === highlightKey;
                    return (
                      <div
                        key={keyOf(item)}
                        ref={hl ? highlightRef : undefined}
                        className={hl ? 'rounded-ha-2xl ha-last-opened' : undefined}
                      >
                        {renderCard(item)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
                  {bucket.items.map((item) => {
                    const hl = highlightKey != null && keyOf(item) === highlightKey;
                    return (
                      <div
                        key={keyOf(item)}
                        ref={hl ? highlightRef : undefined}
                        className={`border-b border-surface-low/40 last:border-0${hl ? ' ha-last-opened' : ''}`}
                      >
                        {renderRow(item)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
