'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { mdiImageOffOutline } from '@mdi/js';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { DeferredCard } from '@/components/cards/DeferredCard';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { NavChevron } from '@/components/ui';
import { useDevices, useHomeAssistant, useDeviceCardConfig, useMasonryCols } from '@/hooks';
import {
  entityDomain, entityLabel, stateLabel, stateExtras, isOn, TOGGLEABLE, primaryCornerBadge, domainIcon, deviceFeedEntity, deviceThumbnail,
  PRESSABLE, panelEntitiesForDevice,
} from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

export interface DeviceSection {
  key: string;
  title: string;
  href?: string;
  devices: HassDevice[];
}

interface DeviceSectionsViewProps {
  sections: DeviceSection[];
}

// Non-sticky section header that scrolls away naturally. As it leaves the top
// of the scroll area, the page republishes its title into the top bar as a
// reversed breadcrumb (see useSectionCrumb) — same pattern as the home
// dashboard's Section.
function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="-mx-ha-1 px-ha-1 py-ha-2 mb-ha-1" data-section-header>
      {href ? (
        <Link href={href} prefetch={false} className="flex items-center gap-1 group w-fit">
          <span className="text-xl font-semibold text-text-primary group-hover:text-ha-blue transition-colors">{title}</span>
          <NavChevron size={18} className="text-text-tertiary group-hover:text-ha-blue" />
        </Link>
      ) : (
        <span className="text-xl font-semibold text-text-primary">{title}</span>
      )}
    </div>
  );
}

