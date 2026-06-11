'use client';

import { useState } from 'react';
import {
  mdiArrowLeft,
  mdiCancel,
  mdiChartLineVariant,
  mdiCheck,
  mdiClose,
  mdiDragVertical,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiRestore,
  mdiStar,
  mdiStarOutline,
} from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { domainIcon, friendlyName } from '@/lib/homeassistant/entityHelpers';
import type { HassDevice } from '@/hooks/useDevices';
import type { EntitySlot, EntitySection, DeviceCardConfig } from '@/hooks/useDeviceCardConfig';

interface DeviceCardEditPanelProps {
  device: HassDevice;
  config: DeviceCardConfig;
  onSave: (config: DeviceCardConfig) => void;
  onBack: () => void;   // return to entity detail
  onClose: () => void;  // close the whole panel
  hideBack?: boolean;   // hide back arrow (dialog mode — Done is enough)
}

const SECTIONS: Array<{
  key: EntitySection;
  label: string;
  accent: string;
  hint: string;
}> = [
  { key: 'primary', label: 'Main', accent: 'border-ha-blue bg-fill-primary-quiet', hint: 'Big tile at the top of the card' },
  { key: 'secondary', label: 'Shown', accent: 'border-surface-mid bg-surface-low', hint: 'Listed below the main entity' },
  { key: 'hidden', label: 'Hidden', accent: 'border-surface-lower', hint: 'Not on the card, still active in HA' },
  { key: 'disabled', label: 'Disabled', accent: 'border-surface-lower', hint: 'Turned off in Home Assistant' },
];

