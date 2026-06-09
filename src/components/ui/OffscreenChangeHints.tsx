'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { clsx } from 'clsx';
import { useHomeAssistantEntities } from '@/hooks';
import { entityDomain, isOn, TOGGLEABLE } from '@/lib/homeassistant/entityHelpers';
import type { HassEntity } from '@/types';

// ── Tuning ──────────────────────────────────────────────────────────────────
const HINT_LIFETIME_MS = 3000;     // matches the CSS fade animation
const MAX_HINTS = 12;              // cap simultaneous bars to avoid edge clutter
const OFFSCREEN_MARGIN = 8;        // px a card must be past the edge to count as offscreen
const NUMERIC_JUMP_RATIO = 0.15;   // relative change needed for a numeric sensor to be "meaningful"

type HintKind = 'on' | 'off' | 'numeric';
interface Hint {
  id: string;        // entity_id + last_updated — stable per change
  entityId: string;  // raw id — used to scroll the card back into view on tap
  edge: 'top' | 'bottom';
  x: number;         // px from the surface left edge, where the card is centered
  kind: HintKind;
}

const JUNK = new Set(['unavailable', 'unknown', '']);

/**
 * Decide whether a state transition is worth surfacing. Filters out sensor
 * noise: numeric sensors only count on a large relative jump; categorical
 * states (on/off, open/closed, locked/unlocked, …) count on any change.
 * Returns the hint colour kind, or null when the change should be ignored.
 */
function classifyChange(prev: HassEntity, next: HassEntity): HintKind | null {
  if (prev.state === next.state) return null;
  const p = prev.state.toLowerCase();
  const n = next.state.toLowerCase();
  if (JUNK.has(p) || JUNK.has(n)) return null; // ignore drop-outs / recoveries

  const domain = entityDomain(next);
  const pn = parseFloat(prev.state);
  const nn = parseFloat(next.state);
  const numeric = !TOGGLEABLE.has(domain) && Number.isFinite(pn) && Number.isFinite(nn);

  if (numeric) {
    const denom = Math.max(Math.abs(pn), 1);
    if (Math.abs(nn - pn) / denom < NUMERIC_JUMP_RATIO) return null;
    return 'numeric';
  }
  return isOn(next) ? 'on' : 'off';
}

interface OffscreenChangeHintsProps {
  /** The dashboard scroll container — its visible box defines on/offscreen. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Disable while editing or in 3D view. */
  enabled: boolean;
}

/**
 * Ambient edge cue: when an offscreen card's primary entity changes in a
 * meaningful way, a glowing bar pulses at the top or bottom edge of the
 * dashboard — horizontally aligned with the card's column — then fades.
 */
export function OffscreenChangeHints({ scrollRef, enabled }: OffscreenChangeHintsProps) {
  const entities = useHomeAssistantEntities();
  const prevRef = useRef<Map<string, HassEntity> | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [hints, setHints] = useState<Hint[]>([]);

  useEffect(() => {
    const scroller = scrollRef.current;

    // First sight (or while disabled): record the baseline, never fire.
    if (!enabled || prevRef.current === null || !scroller) {
      prevRef.current = new Map(Object.entries(entities));
      return;
    }

    const prev = prevRef.current;
    const containerRect = scroller.getBoundingClientRect();
    const fresh: Hint[] = [];

    for (const id in entities) {
      const before = prev.get(id);
      if (!before) continue; // entity only just appeared — no prior state to compare
      const kind = classifyChange(before, entities[id]);
      if (!kind) continue;

      // Locate the card showing this entity as its primary tile.
      const card = scroller.querySelector<HTMLElement>(`[data-entity-id="${CSS.escape(id)}"]`);
      if (!card) continue;
      const r = card.getBoundingClientRect();

      let edge: 'top' | 'bottom' | null = null;
      if (r.bottom <= containerRect.top + OFFSCREEN_MARGIN) edge = 'top';
      else if (r.top >= containerRect.bottom - OFFSCREEN_MARGIN) edge = 'bottom';
      if (!edge) continue; // card is (partly) visible — no need for a hint

      const x = r.left + r.width / 2 - containerRect.left;
      fresh.push({ id: `${id}:${entities[id].last_updated}`, entityId: id, edge, x, kind });
    }

    prevRef.current = new Map(Object.entries(entities));

    if (fresh.length === 0) return;

    setHints(prevHints => {
      const byId = new Map(prevHints.map(h => [h.id, h]));
      for (const h of fresh) byId.set(h.id, h);
      return Array.from(byId.values()).slice(-MAX_HINTS);
    });

    for (const h of fresh) {
      const t = setTimeout(() => {
        timersRef.current.delete(t);
        setHints(curr => curr.filter(x => x.id !== h.id));
      }, HINT_LIFETIME_MS);
      timersRef.current.add(t);
    }
  }, [entities, enabled, scrollRef]);

  // Clear everything when disabled (entering edit / 3D view).
  useEffect(() => {
    if (enabled) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    setHints([]);
  }, [enabled]);

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  const color: Record<HintKind, string> = {
    on: 'rgb(34, 197, 94)',     // emerald — turned on / active
    off: 'rgb(148, 163, 184)',  // slate — turned off / inactive
    numeric: 'rgb(56, 189, 248)', // sky — significant sensor jump
  };

  const scrollToCard = (entityId: string, kind: HintKind) => {
    const card = scrollRef.current?.querySelector<HTMLElement>(`[data-entity-id="${CSS.escape(entityId)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash a ring once the scroll settles, in the hint's colour.
    card.style.setProperty('--flash-color', color[kind]);
    card.classList.remove('ha-card-flash');
    void card.offsetWidth; // force reflow so the animation can re-trigger
    card.classList.add('ha-card-flash');
    const clear = () => { card.classList.remove('ha-card-flash'); card.removeEventListener('animationend', clear); };
    card.addEventListener('animationend', clear);
  };

  if (hints.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {hints.map(h => (
        <button
          key={h.id}
          type="button"
          onClick={() => scrollToCard(h.entityId, h.kind)}
          aria-label="Scroll to the device that changed"
          className={clsx(
            'ha-edge-hint-hit pointer-events-auto',
            h.edge === 'top' ? 'ha-edge-hint-hit--top' : 'ha-edge-hint-hit--bottom',
          )}
          style={{ left: `${h.x}px` }}
        >
          <span
            className={h.edge === 'top' ? 'ha-edge-hint ha-edge-hint--top' : 'ha-edge-hint ha-edge-hint--bottom'}
            style={{ ['--hint-color' as string]: color[h.kind] }}
          />
        </button>
      ))}
    </div>
  );
}
