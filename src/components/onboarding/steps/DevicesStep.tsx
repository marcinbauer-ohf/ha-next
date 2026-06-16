'use client';

import { useMemo } from 'react';
import { Icon } from '@/components/ui';
import { useDevices } from '@/hooks';
import { mdiDevices, mdiMapMarkerOutline } from '@mdi/js';
import type { StepProps } from '../types';

export function DevicesStep({ state, update }: StepProps) {
  const { devices, loading } = useDevices();
  const { areas, deviceAreas } = state;

  // Stable list — drop service/unnamed noise, cap to keep the step quick.
  const list = useMemo(
    () => devices.filter(d => d.name).slice(0, 40),
    [devices],
  );

  const assign = (deviceId: string, areaId: string) =>
    update({
      deviceAreas: areaId
        ? { ...deviceAreas, [deviceId]: areaId }
        : (() => {
            const { [deviceId]: _drop, ...rest } = deviceAreas;
            return rest;
          })(),
    });

  return (
    <div className="flex flex-col gap-ha-5">
      <div className="space-y-ha-2">
        <h1 className="text-xl font-semibold tracking-tight">Place your devices</h1>
        <p className="text-sm text-text-secondary">
          Assign devices to the areas you created. Optional — skip to do it later.
        </p>
      </div>

      {areas.length === 0 ? (
        <EmptyHint
          icon={mdiMapMarkerOutline}
          title="No areas yet"
          body="Go back and add a few areas first, then assign devices here."
        />
      ) : loading ? (
        <p className="text-sm text-text-tertiary">Loading devices…</p>
      ) : list.length === 0 ? (
        <EmptyHint
          icon={mdiDevices}
          title="No devices found"
          body="Connect an instance or use demo data to see devices here."
        />
      ) : (
        <div className="space-y-ha-2">
          {list.map(device => (
            <div
              key={device.id}
              className="flex items-center gap-ha-3 rounded-ha-xl border border-surface-lower bg-surface-low px-ha-3 py-ha-2"
            >
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-text-primary">
                {device.name}
              </span>
              <select
                value={deviceAreas[device.id] ?? ''}
                onChange={e => assign(device.id, e.target.value)}
                className="shrink-0 max-w-[48%] rounded-ha-lg bg-surface-default border border-fill-primary-normal text-sm text-text-primary px-ha-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ha-blue/50"
                aria-label={`Area for ${device.name}`}
              >
                <option value="">Unassigned</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyHint({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-ha-2 py-ha-8 rounded-ha-xl border border-dashed border-surface-lower">
      <Icon path={icon} size={28} className="text-text-tertiary" />
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="text-xs text-text-secondary max-w-[260px]">{body}</p>
    </div>
  );
}
