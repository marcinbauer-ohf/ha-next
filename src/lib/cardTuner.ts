'use client';

// Live tuning store for the DeviceCardV2 readability experiments. The tuner
// panel (settings → Prototype & Debug → Developer flags, or ⌘⇧C) writes CSS
// custom properties straight onto <html>; the card reads every tunable value
// through `var(--dct-*, fallback)` so slider changes repaint instantly without
// re-rendering a single memoized card.
//
// Only overrides are stored — an untouched slider leaves no var behind, so the
// card's baked-in fallbacks stay the single source of truth for defaults.

import { useSyncExternalStore } from 'react';

const LS_KEY = 'ha-card-tuner';

export type CardTunerGroup = 'Type' | 'Layout' | 'Image & graph' | 'Secondary rows';

export interface CardTunerParam {
  id: string;
  cssVar: string;
  label: string;
  group: CardTunerGroup;
  min: number;
  max: number;
  step: number;
  /** Appended to the number when written to the CSS var ('' for unitless). */
  unit: 'px' | '%' | '';
  /** Must match the fallback baked into DeviceCardV2. */
  defaultValue: number;
}

export interface CardTunerToggle {
  id: string;
  label: string;
  group: CardTunerGroup;
  /** Vars written while the toggle is ON; removed when off. */
  vars: Record<string, string>;
}

export const CARD_TUNER_PARAMS: CardTunerParam[] = [
  // ── Type ──
  { id: 'nameSize', cssVar: '--dct-name-size', label: 'Name size', group: 'Type', min: 12, max: 22, step: 0.5, unit: 'px', defaultValue: 15 },
  { id: 'nameWeight', cssVar: '--dct-name-weight', label: 'Name weight', group: 'Type', min: 400, max: 800, step: 100, unit: '', defaultValue: 600 },
  { id: 'stateSize', cssVar: '--dct-state-size', label: 'State size', group: 'Type', min: 10, max: 18, step: 0.5, unit: 'px', defaultValue: 13 },
  { id: 'stateGap', cssVar: '--dct-state-gap', label: 'Name → state gap', group: 'Type', min: 0, max: 12, step: 1, unit: 'px', defaultValue: 2 },
  { id: 'areaSize', cssVar: '--dct-area-size', label: 'Area size', group: 'Type', min: 9, max: 15, step: 0.5, unit: 'px', defaultValue: 12 },
  // ── Layout ──
  { id: 'minH', cssVar: '--dct-min-h', label: 'Card height (desktop)', group: 'Layout', min: 96, max: 220, step: 4, unit: 'px', defaultValue: 136 },
  { id: 'pad', cssVar: '--dct-pad', label: 'Card padding', group: 'Layout', min: 6, max: 24, step: 1, unit: 'px', defaultValue: 12 },
  // ── Image & graph ──
  { id: 'thumbW', cssVar: '--dct-thumb-w', label: 'Image width', group: 'Image & graph', min: 20, max: 60, step: 1, unit: '%', defaultValue: 44 },
  { id: 'thumbH', cssVar: '--dct-thumb-h', label: 'Image height', group: 'Image & graph', min: 30, max: 100, step: 2, unit: '%', defaultValue: 64 },
  { id: 'thumbFade', cssVar: '--dct-thumb-fade', label: 'Image edge fade', group: 'Image & graph', min: 0, max: 60, step: 2, unit: '%', defaultValue: 28 },
  { id: 'thumbAlpha', cssVar: '--dct-thumb-alpha', label: 'Image opacity', group: 'Image & graph', min: 0.2, max: 1, step: 0.05, unit: '', defaultValue: 1 },
  { id: 'sparkAlpha', cssVar: '--dct-spark-alpha', label: 'Sparkline opacity', group: 'Image & graph', min: 0, max: 1, step: 0.05, unit: '', defaultValue: 1 },
  // ── Secondary rows ──
  { id: 'rowH', cssVar: '--dct-row-h', label: 'Row height', group: 'Secondary rows', min: 36, max: 72, step: 2, unit: 'px', defaultValue: 52 },
  { id: 'rowSize', cssVar: '--dct-row-size', label: 'Row text size', group: 'Secondary rows', min: 11, max: 17, step: 0.5, unit: 'px', defaultValue: 15 },
];

