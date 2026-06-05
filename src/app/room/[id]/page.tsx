'use client';

import { use, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { mdiArrowLeft } from '@mdi/js';
import { clsx } from 'clsx';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { PullToRevealPanel } from '@/components/sections';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { Icon } from '@/components/ui/Icon';
import { HALoader } from '@/components/ui/HALoader';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { useTheme, useDevices, useHomeAssistant, useDeviceCardConfig } from '@/hooks';
import { useDesktopImmersivePageLayout } from '@/hooks';
import Link from 'next/link';
import {
  entityDomain, entityLabel, stateLabel, isOn, TOGGLEABLE, domainIcon,
} from '@/lib/homeassistant/entityHelpers';

interface RoomPageProps {
  params: Promise<{ id: string }>;
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

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const masonryCols = useMasonryCols();
  const { isRevealed } = usePullToRevealContext();
  const { setHeader } = useHeader();
  const { background } = useTheme();
  const { devices, areas, loading } = useDevices();
  const { toggleEntity, haUrl } = useHomeAssistant();
  const { getConfig, setConfig } = useDeviceCardConfig();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle } = useDesktopImmersivePageLayout();

  const scrollableRef = useRef<HTMLElement | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');

  const areaName = areas.get(id) ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    setHeader({ title: areaName, subtitle: 'Home' });
  }, [setHeader, areaName]);

  // Devices belonging to this area
  const areaDevices = useMemo(
    () => devices.filter(d => d.areaId === id),
    [devices, id],
  );

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

  useEffect(() => {
    const el = scrollableRef.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTopGradient(scrollTop > 10);
      setShowBottomGradient(scrollHeight > clientHeight + 10 && scrollTop + clientHeight < scrollHeight - 10);
    };
    update();
    el.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);

  return (
    <>
      <PullToRevealPanel />

      <div
        className={clsx(
          'min-h-0 overflow-hidden',
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1',
          contentPaddingClasses,
          contentTransitionClasses,
        )}
        style={contentStyle}
      >
        <div className="h-full flex">
          <div className="flex-1 min-w-0 bg-surface-lower overflow-hidden rounded-ha-3xl relative">
            {showTopGradient && background !== 'image' && background !== 'gradient' && (
              <div className="absolute top-0 left-0 right-0 lg:left-14 lg:right-14 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20" />
            )}
            {showBottomGradient && background !== 'image' && background !== 'gradient' && (
              <div className="absolute bottom-0 left-0 right-0 lg:left-14 lg:right-14 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20" />
            )}

            {/* Back arrow — desktop left gutter */}
            <Link
              href="/"
              prefetch={false}
              className="hidden lg:flex group absolute inset-y-0 left-0 w-14 z-10 items-center justify-center"
            >
              <div className="absolute inset-0 rounded-l-ha-3xl bg-gradient-to-r from-transparent to-transparent group-hover:from-ha-blue/[0.06] group-hover:to-transparent transition-all duration-500 delay-0 group-hover:delay-150" />
              <Icon
                path={mdiArrowLeft}
                size={16}
                className="relative opacity-15 group-hover:opacity-100 group-hover:text-ha-blue group-hover:-translate-x-0.5 transition-all duration-500 delay-0 group-hover:delay-150 text-text-primary"
              />
            </Link>

            <main
              ref={el => { scrollableRef.current = el; }}
              className="h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide select-none px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-14 lg:pt-ha-5 lg:pb-ha-5"
              data-scrollable="dashboard"
            >
              <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
                <ApplicationViewNotice />

                {loading && <HALoader className="mb-ha-5" />}

                {loading && (() => {
                  const heights = [140, 88, 88, 88, 140, 88];
                  const colArrays: number[][] = Array.from({ length: masonryCols }, () => []);
                  heights.forEach((h, i) => colArrays[i % masonryCols].push(h));
                  return (
                    <div className="flex gap-ha-3 items-start">
                      {colArrays.map((col, ci) => (
                        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-3">
                          {col.map((h, j) => (
                            <div key={j} className="rounded-ha-2xl bg-surface-low animate-pulse" style={{ height: h }} />
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {!loading && areaDevices.length === 0 && (
                  <p className="text-sm text-text-secondary text-center py-ha-8">
                    No devices in this area.
                  </p>
                )}

                {!loading && areaDevices.length > 0 && (() => {
                  const colArrays: typeof areaDevices[] = Array.from({ length: masonryCols }, () => []);
                  areaDevices.forEach((d, i) => colArrays[i % masonryCols].push(d));
                  return (
                    <div className="flex gap-ha-3 items-start">
                      {colArrays.map((col, ci) => (
                        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-3">
                          {col.map(device => {
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
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Entity detail / card edit modal */}
      <ModalSheet open={!!selectedDevice && (panelMode === 'entity' || panelMode === 'edit')} onClose={closePanel}>
        {selectedDevice && panelMode === 'entity' && allPanelEntities.length > 0 && (
          <EntityDetailPanel
            initialEntityId={selectedEntityId ?? allPanelEntities[0].entityId}
            entities={allPanelEntities}
            deviceName={selectedDevice.name}
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
