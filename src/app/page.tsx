'use client';

import { useCallback, useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import { mdiHomeAssistant, mdiChevronDown, mdiChevronRight } from '@mdi/js';
import { clsx } from 'clsx';
import { DeviceCardV2 } from '@/components/cards/DeviceCardV2';
import { EntityDetailPanel } from '@/components/cards/EntityDetailPanel';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { MobileSummaryRow } from '@/components/sections';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { DashboardSidePanel } from '@/components/layout/DashboardSidePanel';
import { PullToRevealPanel } from '@/components/sections';
import { useTheme, useImmersiveMode, useHomeAssistant, useDevices, useDeviceCardConfig } from '@/hooks';
import { usePullToRevealContext, useHeader } from '@/contexts';
import { Icon } from '@/components/ui/Icon';
import {
  entityDomain, friendlyName, stateLabel, isOn, TOGGLEABLE,
  domainIcon, SECTION_ORDER, SECTION_TITLES,
} from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks';

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-ha-2 w-full text-left mb-ha-3 group"
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <span className="text-xs font-medium text-text-tertiary bg-surface-mid rounded-ha-pill px-ha-2 py-0.5">{count}</span>
        <span className="ml-auto text-text-secondary group-hover:text-text-primary transition-colors">
          <Icon path={open ? mdiChevronDown : mdiChevronRight} size={18} />
        </span>
      </button>
      {open && (
        <div className="grid gap-ha-3 items-start grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { background } = useTheme();
  const { immersiveMode, toggleImmersiveMode, immersivePhase } = useImmersiveMode();
  const scrollableRef = useRef<HTMLElement | null>(null);
  const { isRevealed } = usePullToRevealContext();
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const { setHeader } = useHeader();
  const { toggleEntity } = useHomeAssistant();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');

  const { devices, areas, loading } = useDevices();
  const { getConfig, setConfig } = useDeviceCardConfig();

  useEffect(() => {
    setHeader({ title: 'Home', icon: mdiHomeAssistant });
  }, [setHeader]);

  // Dashboard entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setDashboardReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Keyboard shortcut — immersive mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggleImmersiveMode(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleImmersiveMode]);

  // Scroll gradients
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

  const sections = useMemo(() => {
    type Sec = { key: string; title: string; devices: HassDevice[] };
    const ordered: Sec[] = [];

    if (areas.size > 0) {
      const byArea = new Map<string, HassDevice[]>();
      for (const device of devices) {
        const key = device.areaId ?? '__none__';
        if (!byArea.has(key)) byArea.set(key, []);
        byArea.get(key)!.push(device);
      }
      for (const [areaId, areaName] of areas) {
        if (byArea.has(areaId)) ordered.push({ key: areaId, title: areaName, devices: byArea.get(areaId)! });
      }
      if (byArea.has('__none__')) ordered.push({ key: '__none__', title: 'Other', devices: byArea.get('__none__')! });
    } else {
      const byDomain = new Map<string, HassDevice[]>();
      for (const device of devices) {
        if (!device.primaryEntity) continue;
        const domain = entityDomain(device.primaryEntity);
        if (!byDomain.has(domain)) byDomain.set(domain, []);
        byDomain.get(domain)!.push(device);
      }
      for (const domain of SECTION_ORDER) {
        if (byDomain.has(domain)) {
          ordered.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, devices: byDomain.get(domain)! });
          byDomain.delete(domain);
        }
      }
      for (const [domain, devs] of byDomain) {
        ordered.push({ key: domain, title: SECTION_TITLES[domain] ?? domain, devices: devs });
      }
    }
    return ordered;
  }, [devices, areas]);

  const selectedDevice = useMemo(
    () => devices.find(d => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );
  const selectedEntity = useMemo(
    () => selectedDevice?.entities.find(e => e.entity_id === selectedEntityId) ?? null,
    [selectedDevice, selectedEntityId],
  );

  // Other visible entities on the same device (secondary section, excluding the selected one)
  const otherPanelEntities = useMemo(() => {
    if (!selectedDevice || !selectedEntityId) return [];
    const config = getConfig(selectedDevice.id);
    const visibleIds = config.slots.length === 0
      ? selectedDevice.entities.map(e => e.entity_id)
      : config.slots.filter(s => s.section === 'primary' || s.section === 'secondary').map(s => s.entity_id);
    return visibleIds
      .filter(id => id !== selectedEntityId)
      .flatMap(id => {
        const e = selectedDevice.entities.find(ent => ent.entity_id === id);
        if (!e) return [];
        return [{
          entityId: e.entity_id,
          icon: domainIcon(e),
          name: friendlyName(e),
          state: stateLabel(e),
          active: isOn(e),
          toggleable: TOGGLEABLE.has(entityDomain(e)),
          onToggle: TOGGLEABLE.has(entityDomain(e)) ? () => toggleEntity(e.entity_id, e.state) : undefined,
          onClick: () => selectEntity(selectedDevice.id, e.entity_id),
        }];
      });
  }, [selectedDevice, selectedEntityId, getConfig, toggleEntity]);

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

  const isImmersiveFixed = immersivePhase !== 'normal';
  const isMobileImmersive = immersiveMode && !isImmersiveFixed;

  const statusBarHeight = 'calc(var(--ha-space-2) + 48px + var(--ha-edge-padding))';
  const compensatingPadding = {
    paddingLeft: 'calc(2 * var(--ha-edge-padding) + 64px)',
    paddingTop: 'calc(var(--ha-edge-padding) + 64px)',
    paddingRight: 'var(--ha-edge-padding)',
    paddingBottom: 0,
  };
  const expandedPadding = {
    paddingLeft: 'var(--ha-edge-padding)',
    paddingTop: 'var(--ha-edge-padding)',
    paddingRight: 'var(--ha-edge-padding)',
    paddingBottom: 0,
  };

  const contentStyle: CSSProperties = isImmersiveFixed ? {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: statusBarHeight, zIndex: 5, margin: 0, overflow: 'hidden',
    ...(immersivePhase === 'expanded' ? { ...expandedPadding, transition: 'padding 300ms ease-out' }
      : { ...compensatingPadding, transition: immersivePhase === 'preparing' ? 'none' : 'padding 300ms ease-out' }),
  } : {};

  const contentPaddingClasses = isImmersiveFixed
    ? ''
    : isMobileImmersive
      ? 'pb-0 lg:px-edge lg:pb-ha-0 lg:pr-edge'
      : 'px-edge pt-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] pb-[calc(var(--ha-edge-padding)*var(--mobile-ui-hidden-padding,0))] lg:pt-0 lg:pb-ha-0 lg:pr-edge';

  return (
    <>
      <PullToRevealPanel />

      <div
        className={clsx(
          'min-h-0 overflow-hidden',
          isRevealed ? 'flex-none h-0 opacity-0' : 'flex-1',
          contentPaddingClasses,
          immersivePhase === 'normal' ? 'transition-[flex,height,opacity,padding] duration-300 ease-out lg:transition-[flex,height,opacity]' : '',
        )}
        style={contentStyle}
      >
        <div className={clsx('h-full flex', selectedDeviceId ? 'gap-ha-3' : '')}>
          {/* Dashboard surface */}
          <div
            className={clsx(
              'flex-1 min-w-0 overflow-hidden transition-[opacity,transform,border-radius,background-color] duration-500 ease-out relative',
              dashboardReady ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.9]',
              isMobileImmersive ? 'bg-surface-lower rounded-none lg:rounded-ha-3xl' : 'bg-surface-lower rounded-ha-3xl',
            )}
          >
            {showTopGradient && background !== 'image' && background !== 'gradient' && (
              <div className="absolute top-0 left-0 right-0 lg:left-0 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20" />
            )}
            {showBottomGradient && background !== 'image' && background !== 'gradient' && (
              <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20" />
            )}

            <main
              ref={el => { scrollableRef.current = el; }}
              className={clsx(
                'h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide',
                'pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-ha-5',
                isMobileImmersive ? 'px-ha-4' : 'px-ha-1',
                'lg:px-0',
              )}
              data-scrollable="dashboard"
            >
              <MobileSummaryRow fullBleed={isMobileImmersive} />

              <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full space-y-ha-6">
                <ApplicationViewNotice />

                {loading && (
                  <div className="grid gap-ha-3 grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-[88px] rounded-ha-2xl bg-surface-low animate-pulse" />
                    ))}
                  </div>
                )}

                {!loading && sections.length === 0 && (
                  <p className="text-sm text-text-secondary text-center py-ha-8">
                    No devices found. Connect to Home Assistant to see your devices.
                  </p>
                )}

                {sections.map(({ key, title, devices: sectionDevices }) => (
                  <Section key={key} title={title} count={sectionDevices.length}>
                    {sectionDevices.map(device => {
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

                      return (
                        <DeviceCardV2
                          key={device.id}
                          selected={selectedDeviceId === device.id}
                          primary={{
                            entityId: primaryEntity.entity_id,
                            icon: domainIcon(primaryEntity),
                            name: device.name,
                            state: stateLabel(primaryEntity),
                            active: isOn(primaryEntity),
                            entityPicture: (primaryEntity.attributes.entity_picture as string | undefined) ?? undefined,
                            toggleable: TOGGLEABLE.has(entityDomain(primaryEntity)),
                            onToggle: TOGGLEABLE.has(entityDomain(primaryEntity)) ? () => toggleEntity(primaryEntity.entity_id, primaryEntity.state) : undefined,
                            onClick: () => selectEntity(device.id, primaryEntity.entity_id),
                          }}
                          secondary={secondarySlotInfos.flatMap(slot => {
                            const e = device.entities.find(ent => ent.entity_id === slot.entity_id);
                            if (!e) return [];
                            return [{
                              entityId: e.entity_id,
                              icon: domainIcon(e),
                              name: friendlyName(e),
                              state: stateLabel(e),
                              active: isOn(e),
                              size: slot.size,
                              toggleable: TOGGLEABLE.has(entityDomain(e)),
                              onToggle: TOGGLEABLE.has(entityDomain(e)) ? () => toggleEntity(e.entity_id, e.state) : undefined,
                              onClick: () => selectEntity(device.id, e.entity_id),
                            }];
                          })}
                        />
                      );
                    })}
                  </Section>
                ))}
              </div>
            </main>
          </div>

          {/* Side panel — entity detail or card edit */}
          <DashboardSidePanel open={!!selectedDeviceId} onClose={closePanel}>
            {selectedDevice && panelMode === 'edit' && (
              <DeviceCardEditPanel
                device={selectedDevice}
                config={getConfig(selectedDevice.id)}
                onSave={cfg => setConfig(selectedDevice.id, cfg)}
                onBack={() => setPanelMode('entity')}
                onClose={closePanel}
              />
            )}
            {selectedDevice && selectedEntity && panelMode === 'entity' && (
              <EntityDetailPanel
                entityId={selectedEntity.entity_id}
                name={friendlyName(selectedEntity)}
                state={stateLabel(selectedEntity)}
                icon={domainIcon(selectedEntity)}
                active={isOn(selectedEntity)}
                toggleable={TOGGLEABLE.has(entityDomain(selectedEntity))}
                unit={(selectedEntity.attributes.unit_of_measurement as string | undefined) ?? undefined}
                deviceName={selectedDevice.name}
                otherEntities={otherPanelEntities}
                onToggle={TOGGLEABLE.has(entityDomain(selectedEntity)) ? () => toggleEntity(selectedEntity.entity_id, selectedEntity.state) : undefined}
                onClose={closePanel}
                onEditCard={() => setPanelMode('edit')}
              />
            )}
          </DashboardSidePanel>
        </div>
      </div>
    </>
  );
}
