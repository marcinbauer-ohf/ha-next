'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mdiCheck, mdiLinkVariant } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { DataListView, StoreOverlay } from '../ui';
import type { DataListConfig, StoreItem } from '../ui';
import { useAddContext } from '@/contexts';
import { useBlueprints, type BlueprintSummary } from '@/hooks/useBlueprints';

// ─────────────────────────────────────────────────────────────────────────────
// Blueprints — the second store. Same shell as Applications, different catalogue:
// the list is what this home already has, "+ → Blueprint" opens the store, and
// the store keeps the URL import (how blueprints really arrive) as its footer.
// ─────────────────────────────────────────────────────────────────────────────

function BlueprintTile({ blueprint, onUse }: { blueprint: BlueprintSummary; onUse: () => void }) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-ha-xl"
          style={{ backgroundColor: `${blueprint.accent}24`, color: blueprint.accent }}
        >
          <Icon path={blueprint.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">{blueprint.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-text-tertiary">{blueprint.author}</p>
        </div>
      </div>
      <p className="mt-ha-3 line-clamp-2 text-[13px] leading-snug text-text-secondary">{blueprint.tagline}</p>
    </button>
  );
}

function BlueprintRow({ blueprint, onUse }: { blueprint: BlueprintSummary; onUse: () => void }) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-mid/50 active:bg-surface-mid"
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl"
        style={{ backgroundColor: `${blueprint.accent}24`, color: blueprint.accent }}
      >
        <Icon path={blueprint.icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">{blueprint.name}</p>
        <p className="mt-0.5 truncate text-[13px] text-text-secondary">{blueprint.tagline}</p>
      </div>
      <span className="flex-shrink-0 rounded-full bg-surface-low px-ha-3 py-1 text-[13px] font-semibold text-text-secondary">
        Use
      </span>
    </button>
  );
}

function toStoreItem(blueprint: BlueprintSummary): StoreItem {
  return {
    id: blueprint.id,
    name: blueprint.name,
    tagline: blueprint.tagline,
    category: blueprint.category,
    icon: blueprint.icon,
    accent: blueprint.accent,
    source: blueprint.author,
    badges: blueprint.author === 'Home Assistant' ? ['Official'] : [],
    installed: blueprint.installed,
    featured: blueprint.author === 'Home Assistant',
    description: blueprint.description ?? blueprint.tagline,
    facts: [
      { label: 'Makes', value: blueprint.domain === 'script' ? 'A script' : 'An automation' },
      { label: 'By', value: blueprint.author },
    ],
    url: blueprint.sourceUrl,
  };
}

/** "Blueprints arrive as a link" — kept in the store rather than a separate dialog. */
function ImportFromUrl({ onImport }: { onImport: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!url.trim()) return;
    onImport(url.trim());
    setUrl('');
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div className="rounded-ha-2xl border border-dashed border-surface-mid p-ha-4">
      <p className="text-sm font-semibold text-text-primary">Found one somewhere else?</p>
      <p className="mt-0.5 text-[13px] text-text-secondary">
        Paste the link from a forum post or a repository and it joins your list.
      </p>
      <div className="mt-ha-3 flex gap-ha-2">
        <div className="flex min-w-0 flex-1 items-center gap-ha-2 rounded-full bg-surface-low px-ha-3 py-ha-2">
          <Icon path={mdiLinkVariant} size={16} className="flex-shrink-0 text-text-tertiary" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="https://community.home-assistant.io/t/…"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-disabled"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          className="flex flex-shrink-0 items-center gap-ha-2 rounded-full bg-ha-blue px-ha-4 py-ha-2 text-sm font-semibold text-white transition-[filter] hover:brightness-105"
        >
          {done && <Icon path={mdiCheck} size={16} />}
          {done ? 'Added' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export function BlueprintsPanel() {
  const router = useRouter();
  const { blueprints, catalog, importBlueprint, importFromUrl } = useBlueprints();
  const { pendingAdd, clearPendingAdd } = useAddContext();
  const [storeOpen, setStoreOpen] = useState(false);

  // "+ → Blueprint" lands here and opens the store; the request is held until
  // the store closes (see ApplicationsTable for why).
  const wantsStore = pendingAdd?.slug === 'blueprints';
  useEffect(() => {
    if (!wantsStore) return;
    const frame = requestAnimationFrame(() => setStoreOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [wantsStore]);

  const closeStore = useCallback(() => {
    setStoreOpen(false);
    clearPendingAdd();
  }, [clearPendingAdd]);

  // Using a blueprint means making an automation from it.
  const use = () => router.push('/settings/automations');

  const config = useMemo<DataListConfig<BlueprintSummary>>(() => ({
    keyOf: (b) => b.id,
    searchText: (b) => `${b.name} ${b.tagline} ${b.author} ${b.category}`,
    searchPlaceholder: 'Search blueprints…',
    sortOptions: [{ id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) }],
    groupOptions: [
      { id: 'category', label: 'Category', groupOf: (b) => ({ key: b.category, title: b.category }) },
      { id: 'author', label: 'Author', groupOf: (b) => ({ key: b.author, title: b.author }) },
    ],
    defaultGroupId: 'category',
    renderRow: (b) => <BlueprintRow blueprint={b} onUse={use} />,
    renderCard: (b) => <BlueprintTile blueprint={b} onUse={use} />,
    fillHeight: true,
    defaultLayout: 'list',
    emptyLabel: 'No blueprints yet — use + to browse the store.',
    bg: 'surface-lower',
    // `use` only navigates; it never changes between renders in a way that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const items = useMemo(() => catalog.map(toStoreItem), [catalog]);

  // Entry point is the top bar's "+ → Blueprint" (see ApplicationsTable).
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DataListView items={blueprints} config={config} />
      <StoreOverlay
        open={storeOpen}
        onClose={closeStore}
        eyebrow="Blueprint store"
        title="Blueprints"
        items={items}
        onAdd={(item) => importBlueprint(item.id)}
        addLabel="Add to my home"
        addedLabel="Added"
        emptyLabel="No blueprints match that search."
        footer={<ImportFromUrl onImport={importFromUrl} />}
      />
    </div>
  );
}
