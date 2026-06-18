'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { SectionLabel, DataListView, ToggleSwitch, NavChevron, Sidebar } from '../ui';
import type { DataListConfig } from '../ui';
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

function entityCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'entity' : 'entities'}`;
}

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
  return parts.length ? parts.join(' · ') : entityCountLabel(device.entityCount);
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
        <p className="text-[13px] text-text-secondary truncate mt-0.5">{deviceMeta(device)}</p>
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
              {device.areaName ?? 'No area'}
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
        <span className="text-[13px] text-text-tertiary flex-shrink-0">
          {entityCountLabel(device.entityCount)}
        </span>
      </div>
    </button>
  );
}

/**
 * Master view: the devices list in settings column 2. Supplies a typed
 * DataListConfig and lets the generic DataListView handle search / sort / group
 * / filter / layout — same pattern as IntegrationsTable.
 */
export function DevicesTable({
  devices,
  onSelect,
  lastOpenedId,
}: {
  devices: DeviceSummary[];
  onSelect: (id: string) => void;
  lastOpenedId?: string | null;
}) {
  const config = useMemo<DataListConfig<DeviceSummary>>(() => ({
    keyOf: (d) => d.id,
    searchText: (d) => `${d.name} ${d.manufacturer ?? ''} ${d.model ?? ''} ${d.areaName ?? ''} ${d.integrationName ?? ''}`,
    searchPlaceholder: 'Search devices…',
    sortOptions: [
      { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
      { id: 'entities', label: 'Entities', compare: (a, b) => b.entityCount - a.entityCount || a.name.localeCompare(b.name) },
      { id: 'area', label: 'Area', compare: (a, b) => (a.areaName ?? 'zzz').localeCompare(b.areaName ?? 'zzz') || a.name.localeCompare(b.name) },
    ],
    groupOptions: [
      {
        id: 'area',
        label: 'Area',
        groupOf: (d) => ({ key: d.areaId ?? '∅', title: d.areaName ?? 'No area' }),
        compareGroups: (a, b) => {
          // Real areas A→Z; the "No area" bucket sinks to the bottom.
          if (a.key === '∅') return 1;
          if (b.key === '∅') return -1;
          return a.title.localeCompare(b.title);
        },
      },
      {
        id: 'category',
        label: 'Type',
        groupOf: (d) => ({ key: d.category, title: DEVICE_CATEGORY_LABEL[d.category] }),
        compareGroups: (a, b) => CATEGORY_RANK[a.key as DeviceCategory] - CATEGORY_RANK[b.key as DeviceCategory],
      },
      {
        id: 'integration',
        label: 'Integration',
        groupOf: (d) => ({ key: d.integration ?? '∅', title: d.integrationName ?? 'Other' }),
        compareGroups: (a, b) => a.title.localeCompare(b.title),
      },
    ],
    defaultGroupId: 'area',
    filterGroups: [
      {
        id: 'availability',
        mode: 'facet',
        chips: [
          { id: 'available', label: 'Available', predicate: (d) => d.available, defaultActive: true },
          { id: 'unavailable', label: 'Unavailable', predicate: (d) => !d.available },
        ],
      },
    ],
    renderRow: (d) => <DeviceRow device={d} onSelect={onSelect} />,
    renderCard: (d) => <DeviceTile device={d} onSelect={onSelect} />,
    columns: [
      {
        id: 'name',
        header: 'Device',
        sortAccessor: (d) => d.name.toLowerCase(),
        cell: (d) => (
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
      { id: 'area', header: 'Area', sortAccessor: (d) => (d.areaName ?? '￿').toLowerCase(), cell: (d) => d.areaName ?? 'No area', hideBelow: 'sm' },
      { id: 'integration', header: 'Integration', sortAccessor: (d) => (d.integrationName ?? '￿').toLowerCase(), cell: (d) => d.integrationName ?? '—', hideBelow: 'md' },
      {
        id: 'entities',
        header: 'Entities',
        align: 'right',
        sortAccessor: (d) => d.entityCount,
        cell: (d) => <span className="tabular-nums">{d.entityCount}</span>,
      },
    ],
    onRowClick: (d) => onSelect(d.id),
    fillHeight: true,
    defaultLayout: 'list',
    emptyLabel: 'No devices match these filters.',
    bg: 'surface-lower',
    highlightKey: lastOpenedId ?? undefined,
  }), [onSelect, lastOpenedId]);

  return <DataListView items={devices} config={config} />;
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

/** A controllable entity row — toggle for switchables, state label otherwise. */
function EntityControlRow({
  entity,
  deviceName,
}: {
  entity: HassDevice['entities'][number];
  deviceName: string;
}) {
  const { toggleEntity } = useHomeAssistant();
  const domain = entity.entity_id.split('.')[0];
  const toggleable = TOGGLEABLE.has(domain) && entity.state !== 'unavailable';
  const on = isOn(entity);

  // Border + container come from DataListView's row wrapper / section card.
  return (
    <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
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
        <ToggleSwitch on={on} onToggle={() => toggleEntity(entity.entity_id, entity.state)} />
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
 * reusable <Sidebar> chrome on desktop and the mobile bottom sheet.
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
      <div className="space-y-ha-3">
        <SectionLabel className="px-ha-1">Device info</SectionLabel>
        <div className="bg-surface-default rounded-ha-2xl border border-surface-lower overflow-hidden">
          {device.areaId ? (
            <NavInfoRow
              icon={mdiMapMarkerOutline}
              label="Area"
              value={device.areaName ?? 'Unknown'}
              onClick={() => router.push(`/room/${device.areaId}`)}
            />
          ) : (
            <InfoRow icon={mdiMapMarkerOutline} label="Area" value="Not assigned" />
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
  const { devices } = useDevices();
  const live = devices.find((d) => d.id === device.id);
  const entities = live?.entities ?? [];

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
    renderRow: (e) => <EntityControlRow entity={e} deviceName={device.name} />,
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
        <div className="space-y-ha-3">
          <SectionLabel className="px-ha-1">Configuration</SectionLabel>
          <div className="flex items-center gap-ha-2 px-ha-4 py-ha-3 bg-surface-low rounded-ha-2xl border border-surface-lower">
            <Icon path={mdiOpenInNew} size={15} className="text-text-tertiary flex-shrink-0" />
            <span className="text-xs text-text-secondary">
              In production this opens the device page at{' '}
              <code className="font-mono text-text-secondary">/config/devices/device/{device.id}</code>
            </span>
          </div>
        </div>
      </div>

      {/* Right sidebar (lg+), sticky below the pinned title — the device summary
          and metadata. Hidden entirely when toggled off so the main column fills
          the width. */}
      {infoOpen && (
        <Sidebar
          resizable
          {...panelHeader}
          // z-20 lifts the sidebar above the ScrollColumn's z-10 top/bottom fade
          // gradients, so the fade only veils the scrolling main column — the
          // docked (non-scrolling) sidebar stays crisp.
          className="ha-pane-in sticky z-20 hidden flex-shrink-0 lg:flex"
          style={{
            top: 'calc(var(--settings-header-h, 0px) + 4px)',
            maxHeight: 'calc(100vh - var(--settings-header-h, 0px) - 24px)',
          }}
        >
          {infoBody}
        </Sidebar>
      )}

      {/* Below lg the same panel rises as a bottom sheet. Portaled to the body —
          the pane-transition wrapper is transformed during its animation, which
          would otherwise clip this fixed overlay to the page. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {infoOpen && (
            <>
              <motion.div
                key="device-sheet-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="lg:hidden fixed inset-0 z-[100] bg-black/40"
                onClick={() => onCloseInfo?.()}
              />
              <motion.div
                key="device-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="lg:hidden fixed inset-x-0 bottom-0 z-[100] px-ha-2"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
              >
                <div className="flex justify-center pb-ha-2">
                  <div className="h-1.5 w-9 rounded-full bg-white/40" />
                </div>
                <Sidebar {...panelHeader} className="flex max-h-[82vh]">
                  {infoBody}
                </Sidebar>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
