'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  mdiAlertOutline,
  mdiCheckCircle,
  mdiFlaskOutline,
  mdiOpenInNew,
  mdiPause,
  mdiPlay,
  mdiShieldCheckOutline,
  mdiUpdate,
  mdiViewDashboardOutline,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { SectionLabel, DataListView, NavChevron, StoreOverlay } from '../ui';
import type { DataListConfig, StoreItem } from '../ui';
import { useAddContext } from '@/contexts';
import { useApplications, type ApplicationSummary } from '@/hooks/useApplications';

// ─────────────────────────────────────────────────────────────────────────────
// Applications — Home Assistant add-ons in user language. Same master-detail
// shape as Integrations and Devices (a DataListConfig handed to DataListView),
// plus the store overlay that "+ → Application" opens.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Home automation', 'Voice & AI', 'Media', 'Network', 'Security', 'Data & charts', 'Tools', 'Other'];

// Supervisor's `stage`, said plainly.
const STAGE_LABEL: Record<string, string> = {
  stable: 'Stable',
  experimental: 'Still experimental',
  deprecated: 'No longer maintained',
};

function AppIconTile({ app, size, tile }: { app: ApplicationSummary; size: number; tile: string }) {
  return (
    <div
      className={`${tile} flex flex-shrink-0 items-center justify-center rounded-ha-xl`}
      style={{ backgroundColor: `${app.accent}24`, color: app.accent }}
    >
      <Icon path={app.icon} size={size} />
    </div>
  );
}

/** Running / Stopped, the one property people actually scan for. */
function StatePill({ running }: { running: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-ha-2 py-0.5 text-[13px] font-semibold',
        running ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-surface-mid text-text-tertiary',
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', running ? 'bg-green-500' : 'bg-text-disabled')} />
      {running ? 'Running' : 'Stopped'}
    </span>
  );
}

function UpdateChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-ha-2 py-0.5 text-[13px] font-semibold text-amber-600 dark:text-amber-400">
      <Icon path={mdiUpdate} size={13} />
      Update
    </span>
  );
}

function appSubtitle(app: ApplicationSummary): string {
  const version = app.version ? `Version ${app.version}` : 'Not installed';
  return `${version} · ${app.source}`;
}

