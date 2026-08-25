'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { SectionLabel, DataListView, ToggleSwitch, NavChevron } from '../ui';
import type { DataListConfig } from '../ui';
import { ModalSheet } from '../layout/ModalSheet';
import { SidePanel } from '../layout/SidePanel';
import { EntityDetailPanel, type PanelEntity } from '../cards/EntityDetailPanel';
import { IntegrationStore } from './IntegrationsPanel';
import {
  usePendingRows,
  PendingListRow,
  PendingTile,
  PendingNameCell,
  PENDING_GROUP,
  IGNORED_GROUP,
  type PendingRow,
} from './DiscoveredDevices';
import type { DeviceSummary, HassDevice } from '@/hooks';
import { DEVICE_CATEGORY_LABEL, useDevices, useCopyToClipboard } from '@/hooks';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import {
  entityLabel,
  stateLabel,
  isOn,
  domainIcon,
  TOGGLEABLE,
  type DeviceCategory,
  PRESSABLE,
} from '@/lib/homeassistant/entityHelpers';
import {
  mdiDevices,
  mdiMapMarkerOutline,
  mdiPuzzleOutline,
  mdiInformationOutline,
  mdiAlertCircleOutline,
  mdiOpenInNew,
  mdiTextureBox,
  mdiPound,
  mdiContentCopy,
  mdiCheck,
} from '@mdi/js';

const CATEGORY_RANK: Record<DeviceCategory, number> = {
  security: 0,
  entertainment: 1,
  climate: 2,
  lighting: 3,
  sensors: 4,
};

/** Amber "Unavailable" pill — hidden when the device is reachable. */
function AvailabilityPill({ available }: { available: boolean }) {
  if (available) return null;
  return (
    <span className="rounded-full bg-amber-500/15 px-ha-2 py-0.5 text-[13px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
      Unavailable
    </span>
  );
}

/**
 * Device icon tile — the product thumbnail (PNG under /public/devices) when one
 * exists, else the thematic mdi icon. Mirrors the device-card thumbnail rule so
 * the table reads the same as the dashboard.
 */
