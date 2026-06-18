'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { CountBadge } from './CountBadge';
import { Chip } from './Chip';
import { ModalSheet } from '../layout/ModalSheet';
import { SearchField } from './SearchField';
import { SectionLabel } from './SectionLabel';
import { NavChevron } from './NavChevron';
import { mdiSortVariant, mdiViewAgendaOutline, mdiCheck, mdiChevronDown, mdiFormatListBulleted, mdiViewGridOutline, mdiTableLarge, mdiTune, mdiClose, mdiArrowUp, mdiArrowDown } from '@mdi/js';

export type DataListLayout = 'list' | 'grid' | 'table';

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

/** One column in the tabular layout. */
export interface DataListColumn<T> {
  id: string;
  /** Heading text shown in the table's top row. */
  header: string;
  /** Cell content for a given item. */
  cell: (item: T) => React.ReactNode;
  /** Extra classes on both the <th> and <td> (width, alignment, etc.). */
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Hide this column below the given breakpoint — keeps tables usable on mobile. */
  hideBelow?: 'sm' | 'md' | 'lg';
  /**
   * When set, the column header becomes a sort toggle (asc ⇄ desc). The accessor
   * returns the value to order by — numbers compare numerically, strings A→Z.
   */
  sortAccessor?: (item: T) => string | number;
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
  /**
   * Optional column definitions. When provided, a "table" mode is offered in the
   * layout toggle and renders a real <table> (heading row + columns + rows).
   */
  columns?: DataListColumn<T>[];
  /**
   * Invoked when a table row is clicked. When set, rows are interactive (hover +
   * pointer) and a trailing chevron column is appended — mirroring the list rows.
   */
  onRowClick?: (item: T) => void;
  defaultLayout?: DataListLayout;
  /** Tailwind grid-cols classes for the tiled layout. */
  gridColsClassName?: string;
  emptyLabel?: string;
  /**
   * Fill the parent's height and scroll internally: the search/filter controls
   * stay fixed at the top and only the rows scroll beneath them (the table's
   * heading row stays pinned too). Requires a height-bounded parent. Without it
   * the whole view flows and the page scrolls.
   */
  fillHeight?: boolean;
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

const ALIGN_CLASS: Record<NonNullable<DataListColumn<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const HIDE_BELOW_CLASS: Record<NonNullable<DataListColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/** Shared th/td classes for a column (alignment, responsive hiding, custom). */
function colClass<T>(col: DataListColumn<T>): string {
  return [
    col.align ? ALIGN_CLASS[col.align] : 'text-left',
    col.hideBelow ? HIDE_BELOW_CLASS[col.hideBelow] : '',
    col.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

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

const LAYOUT_META: Record<DataListLayout, { icon: string; label: string }> = {
  list: { icon: mdiFormatListBulleted, label: 'List view' },
  grid: { icon: mdiViewGridOutline, label: 'Grid view' },
  table: { icon: mdiTableLarge, label: 'Table view' },
};

/** Segmented layout switch over the modes the config actually supports. */
function LayoutToggle({
  layout,
  onChange,
  available,
}: {
  layout: DataListLayout;
  onChange: (l: DataListLayout) => void;
  available: DataListLayout[];
}) {
  const modes = available.map((id) => ({ id, ...LAYOUT_META[id] }));
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
    columns,
    onRowClick,
    defaultLayout = 'list',
    gridColsClassName = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    emptyLabel = 'Nothing to show.',
    fillHeight = false,
    bg = 'surface-default',
    highlightKey,
  } = config;

  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState(sortOptions[0]?.id ?? '');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [layout, setLayout] = useState<DataListLayout>(defaultLayout);
  // Table-only: sort driven by clicking a column header (asc ⇄ desc). Overrides
  // the "Sort" chip while set; picking the chip clears it.
  const [columnSort, setColumnSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(null);
  // Mobile: filters live in a bottom sheet instead of the inline row.
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggleColumnSort = (id: string) =>
    setColumnSort((prev) => (prev && prev.id === id ? { id, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: 'asc' }));
  const selectSort = (id: string) => {
    setSortId(id);
    setColumnSort(null);
  };

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

  const hasTable = !!columns && columns.length > 0;
  const tableColSpan = (columns?.length ?? 0) + (onRowClick ? 1 : 0);
  // The modes the layout toggle offers — list is always available.
  const availableLayouts: DataListLayout[] = [
    'list',
    ...(renderCard ? (['grid'] as const) : []),
    ...(hasTable ? (['table'] as const) : []),
  ];
  const showLayoutToggle = availableLayouts.length > 1;

  const hasControls = sortOptions.length > 0 || groupOptions.length > 0 || filterGroups.length > 0 || showLayoutToggle;
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

    // 3. sort — a clicked table column wins over the "Sort" chip when active.
    const sortCol = columnSort ? columns?.find((c) => c.id === columnSort.id) : undefined;
    if (layout === 'table' && columnSort && sortCol?.sortAccessor) {
      const acc = sortCol.sortAccessor;
      const dir = columnSort.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = acc(a);
        const bv = acc(b);
        const cmp =
          typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return cmp * dir;
      });
    } else {
      const sort = sortOptions.find((s) => s.id === sortId);
      if (sort) rows.sort(sort.compare);
    }

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
  }, [items, query, enabled, filterGroups, sortId, sortOptions, groupId, groupOptions, searchText, layout, columnSort, columns]);

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

  // Where sticky table/group headers pin. When the controls scroll with the page
  // (default) they sit below the pinned title + controls; in fillHeight the
  // controls are fixed outside the scroller, so headers pin at its top (0).
  const headerStickyTop = fillHeight
    ? '0px'
    : 'calc(var(--settings-header-h, 0px) + var(--datalist-controls-h, 0px))';

  const resultsBody =
    total === 0 ? (
      <p className="text-sm text-text-tertiary text-center py-ha-8">{emptyLabel}</p>
    ) : layout === 'table' && hasTable ? (
      /* One table across every group with a pinned heading row.
         - fillHeight: the card itself is the scroll container, so it stays a
           static rounded frame and the sticky header pins at its (rounded) top.
         - page-scroll: `overflow-clip` rounds the corners without becoming a
           scroll container, which would trap the sticky header inside it. */
      <div
        className={`bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] ${
          fillHeight ? 'flex-1 min-h-0 overflow-y-auto scrollbar-hide' : 'mt-ha-2 overflow-clip'
        }`}
      >
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              {columns!.map((col) => {
                const sortable = !!col.sortAccessor;
                const active = columnSort?.id === col.id;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={active ? (columnSort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`sticky z-20 bg-surface-default border-b border-surface-lower px-ha-4 py-ha-3 text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap ${active ? 'text-text-primary' : 'text-text-tertiary'} ${colClass(col)}`}
                    style={{ top: headerStickyTop }}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleColumnSort(col.id)}
                        className={`group inline-flex items-center gap-ha-1 uppercase tracking-wide transition-colors hover:text-text-primary ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                      >
                        <span>{col.header}</span>
                        <Icon
                          path={active && columnSort!.dir === 'asc' ? mdiArrowUp : mdiArrowDown}
                          size={13}
                          className={active ? '' : 'opacity-0 transition-opacity group-hover:opacity-40'}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {onRowClick && (
                <th
                  aria-hidden
                  className="sticky z-20 bg-surface-default border-b border-surface-lower w-10"
                  style={{ top: headerStickyTop }}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((bucket) => (
              <Fragment key={bucket.key}>
                {grouped && bucket.title && (
                  <tr>
                    <td
                      colSpan={tableColSpan}
                      className="bg-surface-lower/60 px-ha-4 py-ha-2 border-b border-surface-lower"
                    >
                      <span className="flex items-center gap-ha-2">
                        <SectionLabel>{bucket.title}</SectionLabel>
                        <CountBadge count={bucket.items.length} />
                      </span>
                    </td>
                  </tr>
                )}
                {bucket.items.map((item) => {
                  const hl = highlightKey != null && keyOf(item) === highlightKey;
                  return (
                    <tr
                      key={keyOf(item)}
                      ref={hl ? (highlightRef as unknown as React.RefObject<HTMLTableRowElement>) : undefined}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                      className={`transition-colors${
                        onRowClick ? ' cursor-pointer hover:bg-surface-mid/50 active:bg-surface-mid' : ''
                      }${hl ? ' ha-last-opened' : ''}`}
                    >
                      {columns!.map((col) => (
                        <td
                          key={col.id}
                          className={`px-ha-4 py-ha-3 text-[13px] text-text-secondary align-middle border-b border-surface-low/40 ${colClass(col)}`}
                        >
                          {col.cell(item)}
                        </td>
                      ))}
                      {onRowClick && (
                        <td className="pr-ha-3 align-middle border-b border-surface-low/40">
                          <NavChevron size={16} className="text-text-disabled" />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="space-y-ha-5 pt-ha-2">
        {groups.map((bucket) => (
          <div key={bucket.key} className="space-y-ha-2">
            {grouped && bucket.title && (
              <div
                className={`sticky z-20 ${solidBg} flex items-center gap-ha-2 px-ha-1 py-ha-1`}
                style={{ top: headerStickyTop }}
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
    );

  return (
    <div ref={rootRef} className={fillHeight ? 'flex h-full min-h-0 flex-col' : undefined}>
      {/* Controls. Default: sticky so they stay reachable as the page scrolls. In
          settings' second column the title pins above, so offset by its measured
          height (`--settings-header-h`); 0 everywhere else. The negative margin /
          inner padding cancel the scroll container's top padding so the bar pins
          with no drift (see `--list-top-pad`).

          fillHeight: the rows scroll in their own container below, so the bar is
          just a fixed flex header — no sticky, no offset hacks. */}
      <div
        ref={controlsRef}
        className={fillHeight ? `flex-shrink-0 ${solidBg} pb-ha-2` : `sticky z-30 ${solidBg} pb-ha-2`}
        style={
          fillHeight
            ? undefined
            : {
                top: 'var(--settings-header-h, 0px)',
                marginTop: 'calc(-1 * var(--list-top-pad, 0px))',
                paddingTop: 'calc(var(--list-top-pad, 0px) + var(--ha-space-1))',
              }
        }
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
                  selectedId={columnSort ? '' : sortId}
                  onSelect={selectSort}
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
              {showLayoutToggle && <LayoutToggle layout={layout} onChange={setLayout} available={availableLayouts} />}
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
              {showLayoutToggle && <LayoutToggle layout={layout} onChange={setLayout} available={availableLayouts} />}
            </div>
          </>
        )}
        {/* fade for rows scrolling under the sticky controls (page-scroll mode
            only — fillHeight's own scroller draws its own fades). */}
        {!fillHeight && (
          <div className={`h-4 bg-gradient-to-b ${fromBg} to-transparent pointer-events-none -mb-4`} />
        )}
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
                      <Chip key={s.id} active={!columnSort && s.id === sortId} onClick={() => selectSort(s.id)}>
                        {!columnSort && s.id === sortId && <Icon path={mdiCheck} size={13} />}
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

      {fillHeight ? (
        // The controls above stay fixed; only the rows scroll. The table renders
        // its own card as the scroller (so its frame/heading stay put); list and
        // grid scroll in a plain region. No gradient fades — they'd mask rows.
        layout === 'table' && hasTable ? (
          resultsBody
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">{resultsBody}</div>
        )
      ) : (
        resultsBody
      )}
    </div>
  );
}