function AppRow({ app, onSelect }: { app: ApplicationSummary; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(app.slug)}
      className="group flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-mid/50 active:bg-surface-mid"
    >
      <AppIconTile app={app} size={18} tile="h-9 w-9" />
      {/* Name gets the full width; the pills ride under it beside the tagline,
          or a long name is crushed to three letters on a phone. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">{app.name}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-ha-2">
          <StatePill running={app.running} />
          {app.updateAvailable && <UpdateChip />}
          <span className="truncate text-[13px] text-text-secondary">{app.tagline}</span>
        </div>
      </div>
      <NavChevron size={16} className="flex-shrink-0 text-text-disabled" />
    </button>
  );
}

function AppTile({ app, onSelect }: { app: ApplicationSummary; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(app.slug)}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <AppIconTile app={app} size={22} tile="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">{app.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-text-tertiary">{appSubtitle(app)}</p>
        </div>
        <NavChevron size={16} className="flex-shrink-0 text-text-disabled" />
      </div>
      <p className="mt-ha-3 line-clamp-2 text-[13px] leading-snug text-text-secondary">{app.tagline}</p>
      <div className="mt-ha-3 flex items-center gap-ha-2">
        <StatePill running={app.running} />
        {app.updateAvailable && <UpdateChip />}
      </div>
    </button>
  );
}

/** Catalogue rows shaped for the shared store overlay. */
function toStoreItem(app: ApplicationSummary): StoreItem {
  const badges: string[] = [];
  if (app.official) badges.push('Official');
  if (app.stage === 'experimental') badges.push('Experimental');
  if (app.stage === 'deprecated') badges.push('No longer maintained');
  if (app.hasOwnScreen) badges.push('Own screen');
  return {
    id: app.slug,
    name: app.name,
    tagline: app.tagline,
    category: app.category,
    icon: app.icon,
    accent: app.accent,
    source: app.source,
    badges,
    installed: app.installed,
    featured: app.official && app.stage === 'stable',
    description: app.description || app.tagline,
    facts: [
      { label: 'Latest version', value: app.latestVersion ?? 'Unknown' },
      { label: 'From', value: app.source },
      { label: 'Opens its own screen', value: app.hasOwnScreen ? 'Yes' : 'No' },
      { label: 'Status', value: STAGE_LABEL[app.stage] ?? 'Stable' },
    ],
    url: app.url,
  };
}

/**
 * The application store, opened from the top-bar "+ → Application" (which raises
 * an add request on AddContext, the same channel Areas uses for its create
 * actions). No second entry point — the "+" is the one way in.
 */
export function ApplicationStore({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { catalog, install } = useApplications();
  const items = useMemo(() => catalog.map(toStoreItem), [catalog]);

  return (
    <StoreOverlay
      open={open}
      onClose={onClose}
      eyebrow="Application store"
      title="Applications"
      items={items}
      onAdd={(item) => install(item.id)}
      addLabel="Add to my home"
      addedLabel="Added"
      emptyLabel="No applications match that search."
    />
  );
}

/** Master view: everything installed on this home. */
export function ApplicationsTable({
  applications,
  onSelect,
  lastOpenedId,
}: {
  applications: ApplicationSummary[];
  onSelect: (id: string) => void;
  lastOpenedId?: string | null;
}) {
  const { pendingAdd, clearPendingAdd } = useAddContext();
  const [storeOpen, setStoreOpen] = useState(false);

  // "+ → Application" from anywhere lands here and opens the store (next frame,
  // so the state change stays out of the effect body and the section's own pane
  // animation starts first). The request is held until the store is *closed*,
  // not consumed on open: selecting it while already in this section pushes the
  // same route, which resets this panel — a consumed request would leave nothing
  // to reopen from and the store would never appear.
  const wantsStore = pendingAdd?.slug === 'applications';
  useEffect(() => {
    if (!wantsStore) return;
    const frame = requestAnimationFrame(() => setStoreOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [wantsStore]);

  const closeStore = useCallback(() => {
    setStoreOpen(false);
    clearPendingAdd();
  }, [clearPendingAdd]);

  const config = useMemo<DataListConfig<ApplicationSummary>>(() => ({
    keyOf: (a) => a.slug,
    searchText: (a) => `${a.name} ${a.tagline} ${a.category} ${a.source}`,
    searchPlaceholder: 'Search applications…',
    sortOptions: [
      { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
      { id: 'state', label: 'Running first', compare: (a, b) => Number(b.running) - Number(a.running) || a.name.localeCompare(b.name) },
    ],
    groupOptions: [
      {
        id: 'category',
        label: 'Category',
        groupOf: (a) => ({ key: a.category, title: a.category }),
        compareGroups: (a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a.key);
          const bi = CATEGORY_ORDER.indexOf(b.key);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.title.localeCompare(b.title);
        },
      },
      {
        id: 'state',
        label: 'Status',
        groupOf: (a) => (a.running ? { key: 'running', title: 'Running' } : { key: 'stopped', title: 'Stopped' }),
        compareGroups: (a, b) => (a.key === 'running' ? -1 : b.key === 'running' ? 1 : 0),
      },
    ],
    defaultGroupId: 'category',
    filterGroups: [
      {
        id: 'state',
        mode: 'facet',
        label: 'Status',
        chips: [
          { id: 'running', label: 'Running', predicate: (a) => a.running, defaultActive: true },
          { id: 'stopped', label: 'Stopped', predicate: (a) => !a.running, defaultActive: true },
        ],
      },
      {
        id: 'updates',
        mode: 'predicate',
        label: 'Show',
        chips: [{ id: 'update', label: 'Update available', predicate: (a) => a.updateAvailable }],
      },
    ],
    renderRow: (a) => <AppRow app={a} onSelect={onSelect} />,
    renderCard: (a) => <AppTile app={a} onSelect={onSelect} />,
    columns: [
      {
        id: 'name',
        header: 'Application',
        sortAccessor: (a) => a.name.toLowerCase(),
        cell: (a) => (
          <div className="flex items-center gap-ha-3">
            <AppIconTile app={a} size={16} tile="h-8 w-8" />
            <span className="min-w-0 truncate font-semibold text-text-primary">{a.name}</span>
          </div>
        ),
      },
      { id: 'category', header: 'Category', hideBelow: 'sm', sortAccessor: (a) => a.category, cell: (a) => a.category },
      { id: 'version', header: 'Version', hideBelow: 'md', sortAccessor: (a) => a.version ?? '', cell: (a) => <span className="tabular-nums">{a.version ?? '—'}</span> },
      { id: 'source', header: 'From', hideBelow: 'lg', sortAccessor: (a) => a.source, cell: (a) => a.source },
      {
        id: 'state',
        header: 'Status',
        sortAccessor: (a) => (a.running ? 0 : 1),
        cell: (a) => (
          <div className="flex items-center gap-ha-2">
            <StatePill running={a.running} />
            {a.updateAvailable && <UpdateChip />}
          </div>
        ),
      },
    ],
    onRowClick: (a) => onSelect(a.slug),
    storageId: 'applications',
    fillHeight: true,
    defaultLayout: 'list',
    emptyLabel: 'No applications match these filters. Use + to browse the store.',
    bg: 'surface-lower',
    highlightKey: lastOpenedId ?? undefined,
  }), [onSelect, lastOpenedId]);

  // No "browse" button of its own: the top bar's "+" is the way in, and it
  // already hoists "Application" while this section is open.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DataListView items={applications} config={config} />
      <ApplicationStore open={storeOpen} onClose={closeStore} />
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3">
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="truncate text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

/** Detail view: what it is, whether it's running, and the properties that matter. */
export function ApplicationDetailView({ application }: { application: ApplicationSummary }) {
  const { setRunning } = useApplications();
  const app = application;

  return (
    <div className="space-y-ha-6">
      <section className="rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)] lg:p-ha-6">
        <div className="flex items-start gap-ha-4">
          <AppIconTile app={app} size={26} tile="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-text-primary">{app.name}</h2>
            <p className="mt-0.5 text-sm text-text-secondary">{app.tagline}</p>
            <div className="mt-ha-3 flex flex-wrap items-center gap-ha-2">
              <StatePill running={app.running} />
              {app.official && (
                <span className="inline-flex items-center gap-1 rounded-full border border-surface-lower bg-surface-low px-ha-2 py-0.5 text-xs font-medium text-text-secondary">
                  <Icon path={mdiShieldCheckOutline} size={14} className="text-green-500" />
                  Made by Home Assistant
                </span>
              )}
              {app.stage !== 'stable' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-surface-lower bg-surface-low px-ha-2 py-0.5 text-xs font-medium text-text-secondary">
                  <Icon path={mdiFlaskOutline} size={14} className="text-amber-500" />
                  {STAGE_LABEL[app.stage] ?? 'Still experimental'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-ha-5 flex flex-wrap gap-ha-2">
          <button
            type="button"
            onClick={() => setRunning(app.slug, !app.running)}
            className={clsx(
              'flex items-center gap-ha-2 rounded-full px-ha-4 py-ha-2 text-sm font-semibold transition-colors',
              app.running
                ? 'bg-surface-low text-text-primary hover:bg-surface-mid'
                : 'bg-ha-blue text-white hover:brightness-105',
            )}
          >
            <Icon path={app.running ? mdiPause : mdiPlay} size={16} />
            {app.running ? 'Stop' : 'Start'}
          </button>
          {app.hasOwnScreen && (
            <button
              type="button"
              disabled={!app.running}
              className="flex items-center gap-ha-2 rounded-full bg-surface-low px-ha-4 py-ha-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-mid disabled:text-text-disabled disabled:hover:bg-surface-low"
              title={app.running ? undefined : 'Start the application first'}
            >
              <Icon path={mdiViewDashboardOutline} size={16} />
              Open
            </button>
          )}
        </div>

        {app.updateAvailable && (
          <div className="mt-ha-4 flex items-center gap-ha-3 rounded-ha-2xl bg-amber-500/10 px-ha-4 py-ha-3">
            <Icon path={mdiUpdate} size={18} className="flex-shrink-0 text-amber-500" />
            <p className="flex-1 text-[13px] text-text-secondary">
              Version {app.latestVersion} is available — you&rsquo;re on {app.version}.
            </p>
          </div>
        )}
      </section>

      <div className="space-y-ha-3">
        <SectionLabel inset>Details</SectionLabel>
        <div className="grid grid-cols-2 gap-ha-3">
          <FactCard label="Version" value={app.version ?? 'Not installed'} />
          <FactCard label="Latest version" value={app.latestVersion ?? 'Unknown'} />
          <FactCard label="From" value={app.source} />
          <FactCard label="Starts with your home" value={app.startOnBoot ? 'Yes' : 'No'} />
          <FactCard label="Has its own screen" value={app.hasOwnScreen ? 'Yes' : 'No'} />
          <FactCard label="Category" value={app.category} />
        </div>
      </div>

      <div className="space-y-ha-3">
        <SectionLabel inset>Health</SectionLabel>
        <div className="flex items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3">
          <Icon
            path={app.running ? mdiCheckCircle : mdiAlertOutline}
            size={18}
            className={app.running ? 'flex-shrink-0 text-green-500' : 'flex-shrink-0 text-text-tertiary'}
          />
          <p className="text-[13px] text-text-secondary">
            {app.running
              ? 'Running normally. Anything it provides is available to your home right now.'
              : 'Stopped. Anything it provides is unavailable until you start it again.'}
          </p>
        </div>
      </div>

      <div className="space-y-ha-3">
        <SectionLabel inset>Configuration</SectionLabel>
        <div className="flex items-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-low px-ha-4 py-ha-3">
          <Icon path={mdiOpenInNew} size={15} className="flex-shrink-0 text-text-tertiary" />
          <span className="text-xs text-text-secondary">
            In production this opens the application&rsquo;s own settings at{' '}
            <code className="font-mono text-text-secondary">/hassio/addon/{app.slug}</code>
          </span>
        </div>
      </div>
    </div>
  );
}
