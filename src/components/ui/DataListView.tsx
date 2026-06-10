'use client';

import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { SearchField } from './SearchField';
import { SectionLabel } from './SectionLabel';
import { mdiSortVariant, mdiViewAgendaOutline, mdiCheck, mdiChevronDown, mdiFormatListBulleted, mdiViewGridOutline } from '@mdi/js';

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
}

interface Bucket<T> {
  key: string;
  title: string;
  items: T[];
}

const NONE_GROUP_ID = 'none';

/** Small chip button used for sort/group triggers and facet toggles. */
function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-ha-1 rounded-ha-xl border px-ha-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
          : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low'
      }`}
    >
      {children}
    </button>
  );
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

/** Segmented list/grid layout switch. */
function LayoutToggle({ layout, onChange }: { layout: DataListLayout; onChange: (l: DataListLayout) => void }) {
  const modes: Array<{ id: DataListLayout; icon: string; label: string }> = [
    { id: 'list', icon: mdiFormatListBulleted, label: 'List view' },
    { id: 'grid', icon: mdiViewGridOutline, label: 'Grid view' },
  ];
  return (
    <div className="ml-auto inline-flex rounded-ha-xl border border-surface-lower bg-surface-default p-0.5">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-label={mode.label}
          aria-pressed={layout === mode.id}
          onClick={() => onChange(mode.id)}
          className={`flex h-7 w-7 items-center justify-center rounded-ha-lg transition-colors ${
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
  } = config;

  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState(sortOptions[0]?.id ?? '');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [layout, setLayout] = useState<DataListLayout>(defaultLayout);
  // Enabled filter chips, keyed "groupId:chipId".
  const [enabled, setEnabled] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const group of filterGroups) {
      for (const chip of group.chips) {
        if (chip.defaultActive) set.add(`${group.id}:${chip.id}`);
      }
    }
    return set;
  });

  const toggleChip = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  return (
    <div>
      {/* Controls — sticky so they stay reachable on long lists. `pt-ha-1`
          matches the nav column's sticky search so both fields share a top line.
          In settings' second column the title pins above, so offset by its
          measured height (`--settings-header-h`); 0 everywhere else. */}
      <div
        className={`sticky z-30 ${solidBg} pt-ha-1 pb-ha-2`}
        style={{ top: 'var(--settings-header-h, 0px)' }}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          onClear={() => setQuery('')}
        />
        {(sortOptions.length > 0 || groupOptions.length > 0 || filterGroups.length > 0 || renderCard) && (
          <div className="mt-ha-3 flex flex-wrap items-center gap-ha-2">
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
                <span className="mx-ha-1 h-5 w-px bg-surface-lower" aria-hidden />
                {filterGroups.flatMap((group) =>
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
                )}
              </>
            )}
            {renderCard && <LayoutToggle layout={layout} onChange={setLayout} />}
          </div>
        )}
        {/* fade for rows scrolling under the sticky controls */}
        <div className={`h-4 bg-gradient-to-b ${fromBg} to-transparent pointer-events-none -mb-4`} />
      </div>

      {total === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-ha-8">{emptyLabel}</p>
      ) : (
        <div className="space-y-ha-5 pt-ha-2">
          {groups.map((bucket) => (
            <div key={bucket.key} className="space-y-ha-2">
              {grouped && bucket.title && (
                <div className="flex items-center justify-between px-ha-1">
                  <SectionLabel>{bucket.title}</SectionLabel>
                  <span className="text-[13px] text-text-tertiary tabular-nums">{bucket.items.length}</span>
                </div>
              )}
              {layout === 'grid' && renderCard ? (
                <div className={`grid gap-ha-3 ${gridColsClassName}`}>
                  {bucket.items.map((item) => (
                    <div key={keyOf(item)}>{renderCard(item)}</div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
                  {bucket.items.map((item) => (
                    <div key={keyOf(item)} className="border-b border-surface-low/40 last:border-0">
                      {renderRow(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
