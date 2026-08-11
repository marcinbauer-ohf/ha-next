import type { HistoryPoint } from './types';
import type { HassEntity } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Plausible history for entities that have none to fetch — the sample home, a
// disconnected session, and the staged benchmark rig. Without it every graph
// surface (card sparkline, dialog chart, state timeline) reads as broken in
// exactly the situations where someone is evaluating the UI.
//
// Lives here rather than in one component so the mini sparkline on a card and
// the dialog's chart draw the same curve for the same entity.
// ─────────────────────────────────────────────────────────────────────────────

/** Plausible "other" state per state, so timelines show realistic labels. */
const STATE_COUNTERPART: Record<string, string> = {
  on: 'off', off: 'on',
  open: 'closed', closed: 'open',
  playing: 'paused', paused: 'playing', idle: 'playing',
  home: 'not_home', not_home: 'home',
  locked: 'unlocked', unlocked: 'locked',
  detected: 'clear', clear: 'detected',
  heat: 'off', cool: 'off', heating: 'idle', cooling: 'idle',
  armed_home: 'disarmed', armed_away: 'disarmed', disarmed: 'armed_away',
  docked: 'cleaning', cleaning: 'docked',
  active: 'idle', streaming: 'idle',
};

/**
 * Deterministic pseudo-noise keyed by entity id, so the same entity always draws
 * the same curve (no reshuffle on every re-render) while different entities look
 * different.
 */
function seedFrom(entityId: string): number {
  let h = 0;
  for (let i = 0; i < entityId.length; i++) h = (h * 31 + entityId.charCodeAt(i)) % 9973;
  return h / 9973;
}

export function synthesizeHistory(entity: HassEntity, hours: number): HistoryPoint[] {
  const nowSec = Date.now() / 1000;
  const spanSec = hours * 3600;
  const count = Math.min(Math.max(Math.round(hours * 4), 12), 192); // ~4 pts/hr
  const seed = seedFrom(entity.entity_id);
  const base = parseFloat(entity.state);

  if (isNaN(base)) {
    const current = entity.state;
    if (current === 'unavailable' || current === 'unknown') return [];
    const other = STATE_COUNTERPART[current.toLowerCase()] ?? (current.toLowerCase() === 'off' ? 'on' : 'off');
    let s = current;
    return Array.from({ length: count }, (_, i) => {
      // Flip on a fixed cadence offset by the seed — no Math.random, so the
      // timeline stays stable between renders.
      if (i > 0 && (i + Math.round(seed * 7)) % Math.max(3, Math.round(count / 6)) === 0) {
        s = s === current ? other : current;
      }
      return { s, lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
    });
  }

  const amplitude = Math.abs(base) > 0 ? Math.abs(base) : 1;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const value =
      base +
      Math.sin((t + seed) * Math.PI * 4) * (amplitude * 0.04) +
      Math.sin((t + seed) * Math.PI * 12) * (amplitude * 0.015);
    return { s: value.toFixed(2), lc: nowSec - (count - 1 - i) * (spanSec / (count - 1)) };
  });
}