function DeviceIconTile({
  icon,
  thumbnail,
  tileClass,
  iconSize,
}: {
  icon: string;
  thumbnail?: string | null;
  tileClass: string;
  iconSize: number;
}) {
  const [failed, setFailed] = useState(false);

  if (thumbnail && !failed) {
    return (
      <div className={`${tileClass} bg-surface-low`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnail}
          alt=""
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${tileClass} bg-fill-primary-normal text-ha-blue`}>
      <Icon path={icon} size={iconSize} />
    </div>
  );
}

/** Secondary line: "Area · Integration" (whichever are known). */
function deviceMeta(device: DeviceSummary): string {
  const parts = [device.areaName, device.integrationName].filter(Boolean) as string[];
  return parts.join(' · ');
}

/** A single device row — the renderRow for DataListView. */
function DeviceRow({
  device,
  onSelect,
}: {
  device: DeviceSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(device.id)}
      className="group w-full flex items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-mid/50 active:bg-surface-mid"
    >
      <DeviceIconTile
        icon={device.icon}
        thumbnail={device.thumbnail}
        tileClass="w-9 h-9 flex items-center justify-center rounded-ha-xl flex-shrink-0 overflow-hidden"
        iconSize={18}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-ha-2 min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-text-primary truncate">
            {device.name}
          </p>
          <AvailabilityPill available={device.available} />
        </div>
        {deviceMeta(device) && (
          <p className="text-[13px] text-text-secondary truncate mt-0.5">{deviceMeta(device)}</p>
        )}
      </div>
      <NavChevron size={16} className="text-text-disabled flex-shrink-0" />
    </button>
  );
}

/** A single device tile — the renderCard for DataListView's grid layout. */
function DeviceTile({
  device,
  onSelect,
}: {
  device: DeviceSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(device.id)}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <DeviceIconTile
          icon={device.icon}
          thumbnail={device.thumbnail}
          tileClass="w-11 h-11 flex items-center justify-center rounded-ha-xl flex-shrink-0 overflow-hidden"
          iconSize={22}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight text-text-primary truncate">
            {device.name}
          </p>
          <div className="mt-0.5 flex items-center gap-ha-2">
            <span className="text-[13px] text-text-tertiary truncate">
              {device.areaName ?? (device.isService ? 'Service' : 'No area')}
            </span>
            <AvailabilityPill available={device.available} />
          </div>
        </div>
        <NavChevron size={16} className="text-text-disabled flex-shrink-0" />
      </div>
      <div className="mt-ha-3 flex items-center justify-between gap-ha-2">
        <p className="text-[13px] text-text-secondary truncate">
          {device.integrationName ?? 'Device'}
        </p>
      </div>
    </button>
  );
}

/**
 * Master view: the devices list in settings column 2. Supplies a typed
 * DataListConfig and lets the generic DataListView handle search / sort / group
 * / filter / layout — same pattern as IntegrationsTable.
 */
// A row is either a device you have or one the home found and is waiting on.
// Keeping them in one list means one search, one sort and one set of chips
// covers both — and a find is never somewhere you have to remember to go look.
type DeviceListRow = DeviceSummary | PendingRow;
const isPending = (row: DeviceListRow): row is PendingRow => 'kind' in row;

// Accessors that read either kind, so sort and column code stays one branch
// shallower than it would be spelling the union out at every call site.
const rowName = (r: DeviceListRow) => (isPending(r) ? r.title : r.name);
const rowArea = (r: DeviceListRow) => (isPending(r) ? '\uFFFF' : r.areaName ?? '\uFFFF');
const rowBrand = (r: DeviceListRow) => (isPending(r) ? r.subtitle : r.integrationName ?? '\uFFFF');
// Pending rows have no entities; a count sort should leave them on top, where
// the things still to do belong, not bury them under every populated device.
const rowEntities = (r: DeviceListRow) => (isPending(r) ? Infinity : r.entityCount);
/** Found before everything, dismissed after — whichever grouping is chosen. */
const pendingRank = (key: string) => (key === PENDING_GROUP.key ? -1 : key === IGNORED_GROUP.key ? 1 : 0);

export function DevicesTable({
  devices,
  onSelect,
  lastOpenedId,
}: {
  devices: DeviceSummary[];
  onSelect: (id: string) => void;
  lastOpenedId?: string | null;
}) {
  const pending = usePendingRows();
  const rows = useMemo<DeviceListRow[]>(() => [...pending, ...devices], [pending, devices]);

  const config = useMemo<DataListConfig<DeviceListRow>>(() => ({
    keyOf: (d) => d.id,
    searchText: (d) =>
      isPending(d)
        ? `${d.title} ${d.subtitle} ${d.foundBy} ${d.kind === 'found' ? 'found discovered new' : 'ignored not mine'}`
        : `${d.name} ${d.manufacturer ?? ''} ${d.model ?? ''} ${d.areaName ?? ''} ${d.integrationName ?? ''} ${d.isService ? 'service' : ''}`,
    searchPlaceholder: 'Search devices & services…',
    sortOptions: [
      { id: 'name', label: 'Name', compare: (a, b) => rowName(a).localeCompare(rowName(b)) },
      { id: 'entities', label: 'Entities', compare: (a, b) => rowEntities(b) - rowEntities(a) || rowName(a).localeCompare(rowName(b)) },
      { id: 'area', label: 'Area', compare: (a, b) => rowArea(a).localeCompare(rowArea(b)) || rowName(a).localeCompare(rowName(b)) },
    ],
    groupOptions: [
      {
        id: 'area',
        label: 'Area',
        groupOf: (d) =>
          isPending(d)
            ? (d.kind === 'found' ? PENDING_GROUP : IGNORED_GROUP)
            : d.isService
              ? { key: '⚙', title: 'Services' }
              : { key: d.areaId ?? '∅', title: d.areaName ?? 'No area' },
        compareGroups: (a, b) => {
          // Found first — it is the only group with something to do in it. Then
          // real areas A→Z, "No area", "Services", and the dismissed last.
          const rank = (k: string) =>
            k === PENDING_GROUP.key ? -1 : k === IGNORED_GROUP.key ? 3 : k === '⚙' ? 2 : k === '∅' ? 1 : 0;
          return rank(a.key) - rank(b.key) || a.title.localeCompare(b.title);
        },
      },
      {
        id: 'category',
        label: 'Type',
        groupOf: (d) =>
          isPending(d)
            ? (d.kind === 'found' ? PENDING_GROUP : IGNORED_GROUP)
            : { key: d.category, title: DEVICE_CATEGORY_LABEL[d.category] },
        compareGroups: (a, b) =>
          pendingRank(a.key) - pendingRank(b.key) ||
          (CATEGORY_RANK[a.key as DeviceCategory] ?? 0) - (CATEGORY_RANK[b.key as DeviceCategory] ?? 0),
      },
      {
        id: 'integration',
        label: 'Integration',
        groupOf: (d) =>
          isPending(d)
            ? (d.kind === 'found' ? PENDING_GROUP : IGNORED_GROUP)
            : { key: d.integration ?? '∅', title: d.integrationName ?? 'Other' },
        compareGroups: (a, b) => pendingRank(a.key) - pendingRank(b.key) || a.title.localeCompare(b.title),
      },
    ],
    defaultGroupId: 'area',
    filterGroups: [
      {
        // Both chips on by default (show everything); toggle one off to see
        // only physical devices or only service entries.
        id: 'kind',
        mode: 'facet',
        label: 'Show',
        chips: [
          { id: 'devices', label: 'Devices', predicate: (d) => !isPending(d) && !d.isService, defaultActive: true },
          { id: 'services', label: 'Services', predicate: (d) => !isPending(d) && d.isService, defaultActive: true },
          { id: 'found', label: 'Found', predicate: (d) => isPending(d) && d.kind === 'found', defaultActive: true },
          // Off by default: a dismissal is a decision you already made, and the
          // chip is how you go back and look at it.
          { id: 'ignored', label: 'Not yours', predicate: (d) => isPending(d) && d.kind === 'ignored' },
        ],
      },
      {
        id: 'availability',
        mode: 'facet',
        label: 'Availability',
        chips: [
          // A pending row has no availability to speak of, so neither chip should
          // be able to hide it — that is the "Show" row's job.
          { id: 'available', label: 'Available', predicate: (d) => isPending(d) || d.available, defaultActive: true },
          { id: 'unavailable', label: 'Unavailable', predicate: (d) => isPending(d) || !d.available },
        ],
      },
    ],
    renderRow: (d) => (isPending(d) ? <PendingListRow row={d} /> : <DeviceRow device={d} onSelect={onSelect} />),
    renderCard: (d) => (isPending(d) ? <PendingTile row={d} /> : <DeviceTile device={d} onSelect={onSelect} />),
    columns: [
      {
        id: 'name',
        header: 'Device',
        sortAccessor: (d) => rowName(d).toLowerCase(),
        cell: (d) =>
          isPending(d) ? (
            <PendingNameCell row={d} />
          ) : (
            <div className="flex items-center gap-ha-3">
              <DeviceIconTile
                icon={d.icon}
                thumbnail={d.thumbnail}
                tileClass="w-8 h-8 flex items-center justify-center rounded-ha-lg flex-shrink-0 overflow-hidden"
                iconSize={16}
              />
              <span className="min-w-0 flex items-center gap-ha-2">
                <span className="font-semibold text-text-primary truncate">{d.name}</span>
                <AvailabilityPill available={d.available} />
              </span>
            </div>
          ),
      },
      { id: 'area', header: 'Area', sortAccessor: (d) => rowArea(d).toLowerCase(), cell: (d) => (isPending(d) ? '—' : d.areaName ?? (d.isService ? 'Service' : 'No area')), hideBelow: 'sm' },
      { id: 'integration', header: 'Integration', sortAccessor: (d) => rowBrand(d).toLowerCase(), cell: (d) => (isPending(d) ? d.subtitle || '—' : d.integrationName ?? '—'), hideBelow: 'md' },
      {
        id: 'entities',
        header: 'Entities',
        align: 'right',
        sortAccessor: (d) => rowEntities(d),
        cell: (d) => (isPending(d) ? <span className="text-text-disabled">—</span> : <span className="tabular-nums">{d.entityCount}</span>),
      },
    ],
    // A pending row's buttons are the whole of it; there is no detail to open.
    onRowClick: (d) => { if (!isPending(d)) onSelect(d.id); },
    storageId: 'devices',
    fillHeight: true,
    defaultLayout: 'list',
    emptyLabel: 'No devices match these filters.',
    bg: 'surface-lower',
    highlightKey: lastOpenedId ?? undefined,
  }), [onSelect, lastOpenedId]);

  // Adding a device means adding the brand it belongs to, so "+ → Device" opens
  // the same brand store as "+ → Integration".
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DataListView items={rows} config={config} />
      <IntegrationStore />
    </div>
  );
}

// ── Detail view ─────────────────────────────────────────────────────────────

/**
 * One label/value row in the "Device info" card. Static by default; pass
 * `onClick` to make the whole row a button (with an optional `trailing`
 * affordance — a chevron for navigation, a copy glyph for copy-to-clipboard).
 */
function InfoRow({
  icon,
  label,
  value,
  onClick,
  trailing,
}: {
  icon: string;
  label: string;
  value: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const base =
    'flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 text-left border-b border-surface-low/40 last:border-0';
  const inner = (
    <>
      <Icon path={icon} size={16} className="text-text-tertiary flex-shrink-0" />
      <span className="text-[13px] text-text-secondary flex-1 min-w-0">{label}</span>
      <span className="text-[13px] font-medium text-text-primary text-right truncate max-w-[55%]">
        {value}
      </span>
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} transition-colors hover:bg-surface-low active:bg-surface-mid`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

/** A navigable info row — chevron trailing, routes on click. */
function NavInfoRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <InfoRow
      icon={icon}
      label={label}
      value={value}
      onClick={onClick}
      trailing={<NavChevron size={16} className="text-text-disabled flex-shrink-0" />}
    />
  );
}

/** A copyable info row — copies its value on click, glyph flips to a check. */
function CopyInfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <InfoRow
      icon={icon}
      label={label}
      value={value}
      onClick={() => copy(value)}
      trailing={
        <Icon
          path={copied ? mdiCheck : mdiContentCopy}
          size={15}
          className={`flex-shrink-0 ${copied ? 'text-green-500' : 'text-text-disabled'}`}
        />
      }
    />
  );
}

