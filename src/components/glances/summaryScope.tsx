'use client';

import { createContext, useContext } from 'react';
import type { HassEntities } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Which entities a summary is about. Absent — the dashboard, the screensaver,
// the Home Center — means the whole home. An area page provides that room's
// entities instead, and the same chips and the same dialogs then describe the
// room you're standing in rather than the house around it.
//
// A context rather than a prop through five dialogs: SummaryGlance provides it,
// and each panel reads it where it would otherwise read the whole store.
// ─────────────────────────────────────────────────────────────────────────────

export interface SummaryScope {
  /** The entities in scope, keyed by id — the room's, not the home's. */
  entities: HassEntities;
  /** The area's name, for the dialogs to say what they're describing. */
  areaName: string;
}

const SummaryScopeContext = createContext<SummaryScope | null>(null);

export const SummaryScopeProvider = SummaryScopeContext.Provider;

/** The area a summary is scoped to, or null when it covers the whole home. */
export function useSummaryScope(): SummaryScope | null {
  return useContext(SummaryScopeContext);
}
