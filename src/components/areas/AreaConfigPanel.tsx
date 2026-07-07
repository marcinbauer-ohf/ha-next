'use client';

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { mdiPlus, mdiTrashCanOutline, mdiVectorSquare } from '@mdi/js';
import type { AreaRegistryEntry, FloorRegistryEntry } from '@/lib/homeassistant';

// ─────────────────────────────────────────────────────────────────────────────
// Config sidebar body for the area map. Two modes:
//  • 'assign'  — a freshly-drawn polygon needs an area: pick an unplaced area or
//                create a new one inline.
//  • 'edit'    — an existing area's shape is selected: rename, reassign floor,
//                delete the shape.
// Renders the body only; the host wraps it in <Sidebar> (header + chrome).
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-ha-2xl border border-surface-lower bg-surface-low px-ha-4 py-ha-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-ha-blue/40 focus:ring-1 focus:ring-ha-blue/20';

export function AreaAssignBody({
  unplacedAreas,
  editable,
  onAssign,
  onCreateAndAssign,
  onCancel,
}: {
  unplacedAreas: AreaRegistryEntry[];
  editable: boolean;
  onAssign: (areaId: string) => void;
  onCreateAndAssign: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="space-y-ha-4 px-ha-4 py-ha-4">
      <p className="text-sm text-text-secondary">
        Pick which area this shape represents, or create a new one.
      </p>

      {unplacedAreas.length > 0 && (
        <div className="space-y-ha-1">
          <p className="px-ha-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Unplaced areas
          </p>
          <div className="space-y-ha-1">
            {unplacedAreas.map((a) => (
              <button
                key={a.area_id}
                type="button"
                onClick={() => onAssign(a.area_id)}
                className="flex w-full items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-3 py-ha-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-surface-low"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-ha-lg bg-surface-mid text-text-secondary">
                  <Icon path={a.icon || mdiVectorSquare} size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {editable && (
        <div className="space-y-ha-2">
          <p className="px-ha-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            New area
          </p>
          <input
            className={inputCls}
            placeholder="Area name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onCreateAndAssign(name.trim());
            }}
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onCreateAndAssign(name.trim())}
            className="flex w-full items-center justify-center gap-ha-2 rounded-ha-2xl bg-ha-blue px-ha-4 py-ha-3 text-sm font-semibold text-white transition-colors hover:bg-ha-blue/90 disabled:opacity-40"
          >
            <Icon path={mdiPlus} size={18} />
            Create &amp; assign
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-ha-2xl px-ha-4 py-ha-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-low"
      >
        Discard shape
      </button>
    </div>
  );
}

export function AreaEditBody({
  area,
  floors,
  editable,
  onRename,
  onChangeFloor,
  onDeleteShape,
}: {
  area: AreaRegistryEntry;
  floors: FloorRegistryEntry[];
  editable: boolean;
  onRename: (name: string) => void;
  onChangeFloor: (floorId: string | null) => void;
  onDeleteShape: () => void;
}) {
  const [name, setName] = useState(area.name);
  // Reset the field when a different area is selected (state-during-render, the
  // pattern React recommends over a syncing effect).
  const [syncedId, setSyncedId] = useState(area.area_id);
  if (syncedId !== area.area_id) {
    setSyncedId(area.area_id);
    setName(area.name);
  }

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== area.name) onRename(trimmed);
    else setName(area.name);
  };

  return (
    <div className="space-y-ha-4 px-ha-4 py-ha-4">
      <div className="space-y-ha-2">
        <label className="px-ha-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Name
        </label>
        <input
          className={inputCls}
          value={name}
          disabled={!editable}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      <div className="space-y-ha-2">
        <label className="px-ha-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Floor
        </label>
        <select
          className={inputCls}
          value={area.floor_id ?? ''}
          disabled={!editable}
          onChange={(e) => onChangeFloor(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {floors.map((f) => (
            <option key={f.floor_id} value={f.floor_id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-px bg-surface-lower" />

      <button
        type="button"
        onClick={onDeleteShape}
        className="flex w-full items-center justify-center gap-ha-2 rounded-ha-2xl border border-surface-lower px-ha-4 py-ha-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
      >
        <Icon path={mdiTrashCanOutline} size={18} />
        Remove shape from map
      </button>
      <p className="px-ha-1 text-xs text-text-tertiary">
        Removes the drawn footprint only — the area itself stays in Home Assistant.
      </p>
    </div>
  );
}
