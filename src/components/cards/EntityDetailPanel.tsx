'use client';

import { useState, useEffect } from 'react';
import { mdiClose, mdiPencilOutline, mdiPower } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon, ListSection, RollingNumericValue, SegmentedControl } from '../ui';
import { Sparkline } from '../ui/Sparkline';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import type { HistoryPoint } from '@/lib/homeassistant/types';

// ── Graph config types ────────────────────────────────────────────────────────

const TIME_SPANS = [
  { value: '1h',  label: '1h',  hours: 1 },
  { value: '6h',  label: '6h',  hours: 6 },
  { value: '24h', label: '24h', hours: 24 },
  { value: '7d',  label: '7d',  hours: 168 },
] as const;
type TimeSpan = typeof TIME_SPANS[number]['value'];

const AGGREGATIONS = [
  { value: 'auto',   label: 'Auto' },
  { value: 'raw',    label: 'Raw' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily',  label: 'Daily' },
] as const;
type Aggregation = typeof AGGREGATIONS[number]['value'];

function applyAggregation(
  data: { value: number; ts: number | null }[],
  aggregation: Aggregation,
  hours: number,
): { value: number; ts: number | null }[] {
  const mode = aggregation === 'auto'
    ? (hours <= 24 ? 'raw' : hours <= 48 ? 'hourly' : 'daily')
    : aggregation;

  if (mode === 'raw') return data;

  const bucketSec = mode === 'daily' ? 86400 : 3600;
  const nowSec = Date.now() / 1000;
  const startSec = nowSec - hours * 3600;
  const buckets = new Map<number, number[]>();

  for (const pt of data) {
    const t = pt.ts ?? nowSec;
    const b = Math.floor((t - startSec) / bucketSec);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push(pt.value);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([b, vals]) => ({
      value: vals.reduce((s, v) => s + v, 0) / vals.length,
      ts: startSec + b * bucketSec + bucketSec / 2,
    }));
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PanelEntity {
  entityId: string;
  icon: string;
  name: string;
  state: string;
  active?: boolean;
  toggleable?: boolean;
  pressable?: boolean;
  unit?: string;
  entityPicture?: string;
  onToggle?: () => void;
}

export interface EntityDetailPanelProps {
  /** Entity that was clicked — panel starts here, then manages selection internally */
  initialEntityId: string;
  /** ALL visible entities in stable order (primary first, then secondary) */
  entities: PanelEntity[];
  deviceName?: string;
  onClose: () => void;
  onEditCard?: () => void;
}

// ── Detail body — history fetch + render ─────────────────────────────────────

function formatHoverTime(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 0.5) return 'Just now';
  if (diffH < 24) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diffH < 48) return `Yesterday ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EntityDetailBody({ entity }: { entity: PanelEntity }) {
  const { getEntityHistory, connected, demoMode } = useHomeAssistant();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [timeSpan, setTimeSpan] = useState<TimeSpan>('24h');
  const [aggregation, setAggregation] = useState<Aggregation>('auto');

  const hours = TIME_SPANS.find(t => t.value === timeSpan)?.hours ?? 24;

  useEffect(() => {
    setIsHistoryLoading(true);
    setHoveredIndex(null);
    const base = parseFloat(entity.state);
    const nowSec = Date.now() / 1000;
    const spanSec = hours * 3600;

    if (demoMode || !connected) {
      const count = Math.min(hours * 4, 192); // ~4 pts/hr, max 192
      let pts: HistoryPoint[];
      if (isNaN(base)) {
        let s = Math.random() > 0.5 ? 1 : 0;
        pts = Array.from({ length: count }, (_, i) => {
          if (i > 0 && Math.random() < 0.08) s = s === 1 ? 0 : 1;
          return { s: s.toFixed(0), lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
        });
      } else {
        pts = Array.from({ length: count }, (_, i) => {
          const t = i / (count - 1);
          const v = base + Math.sin(t * Math.PI * 4) * (base * 0.04) + Math.sin(t * Math.PI * 12) * (base * 0.015);
          return { s: v.toFixed(2), lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
        });
      }
      setHistory(pts);
      setIsHistoryLoading(false);
      return;
    }
    setHistory([]);
    getEntityHistory(entity.entityId, hours).then(pts => {
      const b = parseFloat(entity.state);
      if (pts.length < 3 && !isNaN(b)) {
        const count = 48;
        setHistory(Array.from({ length: count }, (_, i) => {
          const t = i / (count - 1);
          return { s: (b + Math.sin(t * Math.PI * 3) * (b * 0.02)).toFixed(2), lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
        }));
      } else {
        setHistory(pts);
      }
      setIsHistoryLoading(false);
    });
  }, [entity.entityId, hours, connected, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build parallel arrays: values + timestamps
  const rawHistoryData = history.map(pt => {
    const value = pt.s === 'on' ? 1 : pt.s === 'off' ? 0 : parseFloat(pt.s);
    return isNaN(value) ? null : { value, ts: pt.lc ?? pt.lu ?? null };
  }).filter(Boolean) as { value: number; ts: number | null }[];

  const historyData = applyAggregation(rawHistoryData, aggregation, hours);
  const numericPoints = historyData.map(d => d.value);

  const sparklineId = `edp-${entity.entityId.replace(/\./g, '-')}`;
  const rawNumeric = parseFloat(entity.state);
  const isNumeric = !isNaN(rawNumeric);
  const numericDisplay = isNumeric ? String(rawNumeric) : entity.state;

  const hoveredData = hoveredIndex !== null ? historyData[hoveredIndex] : null;
  const displayValue = hoveredData
    ? (Number.isInteger(hoveredData.value) ? String(hoveredData.value) : hoveredData.value.toFixed(1))
    : numericDisplay;
  const timeLabel = hoveredData
    ? (hoveredData.ts ? formatHoverTime(hoveredData.ts) : null)
    : 'NOW';

  const hasChart = numericPoints.length >= 3;

  return (
    <div className="shrink-0 flex flex-col items-center gap-3 px-6 py-5 overflow-hidden relative">
      {entity.entityPicture && (
        <>
          <img src={entity.entityPicture} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
        </>
      )}
      <div className="relative z-10 flex flex-col items-center gap-3 w-full">
      {entity.toggleable ? (
        <>
          {entity.onToggle ? (
            <button
              className={clsx(
                'w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95',
                entity.entityPicture
                  ? 'bg-black/30 text-white hover:bg-black/40'
                  : entity.active
                    ? 'bg-green-500/20 text-green-500 shadow-[0_0_24px_rgba(34,197,94,0.3)]'
                    : 'bg-surface-low text-text-secondary',
              )}
              onClick={entity.onToggle}
              aria-label={entity.active ? 'Turn off' : 'Turn on'}
            >
              <Icon path={entity.icon} size={28} />
            </button>
          ) : (
            <div className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center',
              entity.active ? 'bg-green-500/20 text-green-500' : 'bg-surface-low text-text-secondary',
            )}>
              <Icon path={entity.icon} size={28} />
            </div>
          )}
          <RollingNumericValue
            value={entity.state}
            className={clsx(
              'text-lg font-semibold font-mono capitalize',
              entity.entityPicture ? 'text-white' : 'text-text-primary',
            )}
          />
        </>
      ) : (
        <>
          {/* Value — rolling digit animation for numerics */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline justify-center">
              {isNumeric && entity.unit ? (
                <>
                  <RollingNumericValue value={displayValue} className={clsx('text-4xl font-bold font-mono', entity.entityPicture ? 'text-white' : 'text-text-primary')} />
                  <span className={clsx('text-lg font-mono ml-2', entity.entityPicture ? 'text-white/70' : 'text-text-secondary')}>{entity.unit}</span>
                </>
              ) : (
                <RollingNumericValue value={entity.state} className={clsx('text-2xl font-bold font-mono', entity.entityPicture ? 'text-white' : 'text-text-primary')} />
              )}
            </div>
            {/* Time label: "NOW" at rest, timestamp on hover */}
            {isNumeric && (
              <span className={clsx(
                'text-[10px] font-semibold uppercase tracking-wider transition-colors',
                entity.entityPicture
                  ? 'text-white/60'
                  : hoveredIndex !== null ? 'text-text-secondary' : 'text-ha-blue',
              )}>
                {timeLabel}
              </span>
            )}
          </div>

          {/* Sparkline — always reserves height to prevent layout jump */}
          <div className="w-full" style={{ height: 56 }}>
            {isHistoryLoading ? (
              <div className="w-full h-full rounded-ha-lg bg-surface-low animate-pulse" />
            ) : hasChart ? (
              <div className="w-full opacity-80">
                <Sparkline
                  points={numericPoints}
                  on={entity.active ?? false}
                  gradientId={sparklineId}
                  onHover={setHoveredIndex}
                />
              </div>
            ) : null}
          </div>

          {/* Graph controls */}
          <div className="w-full flex items-center justify-between gap-2 pt-1">
            <SegmentedControl
              segments={TIME_SPANS.map(t => ({ value: t.value, label: t.label }))}
              value={timeSpan}
              onChange={v => setTimeSpan(v as TimeSpan)}
              className="text-xs"
            />
            <select
              value={aggregation}
              onChange={e => setAggregation(e.target.value as Aggregation)}
              className="text-xs font-medium bg-surface-mid text-text-secondary rounded-ha-lg px-2 py-1.5 border-0 outline-none cursor-pointer hover:bg-surface-lower transition-colors appearance-none pr-5 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23888\' d=\'M7 10l5 5 5-5z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
            >
              {AGGREGATIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function EntityDetailPanel({
  initialEntityId,
  entities,
  deviceName,
  onClose,
  onEditCard,
}: EntityDetailPanelProps) {
  const [activeEntityId, setActiveEntityId] = useState(initialEntityId);

  // When the user clicks a different card on the dashboard, reset to the new entity
  useEffect(() => {
    setActiveEntityId(initialEntityId);
  }, [initialEntityId]);

  const activeEntity = entities.find(e => e.entityId === activeEntityId) ?? entities[0];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-ha-4 pt-ha-4 pb-ha-3 shrink-0 gap-2">
        <div className="min-w-0 flex-1">
          {deviceName && (
            <p className="text-xs text-text-tertiary truncate">{deviceName}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
          >
            <Icon path={mdiClose} size={20} />
          </button>
        </div>
      </div>

      <div className="h-px bg-surface-lower mx-ha-4 shrink-0" />

      {/* Detail section — big value/toggle, updates in place */}
      {activeEntity && <EntityDetailBody key={activeEntity.entityId} entity={activeEntity} />}

      {/* Entity list — stable, always same order, pinned to bottom */}
      {entities.length > 1 && (
        <div className="shrink-0 px-ha-4 pb-ha-4 pt-ha-2">
          <ListSection title="Features">
            {entities.map(entity => {
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
                  {/* Icon (always non-interactive) */}
                  <div className={clsx(
                    'w-7 h-7 flex items-center justify-center shrink-0',
                    entity.active ? 'text-green-500' : 'text-text-tertiary',
                  )}>
                    <Icon path={entity.icon} size={16} />
                  </div>
                  <span className={clsx(
                    'flex-1 text-sm truncate',
                    isActive ? 'text-ha-blue font-medium' : 'text-text-primary',
                  )}>
                    {entity.name}
                  </span>
                  {entity.toggleable && entity.onToggle ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); entity.onToggle!(); }}
                      className={clsx(
                        'flex items-center shrink-0 w-11 h-[26px] rounded-full px-[4px] transition-colors',
                        entity.active ? 'bg-green-500' : 'bg-surface-mid hover:bg-surface-lower',
                      )}
                      role="switch"
                      aria-checked={entity.active}
                    >
                      <div className={clsx(
                        'w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
                        entity.active ? 'translate-x-[18px]' : 'translate-x-0',
                      )} />
                    </button>
                  ) : entity.pressable && entity.onToggle ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); entity.onToggle!(); }}
                      className="flex items-center justify-center shrink-0 w-11 h-[26px] rounded-full bg-surface-mid hover:bg-surface-lower transition-colors"
                    >
                      <Icon path={mdiPower} size={12} className="text-text-secondary" />
                    </button>
                  ) : (
                    <RollingNumericValue
                      value={entity.state}
                      className={clsx(
                        'text-sm font-medium font-mono shrink-0',
                        isActive ? 'text-ha-blue' : 'text-text-secondary',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </ListSection>
        </div>
      )}
    </div>
  );
}
