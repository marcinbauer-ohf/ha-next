'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import { SectionLabel, DataListView, NavChevron } from '../ui';
import type { DataListConfig } from '../ui';
import type { IntegrationSummary, IntegrationStatus, IntegrationFlags } from '@/hooks';
import {
  mdiCheckCircle,
  mdiFlaskOutline,
  mdiDevices,
  mdiOpenInNew,
  mdiCubeOutline,
  mdiCloudOutline,
  mdiLan,
  mdiAlertCircleOutline,
} from '@mdi/js';

function countLabel(deviceCount: number, entityCount: number): string {
  const d = `${deviceCount} ${deviceCount === 1 ? 'device' : 'devices'}`;
  const e = `${entityCount} ${entityCount === 1 ? 'entity' : 'entities'}`;
  return deviceCount > 0 ? `${d} · ${e}` : e;
}

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  active: 'Active',
  disabled: 'Disabled',
  ignored: 'Ignored',
};

const STATUS_RANK: Record<IntegrationStatus, number> = { active: 0, disabled: 1, ignored: 2 };

// Preferred category ordering for grouped display; unknowns fall after, A→Z.
const CATEGORY_ORDER = ['Lighting', 'Media', 'Climate', 'Network', 'Weather', 'System', 'Other'];

function StatusPill({ status }: { status: IntegrationStatus }) {
  if (status === 'active') return null;
  const tone =
    status === 'disabled'
      ? 'bg-surface-mid text-text-tertiary'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return (
    <span className={`rounded-full px-ha-2 py-0.5 text-[13px] font-semibold uppercase tracking-wide ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Badge flags surfaced as icons, mirroring HA's Integrations page.
const FLAG_META: Array<{ key: keyof IntegrationFlags; icon: string; label: string; tone: string }> = [
  { key: 'custom', icon: mdiCubeOutline, label: 'Custom integration', tone: 'text-violet-500' },
  { key: 'cloud', icon: mdiCloudOutline, label: 'Relies on the cloud', tone: 'text-sky-500' },
  { key: 'local', icon: mdiLan, label: 'Local network', tone: 'text-text-tertiary' },
  { key: 'hasError', icon: mdiAlertCircleOutline, label: 'Needs attention', tone: 'text-amber-500' },
];

/** Compact row of flag icons (list + grid). */
function IntegrationFlagIcons({ flags, size = 15 }: { flags: IntegrationFlags; size?: number }) {
  const active = FLAG_META.filter((f) => flags[f.key]);
  if (active.length === 0) return null;
  return (
    <span className="flex items-center gap-ha-1 flex-shrink-0">
      {active.map((f) => (
        <span key={f.key} title={f.label} aria-label={f.label} className={f.tone}>
          <Icon path={f.icon} size={size} />
        </span>
      ))}
    </span>
  );
}

/** Labeled flag badges for the detail view. */
function IntegrationFlagBadges({ flags }: { flags: IntegrationFlags }) {
  const active = FLAG_META.filter((f) => flags[f.key]);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-ha-2">
      {active.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-ha-1 rounded-full border border-surface-lower bg-surface-low px-ha-2 py-0.5 text-xs font-medium text-text-secondary"
        >
          <span className={f.tone}><Icon path={f.icon} size={14} /></span>
          {f.label}
        </span>
      ))}
    </div>
  );
}

/**
 * The integration's real brand logo from the Home Assistant brands CDN
 * (https://brands.home-assistant.io/<domain>/icon.png — the platform key is the
 * brand domain). Falls back to the thematic mdi icon if the brand has no logo
 * or the image fails to load.
 */
function IntegrationLogo({
  domain,
  fallbackIcon,
  tileClass,
  iconSize,
}: {
  domain: string;
  fallbackIcon: string;
  tileClass: string;
  iconSize: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${tileClass} bg-fill-primary-normal text-ha-blue`}>
        <Icon path={fallbackIcon} size={iconSize} />
      </div>
    );
  }

  return (
    <div className={`${tileClass} bg-white/90 dark:bg-white p-1`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://brands.home-assistant.io/${domain}/icon.png`}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** A single integration row — the renderRow for DataListView. */
function IntegrationRow({
  integration,
  onSelect,
}: {
  integration: IntegrationSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(integration.id)}
      className="group w-full flex items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-mid/50 active:bg-surface-mid"
    >
      <IntegrationLogo
        domain={integration.id}
        fallbackIcon={integration.icon}
        tileClass="w-9 h-9 flex items-center justify-center rounded-ha-xl flex-shrink-0 overflow-hidden"
        iconSize={18}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-ha-2 min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-text-primary truncate">
            {integration.name}
          </p>
          <StatusPill status={integration.status} />
        </div>
        <p className="text-[13px] text-text-secondary truncate mt-0.5">
          {countLabel(integration.deviceCount, integration.entityCount)}
        </p>
      </div>
      <IntegrationFlagIcons flags={integration.flags} />
      <NavChevron size={16} className="text-text-disabled flex-shrink-0" />
    </button>
  );
}

/** A single integration tile — the renderCard for DataListView's grid layout. */
function IntegrationTile({
  integration,
  onSelect,
}: {
  integration: IntegrationSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(integration.id)}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <IntegrationLogo
          domain={integration.id}
          fallbackIcon={integration.icon}
          tileClass="w-11 h-11 flex items-center justify-center rounded-ha-xl flex-shrink-0 overflow-hidden"
          iconSize={22}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight text-text-primary truncate">
            {integration.name}
          </p>
          <div className="mt-0.5 flex items-center gap-ha-2">
            <span className="text-[13px] text-text-tertiary">{integration.category}</span>
            <StatusPill status={integration.status} />
          </div>
        </div>
        <NavChevron size={16} className="text-text-disabled flex-shrink-0" />
      </div>
      <div className="mt-ha-3 flex items-center justify-between gap-ha-2">
        <p className="text-[13px] text-text-secondary truncate">
          {countLabel(integration.deviceCount, integration.entityCount)}
        </p>
        <IntegrationFlagIcons flags={integration.flags} />
      </div>
    </button>
  );
}

