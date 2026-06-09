'use client';

import { useState, useEffect } from 'react';
import { mdiClose, mdiPencilOutline } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui';
import { EntityDetailBody, type PanelEntity } from './EntityDetailPanel';

interface ToggleSwitch {
  on?: boolean;
  onToggle: () => void;
}

function ToggleSwitchControl({ on, onToggle }: ToggleSwitch) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={clsx(
        'flex items-center shrink-0 w-9 h-[20px] rounded-full px-[3px] transition-colors',
        on ? 'bg-green-500' : 'bg-surface-mid hover:bg-surface-lower',
      )}
      role="switch"
      aria-checked={on}
    >
      <div className={clsx(
        'w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200',
        on ? 'translate-x-[18px]' : 'translate-x-0',
      )} />
    </button>
  );
}

export interface ExpandedCardEntity {
  entityId: string;
  icon: string;
  name: string;
  state: string;
  active?: boolean;
  size?: 'sm' | 'lg';
  toggleable?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
}

export interface DeviceCardExpandedProps {
  /** Primary entity shown in the hero */
  primary: ExpandedCardEntity;
  /** Secondary entity rows shown below the hero */
  secondary?: ExpandedCardEntity[];
  /** All visible entities passed to EntityDetailBody (for the detail panel) */
  panelEntities: PanelEntity[];
  /** Which entity to show in the detail panel initially */
  initialEntityId: string;
  onClose: () => void;
  onEditCard?: () => void;
}

export function DeviceCardExpanded({
  primary,
  secondary,
  panelEntities,
  initialEntityId,
  onClose,
  onEditCard,
}: DeviceCardExpandedProps) {
  const [activeEntityId, setActiveEntityId] = useState(initialEntityId);

  useEffect(() => {
    setActiveEntityId(initialEntityId);
  }, [initialEntityId]);

  const activeEntity = panelEntities.find(e => e.entityId === activeEntityId) ?? panelEntities[0];

  return (
    <div className="rounded-ha-2xl overflow-hidden bg-surface-default ha-selected relative">
      {/* Close + edit buttons */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        {onEditCard && (
          <button
            onClick={onEditCard}
            className="p-1.5 rounded-ha-lg bg-surface-default/80 backdrop-blur text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
          >
            <Icon path={mdiPencilOutline} size={16} />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-ha-lg bg-surface-default/80 backdrop-blur text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
        >
          <Icon path={mdiClose} size={16} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* ── LEFT: card content ────────────────────────────────────── */}
        <div className="lg:w-52 shrink-0">
          {/* Primary hero */}
          <div className={clsx(
            'flex flex-col justify-between px-3 pt-3 pb-3 min-h-[88px] relative',
            primary.active ? 'bg-green-500/10' : 'bg-surface-low',
          )}>
            <div className="flex items-center justify-between">
              <Icon
                path={primary.icon}
                size={20}
                className={primary.active ? 'text-green-500' : 'text-text-tertiary'}
              />
              {primary.toggleable && primary.onToggle && (
                <ToggleSwitchControl on={primary.active} onToggle={primary.onToggle} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight truncate pr-16">{primary.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">{primary.state}</p>
            </div>
          </div>

          {/* Secondary rows */}
          {secondary && secondary.map(entity => (
            <div
              key={entity.entityId}
              className="flex items-center gap-3 px-3 py-2 border-t border-surface-lower hover:bg-surface-low transition-colors cursor-pointer"
              onClick={entity.onClick}
            >
              {entity.size !== 'sm' && (
                <Icon
                  path={entity.icon}
                  size={16}
                  className={clsx('shrink-0', entity.active ? 'text-green-500' : 'text-text-tertiary')}
                />
              )}
              <span className={clsx(
                'flex-1 truncate',
                entity.size === 'sm' ? 'text-xs text-text-secondary' : 'text-sm text-text-primary',
              )}>
                {entity.name}
              </span>
              {entity.toggleable && entity.onToggle ? (
                <ToggleSwitchControl on={entity.active} onToggle={entity.onToggle} />
              ) : (
                <span className="text-xs text-text-secondary tabular-nums shrink-0">{entity.state}</span>
              )}
            </div>
          ))}
        </div>

        {/* ── RIGHT: entity detail ──────────────────────────────────── */}
        <div className="flex-1 border-t lg:border-t-0 lg:border-l border-surface-lower flex flex-col">
          {/* Entity detail body */}
          {activeEntity && (
            <EntityDetailBody key={activeEntity.entityId} entity={activeEntity} />
          )}

          {/* Features list */}
          {panelEntities.length > 0 && (
            <div className="border-t border-surface-lower">
              <SectionLabel className="px-ha-4 pt-ha-3 pb-ha-1">Features</SectionLabel>
              {panelEntities.map(entity => {
                const isActive = entity.entityId === activeEntityId;
                return (
                  <div
                    key={entity.entityId}
                    className={clsx(
                      'flex items-center gap-ha-3 px-ha-4 py-ha-2 cursor-pointer transition-colors',
                      isActive ? 'bg-fill-primary-normal' : 'hover:bg-surface-low',
                    )}
                    onClick={() => setActiveEntityId(entity.entityId)}
                  >
                    <div className={clsx(
                      'w-7 h-7 flex items-center justify-center shrink-0',
                      entity.toggleable
                        ? clsx('rounded-full', entity.active ? 'bg-green-500/15 text-green-500' : 'bg-surface-mid text-text-secondary')
                        : entity.active ? 'text-green-500' : 'text-text-tertiary',
                    )}>
                      <Icon path={entity.icon} size={16} />
                    </div>
                    <span className={clsx('flex-1 text-sm truncate', isActive ? 'text-ha-blue font-medium' : 'text-text-primary')}>
                      {entity.name}
                    </span>
                    <span className={clsx('text-xs tabular-nums shrink-0', isActive ? 'text-ha-blue' : 'text-text-secondary')}>
                      {entity.state}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
