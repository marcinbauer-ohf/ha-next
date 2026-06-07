'use client';

import { useState } from 'react';
import {
  mdiArrowLeft,
  mdiCheck,
  mdiClose,
  mdiDragVertical,
  mdiInformationOutline,
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
  tooltip?: string;
}> = [
  { key: 'primary', label: 'Primary', accent: 'border-ha-blue bg-fill-primary-quiet' },
  { key: 'secondary', label: 'Secondary', accent: 'border-surface-mid bg-surface-low' },
  {
    key: 'hidden', label: 'Hidden', accent: 'border-surface-lower',
    tooltip: 'Hidden entities are still active in HA — they just won\'t appear on the card.',
  },
  {
    key: 'disabled', label: 'Disabled', accent: 'border-surface-lower',
    tooltip: 'Disabled entities are fully turned off in HA and stop being polled.',
  },
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
            <Icon path={mdiArrowLeft} size={18} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text-primary leading-tight truncate">{device.name}</h2>
          <p className="text-xs text-text-tertiary mt-0.5">Edit card entities</p>
        </div>

        <button
          onClick={onBack}
          className="shrink-0 flex items-center gap-1 px-ha-3 py-1 rounded-ha-lg text-sm font-semibold bg-fill-primary-normal text-ha-blue hover:bg-fill-primary-quiet transition-colors"
        >
          <Icon path={mdiCheck} size={15} />
          Done
        </button>

        <button
          onClick={onClose}
          className="p-1 rounded-ha-lg text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors shrink-0"
          title="Close"
        >
          <Icon path={mdiClose} size={18} />
        </button>
      </div>

      <div className="h-px bg-surface-lower mx-ha-4 shrink-0" />

      {/* Sections */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-3 pb-ha-3 flex flex-col gap-ha-1">
        {SECTIONS.map(({ key, label, accent, tooltip }) => {
          const sectionSlots = slots.filter(s => s.section === key);
          const isOver = overSection === key;

          return (
            <div
              key={key}
              onDragOver={e => sectionDragOver(e, key)}
              onDrop={() => drop(key)}
            >
              <div className="flex items-center gap-ha-1 px-ha-1 mt-ha-3 mb-ha-2">
                <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">{label}</p>
                {tooltip && (
                  <div className="relative group">
                    <button className="text-text-tertiary hover:text-text-secondary flex items-center" tabIndex={-1}>
                      <Icon path={mdiInformationOutline} size={13} />
                    </button>
                    <div className="absolute left-0 top-full mt-1.5 w-56 px-ha-3 py-ha-2 bg-surface-default border border-surface-lower rounded-ha-xl text-xs text-text-secondary leading-relaxed z-50 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 normal-case font-normal tracking-normal">
                      {tooltip}
                    </div>
                  </div>
                )}
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
