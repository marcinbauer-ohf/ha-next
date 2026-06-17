'use client';

import { useEffect, useState, useSyncExternalStore, type ComponentType } from 'react';

/**
 * DEBUG icon-set swap.
 *
 * The app draws ~all icons through <Icon path={mdi*} /> — call sites pass raw
 * MDI path strings, not names. To swap icon libraries at runtime we can't read
 * a path back to a name directly, so we lazily build a reverse map of every
 * @mdi/js export (path string -> kebab name), translate that name into the
 * equivalent component in the chosen alternate set, and render it. When a set
 * has no equivalent (the alt sets are smaller than MDI's ~7000), we fall back
 * to the original MDI path so the UI never breaks.
 *
 * Everything alt-set is dynamically imported, so none of these libs land in the
 * main bundle unless the toggle is flipped.
 */

export type IconSet = 'mdi' | 'phosphor' | 'lucide' | 'tabler';
export const ICON_SETS: IconSet[] = ['mdi', 'phosphor', 'lucide', 'tabler'];

const LS_KEY = 'ha-flag-icon-set';

// ---- tiny external store (so only icons re-render on swap, not every flag) ----

let current: IconSet = 'mdi';
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(LS_KEY);
  if (stored && (ICON_SETS as string[]).includes(stored)) current = stored as IconSet;
}

const listeners = new Set<() => void>();

export function getIconSet(): IconSet {
  return current;
}

export function setIconSet(value: IconSet): void {
  if (value === current) return;
  current = value;
  if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, value);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useIconSet(): IconSet {
  return useSyncExternalStore(subscribe, getIconSet, () => 'mdi');
}

// ---- lazy MDI path -> kebab-name reverse map ----

let mdiReverse: Map<string, string> | null = null;
let mdiReversePromise: Promise<Map<string, string>> | null = null;

function loadMdiReverse(): Promise<Map<string, string>> {
  if (mdiReverse) return Promise.resolve(mdiReverse);
  if (!mdiReversePromise) {
    mdiReversePromise = import('@mdi/js').then((mod) => {
      const map = new Map<string, string>();
      for (const [key, value] of Object.entries(mod)) {
        if (!key.startsWith('mdi') || typeof value !== 'string') continue;
        const kebab = key
          .slice(3) // drop "mdi"
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase();
        if (!map.has(value)) map.set(value, kebab);
      }
      mdiReverse = map;
      return map;
    });
  }
  return mdiReversePromise;
}

// ---- lazy alt-set catalogs ----
//
// We want a *full* swap: every MDI icon resolves to SOMETHING in the target set,
// never falling back to MDI. So each set's whole catalog is enumerated (kebab
// name -> real export key) plus a token index for fuzzy matching.

type AltModule = Record<string, ComponentType<{ size?: number; className?: string }>>;

interface AltCatalog {
  mod: AltModule;
  /** kebab name -> actual export key (e.g. "arrow-left" -> "IconArrowLeft" for tabler). */
  byKebab: Map<string, string>;
  /** all kebab names, for the deterministic-hash last resort. */
  names: string[];
  /** token -> kebab names containing it, for fuzzy-by-meaning matching. */
  tokenIndex: Map<string, string[]>;
}

const altCatalogCache: Partial<Record<IconSet, AltCatalog>> = {};
const altCatalogPromise: Partial<Record<IconSet, Promise<AltCatalog>>> = {};

function isComponentExport(mod: AltModule, key: string): boolean {
  const v = mod[key] as unknown;
  return !!v && (typeof v === 'function' || (typeof v === 'object' && '$$typeof' in (v as object)));
}

// PascalCase export -> kebab. Handles digits and acronyms (AArrowDown -> a-arrow-down).
function pascalToKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function buildCatalog(set: IconSet, mod: AltModule): AltCatalog {
  const byKebab = new Map<string, string>();
  for (const key of Object.keys(mod)) {
    if (!isComponentExport(mod, key)) continue;
    let base: string;
    if (set === 'tabler') {
      // Every Tabler component is `Icon`-prefixed: IconArrowLeft, Icon123, …
      if (!key.startsWith('Icon') || key === 'Icon') continue;
      base = key.slice(4);
    } else {
      // lucide & phosphor ship both `House` and the `HouseIcon` alias — keep the base.
      if (key === 'default' || key === 'icons') continue;
      if (key.endsWith('Icon') && key !== 'Icon') continue;
      base = key;
    }
    if (!base) continue;
    const kebab = pascalToKebab(base);
    if (!byKebab.has(kebab)) byKebab.set(kebab, key);
  }
  const names = [...byKebab.keys()].sort();
  const tokenIndex = new Map<string, string[]>();
  for (const kebab of names) {
    for (const token of kebab.split('-')) {
      const list = tokenIndex.get(token);
      if (list) list.push(kebab);
      else tokenIndex.set(token, [kebab]);
    }
  }
  return { mod, byKebab, names, tokenIndex };
}

function loadAltCatalog(set: IconSet): Promise<AltCatalog> {
  if (altCatalogCache[set]) return Promise.resolve(altCatalogCache[set]!);
  if (!altCatalogPromise[set]) {
    const importer =
      set === 'lucide'
        ? import('lucide-react')
        : set === 'tabler'
          ? import('@tabler/icons-react')
          : import('@phosphor-icons/react');
    altCatalogPromise[set] = importer.then((mod) => {
      const cat = buildCatalog(set, mod as unknown as AltModule);
      altCatalogCache[set] = cat;
      return cat;
    });
  }
  return altCatalogPromise[set]!;
}

