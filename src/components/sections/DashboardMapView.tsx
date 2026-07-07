'use client';

import { useMemo } from 'react';
import { mdiDevices, mdiMapOutline } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { AreaMapCanvas, type AreaInfo, type DeviceChipInfo } from '../areas/AreaMapCanvas';
import { useAreaGeometry } from '@/hooks/useAreaGeometry';
import { colorForArea } from '@/lib/areaGeometry';
import { useDeviceMapPlacement } from '@/hooks/useDeviceMapPlacement';
import { domainIcon, deviceThumbnail, isOn, stateLabel, entityCategory, entityDomain, TOGGLEABLE, type DeviceCategory } from '@/lib/homeassistant/entityHelpers';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import type { HassDevice } from '@/hooks/useDevices';
import type { AreaRegistryEntry, FloorRegistryEntry } from '@/lib/homeassistant';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Map view — a read-only floor plan with live device chips, the
// display counterpart to the Areas editor. Reuses AreaMapCanvas in 'view' mode:
// area polygons + chips (icon + state pill) the geometry/placement were drawn
// with in Settings → Areas & Floors. Tapping a chip opens the same more-info as
// the device cards (via onSelectEntity).
// ─────────────────────────────────────────────────────────────────────────────

// On the dashboard every room is drawn in one neutral colour so the floor plan
// reads as a single calm layout; the per-area palette is reserved for editing.
const UNIFIED_AREA_COLOR = '#64748b';

const noop = () => {};

export function DashboardMapView({
  devices,
  areaReg,
  floors,
  activeFloorId,
  category = 'all',
  onSelectEntity,
}: {
  devices: HassDevice[];
  areaReg: AreaRegistryEntry[];
  floors: FloorRegistryEntry[];
  activeFloorId: string | null;
  /** Show only chips of this device category ('all' = no filter). */
  category?: DeviceCategory | 'all';
  onSelectEntity: (deviceId: string, entityId: string) => void;
}) {
  const { toggleEntity } = useHomeAssistant();
  const areaIds = useMemo(() => areaReg.map((a) => a.area_id), [areaReg]);
  const geom = useAreaGeometry(areaIds);
  const deviceIds = useMemo(() => devices.map((d) => d.id), [devices]);
  const placement = useDeviceMapPlacement(deviceIds);

  // Map view shows one floor; "All" (null) falls back to the first floor.
  const effectiveFloorId = activeFloorId ?? floors[0]?.floor_id ?? null;

  const areaInfo = useMemo<Record<string, AreaInfo>>(() => {
    const map: Record<string, AreaInfo> = {};
    for (const a of areaReg) map[a.area_id] = { name: a.name, icon: a.icon || '', color: UNIFIED_AREA_COLOR };
    return map;
  }, [areaReg]);

  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  // Live chip info — re-derived as device state ticks (devices come from useDevices).
  const deviceChipInfo = useMemo<Record<string, DeviceChipInfo>>(() => {
    const map: Record<string, DeviceChipInfo> = {};
    for (const d of devices) {
      const e = d.primaryEntity;
      map[d.id] = {
        name: d.name,
        state: e ? stateLabel(e) : '',
        image: e ? deviceThumbnail(e) : null,
        icon: e ? domainIcon(e) : mdiDevices,
        active: e ? isOn(e) : false,
        color: d.areaId ? colorForArea(d.areaId) : '#18bcf2',
        toggleable: e ? TOGGLEABLE.has(entityDomain(e)) : false,
      };
    }
    return map;
  }, [devices]);

  // Filter chips by category (the room is already given by position).
  const visiblePlacements = useMemo(() => {
    if (category === 'all') return placement.placementList;
    return placement.placementList.filter((p) => {
      const e = deviceById.get(p.deviceId)?.primaryEntity;
      return e ? entityCategory(e) === category : false;
    });
  }, [placement.placementList, category, deviceById]);

  const hasContent = geom.shapeList.some((s) => s.floorId === effectiveFloorId)
    || placement.placementList.some((p) => p.floorId === effectiveFloorId);

  const handleSelectDevice = (deviceId: string) => {
    const d = deviceById.get(deviceId);
    if (d?.primaryEntity) onSelectEntity(d.id, d.primaryEntity.entity_id);
  };

  const handleToggleDevice = (deviceId: string) => {
    const e = deviceById.get(deviceId)?.primaryEntity;
    if (e) toggleEntity(e.entity_id, e.state);
  };

  if (!hasContent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-ha-3 px-ha-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-ha-2xl bg-surface-mid text-text-tertiary">
          <Icon path={mdiMapOutline} size={28} />
        </span>
        <p className="text-sm font-semibold text-text-primary">No map for this floor yet</p>
        <p className="max-w-xs text-sm text-text-tertiary">
          Draw rooms and place devices in Settings → Areas &amp; Floors → Map, then they show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-ha-3xl">
      <AreaMapCanvas
        shapes={geom.shapeList}
        activeFloorId={effectiveFloorId}
        showAllFloors={false}
        areaInfo={areaInfo}
        selectedAreaId={null}
        onSelect={noop}
        drawing={false}
        onCommitDraft={noop}
        moveBy={noop}
        mode="view"
        placements={visiblePlacements}
        deviceChipInfo={deviceChipInfo}
        onSelectDevice={handleSelectDevice}
        onToggleDevice={handleToggleDevice}
      />
    </div>
  );
}