/**
 * Master view: the integrations list in settings column 2. It supplies a typed
 * DataListConfig and lets the generic DataListView handle search / sort / group /
 * filter / layout — the same pattern other big lists (entities, people…) can adopt.
 */
export function IntegrationsTable({
  integrations,
  onSelect,
  lastOpenedId,
}: {
  integrations: IntegrationSummary[];
  onSelect: (id: string) => void;
  lastOpenedId?: string | null;
}) {
  const config = useMemo<DataListConfig<IntegrationSummary>>(() => ({
    keyOf: (i) => i.id,
    searchText: (i) => `${i.name} ${i.category}`,
    searchPlaceholder: 'Search integrations…',
    sortOptions: [
      { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
      { id: 'devices', label: 'Devices', compare: (a, b) => b.deviceCount - a.deviceCount || a.name.localeCompare(b.name) },
      { id: 'entities', label: 'Entities', compare: (a, b) => b.entityCount - a.entityCount || a.name.localeCompare(b.name) },
    ],
    groupOptions: [
      {
        id: 'category',
        label: 'Category',
        groupOf: (i) => ({ key: i.category, title: i.category }),
        compareGroups: (a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a.key);
          const bi = CATEGORY_ORDER.indexOf(b.key);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.title.localeCompare(b.title);
        },
      },
      {
        id: 'status',
        label: 'Status',
        groupOf: (i) => ({ key: i.status, title: STATUS_LABEL[i.status] }),
        compareGroups: (a, b) => STATUS_RANK[a.key as IntegrationStatus] - STATUS_RANK[b.key as IntegrationStatus],
      },
    ],
    defaultGroupId: 'category',
    filterGroups: [
      {
        id: 'status',
        mode: 'facet',
        chips: [
          { id: 'active', label: 'Active', predicate: (i) => i.status === 'active', defaultActive: true },
          { id: 'disabled', label: 'Disabled', predicate: (i) => i.status === 'disabled' },
          { id: 'ignored', label: 'Ignored', predicate: (i) => i.status === 'ignored' },
        ],
      },
    ],
    renderRow: (i) => <IntegrationRow integration={i} onSelect={onSelect} />,
    renderCard: (i) => <IntegrationTile integration={i} onSelect={onSelect} />,
    columns: [
      {
        id: 'name',
        header: 'Integration',
        sortAccessor: (i) => i.name.toLowerCase(),
        cell: (i) => (
          <div className="flex items-center gap-ha-3">
            <IntegrationLogo
              domain={i.id}
              fallbackIcon={i.icon}
              tileClass="w-8 h-8 flex items-center justify-center rounded-ha-lg flex-shrink-0 overflow-hidden"
              iconSize={16}
            />
            <span className="min-w-0 flex items-center gap-ha-2">
              <span className="font-semibold text-text-primary truncate">{i.name}</span>
              <StatusPill status={i.status} />
            </span>
          </div>
        ),
      },
      { id: 'category', header: 'Category', sortAccessor: (i) => i.category.toLowerCase(), cell: (i) => i.category, hideBelow: 'sm' },
      {
        id: 'devices',
        header: 'Devices',
        align: 'right',
        hideBelow: 'md',
        sortAccessor: (i) => i.deviceCount,
        cell: (i) => <span className="tabular-nums">{i.deviceCount}</span>,
      },
      {
        id: 'entities',
        header: 'Entities',
        align: 'right',
        sortAccessor: (i) => i.entityCount,
        cell: (i) => <span className="tabular-nums">{i.entityCount}</span>,
      },
      {
        id: 'flags',
        header: 'Flags',
        hideBelow: 'lg',
        cell: (i) => <IntegrationFlagIcons flags={i.flags} />,
      },
    ],
    onRowClick: (i) => onSelect(i.id),
    fillHeight: true,
    defaultLayout: 'list',
    emptyLabel: 'No integrations match these filters.',
    bg: 'surface-lower',
    highlightKey: lastOpenedId ?? undefined,
  }), [onSelect, lastOpenedId]);

  return <DataListView items={integrations} config={config} />;
}

