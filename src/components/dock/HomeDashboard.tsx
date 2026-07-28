'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  mdiFlash,
  mdiHomeOutline,
  mdiLightbulbGroup,
  mdiPlayCircleOutline,
  mdiShieldCheckOutline,
  mdiThermometer,
  mdiUpdate,
  mdiWeatherPartlyCloudy,
  mdiWrenchOutline,
} from '@mdi/js';
import type { HassEntity } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { MdiIcon } from '@/components/ui/MdiIcon';
import { useAreasFloors } from '@/hooks/useAreasFloors';
import { useDevices } from '@/hooks/useDevices';
import { useFavorites } from '@/hooks/useFavorites';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import {
  AREA_ICON,
  domainIcon,
  entityDomain,
  friendlyName,
  isOn,
  stateLabel,
  TOGGLEABLE,
} from '@/lib/homeassistant/entityHelpers';

const numeric = (entity: HassEntity): number | null => {
  const n = Number(entity.state);
  return Number.isFinite(n) ? n : null;
};

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-[13px] text-neutral-500">
      {icon && <Icon path={icon} size={15} exact className="text-neutral-400" />}
      {children}
    </h2>
  );
}

const CARD = 'rounded-xl border border-neutral-200/70 bg-white';

/** Wide pill: icon badge + name + "state · area". Toggles when the entity can. */
function FavoriteCard({
  entity,
  areaName,
  onToggle,
}: {
  entity: HassEntity;
  areaName?: string;
  onToggle: () => void;
}) {
  const on = isOn(entity);
  const canToggle = TOGGLEABLE.has(entityDomain(entity));

  return (
    <button
      type="button"
      onClick={canToggle ? onToggle : undefined}
      className={clsx(CARD, 'flex items-center gap-3 p-3 text-left', canToggle && 'hover:border-neutral-300')}
    >
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          on ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-400',
        )}
      >
        <Icon path={domainIcon(entity)} size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-neutral-800">{friendlyName(entity)}</span>
        <span className="block truncate text-[12px] text-neutral-500">
          {stateLabel(entity)}
          {areaName ? ` · ${areaName}` : ''}
        </span>
      </span>
    </button>
  );
}

/** Square area tile: centred icon, name, temperature when the area has one. */
function AreaCard({
  name,
  icon,
  temp,
  onOpen,
}: {
  name: string;
  icon?: string | null;
  temp?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        CARD,
        'flex flex-col items-center justify-center gap-1 px-3 py-6 transition-colors hover:border-neutral-300 hover:bg-neutral-50',
      )}
    >
      <span className="text-neutral-500">
        {icon ? <MdiIcon icon={icon} size={22} /> : <Icon path={AREA_ICON} size={22} />}
      </span>
      <span className="mt-1 text-center text-[13px] font-medium text-neutral-800">{name}</span>
      {temp && <span className="text-[12px] text-neutral-500">{temp}</span>}
    </button>
  );
}

/**
 * How Home Assistant's own area page groups things: controls first, by kind, then
 * the read-only sensors, then the scenes and scripts you can run.
 */
const AREA_SECTIONS: { title: string; domains: string[] }[] = [
  { title: 'Lights', domains: ['light'] },
  { title: 'Climate', domains: ['climate', 'fan', 'humidifier', 'water_heater'] },
  { title: 'Media', domains: ['media_player'] },
  { title: 'Security', domains: ['lock', 'cover', 'alarm_control_panel', 'camera'] },
  { title: 'Switches', domains: ['switch', 'input_boolean', 'siren', 'valve'] },
  { title: 'Sensors', domains: ['sensor', 'binary_sensor'] },
  { title: 'Actions', domains: ['scene', 'script', 'automation'] },
];

function EntityRow({ entity, onToggle }: { entity: HassEntity; onToggle: () => void }) {
  const domain = entityDomain(entity);
  const unavailable = entity.state === 'unavailable' || entity.state === 'unknown';
  const on = isOn(entity) && !unavailable;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          on ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-400',
        )}
      >
        <Icon path={domainIcon(entity)} size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-700">{friendlyName(entity)}</span>
      {TOGGLEABLE.has(domain) && !unavailable ? (
        <ToggleSwitch on={on} onToggle={onToggle} />
      ) : (
        <span className={clsx('shrink-0 text-[12px] tabular-nums', unavailable ? 'text-neutral-300' : 'text-neutral-500')}>
          {stateLabel(entity)}
        </span>
      )}
    </div>
  );
}

