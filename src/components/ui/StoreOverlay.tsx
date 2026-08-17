'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  mdiCheck,
  mdiDownload,
  mdiOpenInNew,
  mdiStarFourPointsOutline,
} from '@mdi/js';
import { Icon } from './Icon';
import { SearchField } from './SearchField';
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
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Extra row under the grid — e.g. blueprints' "import from a URL". */
  footer?: React.ReactNode;
}

const ALL = 'All';

function ItemTile({ item, onOpen }: { item: StoreItem; onOpen: () => void }) {
  const accent = item.accent ?? '#18bcf2';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-ha-xl"
          style={{ backgroundColor: `${accent}24`, color: accent }}
        >
          <Icon path={item.icon} size={22} />
        </div>
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
      className="flex w-[260px] flex-shrink-0 flex-col justify-between gap-ha-3 overflow-hidden rounded-ha-2xl p-ha-4 text-left transition-transform active:scale-[0.99]"
      style={{ background: `linear-gradient(140deg, ${accent}2e, ${accent}0d)` }}
    >
      <div className="flex items-center gap-ha-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
        <Icon path={mdiStarFourPointsOutline} size={13} />
        Worth a look
      </div>
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-ha-xl bg-surface-default" style={{ color: accent }}>
          <Icon path={item.icon} size={22} />
        </div>
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
  const accent = item.accent ?? '#18bcf2';
  // Going back is the header's arrow (DialogFrame's onBack) — no second control.
  return (
    <div className="flex flex-col gap-ha-4 pb-ha-4">
      <div className="flex items-start gap-ha-4 rounded-ha-2xl bg-surface-low p-ha-4">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-ha-2xl"
          style={{ backgroundColor: `${accent}24`, color: accent }}
        >
          <Icon path={item.icon} size={28} />
        </div>
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
  searchPlaceholder = 'Search…',
  emptyLabel = 'Nothing matches that search.',
  footer,
}: StoreOverlayProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(
    () => [ALL, ...[...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b))],
    [items],
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => items.filter((i) =>
      (category === ALL || i.category === category) &&
      (!q || `${i.name} ${i.tagline} ${i.source ?? ''} ${i.category}`.toLowerCase().includes(q))),
    [items, category, q],
  );
  const featured = useMemo(
    () => (q || category !== ALL ? [] : items.filter((i) => i.featured && !i.installed).slice(0, 4)),
    [items, q, category],
  );

  const selected = openId ? items.find((i) => i.id === openId) ?? null : null;

  const close = () => {
    setOpenId(null);
    onClose();
  };

  // Browse ⇄ detail swaps in place, with no ModalSheet transitionKey: that
  // crossfade pops the outgoing pane out of flow, and since each pane carries
  // its own DialogFrame you see two headers and two bodies stacked mid-swap.

  return (
    <ModalSheet open={open} onClose={close} maxWidth={940}>
      <DialogFrame
        eyebrow={selected ? eyebrow : 'Add to your home'}
        title={selected ? selected.name : title}
        onClose={close}
        onBack={selected ? () => setOpenId(null) : undefined}
      >
        {selected ? (
          <DetailPane
            item={selected}
            onAdd={() => onAdd(selected)}
            addLabel={addLabel}
            addedLabel={addedLabel}
          />
        ) : (
          <div className="flex flex-col gap-ha-4 pb-ha-4">
            <SearchField value={query} onChange={setQuery} placeholder={searchPlaceholder} />

            {/* Categories — a horizontal rail so a long list never wraps into a wall */}
            <div className="-mx-1 flex gap-ha-2 overflow-x-auto scrollbar-hide px-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={clsx(
                    'flex-shrink-0 rounded-full px-ha-3 py-ha-1 text-sm font-medium transition-colors',
                    c === category
                      ? 'bg-ha-blue text-white'
                      : 'bg-surface-low text-text-secondary hover:bg-surface-mid',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {featured.length > 0 && (
              <div className="-mx-1 flex gap-ha-3 overflow-x-auto scrollbar-hide px-1 pb-1">
                {featured.map((item) => (
                  <FeaturedCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <p className="py-ha-6 text-center text-sm text-text-tertiary">{emptyLabel}</p>
            ) : (
              <div className="grid grid-cols-1 gap-ha-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((item) => (
                  <ItemTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
                ))}
              </div>
            )}

            {footer}
          </div>
        )}
      </DialogFrame>
    </ModalSheet>
  );
}
