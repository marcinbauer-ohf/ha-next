'use client';

import { useEffect, useRef } from 'react';
import { useHomeAssistantEntities } from './useHomeAssistant';
import { entityDomain, friendlyName, isOn, TOGGLEABLE } from '@/lib/homeassistant/entityHelpers';
import { emitHomePulse, PULSE_COLORS, type PulseKind } from '@/lib/homePulseBus';
import type { HassEntity } from '@/types';

export type ReactiveTriggerMode = 'toggles-errors' | 'all' | 'errors';

// ── Tuning ──────────────────────────────────────────────────────────────────
const NUMERIC_JUMP_RATIO = 0.15; // relative change for a numeric sensor to count
const MAX_PER_BATCH = 4;         // don't flood the background on bulk updates (startup, scenes)

const JUNK = new Set(['unavailable', 'unknown', '']);

/**
 * Map a state transition to a semantic pulse kind, honouring the trigger mode.
 * Returns null when the change shouldn't spawn a ripple. The colour is derived
 * from the kind by the caller (PULSE_COLORS[kind]).
 */
function classifyPulse(prev: HassEntity, next: HassEntity, mode: ReactiveTriggerMode): PulseKind | null {
  if (prev.state === next.state) return null;
  const p = prev.state.toLowerCase();
  const n = next.state.toLowerCase();

  const toError = !JUNK.has(p) && JUNK.has(n);
  if (toError) return 'error'; // errors surface in every mode
  if (mode === 'errors') return null;     // errors-only: ignore everything else

  const fromError = JUNK.has(p) && !JUNK.has(n);
  if (fromError) return 'on';  // recovered → treat like coming on

  // Both states are real values from here.
  const domain = entityDomain(next);
  const pn = parseFloat(prev.state);
  const nn = parseFloat(next.state);
  const numeric = !TOGGLEABLE.has(domain) && Number.isFinite(pn) && Number.isFinite(nn);

  if (numeric) {
    if (mode !== 'all') return null; // numeric jumps only in "all changes" mode
    const denom = Math.max(Math.abs(pn), 1);
    if (Math.abs(nn - pn) / denom < NUMERIC_JUMP_RATIO) return null;
    return 'alert';
  }

  // Categorical change (on/off, open/closed, locked/unlocked, …).
  return isOn(next) ? 'on' : 'off';
}

/**
 * Watches the live entity store and emits a semantic colour pulse onto the
 * home-pulse bus whenever a meaningful change occurs. The reactive ring
 * background consumes these. No-op while disabled (still tracks a baseline so
 * re-enabling doesn't fire a backlog of stale changes).
 */
export function useHomeEventReactor(enabled: boolean, mode: ReactiveTriggerMode): void {
  const entities = useHomeAssistantEntities();
  const prevRef = useRef<Map<string, HassEntity> | null>(null);

  useEffect(() => {
    // First sight, or while disabled: record the baseline, never fire.
    if (!enabled || prevRef.current === null) {
      prevRef.current = new Map(Object.entries(entities));
      return;
    }

    const prev = prevRef.current;
    let emitted = 0;

    for (const id in entities) {
      if (emitted >= MAX_PER_BATCH) break;
      const before = prev.get(id);
      if (!before) continue; // entity only just appeared — no prior state to compare
      const next = entities[id];
      const kind = classifyPulse(before, next, mode);
      if (!kind) continue;
      emitHomePulse(PULSE_COLORS[kind], { label: friendlyName(next), kind });
      emitted++;
    }

    prevRef.current = new Map(Object.entries(entities));
  }, [entities, enabled, mode]);
}
