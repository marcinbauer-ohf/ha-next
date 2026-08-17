'use client';

import { useState } from 'react';
import {
  mdiArrowDownBoldBoxOutline,
  mdiArrowUpBoldBox,
  mdiArrowUpBoldBoxOutline,
  mdiCancel,
  mdiChartLineVariant,
  mdiCheck,
  mdiClose,
  mdiDragHorizontalVariant,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiRestore,
} from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { ListSection } from '../ui/ListSection';
import { domainIcon, entityLabel, entityDomain } from '@/lib/homeassistant/entityHelpers';
import type { HassEntity } from '@/lib/homeassistant/types';
import type { HassDevice } from '@/hooks/useDevices';
import type { EntitySlot, EntitySection, DeviceCardConfig } from '@/hooks/useDeviceCardConfig';

interface DeviceCardEditPanelProps {
  device: HassDevice;
  config: DeviceCardConfig;
  onSave: (config: DeviceCardConfig) => void;
  onBack: () => void;   // what Done does — back to entity detail, or close
  onClose: () => void;  // close the whole panel
}

// `icon` matches the row button that moves an entity into this section (eye /
// eye-off / cancel), so the heading and the control that gets you there read as
// the same thing. Main is "raise it to the top of the card" — an arrow into a
// box. Not a star (that means favourite everywhere else), not a pin (that means
// pinned to a bar), and not a card diagram, which read as decoration.
// `hint` is only shown while the section is empty — see the drop zone below.
const SECTIONS: Array<{
  key: EntitySection;
  label: string;
  hint: string;
  icon: string;
}> = [
  { key: 'primary', label: 'Main', hint: 'Drag one here for the big tile at the top of the card', icon: mdiArrowUpBoldBox },
  { key: 'secondary', label: 'Secondary', hint: 'Drag here to list below the main entity', icon: mdiEyeOutline },
  { key: 'hidden', label: 'Hidden', hint: 'Drag here to take it off the card — it stays active in Home Assistant', icon: mdiEyeOffOutline },
  { key: 'disabled', label: 'Disabled', hint: 'Drag here to turn it off in Home Assistant', icon: mdiCancel },
];