/** A controllable entity row — toggle for switchables, state label otherwise.
 *  The row itself opens the entity's more-info dialog (same as a dashboard card);
 *  the toggle stops propagation so flipping it never opens the dialog. */
function EntityControlRow({
  entity,
  deviceName,
  onOpen,
}: {
  entity: HassDevice['entities'][number];
  deviceName: string;
  onOpen: () => void;
}) {
  const { toggleEntity } = useHomeAssistant();
  const domain = entity.entity_id.split('.')[0];
  const toggleable = TOGGLEABLE.has(domain) && entity.state !== 'unavailable';
  const on = isOn(entity);

  // Border + container come from DataListView's row wrapper / section card.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex items-center gap-ha-3 px-ha-4 py-ha-3 cursor-pointer transition-colors hover:bg-surface-mid/40"
    >
      <div className={`w-8 h-8 flex items-center justify-center rounded-ha-lg flex-shrink-0 ${on ? 'bg-fill-primary-normal text-ha-blue' : 'bg-surface-mid text-text-secondary'}`}>
        <Icon path={domainIcon(entity)} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-text-primary truncate">
          {entityLabel(entity, deviceName)}
        </p>
        <p className="text-[13px] text-text-tertiary truncate mt-0.5">{entity.entity_id}</p>
      </div>
      {toggleable ? (
        <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
          <ToggleSwitch on={on} onToggle={() => toggleEntity(entity.entity_id, entity.state)} />
        </span>
      ) : (
        <span className="text-[13px] font-medium text-text-secondary flex-shrink-0">
          {stateLabel(entity)}
        </span>
      )}
    </div>
  );
}