export function DeviceCardEditPanel({ device, config, onSave, onBack, onClose, hideBack }: DeviceCardEditPanelProps) {
  // Initialise slots — if empty, put first entity as primary, rest as hidden
  const [slots, setSlots] = useState<EntitySlot[]>(() => {
    if (config.slots.length > 0) return config.slots;
    return device.entities.map((e, i) => ({
      entity_id: e.entity_id,
      size: 'lg' as const,
      section: (i === 0 ? 'primary' : 'hidden') as EntitySection,
    }));
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [overSection, setOverSection] = useState<EntitySection | null>(null);
  const [insertBeforeId, setInsertBeforeId] = useState<string | null>(null);

  function update(next: EntitySlot[]) {
    setSlots(next);
    onSave({ ...config, slots: next });
  }

  function toggleSize(entityId: string) {
    update(slots.map(s => s.entity_id === entityId ? { ...s, size: s.size === 'lg' ? 'sm' : 'lg' } : s));
  }

  // chart defaults to on (undefined = shown), so flip between false and true
  function toggleChart(entityId: string) {
    update(slots.map(s => s.entity_id === entityId ? { ...s, chart: s.chart === false } : s));
  }

  function moveToSection(entityId: string, section: EntitySection) {
    let next = slots.filter(s => s.entity_id !== entityId);
    if (section === 'primary') {
      next = next.map(s => s.section === 'primary' ? { ...s, section: 'secondary' as EntitySection } : s);
    }
    const existing = slots.find(s => s.entity_id === entityId);
    next.push({ entity_id: entityId, size: existing?.size ?? 'lg', section });
    update(next);
  }

  function reorderSecondary(entityId: string, beforeId: string | null) {
    const secondary = slots.filter(s => s.section === 'secondary');
    const others = slots.filter(s => s.section !== 'secondary');
    const item = secondary.find(s => s.entity_id === entityId);
    if (!item) return;
    const rest = secondary.filter(s => s.entity_id !== entityId);
    const idx = beforeId ? rest.findIndex(s => s.entity_id === beforeId) : -1;
    idx >= 0 ? rest.splice(idx, 0, item) : rest.push(item);
    update([...others, ...rest]);
  }

  function sectionDragOver(e: React.DragEvent, section: EntitySection) {
    e.preventDefault();
    setOverSection(section);
    if (section !== 'secondary') setInsertBeforeId(null);
  }

  function itemDragOver(e: React.DragEvent, entityId: string) {
    e.preventDefault();
    e.stopPropagation();
    setOverSection('secondary');
    setInsertBeforeId(entityId);
  }

  function drop(section: EntitySection) {
    if (!dragId) return;
    const fromSection = slots.find(s => s.entity_id === dragId)?.section;
    if (section === 'secondary' && fromSection === 'secondary') {
      reorderSecondary(dragId, insertBeforeId);
    } else if (section !== fromSection) {
      moveToSection(dragId, section);
    }
    setDragId(null);
    setOverSection(null);
    setInsertBeforeId(null);
  }

  const resolve = (id: string) => device.entities.find(e => e.entity_id === id);

  // Per-section quick actions — one-click alternative to dragging
  const quickActions = (key: EntitySection): Array<{ icon: string; title: string; to: EntitySection; active?: boolean }> => {
    switch (key) {
      case 'primary': return [
        { icon: mdiStar, title: 'Remove from main', to: 'secondary', active: true },
        { icon: mdiEyeOffOutline, title: 'Hide from card', to: 'hidden' },
        { icon: mdiCancel, title: 'Disable in HA', to: 'disabled' },
      ];
      case 'secondary': return [
        { icon: mdiStarOutline, title: 'Make main', to: 'primary' },
        { icon: mdiEyeOffOutline, title: 'Hide from card', to: 'hidden' },
        { icon: mdiCancel, title: 'Disable in HA', to: 'disabled' },
      ];
      case 'hidden': return [
        { icon: mdiEyeOutline, title: 'Show on card', to: 'secondary' },
        { icon: mdiCancel, title: 'Disable in HA', to: 'disabled' },
      ];
      case 'disabled': return [
        { icon: mdiRestore, title: 'Enable (stays hidden)', to: 'hidden' },
      ];
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-ha-2 px-ha-4 pt-ha-4 pb-ha-3 shrink-0">
        {!hideBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-ha-lg text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors shrink-0"
            title="Back"
          >
            <Icon path={mdiArrowLeft} size={24} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text-primary leading-tight truncate">{device.name}</h2>
          <p className="text-xs text-text-tertiary mt-0.5">Edit card entities</p>
        </div>

        <button
          onClick={onBack}
          className="shrink-0 flex items-center gap-1 px-ha-3 py-1 rounded-ha-lg text-sm font-semibold bg-ha-blue text-white hover:bg-ha-blue-dark shadow-none transition-colors"
        >
          <Icon path={mdiCheck} size={15} />
          Done
        </button>

        <button
          onClick={onClose}
          className="p-1 rounded-ha-lg text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors shrink-0"
          title="Close"
        >
          <Icon path={mdiClose} size={24} />
        </button>
      </div>

      <div className="h-px bg-surface-lower mx-ha-4 shrink-0" />

      {/* Sections */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-3 pb-ha-3 flex flex-col gap-ha-1">
        {SECTIONS.map(({ key, label, accent, hint }) => {
          const sectionSlots = slots.filter(s => s.section === key);
          const isOver = overSection === key;

          return (
            <div
              key={key}
              onDragOver={e => sectionDragOver(e, key)}
              onDrop={() => drop(key)}
            >
              <div className="px-ha-1 mt-ha-3 mb-ha-2">
                <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">{label}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{hint}</p>
              </div>

              <div className={clsx(
                'flex flex-col gap-1 rounded-ha-xl p-1 border-2 transition-colors min-h-[3rem]',
                isOver && dragId ? accent : sectionSlots.length === 0 ? 'border-dashed border-surface-lower' : 'border-transparent',
              )}>
                {sectionSlots.length === 0 ? (
                  <div className="flex items-center justify-center py-ha-3">
                    <span className="text-xs text-text-tertiary">Drag here</span>
                  </div>
                ) : (
                  sectionSlots.map(slot => {
                    const entity = resolve(slot.entity_id);
                    if (!entity) return null;
                    const isDimmed = key === 'hidden' || key === 'disabled';
                    const isInsertBefore = key === 'secondary' && insertBeforeId === slot.entity_id && dragId !== slot.entity_id;
                    return (
                      <div key={slot.entity_id}>
                        <div className={clsx('h-0.5 rounded-full mb-1 transition-opacity', isInsertBefore ? 'bg-ha-blue opacity-100' : 'opacity-0')} />
                        <div
                          draggable
                          onDragStart={() => setDragId(slot.entity_id)}
                          onDragEnd={() => { setDragId(null); setOverSection(null); setInsertBeforeId(null); }}
                          onDragOver={key === 'secondary' ? e => itemDragOver(e, slot.entity_id) : undefined}
                          className={clsx(
                            'flex items-center gap-ha-2 rounded-ha-xl px-ha-3 py-ha-2 transition-opacity',
                            isDimmed ? 'bg-surface-low/50' : 'bg-surface-low',
                            dragId === slot.entity_id && 'opacity-40',
                          )}
                        >
                          <div className={clsx('cursor-grab active:cursor-grabbing shrink-0', isDimmed ? 'text-text-tertiary/50' : 'text-text-tertiary')}>
                            <Icon path={mdiDragVertical} size={20} />
                          </div>
                          <div className={clsx('shrink-0', isDimmed ? 'text-text-tertiary' : 'text-text-secondary')}>
                            <Icon path={domainIcon(entity)} size={16} />
                          </div>
                          <span className={clsx('flex-1 text-sm truncate min-w-0', isDimmed ? 'text-text-tertiary line-through' : 'text-text-primary')}>
                            {friendlyName(entity)}
                          </span>
                          {key === 'secondary' && entity.attributes.unit_of_measurement != null && (
                            <button
                              onClick={() => toggleChart(slot.entity_id)}
                              title={slot.chart === false ? 'Show graph on card' : 'Hide graph on card'}
                              className={clsx(
                                'p-1 rounded-ha-md transition-colors shrink-0',
                                slot.chart !== false
                                  ? 'text-ha-blue hover:text-text-primary hover:bg-surface-mid'
                                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-mid',
                              )}
                            >
                              <Icon path={mdiChartLineVariant} size={16} />
                            </button>
                          )}
                          {key === 'secondary' && (
                            <div className="flex rounded-ha-lg overflow-hidden border border-surface-lower shrink-0">
                              <button
                                onClick={() => slot.size !== 'sm' && toggleSize(slot.entity_id)}
                                className={clsx('px-ha-2 py-0.5 text-xs font-medium transition-colors', slot.size === 'sm' ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:bg-surface-mid')}
                              >S</button>
                              <button
                                onClick={() => slot.size !== 'lg' && toggleSize(slot.entity_id)}
                                className={clsx('px-ha-2 py-0.5 text-xs font-medium transition-colors', slot.size === 'lg' ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:bg-surface-mid')}
                              >L</button>
                            </div>
                          )}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {quickActions(key).map(action => (
                              <button
                                key={action.title}
                                onClick={() => moveToSection(slot.entity_id, action.to)}
                                title={action.title}
                                className={clsx(
                                  'p-1 rounded-ha-md transition-colors',
                                  action.active
                                    ? 'text-ha-blue hover:text-text-primary hover:bg-surface-mid'
                                    : 'text-text-tertiary hover:text-text-primary hover:bg-surface-mid',
                                )}
                              >
                                <Icon path={action.icon} size={16} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className={clsx('h-0.5 rounded-full mt-1 transition-opacity', key === 'secondary' && isOver && !insertBeforeId && dragId ? 'bg-ha-blue opacity-100' : 'opacity-0')} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