export function DeviceSectionsView({ sections }: DeviceSectionsViewProps) {
  const masonryCols = useMasonryCols();
  const { devices, areas } = useDevices();
  const { toggleEntity, haUrl } = useHomeAssistant();
  const { getConfig, setConfig } = useDeviceCardConfig();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');
  // The card last opened in the detail panel. Survives closing the panel so the
  // grid marks which card you came back from, and scrolls it back into view.
  const [lastOpenedDeviceId, setLastOpenedDeviceId] = useState<string | null>(null);
  const lastOpenedCardRef = useRef<HTMLDivElement | null>(null);

  const selectedDevice = useMemo(
    () => devices.find(d => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const allPanelEntities = useMemo(
    () => selectedDevice
      ? panelEntitiesForDevice(selectedDevice, getConfig(selectedDevice.id), toggleEntity, haUrl)
      : [],
    [selectedDevice, getConfig, toggleEntity, haUrl],
  );

  function selectEntity(deviceId: string, entityId: string) {
    setSelectedDeviceId(deviceId);
    setSelectedEntityId(entityId);
    setLastOpenedDeviceId(deviceId);
    setPanelMode('entity');
  }
  function closePanel() {
    setSelectedDeviceId(null);
    setSelectedEntityId(null);
    setPanelMode('entity');
  }

  // When the panel closes, bring the card we came back from into view (a no-op
  // if it's already visible). `block: 'nearest'` keeps the page from jumping.
  useEffect(() => {
    if (selectedDeviceId !== null || !lastOpenedDeviceId) return;
    lastOpenedCardRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedDeviceId, lastOpenedDeviceId]);

  // Primary-slot entity id mirrored onto the DeferredCard placeholder's
  // data-entity-id, so entity-locating features find offscreen cards while
  // unmounted — same as the home dashboard's cardPrimaryEntityId.
  const cardPrimaryEntityId = (device: HassDevice): string | undefined => {
    if (!device.primaryEntity) return undefined;
    const config = getConfig(device.id);
    const primarySlot = config.slots.find(s => s.section === 'primary');
    const firstId = config.slots.length === 0 ? device.primaryEntity.entity_id : primarySlot?.entity_id;
    return device.entities.find(e => e.entity_id === firstId)?.entity_id ?? device.primaryEntity.entity_id;
  };

  // Every entity hidden/disabled (and no camera/media feed) → nothing to show.
  // Drop the card so it isn't a dead tile that opens an empty detail sheet.
  // Un-hiding is done from the home dashboard's edit mode.
  const isCardEmpty = (device: HassDevice): boolean => {
    const config = getConfig(device.id);
    if (config.slots.length === 0) return false;
    if (config.slots.some(s => s.section === 'primary' || s.section === 'secondary')) return false;
    return !deviceFeedEntity(device.entities);
  };

  const renderCard = (device: HassDevice) => {
    if (!device.primaryEntity) return null;
    const config = getConfig(device.id);
    const primarySlot = config.slots.find(s => s.section === 'primary');
    const secondarySlots = config.slots.filter(s => s.section === 'secondary');
    const displaySlots: { entity_id: string; size: 'sm' | 'lg'; chart?: boolean }[] = config.slots.length === 0
      ? [{ entity_id: device.primaryEntity.entity_id, size: 'lg' as const }]
      : [
          ...(primarySlot ? [{ entity_id: primarySlot.entity_id, size: 'lg' as const }] : []),
          ...secondarySlots,
        ];
    const [primarySlotInfo, ...secondarySlotInfos] = displaySlots;
    const primaryEntity = device.entities.find(e => e.entity_id === primarySlotInfo?.entity_id) ?? device.primaryEntity;
    const primaryExtras = stateExtras(primaryEntity);
    const p = primaryEntity.attributes.entity_picture as string | undefined;
    const feedEntity = deviceFeedEntity(device.entities);
    const feedImage = feedEntity?.attributes.entity_picture
      ? (() => { const fp = feedEntity.attributes.entity_picture as string; return fp.startsWith('http') ? fp : `${haUrl}${fp}`; })()
      : undefined;
    const openEntity = feedEntity ?? primaryEntity;
    const corner = primaryCornerBadge(primaryEntity);
    return (
      <DeviceCardV2
        key={device.id}
        selected={selectedDeviceId === device.id}
        lastOpened={selectedDeviceId === null && lastOpenedDeviceId === device.id}
        feedImage={feedImage}
        primary={{
          entityId: primaryEntity.entity_id,
          icon: domainIcon(primaryEntity),
          // Thumbnail represents the DEVICE, not the chosen primary slot —
          // same rule as the home dashboard's renderCard. A manual override
          // from the edit panel wins (null = force the icon, no thumbnail).
          thumbnail: config.thumbnail !== undefined ? config.thumbnail : deviceThumbnail(device.primaryEntity),
          name: device.name,
          state: stateLabel(primaryEntity),
          details: primaryExtras.details,
          dotColor: primaryExtras.accentRgb ? `rgb(${primaryExtras.accentRgb.join(' ')})` : undefined,
          lastChanged: primaryEntity.last_changed,
          active: isOn(primaryEntity),
          entityPicture: p ? (p.startsWith('http') ? p : `${haUrl}${p}`) : undefined,
          unit: (primaryEntity.attributes.unit_of_measurement as string | undefined) ?? undefined,
          toggleable: TOGGLEABLE.has(entityDomain(primaryEntity)),
          corner: corner?.text,
          cornerLabel: corner?.label,
          onToggle: TOGGLEABLE.has(entityDomain(primaryEntity)) ? () => toggleEntity(primaryEntity.entity_id, primaryEntity.state) : undefined,
          onClick: () => selectEntity(device.id, openEntity.entity_id),
        }}
        secondary={secondarySlotInfos.flatMap(slot => {
          const e = device.entities.find(ent => ent.entity_id === slot.entity_id);
          if (!e) return [];
          const dom = entityDomain(e);
          const isToggleable = TOGGLEABLE.has(dom);
          const isPressable = PRESSABLE.has(dom);
          return [{
            entityId: e.entity_id,
            icon: domainIcon(e),
            name: entityLabel(e, device.name),
            state: stateLabel(e),
            active: isOn(e),
            unit: (e.attributes.unit_of_measurement as string | undefined) ?? undefined,
            chart: slot.chart,
            size: slot.size,
            toggleable: isToggleable,
            pressable: isPressable,
            onToggle: (isToggleable || isPressable) ? () => toggleEntity(e.entity_id, e.state) : undefined,
            onClick: () => selectEntity(device.id, e.entity_id),
          }];
        })}
      />
    );
  };

  return (
    <>
      <div className="space-y-ha-8">
        {sections.map(section => {
          const visibleDevices = section.devices.filter(d => !isCardEmpty(d));
          if (visibleDevices.length === 0) return null;
          const colArrays: HassDevice[][] = Array.from({ length: masonryCols }, () => []);
          visibleDevices.forEach((d, i) => colArrays[i % masonryCols].push(d));
          return (
            <div
              key={section.key}
              data-section-key={section.key}
              data-section-title={section.title}
              // Land jumps (scroll rail) below the top scroll fade, not under
              // it. The fade is h-12 (3rem) anchored at --app-topbar-clear.
              style={{ scrollMarginTop: 'calc(var(--app-topbar-clear, 0px) + var(--dashboard-sticky-top, 0px) + 3rem + var(--ha-space-2))' }}
            >
              <SectionHeader title={section.title} href={section.href} />
              <div className="flex gap-ha-4 items-start">
                {colArrays.map((col, ci) => (
                  <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-4">
                    {col.map(device => (
                      <div
                        key={device.id}
                        ref={device.id === lastOpenedDeviceId ? lastOpenedCardRef : undefined}
                      >
                        <DeferredCard entityId={cardPrimaryEntityId(device)}>{renderCard(device)}</DeferredCard>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ModalSheet open={!!selectedDevice && (panelMode === 'entity' || panelMode === 'edit')} onClose={closePanel} maxWidth={620} transitionKey={panelMode}>
        {selectedDevice && panelMode === 'entity' && allPanelEntities.length > 0 && (
          <EntityDetailPanel
            initialEntityId={selectedEntityId ?? allPanelEntities[0].entityId}
            entities={allPanelEntities}
            deviceName={selectedDevice.name}
            deviceMeta={{
              deviceId: selectedDevice.id,
              manufacturer: selectedDevice.manufacturer,
              model: selectedDevice.model,
              areaName: selectedDevice.areaId ? areas.get(selectedDevice.areaId) : undefined,
              thumbnail: (() => {
                const cfg = getConfig(selectedDevice.id);
                if (cfg.thumbnail !== undefined) return cfg.thumbnail;
                return selectedDevice.primaryEntity ? deviceThumbnail(selectedDevice.primaryEntity) : null;
              })(),
              allEntities: selectedDevice.entities.map(e => ({
                entityId: e.entity_id,
                name: (e.attributes.friendly_name as string | undefined) ?? e.entity_id.split('.')[1],
                domain: e.entity_id.split('.')[0],
              })),
            }}
            onClose={closePanel}
            onEditCard={() => setPanelMode('edit')}
            thumbnailPicker={{
              value: getConfig(selectedDevice.id).thumbnail,
              auto: selectedDevice.primaryEntity ? deviceThumbnail(selectedDevice.primaryEntity) : null,
              iconPath: selectedDevice.primaryEntity ? domainIcon(selectedDevice.primaryEntity) : mdiImageOffOutline,
              onChange: thumbnail => setConfig(selectedDevice.id, { ...getConfig(selectedDevice.id), thumbnail }),
            }}
          />
        )}
        {selectedDevice && panelMode === 'edit' && (
          <DeviceCardEditPanel
            device={selectedDevice}
            config={getConfig(selectedDevice.id)}
            onSave={cfg => setConfig(selectedDevice.id, cfg)}
            onBack={() => setPanelMode('entity')}
            onClose={closePanel}
          />
        )}
      </ModalSheet>
    </>
  );
}
