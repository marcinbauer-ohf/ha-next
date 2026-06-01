'use client';

import { useState, useEffect } from 'react';
import { mdiClose, mdiPencilOutline } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from '../ui/Icon';
import { Sparkline } from '../ui/Sparkline';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import type { HistoryPoint } from '@/lib/homeassistant/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OtherEntity {
  entityId: string;
  icon: string;
  name: string;
  state: string;
  active?: boolean;
  toggleable?: boolean;
  onToggle?: () => void;
  onClick: () => void;
}

export interface EntityDetailPanelProps {
  entityId: string;
  name: string;
  state: string;
  icon: string;
  active?: boolean;
  toggleable?: boolean;
  unit?: string;
  deviceName?: string;
  otherEntities?: OtherEntity[];
  onToggle?: () => void;
  onClose: () => void;
  onEditCard?: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntityDetailPanel({
  entityId,
  name,
  state,
  icon,
  active,
  toggleable,
  unit,
  deviceName,
  otherEntities,
  onToggle,
  onClose,
  onEditCard,
}: EntityDetailPanelProps) {
  const { getEntityHistory, connected, demoMode } = useHomeAssistant();
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    const base = parseFloat(state);
    if (demoMode || !connected) {
      if (isNaN(base)) {
        let s = Math.random() > 0.5 ? 1 : 0;
        setHistory(Array.from({ length: 48 }, (_, i) => {
          if (i > 0 && Math.random() < 0.12) s = s === 1 ? 0 : 1;
          return { s: s.toFixed(0) };
        }));
      } else {
        setHistory(Array.from({ length: 48 }, (_, i) => {
          const t = i / 48;
          const v = base + Math.sin(t * Math.PI * 4) * (base * 0.04) + Math.sin(t * Math.PI * 12) * (base * 0.015);
          return { s: v.toFixed(2) };
        }));
      }
      return;
    }
    setHistory([]);
    getEntityHistory(entityId, 48).then(pts => {
      const base2 = parseFloat(state);
      if (pts.length < 3 && !isNaN(base2)) {
        setHistory(Array.from({ length: 48 }, (_, i) => {
          const t = i / 48;
          const v = base2 + Math.sin(t * Math.PI * 3) * (base2 * 0.02);
          return { s: v.toFixed(2) };
        }));
      } else {
        setHistory(pts);
      }
    });
  }, [entityId, connected, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert history to numeric points
  const numericPoints = history
    .map((pt) => {
      const val = pt.s;
      if (val === 'on') return 1;
      if (val === 'off') return 0;
      return parseFloat(val);
    })
    .filter((v) => !isNaN(v));

  const sparklineId = `edp-${entityId.replace(/\./g, '-')}`;
  const isNumeric = !isNaN(parseFloat(state));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            {deviceName && (
              <span className="text-xs text-text-tertiary mb-1 truncate">{deviceName}</span>
            )}
            <h2 className="text-lg font-semibold text-text-primary leading-tight truncate">
              {name}
            </h2>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {onEditCard && (
              <button
                className="p-1.5 rounded-ha-lg text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
                onClick={onEditCard}
                title="Edit card"
              >
                <Icon path={mdiPencilOutline} size={18} />
              </button>
            )}
            <button
              className="p-1.5 rounded-ha-lg text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon path={mdiClose} size={20} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-4 h-px bg-surface-lower" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8 overflow-y-auto">
        {toggleable ? (
          /* Toggleable entity — big toggle button */
          <>
            {onToggle ? (
              <button
                className={clsx(
                  'w-24 h-24 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95',
                  active
                    ? 'bg-green-500/20 text-green-500 shadow-[0_0_40px_rgba(34,197,94,0.3)]'
                    : 'bg-surface-low text-text-secondary',
                )}
                onClick={onToggle}
                aria-label={active ? 'Turn off' : 'Turn on'}
              >
                <Icon path={icon} size={40} />
              </button>
            ) : (
              <div
                className={clsx(
                  'w-24 h-24 rounded-full flex items-center justify-center',
                  active
                    ? 'bg-green-500/20 text-green-500 shadow-[0_0_40px_rgba(34,197,94,0.3)]'
                    : 'bg-surface-low text-text-secondary',
                )}
              >
                <Icon path={icon} size={40} />
              </div>
            )}

            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-text-primary">{state}</span>
              <span className="text-sm text-text-secondary capitalize">{state}</span>
            </div>
          </>
        ) : (
          /* Sensor / read-only entity — big state value + sparkline */
          <>
            <div className="flex items-baseline justify-center">
              {isNumeric && unit ? (
                <>
                  <span className="text-5xl font-bold text-text-primary">{state}</span>
                  <span className="text-xl text-text-secondary ml-2">{unit}</span>
                </>
              ) : (
                <span className="text-3xl font-bold text-text-primary">{state}</span>
              )}
            </div>

            {numericPoints.length >= 3 && (
              <div className="w-full opacity-80">
                <Sparkline
                  points={numericPoints}
                  on={active ?? false}
                  gradientId={sparklineId}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Also on this device */}
      {otherEntities && otherEntities.length > 0 && (
        <div className="shrink-0 border-t border-surface-lower">
          <div className="px-ha-4 pt-ha-3 pb-ha-1">
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Also on this device
            </span>
          </div>
          <div className="pb-ha-2">
            {otherEntities.map(entity => (
              <div
                key={entity.entityId}
                className="flex items-center gap-ha-3 px-ha-4 py-ha-2 cursor-pointer hover:bg-surface-low transition-colors"
                onClick={entity.onClick}
              >
                <div className={clsx(
                  'w-7 h-7 flex items-center justify-center shrink-0',
                  entity.toggleable
                    ? clsx('rounded-full', entity.active ? 'bg-green-500/15 text-green-500' : 'bg-surface-mid text-text-secondary')
                    : entity.active ? 'text-green-500' : 'text-text-tertiary',
                )}>
                  <Icon path={entity.icon} size={16} />
                </div>
                <span className="flex-1 text-sm text-text-primary truncate">{entity.name}</span>
                <span className="text-xs tabular-nums text-text-secondary shrink-0">{entity.state}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
