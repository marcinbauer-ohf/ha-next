'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  mdiPlus, mdiPencil, mdiTrashCanOutline, mdiDrag, mdiMapMarkerOutline, mdiLayers,
  mdiHomeFloorNegative1, mdiTagOutline, mdiAlertCircleOutline, mdiClose,
} from '@mdi/js';
import { useAreasFloors, type AreaWithCounts, type FloorWithAreas } from '@/hooks';
import { useAddContext } from '@/contexts';
import type { LabelRegistryEntry } from '@/lib/homeassistant';
import {
  Icon, SectionLabel, IconPicker, iconPathFor, AliasInput, Dropdown, ConfirmDialog,
} from '@/components/ui';

// ── Editor modal scaffold ────────────────────────────────────────────────────
// Centered card on desktop, bottom sheet on mobile. Mirrors ConfirmDialog's
// portal + AnimatePresence approach so it layers above the settings workspace.

function EditorModal({
  open,
  title,
  onClose,
  onSave,
  saving,
  error,
  canSave,
  saveLabel = 'Save',
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  canSave: boolean;
  saveLabel?: string;
  children: ReactNode;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[110] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[111] mx-auto w-full max-w-[480px] rounded-t-ha-3xl border border-surface-lower bg-surface-default p-ha-5 shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.5)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-ha-3xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
          >
            <div className="mb-ha-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-ha-xl text-text-secondary transition-colors hover:bg-surface-mid"
              >
                <Icon path={mdiClose} size={20} />
              </button>
            </div>

            <div className="space-y-ha-4">{children}</div>

            {error && (
              <div className="mt-ha-4 flex items-start gap-ha-2 rounded-ha-xl bg-red-500/10 px-ha-3 py-ha-2 text-[13px] text-red-600">
                <Icon path={mdiAlertCircleOutline} size={16} className="mt-0.5 flex-shrink-0" exact />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-ha-5 flex justify-end gap-ha-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-ha-xl px-ha-4 py-ha-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-mid"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave || saving}
                className="rounded-ha-xl bg-ha-blue px-ha-4 py-ha-2 text-sm font-semibold text-white transition-colors hover:bg-ha-blue/90 disabled:opacity-40"
              >
                {saving ? 'Saving…' : saveLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-ha-1 block text-[13px] font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

const textInputClass =
  'w-full rounded-ha-2xl border border-surface-lower bg-surface-low px-ha-4 py-ha-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-ha-blue/40 focus:ring-1 focus:ring-ha-blue/20';

// ── Label multi-select ───────────────────────────────────────────────────────

function LabelMultiSelect({
  all,
  selected,
  onChange,
}: {
  all: LabelRegistryEntry[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (all.length === 0) {
    return <p className="text-[13px] text-text-tertiary">No labels defined yet. Create labels in Home Assistant to tag areas.</p>;
  }
  return (
    <div className="flex flex-wrap gap-ha-2">
      {all.map((l) => {
        const on = selected.includes(l.label_id);
        return (
          <button
            key={l.label_id}
            type="button"
            onClick={() => toggle(l.label_id)}
            className={`inline-flex items-center gap-ha-1 rounded-full px-ha-3 py-1 text-[13px] font-medium transition-colors ${
              on ? 'bg-ha-blue/15 text-ha-blue ring-1 ring-ha-blue/40' : 'bg-surface-mid text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon path={iconPathFor(l.icon) ?? mdiTagOutline} size={14} exact />
            {l.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Area editor ──────────────────────────────────────────────────────────────

interface AreaDraft {
  name: string;
  icon: string | null;
  floor_id: string | null;
  aliases: string[];
  labels: string[];
}

function AreaEditorModal({
  open,
  initial,
  floors,
  labels,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** null ⇒ create; otherwise edit existing. */
  initial: AreaWithCounts | null;
  floors: FloorWithAreas[];
  labels: LabelRegistryEntry[];
  onClose: () => void;
  onSubmit: (draft: AreaDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AreaDraft>(() => emptyAreaDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever the modal opens for a (different) target.
  const seedKey = `${open}:${initial?.area_id ?? 'new'}`;
  const [lastSeed, setLastSeed] = useState('');
  if (open && seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setDraft(
      initial
        ? {
            name: initial.name,
            icon: initial.icon ?? null,
            floor_id: initial.floor_id ?? null,
            aliases: initial.aliases ?? [],
            labels: initial.labels ?? [],
          }
        : emptyAreaDraft(),
    );
    setError(null);
    setSaving(false);
  }

  const floorOptions = useMemo(
    () => [{ value: '', label: 'No floor' }, ...floors.map((f) => ({ value: f.floor_id, label: f.name }))],
    [floors],
  );

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save area.');
      setSaving(false);
    }
  };

  return (
    <EditorModal
      open={open}
      title={initial ? 'Edit area' : 'New area'}
      onClose={onClose}
      onSave={submit}
      saving={saving}
      error={error}
      canSave={draft.name.trim().length > 0}
      saveLabel={initial ? 'Save' : 'Create'}
    >
      <Field label="Name">
        <div className="flex items-center gap-ha-3">
          <IconPicker value={draft.icon} onChange={(icon) => setDraft((d) => ({ ...d, icon }))} placeholderPath={mdiMapMarkerOutline} label="Area icon" />
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Living Room"
            className={textInputClass}
          />
        </div>
      </Field>

      <Field label="Floor">
        <Dropdown
          options={floorOptions}
          value={draft.floor_id ?? ''}
          onChange={(v) => setDraft((d) => ({ ...d, floor_id: v || null }))}
          align="left"
          className="w-full"
        />
      </Field>

      <Field label="Aliases">
        <AliasInput value={draft.aliases} onChange={(aliases) => setDraft((d) => ({ ...d, aliases }))} placeholder="Lounge, Front room…" />
      </Field>

      <Field label="Labels">
        <LabelMultiSelect all={labels} selected={draft.labels} onChange={(labelsSel) => setDraft((d) => ({ ...d, labels: labelsSel }))} />
      </Field>
    </EditorModal>
  );
}

function emptyAreaDraft(): AreaDraft {
  return { name: '', icon: null, floor_id: null, aliases: [], labels: [] };
}

// ── Floor editor ─────────────────────────────────────────────────────────────

interface FloorDraft {
  name: string;
  icon: string | null;
  level: string; // text field; parsed to number|null on submit
  aliases: string[];
}

function FloorEditorModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: FloorWithAreas | null;
  onClose: () => void;
  onSubmit: (draft: FloorDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FloorDraft>(() => emptyFloorDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seedKey = `${open}:${initial?.floor_id ?? 'new'}`;
  const [lastSeed, setLastSeed] = useState('');
  if (open && seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setDraft(
      initial
        ? {
            name: initial.name,
            icon: initial.icon ?? null,
            level: initial.level == null ? '' : String(initial.level),
            aliases: initial.aliases ?? [],
          }
        : emptyFloorDraft(),
    );
    setError(null);
    setSaving(false);
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save floor.');
      setSaving(false);
    }
  };

  return (
    <EditorModal
      open={open}
      title={initial ? 'Edit floor' : 'New floor'}
      onClose={onClose}
      onSave={submit}
      saving={saving}
      error={error}
      canSave={draft.name.trim().length > 0}
      saveLabel={initial ? 'Save' : 'Create'}
    >
      <Field label="Name">
        <div className="flex items-center gap-ha-3">
          <IconPicker value={draft.icon} onChange={(icon) => setDraft((d) => ({ ...d, icon }))} placeholderPath={mdiLayers} label="Floor icon" />
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Ground Floor"
            className={textInputClass}
          />
        </div>
      </Field>

      <Field label="Level">
        <input
          type="number"
          value={draft.level}
          onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
          placeholder="0"
          className={textInputClass}
        />
        <span className="mt-ha-1 block text-xs text-text-tertiary">Floors are ordered by level — 0 for ground, negative for basements.</span>
      </Field>

      <Field label="Aliases">
        <AliasInput value={draft.aliases} onChange={(aliases) => setDraft((d) => ({ ...d, aliases }))} placeholder="Downstairs, Main floor…" />
      </Field>
    </EditorModal>
  );
}

function emptyFloorDraft(): FloorDraft {
  return { name: '', icon: null, level: '', aliases: [] };
}

// ── Area card (draggable) ─────────────────────────────────────────────────────

function AreaCard({
  area,
  labels,
  editable,
  onEdit,
  onDelete,
}: {
  area: AreaWithCounts;
  labels: LabelRegistryEntry[];
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `area:${area.area_id}`,
    data: { areaId: area.area_id },
    disabled: !editable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  const iconPath = iconPathFor(area.icon) ?? mdiMapMarkerOutline;
  const areaLabels = (area.labels ?? [])
    .map((id) => labels.find((l) => l.label_id === id))
    .filter((l): l is LabelRegistryEntry => Boolean(l));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-3 py-ha-3 transition-shadow ${
        isDragging ? 'opacity-80 shadow-[0_18px_42px_-20px_rgba(15,23,42,0.5)]' : ''
      }`}
    >
      {editable && (
        <button
          type="button"
          aria-label="Drag to another floor"
          className="-ml-1 flex-shrink-0 cursor-grab touch-none text-text-disabled transition-colors hover:text-text-secondary active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <Icon path={mdiDrag} size={18} />
        </button>
      )}

      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-ha-3 text-left">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
          <Icon path={iconPath} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-ha-2">
            <span className="truncate text-[13px] font-semibold leading-tight text-text-primary">{area.name}</span>
            {areaLabels.map((l) => (
              <span key={l.label_id} className="inline-flex items-center gap-0.5 rounded-full bg-surface-mid px-ha-2 py-0.5 text-[11px] font-medium text-text-tertiary">
                <Icon path={iconPathFor(l.icon) ?? mdiTagOutline} size={11} exact />
                {l.name}
              </span>
            ))}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-text-secondary">
            {countLabel(area.deviceCount, area.entityCount)}
            {area.aliases && area.aliases.length > 0 ? ` · ${area.aliases.join(', ')}` : ''}
          </span>
        </span>
      </button>

      {editable && (
        <div className="flex flex-shrink-0 items-center gap-ha-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={onEdit} aria-label={`Edit ${area.name}`} className="flex h-8 w-8 items-center justify-center rounded-ha-lg text-text-tertiary transition-colors hover:bg-surface-mid hover:text-text-secondary">
            <Icon path={mdiPencil} size={16} />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${area.name}`} className="flex h-8 w-8 items-center justify-center rounded-ha-lg text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-600">
            <Icon path={mdiTrashCanOutline} size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function countLabel(devices: number, entities: number): string {
  const d = `${devices} ${devices === 1 ? 'device' : 'devices'}`;
  const e = `${entities} ${entities === 1 ? 'entity' : 'entities'}`;
  return `${d} · ${e}`;
}

// ── Floor group (droppable) ───────────────────────────────────────────────────

function FloorGroup({
  floor,
  labels,
  editable,
  onAddArea,
  onEditFloor,
  onDeleteFloor,
  onEditArea,
  onDeleteArea,
}: {
  floor: FloorWithAreas | null; // null ⇒ the "Unassigned" pseudo-floor
  labels: LabelRegistryEntry[];
  editable: boolean;
  onAddArea: () => void;
  onEditFloor?: () => void;
  onDeleteFloor?: () => void;
  onEditArea: (area: AreaWithCounts) => void;
  onDeleteArea: (area: AreaWithCounts) => void;
}) {
  const droppableId = floor ? `floor:${floor.floor_id}` : 'floor:__none__';
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { floorId: floor?.floor_id ?? null },
    disabled: !editable,
  });

  const areas = floor ? floor.areas : ([] as AreaWithCounts[]);
  const headerIcon = floor ? iconPathFor(floor.icon) ?? mdiLayers : mdiHomeFloorNegative1;

  return (
    <section>
      <div className="mb-ha-2 flex items-center gap-ha-2 px-ha-1">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-ha-lg bg-surface-mid text-text-secondary">
          <Icon path={headerIcon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{floor ? floor.name : 'Unassigned'}</p>
          {floor && floor.level != null && <p className="text-xs text-text-tertiary">Level {floor.level}</p>}
        </div>
        {floor && editable && (
          <>
            <button type="button" onClick={onEditFloor} aria-label="Edit floor" className="flex h-8 w-8 items-center justify-center rounded-ha-lg text-text-tertiary transition-colors hover:bg-surface-mid hover:text-text-secondary">
              <Icon path={mdiPencil} size={16} />
            </button>
            <button type="button" onClick={onDeleteFloor} aria-label="Delete floor" className="flex h-8 w-8 items-center justify-center rounded-ha-lg text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-600">
              <Icon path={mdiTrashCanOutline} size={16} />
            </button>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`space-y-ha-2 rounded-ha-2xl p-ha-1 transition-colors ${isOver ? 'bg-ha-blue/5 ring-1 ring-ha-blue/30' : ''}`}
      >
        {areas.length === 0 ? (
          <p className="px-ha-3 py-ha-4 text-center text-[13px] text-text-tertiary">
            {floor ? 'No areas on this floor yet.' : 'Every area is assigned to a floor.'}
          </p>
        ) : (
          areas.map((a) => (
            <AreaCard
              key={a.area_id}
              area={a}
              labels={labels}
              editable={editable}
              onEdit={() => onEditArea(a)}
              onDelete={() => onDeleteArea(a)}
            />
          ))
        )}

        {floor && editable && (
          <button
            type="button"
            onClick={onAddArea}
            className="flex w-full items-center justify-center gap-ha-2 rounded-ha-2xl border border-dashed border-surface-lower px-ha-3 py-ha-2 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
          >
            <Icon path={mdiPlus} size={16} exact />
            Add area to {floor.name}
          </button>
        )}
      </div>
    </section>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

type EditTarget =
  | { kind: 'area'; area: AreaWithCounts | null; floorId: string | null }
  | { kind: 'floor'; floor: FloorWithAreas | null }
  | null;

type DeleteTarget =
  | { kind: 'area'; area: AreaWithCounts }
  | { kind: 'floor'; floor: FloorWithAreas }
  | null;

export function AreasFloorsPanel() {
  const model = useAreasFloors();
  const { floors, unassignedAreas, labels, editable } = model;

  const [edit, setEdit] = useState<EditTarget>(null);
  const [del, setDel] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  // Create actions live in the top-bar "+" menu (AddMenu). It raises a request
  // through AddContext; we open the matching editor here. Ignored when the
  // registry isn't writable (demo / disconnected).
  const { pendingAdd, clearPendingAdd } = useAddContext();
  useEffect(() => {
    if (pendingAdd?.slug !== 'areas') return;
    if (editable) {
      setEdit(pendingAdd.variant === 'floor' ? { kind: 'floor', floor: null } : { kind: 'area', area: null, floorId: null });
    }
    clearPendingAdd();
  }, [pendingAdd, editable, clearPendingAdd]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const areaId = e.active.data.current?.areaId as string | undefined;
    if (!areaId || !e.over) return;
    const targetFloor = (e.over.data.current?.floorId ?? null) as string | null;
    const area = model.areas.find((a) => a.area_id === areaId);
    if (!area) return;
    if ((area.floor_id ?? null) === targetFloor) return;
    void model.reassignAreaToFloor(areaId, targetFloor);
  };

  const submitArea = async (draft: AreaDraft) => {
    const fields = { name: draft.name.trim(), icon: draft.icon, floor_id: draft.floor_id, aliases: draft.aliases, labels: draft.labels };
    if (edit?.kind === 'area' && edit.area) await model.updateArea(edit.area.area_id, fields);
    else await model.createArea(fields);
  };

  const submitFloor = async (draft: FloorDraft) => {
    const level = draft.level.trim() === '' ? null : Number(draft.level);
    const fields = { name: draft.name.trim(), icon: draft.icon, level: Number.isNaN(level as number) ? null : level, aliases: draft.aliases };
    if (edit?.kind === 'floor' && edit.floor) await model.updateFloor(edit.floor.floor_id, fields);
    else await model.createFloor(fields);
  };

  const confirmDelete = async () => {
    if (!del) return;
    setDeleting(true);
    try {
      if (del.kind === 'area') await model.deleteArea(del.area.area_id);
      else await model.deleteFloor(del.floor.floor_id);
      setDel(null);
    } finally {
      setDeleting(false);
    }
  };

  const areaInitial = edit?.kind === 'area' ? edit.area : null;
  const areaSeedFloor = edit?.kind === 'area' ? edit.floorId : null;

  return (
    <div className="space-y-ha-5">
      {!editable && (
        <div className="flex items-start gap-ha-3 rounded-ha-2xl border border-ha-blue/15 bg-fill-primary-quiet px-ha-4 py-ha-3">
          <Icon path={mdiAlertCircleOutline} size={18} className="mt-0.5 flex-shrink-0 text-ha-blue" exact />
          <p className="text-[13px] text-text-secondary">
            Editing areas and floors requires a live Home Assistant connection. Connect to your instance to create, edit, and organize them.
          </p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="space-y-ha-6">
          {floors.map((f) => (
            <FloorGroup
              key={f.floor_id}
              floor={f}
              labels={labels}
              editable={editable}
              onAddArea={() => setEdit({ kind: 'area', area: null, floorId: f.floor_id })}
              onEditFloor={() => setEdit({ kind: 'floor', floor: f })}
              onDeleteFloor={() => setDel({ kind: 'floor', floor: f })}
              onEditArea={(area) => setEdit({ kind: 'area', area, floorId: area.floor_id ?? null })}
              onDeleteArea={(area) => setDel({ kind: 'area', area })}
            />
          ))}

          {(unassignedAreas.length > 0 || floors.length === 0) && (
            <>
              {floors.length > 0 && <SectionLabel className="px-ha-1">Unassigned</SectionLabel>}
              <FloorGroup
                floor={null}
                labels={labels}
                editable={editable}
                onAddArea={() => setEdit({ kind: 'area', area: null, floorId: null })}
                onEditArea={(area) => setEdit({ kind: 'area', area, floorId: area.floor_id ?? null })}
                onDeleteArea={(area) => setDel({ kind: 'area', area })}
              />
            </>
          )}

          {floors.length === 0 && unassignedAreas.length === 0 && (
            <p className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-6 text-center text-sm text-text-tertiary">
              No areas or floors yet.{editable ? ' Use the “+” button in the top bar to add a floor or area.' : ''}
            </p>
          )}
        </div>
      </DndContext>

      <AreaEditorModal
        open={edit?.kind === 'area'}
        initial={areaInitial}
        floors={floors}
        labels={labels}
        onClose={() => setEdit(null)}
        onSubmit={async (draft) => {
          // Seed the floor when adding from a floor's "Add area" button.
          await submitArea(areaInitial ? draft : { ...draft, floor_id: draft.floor_id ?? areaSeedFloor });
        }}
      />

      <FloorEditorModal
        open={edit?.kind === 'floor'}
        initial={edit?.kind === 'floor' ? edit.floor : null}
        onClose={() => setEdit(null)}
        onSubmit={submitFloor}
      />

      <ConfirmDialog
        open={del != null}
        title={del?.kind === 'floor' ? `Delete ${del.floor.name}?` : del?.kind === 'area' ? `Delete ${del.area.name}?` : ''}
        message={
          del?.kind === 'floor'
            ? 'The floor is removed. Its areas are kept but become unassigned.'
            : 'Devices and entities in this area are kept but lose their area assignment.'
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDel(null)}
      />
    </div>
  );
}