// Stable FNV-1a hash — used so unmatched icons map to a CONSISTENT (not per-render
// flickering) target, spread across the set rather than all collapsing to one glyph.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Fuzzy match by meaning: score candidates by shared tokens, weighting earlier
// tokens higher (MDI names are head-first: "lightbulb-group" → "lightbulb", not
// "group"). Tie-break toward the more generic (fewer-token) name, then stably.
function fuzzyMatch(cat: AltCatalog, kebab: string): string | null {
  const tokens = kebab.split('-');
  const score = new Map<string, number>();
  tokens.forEach((token, i) => {
    const candidates = cat.tokenIndex.get(token);
    if (!candidates) return;
    const weight = 1 / (i + 1);
    for (const k of candidates) score.set(k, (score.get(k) ?? 0) + weight);
  });
  let best: string | null = null;
  let bestScore = 0;
  let bestLen = Infinity;
  for (const [k, sc] of score) {
    const len = k.split('-').length;
    if (
      sc > bestScore + 1e-9 ||
      (Math.abs(sc - bestScore) < 1e-9 && len < bestLen) ||
      (Math.abs(sc - bestScore) < 1e-9 && len === bestLen && best !== null && k < best)
    ) {
      best = k;
      bestScore = sc;
      bestLen = len;
    }
  }
  return best;
}

// Resolve an MDI kebab name to a kebab name guaranteed present in `cat`:
//   alias (curated) → exact → fuzzy-by-meaning → deterministic hash.
// Always returns a name, so the swap is total.
function resolveKebab(set: Exclude<IconSet, 'mdi'>, cat: AltCatalog, name: string): string {
  const alias = ALIASES[set]?.[name];
  if (alias && cat.byKebab.has(alias)) return alias;
  if (cat.byKebab.has(name)) return name;
  const fuzzy = fuzzyMatch(cat, name);
  if (fuzzy) return fuzzy;
  return cat.names[hashString(name) % cat.names.length];
}

// MDI names diverge semantically from the other sets (mdi "magnify" = "search",
// "cog" = "settings"/"gear", etc.). These curated aliases give the app's
// highest-frequency icons their best match before the generic fuzzy/hash tiers.
const ALIASES: Record<Exclude<IconSet, 'mdi'>, Record<string, string>> = {
  lucide: {
    close: 'x', flash: 'zap', robot: 'bot', devices: 'smartphone', update: 'refresh-cw',
    cog: 'settings', 'information-outline': 'info', 'timer-outline': 'timer', magnify: 'search',
    'alert-circle-outline': 'alert-circle', 'open-in-new': 'external-link', microphone: 'mic',
    information: 'info', cancel: 'ban', 'map-marker-outline': 'map-pin', web: 'globe',
  },
  tabler: {
    close: 'x', flash: 'bolt', update: 'refresh', cog: 'settings', 'check-circle': 'circle-check',
    'timer-outline': 'clock', magnify: 'search', 'alert-circle-outline': 'alert-circle',
    'open-in-new': 'external-link', layers: 'stack', information: 'info-circle', cancel: 'ban',
    'map-marker-outline': 'map-pin', web: 'globe', play: 'player-play', pause: 'player-pause',
    lightbulb: 'bulb', speaker: 'speakerphone', wrench: 'tool', thermometer: 'temperature',
    'information-outline': 'info-circle',
  },
  phosphor: {
    close: 'x', flash: 'lightning', 'chevron-right': 'caret-right', update: 'arrows-clockwise',
    cog: 'gear', 'chevron-down': 'caret-down', 'information-outline': 'info', 'timer-outline': 'timer',
    speaker: 'speaker-high', magnify: 'magnifying-glass', 'alert-circle-outline': 'warning-circle',
    'open-in-new': 'arrow-square-out', layers: 'stack', home: 'house', information: 'info',
    cancel: 'x-circle', 'map-marker-outline': 'map-pin', web: 'globe',
  },
};

// Resolution cache keyed by `${set}|${path}`. Value null = still loading.
const resolved = new Map<string, ComponentType<{ size?: number; className?: string }> | null>();

/**
 * Resolves an MDI path string to a component in `set`. Returns null only when
 * set === 'mdi' or while the catalog is loading (caller renders the MDI path
 * meanwhile). Once loaded, every icon resolves — the swap is total.
 */
export function useAltIcon(
  set: IconSet,
  path: string,
): ComponentType<{ size?: number; className?: string }> | null {
  const key = `${set}|${path}`;
  const [comp, setComp] = useState<ComponentType<{ size?: number; className?: string }> | null>(
    () => (set === 'mdi' ? null : (resolved.get(key) ?? null)),
  );

  useEffect(() => {
    if (set === 'mdi') {
      setComp(null);
      return;
    }
    if (resolved.has(key)) {
      setComp(resolved.get(key)!);
      return;
    }
    let cancelled = false;
    Promise.all([loadMdiReverse(), loadAltCatalog(set)])
      .then(([reverse, cat]) => {
        if (cancelled) return;
        // Fall back to the raw path for hashing if it isn't a known MDI path.
        const name = reverse.get(path) ?? path;
        const kebab = resolveKebab(set, cat, name);
        const exportKey = cat.byKebab.get(kebab);
        const c = exportKey ? (cat.mod[exportKey] ?? null) : null;
        resolved.set(key, c);
        setComp(c);
      })
      .catch(() => {
        if (!cancelled) setComp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key, set, path]);

  return comp;
}
