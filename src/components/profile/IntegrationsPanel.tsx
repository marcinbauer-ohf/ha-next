'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import { SectionLabel, DataListView, NavChevron, IntegrationLogo, StoreOverlay } from '../ui';
import type { DataListConfig } from '../ui';
import type { IntegrationSummary, IntegrationStatus, IntegrationFlags } from '@/hooks';
import { useIntegrations } from '@/hooks';
import { useAddContext } from '@/contexts';
import { useIntegrationCatalog, useAddedBrands, type CatalogBrand } from '@/hooks/useIntegrationCatalog';
import type { StoreItem, StoreFilter } from '../ui';
import {
  mdiCheckCircle,
  mdiFlaskOutline,
  mdiDevices,
  mdiOpenInNew,
  mdiCubeOutline,
  mdiCloudOutline,
  mdiLan,
  mdiAlertCircleOutline,
  mdiLightbulbOutline,
  mdiThermostat,
  mdiShieldHomeOutline,
  mdiPlayCircleOutline,
  mdiFlashOutline,
  mdiAccessPointNetwork,
  mdiMicrophoneOutline,
  mdiCarOutline,
  mdiWeatherPartlyCloudy,
  mdiRobotVacuumVariant,
  mdiCalendarBlankOutline,
  mdiToggleSwitchOutline,
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
        label: 'Status',
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
    storageId: 'integrations',
    fillHeight: true,
    defaultLayout: 'list',
    emptyLabel: 'No integrations match these filters. Use + to add one.',
    bg: 'surface-lower',
    highlightKey: lastOpenedId ?? undefined,
  }), [onSelect, lastOpenedId]);

  // No "browse" button of its own: the top bar's "+" is the way in, and it
  // already hoists "Integration" while this section is open.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DataListView items={integrations} config={config} />
      <IntegrationStore />
    </div>
  );
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
            <div className="text-xs text-text-secondary">Sensors & controls</div>
          </div>
        </div>
      </section>

      {/* Devices */}
      <div className="space-y-ha-3">
        <SectionLabel inset>Devices</SectionLabel>
        {integration.devices.length === 0 ? (
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-5 text-center text-sm text-text-tertiary">
            This integration has no devices — it adds sensors and controls directly.
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
        <SectionLabel inset>Configuration</SectionLabel>
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

// ─────────────────────────────────────────────────────────────────────────────
// The brand store — everything Home Assistant works with, browsable behind the
// top bar's "+ → Integration" and "+ → Device". One store, two doors: in Home
// Assistant you add a device by adding the brand it belongs to, so splitting the
// two would mean two stores holding the same 1,480 brands.
//
// The catalogue is a snapshot of home-assistant.io/integrations (see
// scripts/fetch-integration-catalog.mjs), because a running instance can only
// list what is already set up.
// ─────────────────────────────────────────────────────────────────────────────

// One face per group, for the handful of brands with no logo on the CDN.
const GROUP_META: Record<string, { icon: string; accent: string }> = {
  'Lights & shades': { icon: mdiLightbulbOutline, accent: '#f5a524' },
  Climate: { icon: mdiThermostat, accent: '#ff6b4a' },
  Security: { icon: mdiShieldHomeOutline, accent: '#4a7dff' },
  Media: { icon: mdiPlayCircleOutline, accent: '#a855f7' },
  Energy: { icon: mdiFlashOutline, accent: '#22c55e' },
  'Hubs & radios': { icon: mdiAccessPointNetwork, accent: '#18bcf2' },
  'Voice & AI': { icon: mdiMicrophoneOutline, accent: '#ec4899' },
  Car: { icon: mdiCarOutline, accent: '#64748b' },
  Weather: { icon: mdiWeatherPartlyCloudy, accent: '#38bdf8' },
  'Home care': { icon: mdiRobotVacuumVariant, accent: '#14b8a6' },
  Everyday: { icon: mdiCalendarBlankOutline, accent: '#8b5cf6' },
  'Sensors & switches': { icon: mdiToggleSwitchOutline, accent: '#0ea5e9' },
  'Network & system': { icon: mdiLan, accent: '#64748b' },
};

// HA's iot_class, said the way you'd say it out loud.
const CONNECTION_LABEL: Record<string, string> = {
  'local-push': 'On your network, reports the moment it changes',
  'local-polling': 'On your network, checked every so often',
  'cloud-push': 'Through the maker’s service, reports right away',
  'cloud-polling': 'Through the maker’s service, checked every so often',
  'assumed-state': 'One-way — it takes commands but can’t report back',
  calculated: 'Worked out from things you already have',
  configurable: 'However you set it up',
};

// HA's integration_type, same treatment.
const TYPE_LABEL: Record<string, string> = {
  device: 'A device you own',
  hub: 'A hub that brings its own devices',
  service: 'An online service',
  virtual: 'Set up through another brand',
  system: 'Part of Home Assistant',
  entity: 'Part of Home Assistant',
  helper: 'A helper you build yourself',
  integration: 'A connection to something else',
  hardware: 'Hardware this runs on',
};

function toStoreItem(brand: CatalogBrand, installed: boolean): StoreItem {
  const meta = GROUP_META[brand.group] ?? { icon: mdiDevices, accent: '#18bcf2' };
  const badges: string[] = [];
  if (brand.partner) badges.push('Works with Home Assistant');
  if (brand.type === 'virtual') badges.push('Through another brand');
  return {
    id: brand.slug,
    name: brand.name,
    tagline: brand.tagline,
    category: brand.group,
    icon: meta.icon,
    accent: meta.accent,
    logoDomain: brand.domain,
    // Home Assistant's own categories: not shown, but a search for "thermostat"
    // or "doorbell" should still find the brand that has one.
    keywords: brand.categories.join(' '),
    badges,
    installed,
    featured: brand.featured && !installed,
    facts: [
      { label: 'How it connects', value: CONNECTION_LABEL[brand.iotClass ?? ''] ?? 'Depends on the device' },
      { label: 'What it is', value: TYPE_LABEL[brand.type] ?? 'A connection to something else' },
      { label: 'It can bring', value: brand.categories.slice(0, 3).join(', ') || 'Whatever you connect' },
      { label: 'Supported since', value: brand.since ? `Version ${brand.since}` : 'Early days' },
    ],
    url: brand.url,
  };
}

// Devices or services, from Home Assistant's own `integration_type`. The older
// third of the catalogue has no type set, and HA's default for unset is `hub`, so
// unclassified counts as a device — it means a filter for devices can show the odd
// service, which beats hiding the camera brand you came for. HA's own building
// blocks (entity, helper, system) are neither, and show when no chip is picked.
const DEVICE_TYPES = new Set(['device', 'hub', 'hardware', 'brand', 'virtual', 'integration']);
const SERVICE_TYPES = new Set(['service']);

// Searches offered before anyone types: things people shop for that the category
// grid can't show them — there is no "doorbell" or "blinds" group. Each was
// checked against the catalogue (8–31 brands apiece), so none is a dead end.
const SUGGESTED_SEARCHES = ['Doorbell', 'Vacuum', 'Blinds', 'Water heater', 'Solar', 'Air quality'];

/**
 * Opened from the top bar's "+ → Integration" / "+ → Device" (an AddContext
 * request, the same channel Applications and Blueprints use). No second entry
 * point — the "+" is the one way in.
 *
 * It watches AddContext itself rather than taking `open`, because both the
 * integrations list and the devices list mount it and neither should have to
 * keep the same piece of state.
 */
export function IntegrationStore() {
  const { pendingAdd, clearPendingAdd } = useAddContext();
  const [open, setOpen] = useState(false);

  // Held open until dismissed, and raised on the next frame so the section it
  // landed on paints first (see BlueprintsPanel).
  const wanted = pendingAdd?.slug === 'integrations' || pendingAdd?.slug === 'devices';
  useEffect(() => {
    if (!wanted) return;
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [wanted]);

  const onClose = useCallback(() => {
    setOpen(false);
    clearPendingAdd();
  }, [clearPendingAdd]);

  const { items: catalog, loading } = useIntegrationCatalog(open);
  const { integrations } = useIntegrations();
  const { added, addBrand } = useAddedBrands();

  const items = useMemo(() => {
    const have = new Set([...integrations.map((i) => i.id), ...added]);
    return catalog.map((brand) => toStoreItem(brand, have.has(brand.domain)));
  }, [catalog, integrations, added]);

  const filters = useMemo<StoreFilter[]>(() => {
    const devices = new Set(catalog.filter((b) => DEVICE_TYPES.has(b.type)).map((b) => b.slug));
    const services = new Set(catalog.filter((b) => SERVICE_TYPES.has(b.type)).map((b) => b.slug));
    return [
      { id: 'devices', label: 'Devices', match: (i) => devices.has(i.id) },
      { id: 'services', label: 'Services', match: (i) => services.has(i.id) },
    ];
  }, [catalog]);

  return (
    <StoreOverlay
      open={open}
      onClose={onClose}
      eyebrow="Devices & services"
      title="Devices & services"
      items={items}
      onAdd={(item) => {
        const brand = catalog.find((b) => b.slug === item.id);
        if (brand) addBrand(brand.domain);
      }}
      addLabel="Add to my home"
      addedLabel="Already here"
      emptyLabel={loading ? 'Fetching everything Home Assistant works with…' : 'Nothing matches that search.'}
      filters={filters}
      itemsLabel="Brands"
      suggestions={SUGGESTED_SEARCHES}
    />
  );
}
