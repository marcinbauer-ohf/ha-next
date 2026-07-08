'use client';

import { useState } from 'react';
import {
  mdiArrowLeft,
  mdiAutoFix,
  mdiCancel,
  mdiChartLineVariant,
  mdiCheck,
  mdiChevronDown,
  mdiClose,
  mdiDragVertical,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiImageOffOutline,
  mdiRestore,
  mdiStar,
  mdiStarOutline,
} from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { domainIcon, friendlyName, deviceThumbnail } from '@/lib/homeassistant/entityHelpers';
import { DEVICE_THUMBNAIL_GROUPS, deviceThumbnailPath } from '@/lib/deviceThumbnails';
import type { HassDevice } from '@/hooks/useDevices';
import type { EntitySlot, EntitySection, DeviceCardConfig } from '@/hooks/useDeviceCardConfig';

// Catalog label keyed by /devices/*.png path — labels the auto pick and the
// current selection in the thumbnail picker.
const THUMB_LABEL_BY_PATH: Record<string, string> = Object.fromEntries(
  DEVICE_THUMBNAIL_GROUPS.flatMap(g => g.items.map(it => [deviceThumbnailPath(it.file), it.label])),
);

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

// Selected-badge for a thumbnail tile — a ha-blue check in the top-right corner.
function ThumbCheck() {
  return (
    <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-ha-blue flex items-center justify-center shadow">
      <Icon path={mdiCheck} size={11} className="text-white" />
    </span>
  );
}

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
  const [thumbPickerOpen, setThumbPickerOpen] = useState(false);

  function update(next: EntitySlot[]) {
    setSlots(next);
    onSave({ ...config, slots: next });
  }

  // Thumbnail override. undefined = auto (deviceThumbnail picks off the entity),
  // null = none (mdi icon), string = a chosen /devices/*.png. Slots are left
  // untouched — the parent re-passes a fresh config after save.
  function setThumbnail(thumbnail: string | null | undefined) {
    onSave({ ...config, thumbnail });
  }

  // Auto pick + current resolved selection, for the picker's preview + labels.
  const autoThumb = device.primaryEntity ? deviceThumbnail(device.primaryEntity) : null;
  const primaryIcon = device.primaryEntity ? domainIcon(device.primaryEntity) : mdiImageOffOutline;
  const thumbMode: 'auto' | 'none' | 'custom' =
    config.thumbnail === undefined ? 'auto' : config.thumbnail === null ? 'none' : 'custom';
  const currentThumbSrc = thumbMode === 'auto' ? autoThumb : thumbMode === 'custom' ? config.thumbnail! : null;
  const currentThumbLabel =
    thumbMode === 'none' ? 'No image'
      : thumbMode === 'auto' ? (autoThumb ? `Auto · ${THUMB_LABEL_BY_PATH[autoThumb] ?? 'matched'}` : 'Auto · icon (no match)')
        : (THUMB_LABEL_BY_PATH[config.thumbnail!] ?? 'Custom');

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
        {/* Thumbnail — product render shown top-left of the card. */}
        <div className="px-ha-1 mt-ha-3 mb-ha-2">
          <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">Thumbnail</p>
          <p className="text-xs text-text-tertiary mt-0.5">Product image shown on the card</p>
        </div>

        <button
          onClick={() => setThumbPickerOpen(o => !o)}
          className="flex items-center gap-ha-3 rounded-ha-xl px-ha-3 py-ha-2 bg-surface-low hover:bg-surface-mid transition-colors text-left"
        >
          <div className="shrink-0 size-11 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden">
            {currentThumbSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentThumbSrc} alt="" className="size-full object-contain" />
            ) : (
              <Icon path={thumbMode === 'none' ? mdiImageOffOutline : primaryIcon} size={20} className="text-text-tertiary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary truncate">{currentThumbLabel}</p>
            <p className="text-xs text-text-tertiary">{thumbPickerOpen ? 'Tap an image below' : 'Tap to change'}</p>
          </div>
          <Icon path={mdiChevronDown} size={20} className={clsx('shrink-0 text-text-tertiary transition-transform', thumbPickerOpen && 'rotate-180')} />
        </button>

        {thumbPickerOpen && (
          <div className="mt-ha-2 rounded-ha-xl border-2 border-surface-lower p-ha-2 flex flex-col gap-ha-3">
            {/* Auto + None — the two non-catalog choices. */}
            <div className="flex flex-wrap gap-ha-2">
              <button
                onClick={() => setThumbnail(undefined)}
                title="Auto — based on the device type"
                className={clsx(
                  'relative size-14 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden border-2 transition-colors',
                  thumbMode === 'auto' ? 'border-ha-blue' : 'border-transparent hover:border-surface-mid',
                )}
              >
                {autoThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={autoThumb} alt="Auto" className="size-full object-contain p-1" />
                ) : (
                  <Icon path={primaryIcon} size={22} className="text-text-tertiary" />
                )}
                <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-0.5 bg-black/45 py-0.5 text-[9px] font-semibold text-white">
                  <Icon path={mdiAutoFix} size={9} className="text-white" />Auto
                </span>
                {thumbMode === 'auto' && <ThumbCheck />}
              </button>

              <button
                onClick={() => setThumbnail(null)}
                title="None — show the icon instead"
                className={clsx(
                  'relative size-14 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden border-2 transition-colors',
                  thumbMode === 'none' ? 'border-ha-blue' : 'border-transparent hover:border-surface-mid',
                )}
              >
                <Icon path={mdiImageOffOutline} size={22} className="text-text-tertiary" />
                <span className="absolute bottom-0 inset-x-0 text-center bg-black/45 py-0.5 text-[9px] font-semibold text-white">None</span>
                {thumbMode === 'none' && <ThumbCheck />}
              </button>
            </div>

            {/* Catalog, grouped. */}
            {DEVICE_THUMBNAIL_GROUPS.map(({ group, items }) => (
              <div key={group} className="flex flex-col gap-ha-1">
                <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider px-0.5">{group}</p>
                <div className="flex flex-wrap gap-ha-2">
                  {items.map(({ file, label }) => {
                    const path = deviceThumbnailPath(file);
                    const selected = config.thumbnail === path;
                    return (
                      <button
                        key={file}
                        onClick={() => setThumbnail(path)}
                        title={label}
                        className={clsx(
                          'relative size-14 rounded-ha-lg bg-surface-mid flex items-center justify-center overflow-hidden border-2 transition-colors',
                          selected ? 'border-ha-blue' : 'border-transparent hover:border-surface-mid',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={path} alt={label} className="size-full object-contain p-1" />
                        {selected && <ThumbCheck />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-surface-lower mx-ha-1 mt-ha-3" />

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