/** The area's own page: everything assigned to it, grouped like HA does. */
function AreaDetail({
  entities,
  temp,
  onToggle,
}: {
  entities: HassEntity[];
  temp?: string;
  onToggle: (entity: HassEntity) => void;
}) {
  const sections = useMemo(() => {
    const remaining = new Map(entities.map((e) => [e.entity_id, e]));
    return AREA_SECTIONS.map((section) => {
      const items: HassEntity[] = [];
      for (const entity of remaining.values()) {
        if (!section.domains.includes(entityDomain(entity))) continue;
        items.push(entity);
      }
      // Claimed here so a later section can't list the same entity again.
      items.forEach((e) => remaining.delete(e.entity_id));
      return { title: section.title, items: items.sort((a, b) => friendlyName(a).localeCompare(friendlyName(b))) };
    }).filter((section) => section.items.length > 0);
  }, [entities]);

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Name and back arrow live in the app's top bar — only the temperature is
          left to say here. */}
      {temp && <p className="mb-4 text-[14px] text-neutral-500">{temp}</p>}

      {sections.length === 0 ? (
        <p className="pt-10 text-center text-[14px] text-neutral-400">Nothing is assigned to this area yet.</p>
      ) : (
        <div className="grid grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <section key={section.title} className={clsx(CARD, 'p-4')}>
              <h2 className="mb-1 px-1 text-[13px] font-medium text-neutral-500">{section.title}</h2>
              <div className="divide-y divide-neutral-100">
                {section.items.map((entity) => (
                  <EntityRow key={entity.entity_id} entity={entity} onToggle={() => onToggle(entity)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ icon, tint, title, detail }: { icon: string; tint: string; title: string; detail: string }) {
  return (
    <div className={clsx(CARD, 'flex items-center gap-3 p-3')}>
      <Icon path={icon} size={22} className={clsx('shrink-0', tint)} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-neutral-800">{title}</span>
        <span className="block truncate text-[12px] text-neutral-500">{detail}</span>
      </span>
    </div>
  );
}

/**
 * A pared-back take on Home Assistant's home dashboard: favourites, then areas
 * grouped by floor, with a summaries column beside them. Every number here is
 * read from the connected instance — nothing is mocked.
 */
export function HomeDashboard({
  areaId,
  onOpenArea,
}: {
  /** Which area is drilled into, owned by DockApp so the top bar can title it. */
  areaId: string | null;
  onOpenArea: (area: { id: string; name: string }) => void;
}) {
  const ha = useHomeAssistant();
  const { devices, areas, loading } = useDevices();
  const { floors, unassignedAreas } = useAreasFloors();
  const { favoriteIds } = useFavorites();

  /** Temperatures and entities per area, plus every entity flattened for summaries. */
  const { tempByArea, allEntities, entitiesByArea } = useMemo(() => {
    const temps = new Map<string, number[]>();
    const byArea = new Map<string, HassEntity[]>();
    const flat: HassEntity[] = [];
    for (const device of devices) {
      for (const entity of device.entities) {
        flat.push(entity);
        if (!device.areaId) continue;
        const bucket = byArea.get(device.areaId);
        if (bucket) bucket.push(entity);
        else byArea.set(device.areaId, [entity]);
        if (entity.attributes.device_class !== 'temperature') continue;
        const value = numeric(entity);
        if (value === null) continue;
        const list = temps.get(device.areaId);
        if (list) list.push(value);
        else temps.set(device.areaId, [value]);
      }
    }
    return { tempByArea: temps, allEntities: flat, entitiesByArea: byArea };
  }, [devices]);

  const areaTemp = (areaId: string): string | undefined => {
    const list = tempByArea.get(areaId);
    if (!list?.length) return undefined;
    const mean = list.reduce((a, b) => a + b, 0) / list.length;
    return `${mean.toFixed(1)} °C`;
  };

  const favorites = useMemo(
    () =>
      favoriteIds
        .map((id) => devices.find((d) => d.id === id))
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .map((device) => ({
          device,
          entity: device.primaryEntity ?? device.entities[0],
          areaName: device.areaId ? areas.get(device.areaId) : undefined,
        }))
        .filter((f) => Boolean(f.entity)),
    [favoriteIds, devices, areas],
  );

  // Every summary is counted off live state — no placeholder rows.
  const summaries = useMemo(() => {
    const byDomain = (domain: string) => allEntities.filter((e) => entityDomain(e) === domain);
    const rows: { icon: string; tint: string; title: string; detail: string }[] = [];

    const updates = byDomain('update').filter(isOn).length;
    if (updates) {
      rows.push({
        icon: mdiUpdate,
        tint: 'text-sky-500',
        title: 'Updates',
        detail: `${updates} update${updates === 1 ? '' : 's'} available`,
      });
    }

    const lights = byDomain('light');
    if (lights.length) {
      rows.push({
        icon: mdiLightbulbGroup,
        tint: 'text-amber-500',
        title: 'Lights',
        detail: `${lights.filter(isOn).length} on`,
      });
    }

    const temps = [...tempByArea.values()].flat();
    if (temps.length) {
      rows.push({
        icon: mdiThermometer,
        tint: 'text-orange-500',
        title: 'Climate',
        detail: `${Math.min(...temps).toFixed(1)} – ${Math.max(...temps).toFixed(1)} °C`,
      });
    }

    const locks = byDomain('lock');
    const openings = byDomain('binary_sensor').filter(
      (e) => ['door', 'window', 'garage_door'].includes(String(e.attributes.device_class)) && isOn(e),
    );
    const unlocked = locks.filter((e) => e.state === 'unlocked').length;
    if (locks.length || openings.length) {
      rows.push({
        icon: mdiShieldCheckOutline,
        tint: 'text-emerald-600',
        title: 'Security',
        detail:
          unlocked || openings.length
            ? [unlocked && `${unlocked} unlocked`, openings.length && `${openings.length} open`]
                .filter(Boolean)
                .join(', ')
            : 'All secure',
      });
    }

    const players = byDomain('media_player');
    if (players.length) {
      const playing = players.filter((e) => e.state === 'playing').length;
      rows.push({
        icon: mdiPlayCircleOutline,
        tint: 'text-indigo-500',
        title: 'Media players',
        detail: playing ? `${playing} playing` : 'No media playing',
      });
    }

    const lowBattery = allEntities.filter(
      (e) => e.attributes.device_class === 'battery' && (numeric(e) ?? 100) < 20,
    ).length;
    const unavailable = allEntities.filter((e) => e.state === 'unavailable').length;
    if (lowBattery || unavailable) {
      rows.push({
        icon: mdiWrenchOutline,
        tint: 'text-neutral-500',
        title: 'Maintenance',
        detail: [lowBattery && `${lowBattery} low batteries`, unavailable && `${unavailable} unavailable`]
          .filter(Boolean)
          .join(', '),
      });
    }

    const weather = byDomain('weather')[0];
    if (weather) {
      const temp = weather.attributes.temperature;
      rows.push({
        icon: mdiWeatherPartlyCloudy,
        tint: 'text-sky-500',
        title: 'Weather',
        detail: [temp != null && `${temp} °C`, stateLabel(weather)].filter(Boolean).join(' · '),
      });
    }

    const power = allEntities.find(
      (e) => e.attributes.device_class === 'energy' && numeric(e) !== null,
    );
    if (power) {
      rows.push({
        icon: mdiFlash,
        tint: 'text-amber-500',
        title: 'Energy',
        detail: `${numeric(power)} ${power.attributes.unit_of_measurement ?? ''}`.trim(),
      });
    }

    return rows;
  }, [allEntities, tempByArea]);

  if (!ha.connected && !ha.demoMode) {
    return (
      <p className="pt-16 text-center text-[15px] text-neutral-400">
        Connect to Home Assistant in the main prototype — this shares those credentials.
      </p>
    );
  }

  if (loading && devices.length === 0) {
    return <p className="pt-16 text-center text-[15px] text-neutral-400">Loading your home…</p>;
  }

  const areaGrid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4';

  // Drilled into an area — its own page replaces the home view.
  const openArea = areaId
    ? [...floors.flatMap((f) => f.areas), ...unassignedAreas].find((a) => a.area_id === areaId)
    : undefined;
  if (openArea) {
    return (
      <AreaDetail
        entities={entitiesByArea.get(openArea.area_id) ?? []}
        temp={areaTemp(openArea.area_id)}
        onToggle={(entity) => void ha.toggleEntity(entity.entity_id, entity.state)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <h1 className="mb-5 text-[20px] font-semibold text-neutral-900">
        Welcome{ha.currentUser?.name ? ` ${ha.currentUser.name}` : ''}
      </h1>

      <div className="flex flex-col gap-8 xl:flex-row">
        <div className="min-w-0 flex-1">
          {favorites.length > 0 && (
            <section className="mb-7">
              <SectionLabel>Favorites</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {favorites.map(({ device, entity, areaName }) => (
                  <FavoriteCard
                    key={device.id}
                    entity={entity}
                    areaName={areaName}
                    onToggle={() => void ha.toggleEntity(entity.entity_id, entity.state)}
                  />
                ))}
              </div>
            </section>
          )}

          {floors
            .filter((floor) => floor.areas.length > 0)
            .map((floor) => (
              <section key={floor.floor_id} className="mb-7">
                <SectionLabel icon={mdiHomeOutline}>{floor.name}</SectionLabel>
                <div className={areaGrid}>
                  {floor.areas.map((area) => (
                    <AreaCard
                      key={area.area_id}
                      name={area.name}
                      icon={area.icon}
                      temp={areaTemp(area.area_id)}
                      onOpen={() => onOpenArea({ id: area.area_id, name: area.name })}
                    />
                  ))}
                </div>
              </section>
            ))}

          {unassignedAreas.length > 0 && (
            <section className="mb-7">
              <SectionLabel>Other areas</SectionLabel>
              <div className={areaGrid}>
                {unassignedAreas.map((area) => (
                  <AreaCard
                    key={area.area_id}
                    name={area.name}
                    icon={area.icon}
                    temp={areaTemp(area.area_id)}
                    onOpen={() => onOpenArea({ id: area.area_id, name: area.name })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {summaries.length > 0 && (
          <aside className="w-full shrink-0 xl:w-[340px]">
            <SectionLabel>Summaries</SectionLabel>
            <div className="flex flex-col gap-3">
              {summaries.map((row) => (
                <SummaryRow key={row.title} {...row} />
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
