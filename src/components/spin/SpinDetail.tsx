'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { mdiPower } from '@mdi/js';
import type { HassEntity } from '@/types';
import type { HassDevice } from '@/hooks/useDevices';
import type { AreaWithCounts } from '@/hooks/useAreasFloors';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant, useHomeAssistantEntities } from '@/hooks/useHomeAssistant';
import { useScrollFades } from '@/hooks/useScrollFades';
import { domainIcon } from './SpinWidgets';
import {
  SPIN_CATEGORIES,
  bulkTargets,
  entityName,
  friendlyState,
  isTogglable,
  type CategoryDevice,
  type SpinCategory,
} from './spinCategories';

interface Group {
  key: string;
  label: string;
  entities: HassEntity[];
  active: number;
}

interface SpinDetailProps {
  devices: HassDevice[];
  areas: AreaWithCounts[];
  focusCategory: SpinCategory | null;
  selectedArea: string | null;
  onOpenDevice: (item: CategoryDevice) => void;
}

/**
 * The drill-in half: every entity of the focused category, grouped by room (or by
 * device when a single room is selected), with the controls inline so the list
 * itself is the answer — no card hopping.
 */
export function SpinDetail({ devices, areas, focusCategory, selectedArea, onOpenDevice }: SpinDetailProps) {
  const ha = useHomeAssistant();
  const entities = useHomeAssistantEntities();
  const { attach, showTop, showBottom } = useScrollFades<HTMLDivElement>();

  const deviceByEntity = useMemo(() => {
    const map = new Map<string, HassDevice>();
    for (const device of devices) {
      if (device.isService) continue;
      for (const e of device.entities) map.set(e.entity_id, device);
    }
    return map;
  }, [devices]);

  const pool = useMemo(() => {
    const all = Object.values(entities);
    // Without a category, an area drill-in still filters out the diagnostic noise:
    // only entities some category cares about are worth listing.
    let list = focusCategory
      ? all.filter(focusCategory.matches)
      : all.filter((e) => SPIN_CATEGORIES.some((c) => c.matches(e)));
    if (selectedArea) list = list.filter((e) => deviceByEntity.get(e.entity_id)?.areaId === selectedArea);
    return list;
  }, [entities, focusCategory, selectedArea, deviceByEntity]);

  const isActive = useMemo(
    () => focusCategory?.isActive ?? ((e: HassEntity) => e.state === 'on'),
    [focusCategory],
  );

  const groups = useMemo<Group[]>(() => {
    const buckets = new Map<string, HassEntity[]>();
    const push = (key: string, e: HassEntity) => {
      const list = buckets.get(key);
      if (list) list.push(e);
      else buckets.set(key, [e]);
    };

    for (const e of pool) {
      const device = deviceByEntity.get(e.entity_id);
      // One room in view → devices are the useful grouping; otherwise group by room.
      push(selectedArea ? device?.name ?? 'Elsewhere' : device?.areaId ?? '__none__', e);
    }

    const order = selectedArea
      ? [...buckets.keys()].sort((a, b) => a.localeCompare(b))
      : [...areas.map((a) => a.area_id).filter((id) => buckets.has(id)), ...(buckets.has('__none__') ? ['__none__'] : [])];

    return order.map((key) => {
      const list = buckets.get(key)!;
      return {
        key,
        label: selectedArea
          ? key
          : key === '__none__'
            ? 'Elsewhere'
            : areas.find((a) => a.area_id === key)?.name ?? 'Elsewhere',
        entities: list,
        active: list.filter(isActive).length,
      };
    });
  }, [pool, deviceByEntity, selectedArea, areas, isActive]);

  const accent = focusCategory?.accent ?? '#18bcf2';
  const activeTotal = pool.filter(isActive).length;
  const targets = focusCategory ? bulkTargets(pool, focusCategory) : [];

  return (
    <motion.div
      className="relative z-10 flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="flex items-center justify-between gap-3 px-6 pb-2 sm:px-10">
        <span className="text-[13px] text-white/55">
          {pool.length === 0 ? 'Nothing here yet' : `${activeTotal} of ${pool.length} active`}
        </span>
        {focusCategory?.bulk && targets.length > 0 && (
          <button
            type="button"
            onClick={() =>
              ha.callService({
                domain: focusCategory.bulk!.domain,
                service: focusCategory.bulk!.service,
                target: { entity_id: targets },
              })
            }
            className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.03] active:scale-95"
            style={{ background: `${accent}38`, boxShadow: `0 0 20px ${accent}30` }}
          >
            {focusCategory.bulk.label}
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={attach}
          className="h-full overflow-y-auto px-6 pb-28 sm:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((group) => (
            <section key={group.key} className="mb-3">
              <header className="sticky top-0 z-10 flex items-baseline justify-between gap-3 bg-[#02091f]/70 py-2 backdrop-blur-md">
                <h3 className="truncate text-[13px] font-semibold uppercase tracking-wide text-white/60">
                  {group.label}
                </h3>
                <span className="shrink-0 text-[12px] text-white/40">
                  {group.active} of {group.entities.length} on
                </span>
              </header>
              <ul className="space-y-1">
                {group.entities.map((entity) => (
                  <EntityRow
                    key={entity.entity_id}
                    entity={entity}
                    accent={accent}
                    active={isActive(entity)}
                    device={deviceByEntity.get(entity.entity_id)}
                    onOpenDevice={onOpenDevice}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#02091f] to-transparent transition-opacity duration-200"
          style={{ opacity: showTop ? 1 : 0 }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#02091f] to-transparent transition-opacity duration-200"
          style={{ opacity: showBottom ? 1 : 0 }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function EntityRow({
  entity,
  accent,
  active,
  device,
  onOpenDevice,
}: {
  entity: HassEntity;
  accent: string;
  active: boolean;
  device?: HassDevice;
  onOpenDevice: (item: CategoryDevice) => void;
}) {
  const ha = useHomeAssistant();
  const canToggle = isTogglable(entity);

  return (
    <li
      className="flex items-center gap-2 rounded-2xl border transition-colors"
      style={{
        borderColor: active ? `${accent}44` : 'rgba(255,255,255,0.08)',
        background: active ? `${accent}14` : 'rgba(255,255,255,0.04)',
      }}
    >
      <button
        type="button"
        disabled={!device}
        onClick={() => device && onOpenDevice({ device, lead: entity, categoryEntities: device.entities })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors enabled:hover:bg-white/[0.05] disabled:cursor-default"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: active ? `${accent}2e` : 'rgba(255,255,255,0.08)',
            color: active ? accent : 'rgba(255,255,255,0.65)',
          }}
        >
          <Icon path={domainIcon(entity)} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-white/90">{entityName(entity)}</span>
          {device && device.name !== entityName(entity) && (
            <span className="block truncate text-[12px] text-white/45">{device.name}</span>
          )}
        </span>
        <span className="shrink-0 text-[13px] text-white/60">{friendlyState(entity)}</span>
      </button>
      {canToggle && (
        <button
          type="button"
          aria-label={active ? `Turn off ${entityName(entity)}` : `Turn on ${entityName(entity)}`}
          onClick={() => ha.toggleEntity(entity.entity_id, entity.state)}
          className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          style={{ color: active ? accent : 'rgba(255,255,255,0.6)' }}
        >
          <Icon path={mdiPower} size={18} />
        </button>
      )}
    </li>
  );
}
