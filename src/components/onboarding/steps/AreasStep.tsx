'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';
import {
  mdiClose,
  mdiPlus,
  mdiStairs,
  mdiAutoFix,
  mdiSofaOutline,
} from '@mdi/js';
import { INPUT_CLASS } from '../fieldStyles';
import { uid, type OnbArea, type OnbFloor, type StepProps } from '../types';

// Sensible starter layout offered as one tap — mirrors the demo home shape.
const SUGGESTED: { floor: string; areas: string[] }[] = [
  { floor: 'Ground Floor', areas: ['Living Room', 'Kitchen', 'Hallway'] },
  { floor: 'Upstairs', areas: ['Bedroom', 'Bathroom', 'Office'] },
];

export function AreasStep({ state, update }: StepProps) {
  const { floors, areas } = state;
  const [floorDraft, setFloorDraft] = useState('');
  // Per-floor area input drafts, keyed by floorId.
  const [areaDrafts, setAreaDrafts] = useState<Record<string, string>>({});

  const setAreaDraft = (floorId: string, v: string) =>
    setAreaDrafts(d => ({ ...d, [floorId]: v }));

  const addFloor = () => {
    const name = floorDraft.trim();
    if (!name) return;
    update({ floors: [...floors, { id: uid('floor'), name }] });
    setFloorDraft('');
  };

  const removeFloor = (id: string) =>
    update({
      floors: floors.filter(f => f.id !== id),
      // Detach areas from a removed floor rather than deleting them.
      areas: areas.map(a => (a.floorId === id ? { ...a, floorId: null } : a)),
    });

  const addArea = (floorId: string) => {
    const name = (areaDrafts[floorId] ?? '').trim();
    if (!name) return;
    update({ areas: [...areas, { id: uid('area'), name, floorId }] });
    setAreaDraft(floorId, '');
  };

  const removeArea = (id: string) =>
    update({ areas: areas.filter(a => a.id !== id) });

  const applySuggested = () => {
    const newFloors: OnbFloor[] = [];
    const newAreas: OnbArea[] = [];
    for (const s of SUGGESTED) {
      const f: OnbFloor = { id: uid('floor'), name: s.floor };
      newFloors.push(f);
      for (const a of s.areas) newAreas.push({ id: uid('area'), name: a, floorId: f.id });
    }
    update({ floors: newFloors, areas: newAreas });
    setAreaDrafts({});
  };

  const areasFor = (floorId: string) => areas.filter(a => a.floorId === floorId);
  const isEmpty = floors.length === 0;

  return (
    <div className="flex flex-col gap-ha-5">
      <div className="space-y-ha-2">
        <h1 className="text-xl font-semibold tracking-tight">Floors &amp; areas</h1>
        <p className="text-sm text-text-secondary">
          Group your rooms by floor. You can skip this and add them later.
        </p>
      </div>

      {isEmpty && (
        <button
          type="button"
          onClick={applySuggested}
          className="w-full flex items-center justify-center gap-ha-2 py-3 px-4 rounded-ha-xl bg-ha-blue/10 text-ha-blue font-medium hover:bg-ha-blue/15 transition-colors"
        >
          <Icon path={mdiAutoFix} size={18} />
          Use a suggested layout
        </button>
      )}

      {/* ── Floors with their areas ──────────────────────────────────── */}
      <div className="space-y-ha-4">
        {floors.map(floor => (
          <div
            key={floor.id}
            className="rounded-ha-xl border border-surface-lower bg-surface-low p-ha-4 space-y-ha-3"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-ha-2 font-medium text-text-primary">
                <Icon path={mdiStairs} size={18} className="text-text-secondary" />
                {floor.name}
              </span>
              <button
                type="button"
                onClick={() => removeFloor(floor.id)}
                className="p-ha-1 rounded-full text-text-tertiary hover:bg-surface-mid hover:text-text-secondary transition-colors"
                aria-label={`Remove ${floor.name}`}
              >
                <Icon path={mdiClose} size={18} />
              </button>
            </div>

            {areasFor(floor.id).length > 0 && (
              <div className="flex flex-wrap gap-ha-2">
                {areasFor(floor.id).map(area => (
                  <span
                    key={area.id}
                    className="inline-flex items-center gap-ha-1 rounded-ha-xl border border-surface-lower bg-surface-default pl-ha-3 pr-ha-2 py-1.5 text-xs font-semibold text-text-primary"
                  >
                    <Icon path={mdiSofaOutline} size={14} className="text-text-tertiary" />
                    {area.name}
                    <button
                      type="button"
                      onClick={() => removeArea(area.id)}
                      className="ml-px rounded-full text-text-tertiary hover:text-text-secondary"
                      aria-label={`Remove ${area.name}`}
                    >
                      <Icon path={mdiClose} size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-ha-2">
              <input
                type="text"
                value={areaDrafts[floor.id] ?? ''}
                onChange={e => setAreaDraft(floor.id, e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addArea(floor.id);
                  }
                }}
                placeholder="Add an area…"
                className={`${INPUT_CLASS} !py-2 text-sm`}
                aria-label={`Add area to ${floor.name}`}
              />
              <button
                type="button"
                onClick={() => addArea(floor.id)}
                className="shrink-0 p-2 rounded-ha-xl bg-surface-mid text-text-primary hover:bg-surface-lower transition-colors"
                aria-label="Add area"
              >
                <Icon path={mdiPlus} size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add floor ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-ha-2">
        <input
          type="text"
          value={floorDraft}
          onChange={e => setFloorDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFloor();
            }
          }}
          placeholder="Add a floor…"
          className={INPUT_CLASS}
          aria-label="Add a floor"
        />
        <button
          type="button"
          onClick={addFloor}
          className="shrink-0 p-3 rounded-ha-xl bg-surface-mid text-text-primary hover:bg-surface-lower transition-colors"
          aria-label="Add floor"
        >
          <Icon path={mdiPlus} size={20} />
        </button>
      </div>
    </div>
  );
}