type DeviceEntity = HassDevice['entities'][number];

/** Bucket an entity into the HA device-page sections (by domain). */
function entityBucket(e: DeviceEntity): { key: string; title: string } {
  const domain = e.entity_id.split('.')[0];
  if (
    TOGGLEABLE.has(domain) ||
    domain === 'climate' ||
    domain === 'vacuum' ||
    domain === 'number' ||
    domain === 'select' ||
    domain === 'button' ||
    domain === 'alarm_control_panel'
  ) {
    return { key: 'controls', title: 'Controls' };
  }
  if (domain === 'sensor' || domain === 'binary_sensor' || domain === 'weather') {
    return { key: 'sensors', title: 'Sensors' };
  }
  return { key: 'diagnostic', title: 'Diagnostic' };
}

const ENTITY_BUCKET_RANK: Record<string, number> = { controls: 0, sensors: 1, diagnostic: 2 };

/**
 * Body of the "Device info" sidebar — the device summary (icon, name,
 * availability, entity/control/sensor counts) plus the static metadata rows
 * (area, integration, manufacturer, model, device ID). Rendered inside the
 * reusable <SidePanel> chrome — docked rail on desktop, sheet on mobile.
 */
function DeviceInfoPanel({ device }: { device: DeviceSummary }) {
  const router = useRouter();
  const available = device.available;
  return (
    <div className="space-y-ha-5">
      {/* Summary — identity + availability. Entity/control/sensor counts live on
          the main column's section headers instead. */}
      <div className="flex items-start gap-ha-4">
        <DeviceIconTile
          icon={device.icon}
          thumbnail={device.thumbnail}
          tileClass="w-12 h-12 flex items-center justify-center rounded-ha-2xl flex-shrink-0 overflow-hidden"
          iconSize={26}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-text-primary truncate">{device.name}</h2>
          <div className="mt-ha-1 flex items-center gap-ha-2 text-sm">
            <Icon
              path={available ? mdiInformationOutline : mdiAlertCircleOutline}
              size={15}
              className={available ? 'text-green-500' : 'text-amber-500'}
            />
            <span className="text-text-secondary">
              {available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>

      {/* Device info — area + integration drill into their views; manufacturer,
          model and device ID copy to the clipboard on click. */}
      <div className="space-y-ha-2">
        <SectionLabel inset>Device info</SectionLabel>
        <div className="bg-surface-default rounded-ha-2xl border border-surface-lower overflow-hidden">
          {device.areaId ? (
            <NavInfoRow
              icon={mdiMapMarkerOutline}
              label="Area"
              value={device.areaName ?? 'Unknown'}
              onClick={() => router.push(`/room/${device.areaId}`)}
            />
          ) : (
            <InfoRow
              icon={mdiMapMarkerOutline}
              label="Area"
              value={device.isService ? 'Service — no area' : 'Not assigned'}
            />
          )}
          {device.integrationName ? (
            <NavInfoRow
              icon={mdiPuzzleOutline}
              label="Integration"
              value={device.integrationName}
              onClick={() => router.push('/settings/integrations')}
            />
          ) : (
            <InfoRow icon={mdiPuzzleOutline} label="Integration" value="Unknown" />
          )}
          {device.manufacturer && (
            <CopyInfoRow icon={mdiDevices} label="Manufacturer" value={device.manufacturer} />
          )}
          {device.model && (
            <CopyInfoRow icon={mdiTextureBox} label="Model" value={device.model} />
          )}
          <CopyInfoRow icon={mdiPound} label="Device ID" value={device.id} />
        </div>
      </div>
    </div>
  );
}

/**
 * Detail view: shown after drilling into a device row. Uses the live device hook
 * (state + toggles) and the static summary (area / integration metadata). Mirrors
 * Home Assistant's device page — entities split into Controls, Sensors and
 * Diagnostic buckets in the main column, with the summary + metadata moved to a
 * docked "Device info" sidebar (lg+) / bottom sheet (mobile), toggled from the
 * top-bar info icon — same pattern as the automation editor.
 */
export function DeviceDetailView({
  device,
  infoOpen = false,
  onCloseInfo,
}: {
  device: DeviceSummary;
  /** Whether the "Device info" sidebar is shown — driven by the top-bar toggle. */
  infoOpen?: boolean;
  /** Close the info sidebar (its X), kept in sync with the top-bar toggle. */
  onCloseInfo?: () => void;
}) {
  const { devices, services } = useDevices();
  const { haUrl, toggleEntity } = useHomeAssistant();
  // Services are kept out of `devices` (the dashboard set) — fall back to the
  // service list so drilling into a service row still shows its entities.
  const live = devices.find((d) => d.id === device.id) ?? services.find((d) => d.id === device.id);
  const entities = live?.entities ?? [];

  // Clicking an entity row opens its more-info dialog — the same EntityDetailPanel
  // the dashboard device cards use, in the shared ModalSheet.
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  // …so this sheet sits back under that dialog rather than vanishing behind it.
  const panelEntities = useMemo<PanelEntity[]>(() => entities.map((e) => {
    const dom = e.entity_id.split('.')[0];
    const isToggleable = TOGGLEABLE.has(dom);
    const isPressable = PRESSABLE.has(dom);
    const p = e.attributes.entity_picture as string | undefined;
    return {
      entityId: e.entity_id,
      icon: domainIcon(e),
      name: entityLabel(e, device.name),
      state: stateLabel(e),
      active: isOn(e),
      toggleable: isToggleable,
      pressable: isPressable,
      unit: (e.attributes.unit_of_measurement as string | undefined) ?? undefined,
      entityPicture: p ? (p.startsWith('http') ? p : `${haUrl}${p}`) : undefined,
      onToggle: (isToggleable || isPressable) ? () => toggleEntity(e.entity_id, e.state) : undefined,
    };
  }), [entities, device.name, haUrl, toggleEntity]);

  // Reuse the table view (DataListView) for the entity list: it supplies the
  // sticky search field, the Controls / Sensors / Diagnostic grouping (with
  // per-section count badges) and the rounded section cards — same component the
  // devices / integrations tables use.
  const entityConfig = useMemo<DataListConfig<DeviceEntity>>(() => ({
    keyOf: (e) => e.entity_id,
    searchText: (e) => `${entityLabel(e, device.name)} ${e.entity_id}`,
    searchPlaceholder: 'Search entities…',
    groupOptions: [
      {
        id: 'section',
        label: 'Section',
        groupOf: entityBucket,
        compareGroups: (a, b) => ENTITY_BUCKET_RANK[a.key] - ENTITY_BUCKET_RANK[b.key],
      },
    ],
    defaultGroupId: 'section',
    renderRow: (e) => (
      <EntityControlRow
        entity={e}
        deviceName={device.name}
        onOpen={() => setSelectedEntityId(e.entity_id)}
      />
    ),
    emptyLabel: 'No entities match.',
    bg: 'surface-lower',
  }), [device.name]);

  const infoBody = <DeviceInfoPanel device={device} />;
  const panelHeader = { title: 'Device info', onClose: onCloseInfo };

  return (
    <div className="flex items-start gap-ha-5">
      {/* Main column: the controllable / readable entities, then configuration.
          Fills the settings second column (matching the list/cards views); the
          summary + metadata live in the sidebar (below). */}
      <div className="min-w-0 flex-1 space-y-ha-6">
        {entities.length === 0 ? (
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-5 text-center text-sm text-text-tertiary">
            This device has no entities.
          </div>
        ) : (
          <DataListView items={entities} config={entityConfig} />
        )}

        {/* Configure (placeholder — production opens HA's device page) */}
        <div className="space-y-ha-2">
          <SectionLabel inset>Configuration</SectionLabel>
          <div className="flex items-center gap-ha-2 px-ha-4 py-ha-3 bg-surface-low rounded-ha-2xl border border-surface-lower">
            <Icon path={mdiOpenInNew} size={15} className="text-text-tertiary flex-shrink-0" />
            <span className="text-xs text-text-secondary">
              In production this opens the device page at{' '}
              <code className="font-mono text-text-secondary">/config/devices/device/{device.id}</code>
            </span>
          </div>
        </div>
      </div>

      {/* The device summary + metadata: a docked rail beside the list on a
          desktop, the same panel as a bottom sheet on a phone. */}
      <SidePanel
        open={infoOpen}
        onClose={() => onCloseInfo?.()}
        header={panelHeader}
        resizable
      >
        {infoBody}
      </SidePanel>

      {/* Entity more-info dialog — same panel the dashboard device cards open. */}
      <ModalSheet
        open={selectedEntityId !== null}
        onClose={() => setSelectedEntityId(null)}
        maxWidth={640}
      >
        {selectedEntityId !== null && panelEntities.length > 0 && (
          <EntityDetailPanel
            initialEntityId={selectedEntityId}
            entities={panelEntities}
            deviceName={device.name}
            deviceMeta={{
              deviceId: device.id,
              manufacturer: device.manufacturer,
              model: device.model,
              areaName: device.areaName,
              thumbnail: device.thumbnail,
              allEntities: entities.map((e) => ({
                entityId: e.entity_id,
                name: (e.attributes.friendly_name as string | undefined) ?? e.entity_id.split('.')[1],
                domain: e.entity_id.split('.')[0],
              })),
            }}
            onClose={() => setSelectedEntityId(null)}
          />
        )}
      </ModalSheet>
    </div>
  );
}
