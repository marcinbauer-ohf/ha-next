'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  mdiLightbulb,
  mdiLightbulbOutline,
  mdiToggleSwitchOutline,
  mdiToggleSwitchOffOutline,
  mdiThermometer,
  mdiSpeaker,
  mdiTelevision,
  mdiFlash,
  mdiWaterPercent,
  mdiGauge,
  mdiEye,
  mdiDoorOpen,
  mdiDoor,
  mdiMotionSensor,
  mdiShieldCheck,
  mdiDevices,
  mdiChevronDown,
  mdiChevronRight,
  mdiWindowOpen,
  mdiWindowClosed,
  mdiClose,
  mdiToggleSwitch,
  mdiPower,
  mdiInformationOutline,
  mdiFan,
  mdiGarage,
  mdiRobot,
  mdiLock,
  mdiLockOpen,
  mdiPencilOutline,
  mdiCheck,
  mdiPlus,
  mdiDragVertical,
} from '@mdi/js';
import { clsx } from 'clsx';
import { DeviceCard } from '@/components/cards/DeviceCard';
import { ApplicationViewNotice } from '@/components/layout/ApplicationViewNotice';
import { DashboardSidePanel } from '@/components/layout/DashboardSidePanel';
import { PullToRevealPanel } from '@/components/sections';
import { usePullToRevealContext, useHeader, useEditMode } from '@/contexts';
import { EditableCard } from '@/components/edit/EditableCard';
import {
  useDesktopImmersivePageLayout,
  useTheme,
  useHomeAssistant,
  useDevices,
  useDeviceCardConfig,
} from '@/hooks';
import { Icon } from '@/components/ui/Icon';
import type { HassEntity } from '@/types';
import type { HassDevice } from '@/hooks';
import type { EntitySlot, EntitySection, DeviceCardConfig } from '@/hooks';
import type { HistoryPoint } from '@/lib/homeassistant/types';
import type { DeviceEntry } from '@/components/cards/DeviceCard';

// ── Utilities ─────────────────────────────────────────────────────────────────

function entityDomain(entity: HassEntity) {
  return entity.entity_id.split('.')[0];
}

function friendlyName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
}

function stateLabel(entity: HassEntity): string {
  const s = entity.state;
  if (s === 'unavailable') return 'Unavailable';
  if (s === 'unknown') return 'Unknown';
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  return unit ? `${s} ${unit}` : s.charAt(0).toUpperCase() + s.slice(1);
}

function isOn(entity: HassEntity): boolean {
  const s = entity.state.toLowerCase();
  return s !== 'off' && s !== 'unavailable' && s !== 'unknown' && s !== '0' && s !== 'idle' && s !== 'standby';
}

const TOGGLEABLE = new Set(['light', 'switch', 'fan', 'input_boolean', 'media_player', 'cover', 'lock']);

function domainIcon(entity: HassEntity): string {
  const domain = entityDomain(entity);
  const on = isOn(entity);
  const dc = entity.attributes.device_class as string | undefined;
  if (domain === 'light') return on ? mdiLightbulb : mdiLightbulbOutline;
  if (domain === 'switch') return on ? mdiToggleSwitchOutline : mdiToggleSwitchOffOutline;
  if (domain === 'climate') return mdiThermometer;
  if (domain === 'media_player') {
    const isTV = (entity.attributes.device_class as string | undefined) === 'tv' || entity.entity_id.includes('tv');
    return isTV ? mdiTelevision : mdiSpeaker;
  }
  if (domain === 'fan') return mdiFan;
  if (domain === 'lock') return on ? mdiLockOpen : mdiLock;
  if (domain === 'cover') return on ? mdiGarage : mdiGarage;
  if (domain === 'vacuum') return mdiRobot;
  if (domain === 'binary_sensor') {
    if (dc === 'door' || dc === 'garage_door') return on ? mdiDoorOpen : mdiDoor;
    if (dc === 'window') return on ? mdiWindowOpen : mdiWindowClosed;
    if (dc === 'motion' || dc === 'occupancy') return mdiMotionSensor;
    if (dc === 'smoke' || dc === 'gas' || dc === 'safety') return mdiShieldCheck;
    return mdiEye;
  }
  if (domain === 'sensor') {
    if (dc === 'temperature') return mdiThermometer;
    if (dc === 'humidity') return mdiWaterPercent;
    if (dc === 'power' || dc === 'energy' || dc === 'voltage' || dc === 'current') return mdiFlash;
    if (dc === 'illuminance') return mdiEye;
    return mdiGauge;
  }
  return mdiDevices;
}