// Humanize a snake/kebab token — "binary_sensor" → "Binary sensor".
function humanize(token: string): string {
  const t = token.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Short descriptor for an entity row: unit if it has one, else device_class,
// else the domain. e.g. "°C", "Temperature", "Light".
function entityMeta(entity: HassEntity): string {
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  if (unit) return unit;
  const deviceClass = entity.attributes.device_class as string | undefined;
  return humanize(deviceClass ?? entityDomain(entity));
}

export function DeviceCardEditPanel({ device, config, onSave, onBack, onClose }: DeviceCardEditPanelProps) {
  // Initialise slots — if empty, put first entity as primary, rest as hidden
  const [slots, setSlots] = useState<EntitySlot[]>(() => {
    if (config.slots.length > 0) return config.slots;
    return device.entities.map((e, i) => ({
      entity_id: e.entity_id,
      size: 'lg' as const,
      section: (i === 0 ? 'primary' : 'hidden') as EntitySection,
    }));
  });

  function update(next: EntitySlot[]) {
    setSlots(next);
    onSave({ ...config, slots: next });
  }

  // chart defaults to on (undefined = shown), so flip between false and true
  function toggleChart(entityId: string) {
    update(slots.map(s => s.entity_id === entityId ? { ...s, chart: s.chart === false } : s));
  }

  /**
   * One move for every gesture: drop into another section, reorder inside one,
   * or a quick-action button (which is just a drop at the end). Order inside a
   * section is array order, so placing = splice at `beforeId`.
   */
  function place(entityId: string, section: EntitySection, beforeId: string | null) {
    const existing = slots.find(s => s.entity_id === entityId);
    if (!existing) return;
    if (beforeId === entityId) return;
    let rest = slots.filter(s => s.entity_id !== entityId);
    // Only one main entity — whoever held the slot slides down to Secondary.
    if (section === 'primary') {
      rest = rest.map(s => s.section === 'primary' ? { ...s, section: 'secondary' as EntitySection } : s);
    }
    const moved: EntitySlot = { ...existing, section };
    const idx = beforeId ? rest.findIndex(s => s.entity_id === beforeId) : -1;
    if (idx >= 0) rest.splice(idx, 0, moved); else rest.push(moved);
    update(rest);
  }

  const resolve = (id: string) => device.entities.find(e => e.entity_id === id);

  // Per-section quick actions — one-click alternative to dragging
  const quickActions = (key: EntitySection): Array<{ icon: string; title: string; to: EntitySection; active?: boolean }> => {
    switch (key) {
      case 'primary': return [
        { icon: mdiArrowDownBoldBoxOutline, title: 'Move down to Secondary', to: 'secondary' },
        { icon: mdiEyeOffOutline, title: 'Hide from card', to: 'hidden' },
        { icon: mdiCancel, title: 'Disable in HA', to: 'disabled' },
      ];
      case 'secondary': return [
        { icon: mdiArrowUpBoldBoxOutline, title: 'Make main', to: 'primary' },
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
      {/* Header — the same row as EntityDetailPanel's, glyph for glyph: 20px
          close at the same 16px inset, 13px eyebrow over an `text-xl` title,
          everything centred on one line. The dialog crossfades between the two
          panels, so a taller row or a bigger title reads as the whole dialog
          lurching. No back arrow: Done already returns where you came from, and
          a third "leave" control only squeezed the name. */}
      <div className="flex items-center justify-between gap-ha-2 p-ha-4 pb-ha-2 shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors shrink-0"
          title="Close"
          aria-label="Close"
        >
          <Icon path={mdiClose} size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-none text-text-tertiary">Editing card</p>
          <p className="truncate text-xl font-bold leading-tight text-text-primary">{device.name}</p>
        </div>

        <button
          onClick={onBack}
          className="shrink-0 flex items-center gap-1 px-ha-3 py-2 rounded-full text-sm font-semibold bg-ha-blue text-white hover:bg-ha-blue-dark shadow-none transition-colors"
        >
          <Icon path={mdiCheck} size={15} />
          Done
        </button>
      </div>

      {/* Sections — the app's grouped-list pattern: an inset uppercase heading
          floating above one bordered card whose rows divide themselves. Same
          shape as "On this device", settings groups and the history log. */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-3 pb-ha-3 flex flex-col gap-ha-4 pt-ha-2">
        {SECTIONS.map(({ key, label, hint, icon }) => {
          const sectionSlots = slots.filter(s => s.section === key);

          return (
            <div key={key}>
              <ListSection
                title={
                  <span className="flex items-center gap-1.5">
                    <Icon path={icon} size={14} className="shrink-0 text-text-tertiary" />
                    {label}
                  </span>
                }
                // Dragging, the landing line and the drop highlight all come from
                // ListSection now — a row dragged from another section reports its
                // own id, so this one handler covers both moves and reorders.
                onReorder={(fromId, beforeId) => place(fromId, key, beforeId)}
              >
                {sectionSlots.length === 0 ? (
                  // The explanation lives in the empty drop zone, so it teaches
                  // while the section is empty and gets out of the way the moment
                  // there's something to read instead.
                  <div className="flex items-center justify-center px-ha-4 py-ha-4">
                    <span className="text-xs text-text-tertiary text-center text-balance">{hint}</span>
                  </div>
                ) : (
                  sectionSlots.map(slot => {
                    const entity = resolve(slot.entity_id);
                    if (!entity) return null;
                    const isDimmed = key === 'hidden' || key === 'disabled';
                    const meta = entityMeta(entity);
                    return (
                        <div
                          key={slot.entity_id}
                          className={clsx(
                            'flex items-center gap-ha-2 px-ha-4 py-ha-2 transition-opacity',
                            isDimmed && 'opacity-70',
                          )}
                        >
                          <div className={clsx('cursor-grab active:cursor-grabbing shrink-0', isDimmed ? 'text-text-tertiary/50' : 'text-text-tertiary')}>
                            <Icon path={mdiDragHorizontalVariant} size={20} />
                          </div>
                          <div className={clsx('shrink-0', isDimmed ? 'text-text-tertiary' : 'text-text-secondary')}>
                            <Icon path={domainIcon(entity)} size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Dimmed, not struck through: hidden/disabled rows are
                                still real entities you may promote back, and the
                                strike read as "deleted". */}
                            <span className={clsx('block text-sm truncate', isDimmed ? 'text-text-tertiary' : 'text-text-primary')}>
                              {/* The device name is already the panel's heading —
                                  rows show only what distinguishes them. */}
                              {entityLabel(entity, device.name)}
                            </span>
                          </div>
                          {/* Unit / type at the end of the row, just before the
                              actions — at every width. As a second line on the
                              phone it doubled the row height to say "kWh". */}
                          <span className="text-xs text-text-tertiary shrink-0 max-w-[8rem] truncate">
                            {meta}
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
                                onClick={() => place(slot.entity_id, action.to, null)}
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
                    );
                  })
                )}
              </ListSection>
            </div>
          );
        })}
      </div>
    </div>
  );
}