export const CARD_TUNER_TOGGLES: CardTunerToggle[] = [
  {
    id: 'stateSans',
    label: 'State in UI font (not mono)',
    group: 'Type',
    vars: { '--dct-state-font': 'var(--font-sans)' },
  },
  {
    id: 'areaCaps',
    label: 'Area as spaced caps',
    group: 'Type',
    vars: { '--dct-area-transform': 'uppercase', '--dct-area-tracking': '0.08em' },
  },
];

export const CARD_TUNER_GROUPS: CardTunerGroup[] = ['Type', 'Layout', 'Image & graph', 'Secondary rows'];

interface CardTunerState {
  /** Param id → value, only when it differs from the default. */
  overrides: Record<string, number>;
  toggles: Record<string, boolean>;
}

let state: CardTunerState = { overrides: {}, toggles: {} };
let panelOpen = false;
let initialized = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function applyToRoot(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  for (const p of CARD_TUNER_PARAMS) {
    const value = state.overrides[p.id];
    if (value !== undefined && value !== p.defaultValue) root.setProperty(p.cssVar, `${value}${p.unit}`);
    else root.removeProperty(p.cssVar);
  }
  for (const t of CARD_TUNER_TOGGLES) {
    for (const [cssVar, cssValue] of Object.entries(t.vars)) {
      if (state.toggles[t.id]) root.setProperty(cssVar, cssValue);
      else root.removeProperty(cssVar);
    }
  }
}

function persist(): void {
  try {
    if (Object.keys(state.overrides).length === 0 && Object.keys(state.toggles).length === 0) {
      localStorage.removeItem(LS_KEY);
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }
  } catch {
    /* storage full / private mode — live values still work */
  }
}

/** Load persisted tweaks and push them onto <html>. Safe to call repeatedly. */
export function initCardTuner(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CardTunerState>;
      state = {
        overrides: typeof parsed.overrides === 'object' && parsed.overrides ? parsed.overrides : {},
        toggles: typeof parsed.toggles === 'object' && parsed.toggles ? parsed.toggles : {},
      };
    }
  } catch {
    state = { overrides: {}, toggles: {} };
  }
  applyToRoot();
}

export function setCardTunerValue(id: string, value: number): void {
  const param = CARD_TUNER_PARAMS.find((p) => p.id === id);
  if (!param) return;
  const overrides = { ...state.overrides };
  if (value === param.defaultValue) delete overrides[id];
  else overrides[id] = value;
  state = { ...state, overrides };
  applyToRoot();
  persist();
  emit();
}

export function setCardTunerToggle(id: string, on: boolean): void {
  const toggles = { ...state.toggles };
  if (on) toggles[id] = true;
  else delete toggles[id];
  state = { ...state, toggles };
  applyToRoot();
  persist();
  emit();
}

export function resetCardTuner(): void {
  state = { overrides: {}, toggles: {} };
  applyToRoot();
  persist();
  emit();
}

export function getCardTunerValue(id: string): number {
  const param = CARD_TUNER_PARAMS.find((p) => p.id === id);
  return state.overrides[id] ?? param?.defaultValue ?? 0;
}

export function cardTunerHasOverrides(): boolean {
  return Object.keys(state.overrides).length > 0 || Object.keys(state.toggles).length > 0;
}

/**
 * Snapshot of the current tweaks for handing back to a human/agent to bake in:
 * changed CSS vars with values, plus active toggles.
 */
export function serializeCardTuner(): string {
  const vars: Record<string, string> = {};
  for (const p of CARD_TUNER_PARAMS) {
    const v = state.overrides[p.id];
    if (v !== undefined && v !== p.defaultValue) vars[p.cssVar] = `${v}${p.unit} /* ${p.label}, default ${p.defaultValue}${p.unit} */`;
  }
  for (const t of CARD_TUNER_TOGGLES) {
    if (state.toggles[t.id]) {
      for (const [cssVar, cssValue] of Object.entries(t.vars)) vars[cssVar] = cssValue;
    }
  }
  return JSON.stringify(vars, null, 2);
}

// ── Panel visibility (session-only) ──────────────────────────────────────────

export function toggleCardTunerPanel(force?: boolean): void {
  panelOpen = force ?? !panelOpen;
  if (panelOpen) initCardTuner();
  emit();
}

// ── React bindings ────────────────────────────────────────────────────────────

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCardTunerOpen(): boolean {
  return useSyncExternalStore(subscribe, () => panelOpen, () => false);
}

const serverState: CardTunerState = { overrides: {}, toggles: {} };

export function useCardTunerState(): CardTunerState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}