// Section grouping by primary entity domain
const SECTION_ORDER = [
  'climate', 'media_player', 'light', 'switch', 'fan',
  'lock', 'cover', 'vacuum', 'binary_sensor', 'sensor',
];
const SECTION_TITLES: Record<string, string> = {
  climate: 'Climate',
  media_player: 'Media',
  light: 'Lights',
  switch: 'Switches',
  fan: 'Fans',
  lock: 'Locks',
  cover: 'Covers',
  vacuum: 'Vacuums',
  binary_sensor: 'Security & Presence',
  sensor: 'Sensors',
};

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ points, on }: { points: number[]; on: boolean }) {
  if (points.length < 3) return null;

  const W = 280;
  const H = 56;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }));

  // Smooth cubic bezier path
  const line = coords.reduce((p, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${p} C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  const area = `${line} L${W},${H} L0,${H} Z`;
  const id = `sg-${on ? 'on' : 'off'}`;
  const stroke = on ? 'rgba(34,197,94,0.9)' : 'rgba(120,120,120,0.5)';
  const fill0 = on ? 'rgba(34,197,94,0.25)' : 'rgba(120,120,120,0.12)';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill0} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Device card with sparkline overlay ───────────────────────────────────────

function DeviceCardWithGraph({
  device, allEntries, hasMultiple, primaryEntityId, active, onClick, selected,
}: {
  device: HassDevice; allEntries: DeviceEntry[]; hasMultiple: boolean;
  primaryEntityId: string; active: boolean; onClick?: () => void; selected?: boolean;
}) {
  const { getEntityHistory, connected, demoMode } = useHomeAssistant();
  const [sparkPoints, setSparkPoints] = useState<number[]>([]);

  useEffect(() => {
    const entity = device.entities.find(e => e.entity_id === primaryEntityId);
    const base = parseFloat(entity?.state ?? '');

    const toNums = (pts: { s: string }[]) => pts.map(p => {
      const n = parseFloat(p.s);
      if (!isNaN(n)) return n;
      const ls = p.s.toLowerCase();
      if (ls === 'on' || ls === 'true' || ls === 'home' || ls === 'open') return 1;
      if (ls === 'off' || ls === 'false' || ls === 'not_home' || ls === 'closed') return 0;
      return NaN;
    }).filter(v => !isNaN(v));

    if (demoMode || !connected) {
      const raw = isNaN(base)
        ? (() => { let s = Math.random() > 0.5 ? 1 : 0; return Array.from({ length: 48 }, (_, i) => { if (i > 0 && Math.random() < 0.12) s = s === 1 ? 0 : 1; return { s: s.toFixed(0) }; }); })()
        : Array.from({ length: 48 }, (_, i) => { const t = i / 48; return { s: (base + Math.sin(t * Math.PI * 4) * (base * 0.04)).toFixed(2) }; });
      setSparkPoints(toNums(raw));
      return;
    }
    getEntityHistory(primaryEntityId, 48).then(pts => setSparkPoints(toNums(pts)));
  }, [primaryEntityId, connected, demoMode, getEntityHistory, device.entities]);

  const primary = device.primaryEntity!;
  return (
    <div className="relative rounded-ha-xl overflow-hidden">
      <DeviceCard
        variant={hasMultiple ? 'card' : 'row'}
        icon={allEntries[0]?.icon ?? domainIcon(primary)}
        name={device.name} state={stateLabel(primary)} active={active}
        onIconClick={allEntries[0]?.onIconClick}
        entities={hasMultiple ? allEntries : undefined}
        onClick={onClick} selected={selected}
      />
      {sparkPoints.length >= 3 && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-50">
          <Sparkline points={sparkPoints} on={active} />
        </div>
      )}
    </div>
  );
}

// ── Device detail panel ───────────────────────────────────────────────────────

function EntityRow({
  entity,
  onToggle,
}: {
  entity: HassEntity;
  onToggle?: () => void;
}) {
  const domain = entityDomain(entity);
  const on = isOn(entity);
  const canToggle = TOGGLEABLE.has(domain) && !!onToggle;

  return (
    <div
      className={clsx(
        'flex items-center gap-ha-3 py-ha-2 px-ha-3 rounded-ha-xl',
        canToggle && 'cursor-pointer hover:bg-surface-mid transition-colors',
      )}
      onClick={canToggle ? onToggle : undefined}
    >
      <div className={clsx(
        'w-7 h-7 flex items-center justify-center flex-shrink-0',
        canToggle
          ? clsx('rounded-full', on ? 'bg-green-500/15 text-green-500' : 'bg-surface-mid text-text-secondary')
          : 'text-text-tertiary',
      )}>
        <Icon path={domainIcon(entity)} size={16} />
      </div>
      <span className="flex-1 text-sm text-text-primary truncate min-w-0">
        {friendlyName(entity)}
      </span>
      <span className={clsx('text-xs tabular-nums shrink-0', on ? 'text-text-primary' : 'text-text-secondary')}>
        {stateLabel(entity)}
      </span>
    </div>
  );
}

