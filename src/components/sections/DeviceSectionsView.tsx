'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { mdiChevronRight } from '@mdi/js';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { DeferredCard } from '@/components/cards/DeferredCard';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { Icon } from '@/components/ui/Icon';
import { useDevices, useHomeAssistant, useDeviceCardConfig } from '@/hooks';
import {
  entityDomain, entityLabel, stateLabel, isOn, TOGGLEABLE, domainIcon,
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

function useMasonryCols() {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const update = () => setCols(window.innerWidth >= 1024 ? 3 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

export function DeviceSectionsView({ sections }: DeviceSectionsViewProps) {
  const masonryCols = useMasonryCols();
  const { devices, areas } = useDevices();
  const { toggleEntity, haUrl } = useHomeAssistant();
  const { getConfig, setConfig } = useDeviceCardConfig();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');

  const selectedDevice = useMemo(
    () => devices.find(d => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const allPanelEntities = useMemo(() => {
    if (!selectedDevice) return [];
    const config = getConfig(selectedDevice.id);
    const visibleIds = config.slots.length === 0
      ? selectedDevice.entities.slice(0, 1).map(e => e.entity_id)
      : config.slots.filter(s => s.section === 'primary' || s.section === 'secondary').map(s => s.entity_id);
    return visibleIds.flatMap(eid => {
      const e = selectedDevice.entities.find(ent => ent.entity_id === eid);
      if (!e) return [];
      const dom = entityDomain(e);
      const isToggleable = TOGGLEABLE.has(dom);
      const isPressable = ['button', 'script', 'automation', 'input_button'].includes(dom);
      const p = e.attributes.entity_picture as string | undefined;
      return [{
        entityId: e.entity_id,
        icon: domainIcon(e),
        name: entityLabel(e, selectedDevice.name),
        state: stateLabel(e),
        active: isOn(e),
        toggleable: isToggleable,
        pressable: isPressable,
        unit: (e.attributes.unit_of_measurement as string | undefined) ?? undefined,
        entityPicture: p ? (p.startsWith('http') ? p : `${haUrl}${p}`) : undefined,
        onToggle: (isToggleable || isPressable) ? () => toggleEntity(e.entity_id, e.state) : undefined,
      }];
    });
  }, [selectedDevice, getConfig, toggleEntity, haUrl]);

  function selectEntity(deviceId: string, entityId: string) {
    setSelectedDeviceId(deviceId);
    setSelectedEntityId(entityId);
    setPanelMode('entity');
  }
  function closePanel() {
    setSelectedDeviceId(null);
    setSelectedEntityId(null);
    setPanelMode('entity');
  }

  const renderCard = (device: HassDevice) => {
    if (!device.primaryEntity) return null;
    const config = getConfig(device.id);
    const primarySlot = config.slots.find(s => s.section === 'primary');
    const secondarySlots = config.slots.filter(s => s.section === 'secondary');
    const displaySlots = config.slots.length === 0
      ? [{ entity_id: device.primaryEntity.entity_id, size: 'lg' as const }]
      : [
          ...(primarySlot ? [{ entity_id: primarySlot.entity_id, size: 'lg' as const }] : []),
          ...secondarySlots,
        ];
    const [primarySlotInfo, ...secondarySlotInfos] = displaySlots;
    const primaryEntity = device.entities.find(e => e.entity_id === primarySlotInfo?.entity_id) ?? device.primaryEntity;
    const p = primaryEntity.attributes.entity_picture as string | undefined;
    return (
      <DeviceCardV2
        key={device.id}
        selected={selectedDeviceId === device.id}
        primary={{
          entityId: primaryEntity.entity_id,
          icon: domainIcon(primaryEntity),
          name: device.name,
          state: stateLabel(primaryEntity),
          lastChanged: primaryEntity.last_changed,
          active: isOn(primaryEntity),
          entityPicture: p ? (p.startsWith('http') ? p : `${haUrl}${p}`) : undefined,
          unit: (primaryEntity.attributes.unit_of_measurement as string | undefined) ?? undefined,
          toggleable: TOGGLEABLE.has(entityDomain(primaryEntity)),
          onToggle: TOGGLEABLE.has(entityDomain(primaryEntity)) ? () => toggleEntity(primaryEntity.entity_id, primaryEntity.state) : undefined,
          onClick: () => selectEntity(device.id, primaryEntity.entity_id),
        }}
        secondary={secondarySlotInfos.flatMap(slot => {
          const e = device.entities.find(ent => ent.entity_id === slot.entity_id);
          if (!e) return [];
          const dom = entityDomain(e);
          const isToggleable = TOGGLEABLE.has(dom);
          const isPressable = ['button', 'script', 'automation', 'input_button'].includes(dom);
          return [{
            entityId: e.entity_id,
            icon: domainIcon(e),
            name: entityLabel(e, device.name),
            state: stateLabel(e),
            active: isOn(e),
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
      <div className="space-y-ha-6">
        {sections.map(section => {
          if (section.devices.length === 0) return null;
          const colArrays: HassDevice[][] = Array.from({ length: masonryCols }, () => []);
          section.devices.forEach((d, i) => colArrays[i % masonryCols].push(d));
          return (
            <div
              key={section.key}
              data-section-key={section.key}
              style={{ scrollMarginTop: 'calc(var(--dashboard-sticky-top, 0px) + var(--ha-space-2))' }}
            >
              <div className="py-ha-2 mb-ha-1">
                {section.href ? (
                  <Link href={section.href} prefetch={false} className="flex items-center gap-1 group w-fit">
                    <span className="text-base font-semibold text-text-primary group-hover:text-ha-blue transition-colors">{section.title}</span>
                    <Icon path={mdiChevronRight} size={16} className="text-text-tertiary group-hover:text-ha-blue transition-colors" />
                  </Link>
                ) : (
                  <span className="text-base font-semibold text-text-primary">{section.title}</span>
                )}
              </div>
              <div className="flex gap-ha-3 items-start">
                {colArrays.map((col, ci) => (
                  <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-3">
                    {col.map(device => (
                      <DeferredCard key={device.id}>{renderCard(device)}</DeferredCard>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ModalSheet open={!!selectedDevice && (panelMode === 'entity' || panelMode === 'edit')} onClose={closePanel}>
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
              allEntities: selectedDevice.entities.map(e => ({
                entityId: e.entity_id,
                name: (e.attributes.friendly_name as string | undefined) ?? e.entity_id.split('.')[1],
                domain: e.entity_id.split('.')[0],
              })),
            }}
            onClose={closePanel}
            onEditCard={() => setPanelMode('edit')}
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