/** Detail view: shown after drilling into a single integration row. */
export function IntegrationDetailView({ integration }: { integration: IntegrationSummary }) {
  return (
    <div className="space-y-ha-6">
      {/* Summary */}
      <section className="rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 lg:p-ha-6 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-ha-4">
          <IntegrationLogo
            domain={integration.id}
            fallbackIcon={integration.icon}
            tileClass="w-12 h-12 flex items-center justify-center rounded-ha-2xl flex-shrink-0 overflow-hidden"
            iconSize={26}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">{integration.name}</h2>
            <div className="mt-ha-1 flex items-center gap-ha-2 text-sm">
              <Icon
                path={integration.demo ? mdiFlaskOutline : mdiCheckCircle}
                size={15}
                className={integration.demo ? 'text-text-tertiary' : 'text-green-500'}
              />
              <span className="text-text-secondary">
                {integration.demo ? 'Demo integration' : 'Connected'}
              </span>
            </div>
            <div className="mt-ha-3">
              <IntegrationFlagBadges flags={integration.flags} />
            </div>
          </div>
        </div>

        <div className="mt-ha-5 grid grid-cols-2 gap-ha-3">
          <div className="rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3">
            <div className="text-2xl font-bold text-text-primary">{integration.deviceCount}</div>
            <div className="text-xs text-text-secondary">Devices</div>
          </div>
          <div className="rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3">
            <div className="text-2xl font-bold text-text-primary">{integration.entityCount}</div>
            <div className="text-xs text-text-secondary">Entities</div>
          </div>
        </div>
      </section>

      {/* Devices */}
      <div className="space-y-ha-3">
        <SectionLabel className="px-ha-1">Devices</SectionLabel>
        {integration.devices.length === 0 ? (
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-5 text-center text-sm text-text-tertiary">
            This integration has no devices — it provides entities directly.
          </div>
        ) : (
          <div className="bg-surface-default rounded-ha-2xl border border-surface-lower overflow-hidden">
            {integration.devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-ha-3 px-ha-4 py-ha-3 border-b border-surface-low/40 last:border-0"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-ha-lg flex-shrink-0 bg-surface-mid text-text-secondary">
                  <Icon path={mdiDevices} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-text-primary truncate">
                    {device.name}
                  </p>
                  {device.model && (
                    <p className="text-[13px] text-text-secondary truncate mt-0.5">{device.model}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configure (placeholder — production opens HA's config-entry page) */}
      <div className="space-y-ha-3">
        <SectionLabel className="px-ha-1">Configuration</SectionLabel>
        <div className="flex items-center gap-ha-2 px-ha-4 py-ha-3 bg-surface-low rounded-ha-2xl border border-surface-lower">
          <Icon path={mdiOpenInNew} size={15} className="text-text-tertiary flex-shrink-0" />
          <span className="text-xs text-text-secondary">
            In production this opens the integration&rsquo;s setup at{' '}
            <code className="font-mono text-text-secondary">/config/integrations/integration/{integration.id}</code>
          </span>
        </div>
      </div>
    </div>
  );
}