function DeviceDetailPanel({
  device,
  onClose,
  getConfig,
  setConfig,
  areas,
}: {
  device: HassDevice;
  onClose: () => void;
  getConfig: (id: string) => DeviceCardConfig;
  setConfig: (id: string, cfg: DeviceCardConfig) => void;
  areas: Map<string, string>;
}) {
  const { toggleEntity, getEntityHistory, connected, demoMode } = useHomeAssistant();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'entities' | 'info'>('entities');
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  useEffect(() => { setEditing(false); setTab('entities'); }, [device.id]);

  // Fetch (or simulate) history for the primary entity
  useEffect(() => {
    const primaryId = (slots.length > 0 ? slots.find(s => s.section === 'primary')?.entity_id : undefined)
      ?? device.primaryEntity?.entity_id;
    if (!primaryId) return;

    const entity = device.entities.find(e => e.entity_id === primaryId);
    const base = parseFloat(entity?.state ?? '');

    if (demoMode || !connected) {
      let pts: HistoryPoint[];
      if (isNaN(base)) {
        // Binary entity — simulate on/off state changes
        let state = Math.random() > 0.5 ? 1 : 0;
        pts = Array.from({ length: 48 }, (_, i) => {
          if (i > 0 && Math.random() < 0.12) state = state === 1 ? 0 : 1;
          return { s: state.toFixed(0) };
        });
      } else {
        pts = Array.from({ length: 48 }, (_, i) => {
          const t = i / 48;
          const v = base + Math.sin(t * Math.PI * 4) * (base * 0.04) + Math.sin(t * Math.PI * 12) * (base * 0.015);
          return { s: v.toFixed(2) };
        });
      }
      setHistory(pts);
      return;
    }

    setHistory([]);
    getEntityHistory(primaryId, 48).then((pts) => {
      // Sparse history (e.g. slow-changing battery sensors): pad with synthetic data around current value
      const numericCount = pts.filter(p => !isNaN(parseFloat(p.s))).length;
      const binaryCount = pts.filter(p => {
        const ls = p.s.toLowerCase();
        return ls === 'on' || ls === 'off' || ls === 'true' || ls === 'false';
      }).length;
      if (pts.length < 3 || (numericCount === 0 && binaryCount === 0)) {
        if (!isNaN(base)) {
          const synth: HistoryPoint[] = Array.from({ length: 48 }, (_, i) => {
            const t = i / 48;
            const v = base + Math.sin(t * Math.PI * 3) * (base * 0.02) + Math.sin(t * Math.PI * 11) * (base * 0.008);
            return { s: v.toFixed(2) };
          });
          setHistory(synth);
        } else {
          setHistory(pts);
        }
      } else {
        setHistory(pts);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id, connected, demoMode]);

  const stored = getConfig(device.id);
  const slots = stored.slots;

  // Effective primary entity
  const primarySlot = slots.find((s) => s.section === 'primary');
  // No config at all → use device default. Config exists but Primary empty → no hero.
  const primary = slots.length === 0
    ? device.primaryEntity
    : (primarySlot ? (device.entities.find((e) => e.entity_id === primarySlot.entity_id) ?? null) : null);

  function update(next: EntitySlot[]) {
    setConfig(device.id, { slots: next });
  }

  function toggleSize(entityId: string) {
    update(slots.map((s) => s.entity_id === entityId ? { ...s, size: s.size === 'lg' ? 'sm' : 'lg' } : s));
  }

  // Move an entity to a section; Primary enforces max-1 by bumping existing to secondary
  function moveToSection(entityId: string, section: EntitySection) {
    let next = slots.filter((s) => s.entity_id !== entityId);
    if (section === 'primary') {
      // Bump existing primary to secondary
      next = next.map((s) => s.section === 'primary' ? { ...s, section: 'secondary' as EntitySection } : s);
    }
    const existing = slots.find((s) => s.entity_id === entityId);
    next.push({ entity_id: entityId, size: existing?.size ?? 'lg', section });
    update(next);
  }

  // Reorder within secondary by inserting before a target
  function reorderSecondary(entityId: string, beforeId: string | null) {
    const secondary = slots.filter((s) => s.section === 'secondary');
    const others = slots.filter((s) => s.section !== 'secondary');
    const item = secondary.find((s) => s.entity_id === entityId);
    if (!item) return;
    const rest = secondary.filter((s) => s.entity_id !== entityId);
    const idx = beforeId ? rest.findIndex((s) => s.entity_id === beforeId) : -1;
    idx >= 0 ? rest.splice(idx, 0, item) : rest.push(item);
    update([...others, ...rest]);
  }

  // Enter edit: initialize all entities into sections if not yet configured
  function enterEdit() {
    if (slots.length === 0) {
      const initial: EntitySlot[] = device.entities.map((e, i) => ({
        entity_id: e.entity_id,
        size: 'lg' as const,
        section: (i === 0 ? 'primary' : 'hidden') as EntitySection,
      }));
      update(initial);
    }
    setEditing(true);
  }

  const [dragId, setDragId] = useState<string | null>(null);
  const [overSection, setOverSection] = useState<EntitySection | null>(null);
  const [insertBeforeId, setInsertBeforeId] = useState<string | null>(null);

  function startDrag(entityId: string) { setDragId(entityId); }

  function endDrag() { setDragId(null); setOverSection(null); setInsertBeforeId(null); }

  function sectionDragOver(e: React.DragEvent, section: EntitySection) {
    e.preventDefault(); setOverSection(section);
    if (section !== 'secondary') setInsertBeforeId(null);
  }

  function itemDragOver(e: React.DragEvent, entityId: string) {
    e.preventDefault(); e.stopPropagation(); setOverSection('secondary'); setInsertBeforeId(entityId);
  }

  function dropOnSection(section: EntitySection) {
    if (!dragId) return;
    const fromSection = slots.find((s) => s.entity_id === dragId)?.section;
    if (section === 'secondary' && fromSection === 'secondary') {
      reorderSecondary(dragId, insertBeforeId);
    } else if (section !== fromSection) {
      moveToSection(dragId, section);
    }
    endDrag();
  }

  const resolve = (id: string) => device.entities.find((e) => e.entity_id === id);
  const secondaryEntities = slots.filter((s) => s.section === 'secondary').flatMap((s) => { const e = resolve(s.entity_id); return e ? [e] : []; });
  const disabledEntities  = slots.filter((s) => s.section === 'disabled').flatMap((s) => { const e = resolve(s.entity_id); return e ? [e] : []; });
  // Fallback when no config: all non-primary sorted by toggleability
  const otherEntities = slots.length > 0
    ? secondaryEntities
    : device.entities
        .filter((e) => e.entity_id !== primary?.entity_id)
        .sort((a, b) => (TOGGLEABLE.has(entityDomain(a)) ? 0 : 1) - (TOGGLEABLE.has(entityDomain(b)) ? 0 : 1));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-ha-4 pt-ha-4 pb-ha-3 shrink-0 gap-ha-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text-primary leading-tight truncate">{device.name}</h2>
          {(device.manufacturer || device.model) && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              {[device.manufacturer, device.model].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tab === 'entities' && (
            <button
              onClick={() => editing ? setEditing(false) : enterEdit()}
              className={clsx(
                'p-1 rounded-ha-lg transition-colors',
                editing
                  ? 'text-ha-blue bg-fill-primary-normal hover:bg-fill-primary-normal'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-low',
              )}
              title={editing ? 'Done' : 'Edit card'}
            >
              <Icon path={editing ? mdiCheck : mdiPencilOutline} size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-ha-lg text-text-secondary hover:text-text-primary hover:bg-surface-low transition-colors"
          >
            <Icon path={mdiClose} size={18} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex mx-ha-4 gap-1 shrink-0 pb-ha-3">
        {(['entities', 'info'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t !== 'entities') setEditing(false); }}
            className={clsx(
              'flex-1 py-1.5 text-xs font-medium rounded-ha-lg transition-colors capitalize',
              tab === t
                ? 'bg-surface-low text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {t === 'entities' ? 'Entities' : 'Info'}
          </button>
        ))}
      </div>

      <div className="h-px bg-surface-lower mx-ha-4 shrink-0" />

      {/* Primary entity hero — entities tab only */}
      {tab === 'entities' && primary && (() => {
        const canToggle = TOGGLEABLE.has(entityDomain(primary));
        const on = isOn(primary);
        return (
          <div className="px-ha-4 pt-ha-4 pb-ha-2 shrink-0">
            {(() => {
              const numericPoints = history.map(p => {
                const n = parseFloat(p.s);
                if (!isNaN(n)) return n;
                const ls = p.s.toLowerCase();
                if (ls === 'on' || ls === 'true' || ls === 'home' || ls === 'open' || ls === 'unlocked') return 1;
                if (ls === 'off' || ls === 'false' || ls === 'not_home' || ls === 'closed' || ls === 'locked') return 0;
                return NaN;
              }).filter(v => !isNaN(v));
              const hasChart = numericPoints.length >= 3 && stored.showGraph !== false;
              return (
          <div className={clsx(
              'rounded-ha-2xl px-ha-4 pt-ha-5 pb-ha-4 flex flex-col items-center gap-ha-2 relative overflow-hidden',
              on ? 'bg-green-500/10' : 'bg-surface-low',
            )}>
            {/* Sparkline background */}
            {hasChart && (
              <div className="absolute bottom-0 left-0 right-0 opacity-60">
                <Sparkline points={numericPoints} on={on} />
              </div>
            )}
            <div className="relative z-10 w-full flex flex-col items-center gap-ha-2">
              {/* Icon (toggleable — click to toggle) or big state value (read-only) */}
              {canToggle ? (
                <button
                  onClick={() => toggleEntity(primary.entity_id)}
                  className={clsx(
                    'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200',
                    'hover:scale-110 active:scale-95',
                    on
                      ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 shadow-[0_0_24px_rgba(34,197,94,0.2)]'
                      : 'bg-surface-mid text-text-secondary hover:bg-surface-lower',
                  )}
                >
                  <Icon path={domainIcon(primary)} size={32} />
                </button>
              ) : (() => {
                const unit = primary.attributes.unit_of_measurement as string | undefined;
                const val = unit ? primary.state : null;
                return (
                  <div className="w-16 h-16 flex flex-col items-center justify-center shrink-0">
                    {val ? (
                      <>
                        <span className="text-3xl font-bold text-text-primary leading-none">{val}</span>
                        <span className="text-sm text-text-secondary mt-1">{unit}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-text-primary text-center leading-tight">
                        {primary.state}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Name + state */}
              <div className="text-center mt-ha-1">
                <p className="text-base font-semibold text-text-primary leading-tight">{friendlyName(primary)}</p>
                {canToggle && (
                  <p className={clsx('text-sm font-medium mt-0.5', on ? 'text-green-500' : 'text-text-secondary')}>
                    {stateLabel(primary)}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
          </div>
        );
      })()}

      {/* Body — entities tab */}
      {tab === 'entities' && editing ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-3 pb-ha-3 flex flex-col gap-ha-3">
          {/* Graph toggle */}
          <div className="flex items-center justify-between px-ha-3 py-ha-3 bg-surface-low rounded-ha-xl mt-ha-2">
            <span className="text-sm text-text-primary">Show graph</span>
            <button
              onClick={() => setConfig(device.id, { ...stored, showGraph: stored.showGraph === false ? undefined : false })}
              className="flex-shrink-0"
            >
              <div className={clsx(
                'w-11 h-6 rounded-full flex items-center px-[3px] transition-colors duration-200',
                stored.showGraph !== false ? 'bg-green-500' : 'bg-surface-lower',
              )}>
                <div className={clsx(
                  'w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
                  stored.showGraph !== false ? 'translate-x-5' : 'translate-x-0',
                )} />
              </div>
            </button>
          </div>
          {(
            [
              { key: 'primary',   label: 'Primary',   tooltip: null, accent: 'border-ha-blue bg-fill-primary-quiet' },
              { key: 'secondary', label: 'Secondary',  tooltip: null, accent: 'border-surface-mid bg-surface-low' },
              {
                key: 'hidden', label: 'Hidden', accent: 'border-surface-lower',
                tooltip: 'In HA, hidden entities are still active and polled — automations and scripts can use them. They\'re just hidden from the default Lovelace UI.',
              },
              {
                key: 'disabled', label: 'Disabled', accent: 'border-surface-lower',
                tooltip: 'In HA, disabled entities are fully turned off — the integration stops polling them, they lose their state, and they can\'t be used in automations until re-enabled in HA settings.',
              },
            ] as Array<{ key: EntitySection; label: string; tooltip: string | null; accent: string }>
          ).map(({ key, label, tooltip, accent }) => {
            const sectionSlots = slots.filter((s) => s.section === key);
            const isOver = overSection === key;

            return (
              <div
                key={key}
                onDragOver={(e) => sectionDragOver(e, key)}
                onDrop={() => dropOnSection(key)}
              >
                <div className="flex items-center gap-ha-1 px-ha-1 mt-ha-3 mb-ha-2">
                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">{label}</p>
                  {tooltip && (
                    <div className="relative group">
                      <button className="text-text-tertiary hover:text-text-secondary transition-colors flex items-center" tabIndex={-1}>
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
                  isOver && dragId
                    ? accent
                    : sectionSlots.length === 0
                      ? 'border-dashed border-surface-lower'
                      : 'border-transparent',
                )}>
                  {sectionSlots.length === 0 ? (
                    <div className="flex items-center justify-center py-ha-3">
                      <span className="text-xs text-text-tertiary">Drag here</span>
                    </div>
                  ) : (
                    sectionSlots.map((slot) => {
                      const entity = device.entities.find((e) => e.entity_id === slot.entity_id);
                      if (!entity) return null;
                      const isInsertBefore = key === 'secondary' && insertBeforeId === slot.entity_id && dragId !== slot.entity_id;
                      const isDimmed = key === 'hidden' || key === 'disabled';
                      return (
                        <div key={slot.entity_id}>
                          {/* Fixed-height insert indicator — always in DOM to prevent layout shift */}
                          <div className={clsx('h-0.5 rounded-full mb-1 transition-opacity', isInsertBefore ? 'bg-ha-blue opacity-100' : 'opacity-0')} />
                          <div
                            draggable
                            onDragStart={() => startDrag(slot.entity_id)}
                            onDragEnd={endDrag}
                            onDragOver={key === 'secondary' ? (e) => itemDragOver(e, slot.entity_id) : undefined}
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
                                <button onClick={() => slot.size !== 'sm' && toggleSize(slot.entity_id)} className={clsx('px-ha-2 py-0.5 text-xs font-medium transition-colors', slot.size === 'sm' ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:bg-surface-mid')}>S</button>
                                <button onClick={() => slot.size !== 'lg' && toggleSize(slot.entity_id)} className={clsx('px-ha-2 py-0.5 text-xs font-medium transition-colors', slot.size === 'lg' ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:bg-surface-mid')}>L</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Append indicator — fixed height to avoid layout shift */}
                  <div className={clsx('h-0.5 rounded-full mt-1 transition-opacity', key === 'secondary' && isOver && !insertBeforeId && dragId ? 'bg-ha-blue opacity-100' : 'opacity-0')} />
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'entities' ? (
        /* View mode */
        (otherEntities.length > 0 || disabledEntities.length > 0) ? (
          <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-2 pb-ha-2">
            {otherEntities.length > 0 && (
              <>
                <div className="px-ha-2 pt-ha-3 pb-ha-1">
                  <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Also on this device</span>
                </div>
                {otherEntities.map((entity) => (
                  <EntityRow key={entity.entity_id} entity={entity} onToggle={TOGGLEABLE.has(entityDomain(entity)) ? () => toggleEntity(entity.entity_id) : undefined} />
                ))}
              </>
            )}
            {disabledEntities.length > 0 && (
              <>
                <div className="px-ha-2 pt-ha-3 pb-ha-1">
                  <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Disabled</span>
                </div>
                {disabledEntities.map((entity) => (
                  <div key={entity.entity_id} className="flex items-center gap-ha-3 py-ha-2 px-ha-3 rounded-ha-xl opacity-40">
                    <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-text-tertiary">
                      <Icon path={domainIcon(entity)} size={16} />
                    </div>
                    <span className="flex-1 text-sm text-text-tertiary truncate line-through">{friendlyName(entity)}</span>
                    <span className="text-xs text-text-tertiary tabular-nums">{stateLabel(entity)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : null
      ) : (
        /* Info tab */
        <div className="flex-1 overflow-y-auto scrollbar-hide px-ha-4 pb-ha-4 flex flex-col gap-ha-4 pt-ha-4">
          {/* Device properties */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-ha-2">Device</p>
            {[
              { label: 'Name', value: device.name },
              { label: 'Manufacturer', value: device.manufacturer },
              { label: 'Model', value: device.model },
              { label: 'Area', value: device.areaId ? (areas.get(device.areaId) ?? device.areaId) : undefined },
              { label: 'ID', value: device.id, mono: true },
            ].filter(r => r.value).map(({ label, value, mono }) => (
              <div key={label} className="flex items-start gap-ha-2 py-ha-1">
                <span className="text-xs text-text-tertiary w-24 shrink-0 pt-px">{label}</span>
                <span className={clsx('text-xs text-text-primary break-all flex-1', mono && 'font-mono text-[11px]')}>{value}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-surface-lower" />

          {/* Entities */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-ha-2">
              Entities ({device.entities.length})
            </p>
            {device.entities.map((entity) => {
              const dc = entity.attributes.device_class as string | undefined;
              const unit = entity.attributes.unit_of_measurement as string | undefined;
              const lastChanged = entity.last_changed
                ? new Date(entity.last_changed).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : null;
              return (
                <div key={entity.entity_id} className="flex flex-col gap-0.5 py-ha-2 border-b border-surface-lower last:border-0">
                  <div className="flex items-center gap-ha-2">
                    <div className="w-5 h-5 flex items-center justify-center shrink-0 text-text-tertiary">
                      <Icon path={domainIcon(entity)} size={14} />
                    </div>
                    <span className="text-xs text-text-primary flex-1 truncate">{friendlyName(entity)}</span>
                    <span className="text-xs tabular-nums text-text-secondary shrink-0">
                      {stateLabel(entity)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-ha-3 gap-y-0.5 pl-7">
                    <span className="font-mono text-[10px] text-text-tertiary break-all">{entity.entity_id}</span>
                    {dc && <span className="text-[10px] text-text-tertiary">{dc}</span>}
                    {unit && <span className="text-[10px] text-text-tertiary">{unit}</span>}
                    {lastChanged && <span className="text-[10px] text-text-tertiary/70">{lastChanged}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-ha-2 w-full text-left mb-ha-3 group"
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <span className="text-xs font-medium text-text-tertiary bg-surface-mid rounded-ha-pill px-ha-2 py-0.5">{count}</span>
        <span className="ml-auto text-text-secondary group-hover:text-text-primary transition-colors">
          <Icon path={open ? mdiChevronDown : mdiChevronRight} size={18} />
        </span>
      </button>
      {open && (
        <div className="grid gap-ha-2 items-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DevicesDashboard() {
  const { isRevealed } = usePullToRevealContext();
  const { background } = useTheme();
  const scrollableRef = useRef<HTMLElement | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);
  const { setHeader } = useHeader();
  const { contentPaddingClasses, contentTransitionClasses, contentStyle } = useDesktopImmersivePageLayout();
  const { toggleEntity } = useHomeAssistant();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const { devices, areas, loading } = useDevices();
  const { getConfig, setConfig } = useDeviceCardConfig();

  useEffect(() => {
    setHeader({ title: 'Devices', icon: mdiDevices });
  }, [setHeader]);

  const sections = useMemo(() => {
    type Section = { key: string; title: string; devices: HassDevice[] };
    const ordered: Section[] = [];

    if (areas.size > 0) {
      // Group by area — ordered as HA returns them, unassigned at the end
      const byArea = new Map<string, HassDevice[]>();
      for (const device of devices) {
        const key = device.areaId ?? '__none__';
        if (!byArea.has(key)) byArea.set(key, []);
        byArea.get(key)!.push(device);
      }
      for (const [areaId, areaName] of areas) {
        if (byArea.has(areaId)) {
          ordered.push({ key: areaId, title: areaName, devices: byArea.get(areaId)! });
        }
      }
      if (byArea.has('__none__')) {
        ordered.push({ key: '__none__', title: 'Other', devices: byArea.get('__none__')! });
      }
    } else {
      // Fallback (demo / no area data): group by primary entity domain
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
    () => devices.find((d) => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const { isEditing } = useEditMode();

  // Device order/visibility/colSpan per section, persisted to localStorage
  type DeviceSectionOrder = { order: string[]; hidden: string[]; colSpans: Record<string, 1 | 2> };
  type DeviceOrder = Record<string, DeviceSectionOrder>;

  const [deviceOrder, setDeviceOrder] = useState<DeviceOrder>(() => {
    try { return JSON.parse(localStorage.getItem('ha_device_order') ?? '{}'); } catch { return {}; }
  });

  const saveDeviceOrder = useCallback((next: DeviceOrder) => {
    setDeviceOrder(next);
    try { localStorage.setItem('ha_device_order', JSON.stringify(next)); } catch { /* noop */ }
  }, []);

  const getSectionOrder = useCallback((sectionKey: string, sectionDevices: HassDevice[]): HassDevice[] => {
    const cfg = deviceOrder[sectionKey];
    if (!cfg) return sectionDevices;
    const hidden = new Set(cfg.hidden);
    const orderMap = new Map(cfg.order.map((id, i) => [id, i]));
    return sectionDevices
      .filter(d => !hidden.has(d.id))
      .sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
        return ai - bi;
      });
  }, [deviceOrder]);

  const dragSourceRef = useRef<{ deviceId: string; sectionKey: string } | null>(null);

  const handleDeviceDragStart = useCallback((deviceId: string, sectionKey: string) => {
    dragSourceRef.current = { deviceId, sectionKey };
  }, []);

  const handleDeviceDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDeviceDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetDeviceId: string, sectionKey: string, sectionDevices: HassDevice[]) => {
    e.preventDefault();
    const src = dragSourceRef.current;
    if (!src || src.sectionKey !== sectionKey || src.deviceId === targetDeviceId) { dragSourceRef.current = null; return; }
    const ordered = getSectionOrder(sectionKey, sectionDevices);
    const ids = ordered.map(d => d.id);
    const srcIdx = ids.indexOf(src.deviceId);
    const tgtIdx = ids.indexOf(targetDeviceId);
    if (srcIdx === -1 || tgtIdx === -1) { dragSourceRef.current = null; return; }
    const next = [...ids];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    saveDeviceOrder({ ...deviceOrder, [sectionKey]: { ...deviceOrder[sectionKey], order: next, hidden: deviceOrder[sectionKey]?.hidden ?? [], colSpans: deviceOrder[sectionKey]?.colSpans ?? {} } });
    dragSourceRef.current = null;
  }, [deviceOrder, getSectionOrder, saveDeviceOrder]);

  const handleDeviceRemove = useCallback((deviceId: string, sectionKey: string) => {
    const cfg = deviceOrder[sectionKey] ?? { order: [], hidden: [], colSpans: {} };
    saveDeviceOrder({ ...deviceOrder, [sectionKey]: { ...cfg, hidden: [...cfg.hidden.filter(id => id !== deviceId), deviceId] } });
  }, [deviceOrder, saveDeviceOrder]);

  const handleDeviceResize = useCallback((deviceId: string, sectionKey: string, colSpan: 1 | 2) => {
    const cfg = deviceOrder[sectionKey] ?? { order: [], hidden: [], colSpans: {} };
    saveDeviceOrder({ ...deviceOrder, [sectionKey]: { ...cfg, colSpans: { ...cfg.colSpans, [deviceId]: colSpan } } });
  }, [deviceOrder, saveDeviceOrder]);


  const select = (id: string) => setSelectedDeviceId((prev) => (prev === id ? null : id));

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
        <div className={clsx('h-full flex', selectedDeviceId ? 'gap-ha-3' : '')}>

          {/* Main surface */}
          <div className="flex-1 min-w-0 h-full bg-surface-lower overflow-hidden rounded-ha-3xl relative">

            {showTopGradient && background !== 'image' && background !== 'gradient' && (
              <div className="absolute top-0 left-0 right-0 lg:left-14 h-12 pointer-events-none bg-gradient-to-b from-surface-lower via-surface-lower/60 to-transparent z-20" />
            )}
            {showBottomGradient && background !== 'image' && background !== 'gradient' && (
              <div className="absolute bottom-0 left-0 right-0 lg:left-14 h-12 pointer-events-none bg-gradient-to-t from-surface-lower via-surface-lower/60 to-transparent z-20" />
            )}

            {/* Right-edge close button when panel is open */}
            <button
              onClick={() => setSelectedDeviceId(null)}
              className={clsx(
                'hidden lg:flex group absolute inset-y-0 right-0 w-14 z-10 items-center justify-center transition-all duration-300',
                !selectedDeviceId && 'pointer-events-none',
              )}
            >
              <div className="absolute inset-0 rounded-r-ha-3xl bg-gradient-to-l from-transparent to-transparent group-hover:from-ha-blue/[0.06] to-transparent transition-all duration-500 delay-0 group-hover:delay-150" />
              <Icon
                path={selectedDeviceId ? mdiClose : mdiInformationOutline}
                size={16}
                className={clsx(
                  'relative transition-all duration-500 text-text-primary',
                  selectedDeviceId ? 'opacity-30 group-hover:opacity-100 group-hover:text-ha-blue' : 'opacity-0',
                )}
              />
            </button>

            {/* Scrollable content */}
            <div
              ref={(el) => { scrollableRef.current = el; }}
              className="h-full overflow-y-auto overscroll-none touch-pan-y scrollbar-hide relative px-ha-4 pt-ha-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pl-14 lg:pr-ha-5 lg:pt-ha-5 lg:pb-ha-5"
              data-scrollable="dashboard"
            >
              <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full space-y-ha-6">
                <ApplicationViewNotice />

                {loading && (
                  <div className="grid gap-ha-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-ha-xl bg-surface-low animate-pulse" />
                    ))}
                  </div>
                )}

                {!loading && sections.length === 0 && (
                  <p className="text-sm text-text-secondary text-center py-ha-8">
                    No devices found. Connect to Home Assistant to see your devices.
                  </p>
                )}

                {sections.map(({ key, title, devices: sectionDevices }) => {
                  const visibleDevices = isEditing ? getSectionOrder(key, sectionDevices) : getSectionOrder(key, sectionDevices);
                  return (
                  <Section key={key} title={title} count={visibleDevices.length}>
                    {visibleDevices.map((device) => {
                      if (!device.primaryEntity) return null;
                      const config = getConfig(device.id);
                      const primarySlot = config.slots.find((s) => s.section === 'primary');
                      const secondarySlots = config.slots.filter((s) => s.section === 'secondary');

                      const displaySlots = config.slots.length === 0
                        ? [{ entity_id: device.primaryEntity.entity_id, size: 'lg' as const }]
                        : [
                            ...(primarySlot ? [{ entity_id: primarySlot.entity_id, size: 'lg' as const }] : []),
                            ...secondarySlots,
                          ];

                      const allEntries: DeviceEntry[] = displaySlots.flatMap((slot) => {
                        const e = device.entities.find((ent) => ent.entity_id === slot.entity_id);
                        if (!e) return [];
                        return [{
                          icon: domainIcon(e),
                          name: slot.entity_id === primarySlot?.entity_id ? device.name : friendlyName(e),
                          state: stateLabel(e),
                          active: isOn(e),
                          size: slot.size,
                          onIconClick: TOGGLEABLE.has(entityDomain(e)) ? () => toggleEntity(e.entity_id) : undefined,
                        } satisfies DeviceEntry];
                      });

                      const hasMultiple = allEntries.length > 1;
                      const colSpan = (deviceOrder[key]?.colSpans?.[device.id] ?? 1) as 1 | 2;

                      const heroEntityId = (config.slots.find(s => s.section === 'primary')?.entity_id)
                        ?? device.primaryEntity.entity_id;
                      const showGraph = config.showGraph !== false;

                      const card = showGraph ? (
                        <DeviceCardWithGraph
                          key={device.id}
                          device={device}
                          allEntries={allEntries}
                          hasMultiple={hasMultiple}
                          primaryEntityId={heroEntityId}
                          active={isOn(device.primaryEntity)}
                          onClick={isEditing ? undefined : () => select(device.id)}
                          selected={selectedDeviceId === device.id}
                        />
                      ) : (
                        <DeviceCard
                          key={device.id}
                          variant={hasMultiple ? 'card' : 'row'}
                          icon={allEntries[0]?.icon ?? domainIcon(device.primaryEntity)}
                          name={device.name}
                          state={stateLabel(device.primaryEntity)}
                          active={isOn(device.primaryEntity)}
                          onIconClick={allEntries[0]?.onIconClick}
                          entities={hasMultiple ? allEntries : undefined}
                          title={hasMultiple ? device.name : undefined}
                          onClick={isEditing ? undefined : () => select(device.id)}
                          selected={selectedDeviceId === device.id}
                        />
                      );

                      if (isEditing) {
                        return (
                          <EditableCard
                            key={device.id}
                            cardId={device.id}
                            sectionId={key}
                            colSpan={colSpan}
                            rowSpan={1}
                            isEditing={true}
                            onToggleHidden={() => handleDeviceRemove(device.id, key)}
                            onResize={(cs) => handleDeviceResize(device.id, key, cs)}
                            onDragStart={handleDeviceDragStart}
                            onDragOver={(e) => handleDeviceDragOver(e)}
                            onDrop={(e) => handleDeviceDrop(e, device.id, key, sectionDevices)}
                          >
                            {card}
                          </EditableCard>
                        );
                      }

                      return card;
                    })}
                  </Section>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <DashboardSidePanel open={!!selectedDeviceId} onClose={() => setSelectedDeviceId(null)}>
            {selectedDevice && (
              <DeviceDetailPanel
                device={selectedDevice}
                onClose={() => setSelectedDeviceId(null)}
                getConfig={getConfig}
                setConfig={setConfig}
                areas={areas}
              />
            )}
          </DashboardSidePanel>
        </div>
      </div>
    </>
  );
}
