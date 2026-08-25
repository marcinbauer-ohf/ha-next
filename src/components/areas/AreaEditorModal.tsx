'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiAlertCircleOutline, mdiClose, mdiMapMarkerOutline, mdiThermometer, mdiWaterPercent } from '@mdi/js';
import { useDeviceStructure } from '@/hooks';
import type { AreaRegistryEntry, FloorRegistryEntry, LabelRegistryEntry } from '@/lib/homeassistant';
import {
  Icon, IconPicker, AliasInput, Dropdown, IconButton, SectionLabel,
} from '@/components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// The one area editor. Opened from the settings Areas & floors list AND from a
// room page's top-bar pencil, so both surfaces edit the same fields and write
// the same registry call.
// ─────────────────────────────────────────────────────────────────────────────

/** Centered card on desktop, bottom sheet on mobile. Shared by the floor editor. */
export function EditorModal({
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
            className="fixed inset-0 z-[110] bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[111] mx-auto flex max-h-[88vh] w-full max-w-[480px] flex-col rounded-t-ha-sheet border border-surface-lower bg-surface-default p-ha-5 shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.5)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-ha-3xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
          >
            {/* Close on the left, options grouped on the right. */}
            <div className="mb-ha-4 flex items-center gap-ha-3">
              <IconButton icon={mdiClose} label="Close" size="sm" shape="square" onClick={onClose} />
              <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-text-primary">{title}</h3>
            </div>

            <div className="min-h-0 flex-1 space-y-ha-4 overflow-y-auto scrollbar-hide">{children}</div>

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

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-ha-1 block text-[13px] font-semibold text-text-secondary">{label}</span>
      {children}
      {hint && <span className="mt-ha-1 block text-xs text-text-tertiary">{hint}</span>}
    </label>
  );
}

export const textInputClass =
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
    return <p className="text-[13px] text-text-tertiary">No labels yet.</p>;
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
            className={
              on
                ? 'rounded-ha-full border border-ha-blue/40 bg-fill-primary-quiet px-ha-3 py-ha-1 text-[13px] font-semibold text-ha-blue'
                : 'rounded-ha-full border border-surface-lower bg-surface-low px-ha-3 py-ha-1 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-mid'
            }
          >
            {l.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Sensor pickers ───────────────────────────────────────────────────────────

/**
 * Sensors of one device class, this area's own first. Reads the registry
 * snapshot (structure, not live state) — a picker only needs names and classes.
 */
function useSensorOptions(areaId: string | undefined, deviceClass: 'temperature' | 'humidity') {
  const { devices, areas } = useDeviceStructure();
  return useMemo(() => {
    const here: { value: string; label: string }[] = [];
    const elsewhere: { value: string; label: string }[] = [];
    for (const device of devices) {
      for (const e of device.entities) {
        if (!e.entity_id.startsWith('sensor.')) continue;
        if (e.attributes.device_class !== deviceClass) continue;
        const name = (e.attributes.friendly_name as string | undefined) ?? e.entity_id;
        if (areaId && device.areaId === areaId) here.push({ value: e.entity_id, label: name });
        else elsewhere.push({ value: e.entity_id, label: `${name} · ${device.areaId ? areas.get(device.areaId) ?? 'Other area' : 'No area'}` });
      }
    }
    const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
    return [
      { value: '', label: 'Not set' },
      ...here.sort(byLabel),
      ...elsewhere.sort(byLabel),
    ];
  }, [devices, areas, areaId, deviceClass]);
}

// ── Area editor ──────────────────────────────────────────────────────────────

export interface AreaDraft {
  name: string;
  icon: string | null;
  floor_id: string | null;
  aliases: string[];
  labels: string[];
  temperature_entity_id: string | null;
  humidity_entity_id: string | null;
}

export function emptyAreaDraft(): AreaDraft {
  return { name: '', icon: null, floor_id: null, aliases: [], labels: [], temperature_entity_id: null, humidity_entity_id: null };
}

export function AreaEditorModal({
  open,
  initial,
  floors,
  labels,
  editable = true,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** null ⇒ create; otherwise edit existing. */
  initial: AreaRegistryEntry | null;
  floors: FloorRegistryEntry[];
  labels: LabelRegistryEntry[];
  /** False in demo / disconnected: the form still reads, saving is off. */
  editable?: boolean;
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
            temperature_entity_id: initial.temperature_entity_id ?? null,
            humidity_entity_id: initial.humidity_entity_id ?? null,
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
  const tempOptions = useSensorOptions(initial?.area_id, 'temperature');
  const humidityOptions = useSensorOptions(initial?.area_id, 'humidity');

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
      title={initial ? `${initial.name} settings` : 'New area'}
      onClose={onClose}
      onSave={submit}
      saving={saving}
      error={error}
      canSave={editable && draft.name.trim().length > 0}
      saveLabel={initial ? 'Save' : 'Create'}
    >
      {!editable && (
        <div className="flex items-start gap-ha-2 rounded-ha-xl border border-ha-blue/15 bg-fill-primary-quiet px-ha-3 py-ha-2">
          <Icon path={mdiAlertCircleOutline} size={16} className="mt-0.5 flex-shrink-0 text-ha-blue" exact />
          <span className="text-[13px] text-text-secondary">
            You&apos;re looking at the demo home — connect to your own to change this.
          </span>
        </div>
      )}

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

      {/* The two readings that stand for the room itself: what this room's
          summary shows, and what the voice assistant answers with. */}
      <div className="space-y-ha-2">
        <SectionLabel className="px-ha-1">This room&apos;s readings</SectionLabel>
        <Field label="Temperature">
          <div className="flex items-center gap-ha-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-lg bg-surface-low text-text-secondary">
              <Icon path={mdiThermometer} size={18} exact />
            </span>
            <Dropdown
              options={tempOptions}
              value={draft.temperature_entity_id ?? ''}
              onChange={(v) => setDraft((d) => ({ ...d, temperature_entity_id: v || null }))}
              align="left"
              className="min-w-0 flex-1"
            />
          </div>
        </Field>
        <Field label="Humidity" hint="Pick which sensor speaks for the room when several can. Left unset, every sensor in the room is averaged.">
          <div className="flex items-center gap-ha-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-lg bg-surface-low text-text-secondary">
              <Icon path={mdiWaterPercent} size={18} exact />
            </span>
            <Dropdown
              options={humidityOptions}
              value={draft.humidity_entity_id ?? ''}
              onChange={(v) => setDraft((d) => ({ ...d, humidity_entity_id: v || null }))}
              align="left"
              className="min-w-0 flex-1"
            />
          </div>
        </Field>
      </div>

      <Field label="Also called" hint="Other names you'd use out loud for this room.">
        <AliasInput value={draft.aliases} onChange={(aliases) => setDraft((d) => ({ ...d, aliases }))} placeholder="Lounge, Front room…" />
      </Field>

      <Field label="Labels">
        <LabelMultiSelect all={labels} selected={draft.labels} onChange={(labelsSel) => setDraft((d) => ({ ...d, labels: labelsSel }))} />
      </Field>
    </EditorModal>
  );
}
