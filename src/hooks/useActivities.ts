'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  peekEntities,
  useHomeAssistant,
  useHomeAssistantSelector,
} from '@/hooks/useHomeAssistant';
import {
  areActivityDataEqual,
  selectActivityData,
  type ActivityData,
} from '@/lib/homeassistant/selectors';
import {
  attachEntityPeek,
  getActivitiesSnapshot,
  getEmptyActivitiesSnapshot,
  ingestActivityData,
  retainActivitiesTicker,
  subscribeActivities,
} from '@/lib/activities/ledger';
import type { ActivitiesSnapshot } from '@/lib/activities/types';

// The ledger lives in lib/ and stays import-cycle-free; the hooks layer hands
// it the entity peek it needs for freshness checks.
attachEntityPeek(peekEntities);

export interface UseActivitiesResult {
  /** Raw selector output — status widgets that predate the ledger still read this. */
  data: ActivityData;
  /** Lifecycle-aware view: linger cards, staleness, relevance order. */
  activities: ActivitiesSnapshot;
}

/**
 * Live-activity snapshot shared by the desktop status bar and the mobile nav.
 * One module ledger feeds every consumer, so ordering, ended cards, and
 * dismissals never diverge between surfaces.
 */
export function useActivities(): UseActivitiesResult {
  const data = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { connected, demoMode } = useHomeAssistant();

  useEffect(() => {
    // Demo mode has no socket but its mock entities update in place — treat
    // it as connected so everything isn't instantly marked stale.
    ingestActivityData(data, connected || demoMode);
  }, [data, connected, demoMode]);

  useEffect(() => retainActivitiesTicker(), []);

  const activities = useSyncExternalStore(
    subscribeActivities,
    getActivitiesSnapshot,
    getEmptyActivitiesSnapshot,
  );

  return { data, activities };
}
