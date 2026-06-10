'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { SidebarItem } from './SidebarItemsContext';

/**
 * Session-only arrange ("jiggle") state for the sidebar / bottom-sheet items.
 *
 * Nothing here is persisted: order + hidden reset on reload. Deletes are SOFT —
 * an item is only hidden locally, the Home Assistant config is never touched.
 * `order` only ever holds visible (non-hidden, non-home) ids so a reorder can
 * map group slots one-to-one with the dragged sequence.
 */
interface SidebarArrangeValue {
  arranging: boolean;
  enterArrange: () => void;
  exitArrange: () => void;
  /** Preferred order of visible non-home item ids. Empty = use each surface's default sort. */
  order: string[];
  hiddenIds: Set<string>;
  isHidden: (id: string) => boolean;
  /** Soft-hide an item for this session (also drops it from the order). */
  hideItem: (id: string) => void;
  /** Restore every soft-hidden item. */
  restoreAll: () => void;
  /**
   * Apply a reorder. `allVisibleIds` is every currently-visible non-home id
   * (the order is normalised against it); `groupIds` are the ids that share the
   * surface being dragged (the whole rail on desktop, one grid on mobile); and
   * `newGroupSeq` is their new sequence. Ids outside the group keep their slots.
   */
  reorderVisible: (allVisibleIds: string[], groupIds: string[], newGroupSeq: string[]) => void;
}

const SidebarArrangeContext = createContext<SidebarArrangeValue>({
  arranging: false,
  enterArrange: () => {},
  exitArrange: () => {},
  order: [],
  hiddenIds: new Set(),
  isHidden: () => false,
  hideItem: () => {},
  restoreAll: () => {},
  reorderVisible: () => {},
});

/** Drop ids no longer present, then append any new ids in their incoming order. */
function normalizeOrder(order: string[], ids: string[]): string[] {
  const present = new Set(ids);
  const kept = order.filter((id) => present.has(id));
  const keptSet = new Set(kept);
  for (const id of ids) {
    if (!keptSet.has(id)) kept.push(id);
  }
  return kept;
}

export function SidebarArrangeProvider({ children }: { children: ReactNode }) {
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const enterArrange = useCallback(() => setArranging(true), []);
  const exitArrange = useCallback(() => setArranging(false), []);

  const isHidden = useCallback((id: string) => hiddenIds.has(id), [hiddenIds]);

  const hideItem = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  const restoreAll = useCallback(() => {
    setHiddenIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const reorderVisible = useCallback(
    (allVisibleIds: string[], groupIds: string[], newGroupSeq: string[]) => {
      setOrder((prev) => {
        const base = normalizeOrder(prev, allVisibleIds);
        const groupSet = new Set(groupIds);
        let k = 0;
        return base.map((id) => (groupSet.has(id) ? newGroupSeq[k++] ?? id : id));
      });
    },
    []
  );

  // Esc leaves arrange mode (desktop).
  useEffect(() => {
    if (!arranging) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArranging(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [arranging]);

  const value = useMemo<SidebarArrangeValue>(
    () => ({
      arranging,
      enterArrange,
      exitArrange,
      order,
      hiddenIds,
      isHidden,
      hideItem,
      restoreAll,
      reorderVisible,
    }),
    [arranging, enterArrange, exitArrange, order, hiddenIds, isHidden, hideItem, restoreAll, reorderVisible]
  );

  return <SidebarArrangeContext.Provider value={value}>{children}</SidebarArrangeContext.Provider>;
}

export function useSidebarArrange() {
  return useContext(SidebarArrangeContext);
}

/**
 * Filter out soft-hidden items, then stable-sort by `order`. Items missing from
 * `order` keep their incoming relative position (after the ordered ones), so an
 * empty order leaves the caller's default sort untouched.
 */
export function arrangeItems(
  items: SidebarItem[],
  order: string[],
  hiddenIds: Set<string>
): SidebarItem[] {
  const idx = new Map(order.map((id, i) => [id, i]));
  return items
    .filter((it): it is SidebarItem => !!it && !hiddenIds.has(it.id))
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ai = idx.has(a.it.id) ? (idx.get(a.it.id) as number) : Number.MAX_SAFE_INTEGER;
      const bi = idx.has(b.it.id) ? (idx.get(b.it.id) as number) : Number.MAX_SAFE_INTEGER;
      return ai !== bi ? ai - bi : a.i - b.i;
    })
    .map((x) => x.it);
}
