'use client';

import { useEffect, useRef } from 'react';
import { useHomeAssistantEntities } from './useHomeAssistant';
import { entityDomain, friendlyName, isOn, TOGGLEABLE } from '@/lib/homeassistant/entityHelpers';
import { emitHomePulse, PULSE_COLORS } from '@/lib/homePulseBus';
import type { HassEntity } from '@/types';

/** The change kinds a user can switch on/off as triggers (a subset of PulseKind —
 *  'link' is a connection heartbeat, never produced by this reactor). */
export type ReactiveTriggerKind = 'on' | 'off' | 'error' | 'alert';
export const REACTIVE_TRIGGER_KINDS: ReactiveTriggerKind[] = ['on', 'off', 'error', 'alert'];

/**
 * What is allowed to fire a reactive pulse (ripple + screensaver tip).
 *  - `kinds`: which change kinds count. Empty ⇒ nothing fires.
 *  - `domains`: which entity domains count. Empty ⇒ every domain.
 * Both act as allow-lists ANDed together.
 */
export interface ReactiveTriggerConfig {
  kinds: readonly ReactiveTriggerKind[];
  domains: readonly string[];
}

// ── Tuning ──────────────────────────────────────────────────────────────────
const NUMERIC_JUMP_RATIO = 0.15; // relative change for a numeric sensor to count
const MAX_PER_BATCH = 4;         // don't flood the background on bulk updates (startup, scenes)

const JUNK = new Set(['unavailable', 'unknown', '']);

/**
 * Map a state transition to a semantic pulse kind, independent of the user's
 * filters. Returns null when the change is intrinsically not a pulse (no change,
 * or a numeric wobble below the jump threshold). The caller applies the
 * kind/domain allow-lists. Colour is derived from the kind (PULSE_COLORS[kind]).
 */
function classifyPulse(prev: HassEntity, next: HassEntity): ReactiveTriggerKind | null {
  if (prev.state === next.state) return null;
  const p = prev.state.toLowerCase();
  const n = next.state.toLowerCase();

  const toError = !JUNK.has(p) && JUNK.has(n);
  if (toError) return 'error';

  const fromError = JUNK.has(p) && !JUNK.has(n);
  if (fromError) return 'on';  // recovered → treat like coming on

  // Both states are real values from here.
  const domain = entityDomain(next);
  const pn = parseFloat(prev.state);
  const nn = parseFloat(next.state);
  const numeric = !TOGGLEABLE.has(domain) && Number.isFinite(pn) && Number.isFinite(nn);

  if (numeric) {
    const denom = Math.max(Math.abs(pn), 1);
    if (Math.abs(nn - pn) / denom < NUMERIC_JUMP_RATIO) return null;
    return 'alert'; // significant sensor jump
  }

  // Categorical change (on/off, open/closed, locked/unlocked, …).
  return isOn(next) ? 'on' : 'off';
}

/**
 * Watches the live entity store and emits a semantic colour pulse onto the
 * home-pulse bus whenever a meaningful change occurs. The reactive ring
 * background consumes these. No-op while disabled (still tracks a baseline so
 * re-enabling doesn't fire a backlog of stale changes).
 *
 * `config` filters what counts: only the listed change `kinds` fire, and only
 * for the listed entity `domains` (empty domains ⇒ all). Callers should pass a
 * stable object (state-backed or module-const) so the watch effect isn't torn
 * down every render.
 */
export function useHomeEventReactor(enabled: boolean, config: ReactiveTriggerConfig): void {
  const entities = useHomeAssistantEntities();
  // The store hands out immutable snapshot objects, so the previous snapshot
  // can be kept as-is — no per-tick Map/entries allocation over every entity.
  const prevRef = useRef<Record<string, HassEntity> | null>(null);
  const { kinds, domains } = config;

  useEffect(() => {
    // First sight, or while disabled: record the baseline, never fire.
    if (!enabled || prevRef.current === null) {
      prevRef.current = entities;
      return;
    }

    const prev = prevRef.current;
    let emitted = 0;

    for (const id in entities) {
      if (emitted >= MAX_PER_BATCH) break;
      const before = prev[id];
      if (!before) continue; // entity only just appeared — no prior state to compare
      const next = entities[id];
      if (before === next) continue; // untouched since last tick
      const kind = classifyPulse(before, next);
      if (!kind || !kinds.includes(kind)) continue; // change kind not wanted
      if (domains.length && !domains.includes(entityDomain(next))) continue; // domain not wanted
      emitHomePulse(PULSE_COLORS[kind], { label: friendlyName(next), kind });
      emitted++;
    }

    prevRef.current = entities;
  }, [entities, enabled, kinds, domains]);
}
