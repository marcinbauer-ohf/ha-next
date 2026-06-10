'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_HOME_CENTER_ORDER,
  HOME_CENTER_SECTION_IDS,
  HOME_CENTER_SECTION_MAP,
  isHomeCenterSectionId,
  type HomeCenterSectionId,
} from '@/lib/homeCenter';

const LS_ORDER_KEY = 'ha-home-center-order';
const LS_DISABLED_KEY = 'ha-home-center-disabled';

const isLocked = (id: HomeCenterSectionId) => Boolean(HOME_CENTER_SECTION_MAP[id]?.locked);

// Merge a stored order with the canonical id list: keep the stored sequence for
// ids we still know about, then append any new sections (added in a later build)
// at the end so they show up without wiping the user's arrangement.
function parseOrder(raw: string | null): HomeCenterSectionId[] {
  const stored = (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(isHomeCenterSectionId);
  const seen = new Set(stored);
  const merged = [...stored];
  for (const id of HOME_CENTER_SECTION_IDS) {
    if (!seen.has(id)) merged.push(id);
  }
  return merged.length > 0 ? merged : [...DEFAULT_HOME_CENTER_ORDER];
}

function parseDisabled(raw: string | null): Set<HomeCenterSectionId> {
  const ids = (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(isHomeCenterSectionId)
    // Locked sections can never be disabled, even if a stale value says so.
    .filter((id) => !isLocked(id));
  return new Set(ids);
}

interface HomeCenterPrefsContextValue {
  /** Full ordered list of every section (enabled or not). */
  order: HomeCenterSectionId[];
  /** Whether a section is shown. Locked sections are always true. */
  isEnabled: (id: HomeCenterSectionId) => boolean;
  /** Ordered list of only the sections that should render on the surfaces. */
  visibleSections: HomeCenterSectionId[];
  toggle: (id: HomeCenterSectionId) => void;
  /** Replace the full section order (e.g. after a drag-to-reorder). */
  setOrder: (order: HomeCenterSectionId[]) => void;
  reset: () => void;
}

const HomeCenterPrefsContext = createContext<HomeCenterPrefsContextValue | undefined>(undefined);

export function HomeCenterPrefsProvider({ children }: { children: ReactNode }) {
  const [order, setOrderState] = useState<HomeCenterSectionId[]>(() => {
    if (typeof window === 'undefined') return [...DEFAULT_HOME_CENTER_ORDER];
    return parseOrder(localStorage.getItem(LS_ORDER_KEY));
  });

  const [disabled, setDisabledState] = useState<Set<HomeCenterSectionId>>(() => {
    if (typeof window === 'undefined') return new Set();
    return parseDisabled(localStorage.getItem(LS_DISABLED_KEY));
  });

  const persistOrder = useCallback((next: HomeCenterSectionId[]) => {
    setOrderState(next);
    if (typeof window !== 'undefined') localStorage.setItem(LS_ORDER_KEY, next.join(','));
  }, []);

  const persistDisabled = useCallback((next: Set<HomeCenterSectionId>) => {
    setDisabledState(next);
    if (typeof window !== 'undefined') localStorage.setItem(LS_DISABLED_KEY, [...next].join(','));
  }, []);

  const isEnabled = useCallback(
    (id: HomeCenterSectionId) => isLocked(id) || !disabled.has(id),
    [disabled],
  );

  const toggle = useCallback((id: HomeCenterSectionId) => {
    if (isLocked(id)) return;
    setDisabledState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== 'undefined') localStorage.setItem(LS_DISABLED_KEY, [...next].join(','));
      return next;
    });
  }, []);

  const setOrder = useCallback((next: HomeCenterSectionId[]) => {
    // Guard against a partial list: keep only known ids, then append any missing.
    const filtered = next.filter(isHomeCenterSectionId);
    const seen = new Set(filtered);
    const complete = [...filtered];
    for (const id of HOME_CENTER_SECTION_IDS) {
      if (!seen.has(id)) complete.push(id);
    }
    persistOrder(complete);
  }, [persistOrder]);

  const reset = useCallback(() => {
    persistOrder([...DEFAULT_HOME_CENTER_ORDER]);
    persistDisabled(new Set());
  }, [persistOrder, persistDisabled]);

  const visibleSections = useMemo(
    () => order.filter((id) => isLocked(id) || !disabled.has(id)),
    [order, disabled],
  );

  const value = useMemo<HomeCenterPrefsContextValue>(
    () => ({ order, isEnabled, visibleSections, toggle, setOrder, reset }),
    [order, isEnabled, visibleSections, toggle, setOrder, reset],
  );

  return <HomeCenterPrefsContext.Provider value={value}>{children}</HomeCenterPrefsContext.Provider>;
}

export function useHomeCenterPrefs() {
  const context = useContext(HomeCenterPrefsContext);
  if (context === undefined) {
    throw new Error('useHomeCenterPrefs must be used within a HomeCenterPrefsProvider');
  }
  return context;
}
