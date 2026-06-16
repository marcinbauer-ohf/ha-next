'use client';

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import type { SettingsSlug } from '@/components/profile/settingsNavigation';

// A create request raised from the top-bar "+" (AddMenu) and consumed by the
// section panel (e.g. Areas & Floors opens its area/floor editor). `nonce`
// makes repeat requests for the same target fire again. `variant` lets one
// section expose several create actions (Areas → 'area' | 'floor').
export interface AddRequest {
  slug: SettingsSlug;
  variant: string | null;
  nonce: number;
}

// Tracks which settings section the user is currently viewing, so the top-bar
// "+" (AddMenu) can hoist that section's "Add …" action to the top of the list
// (e.g. viewing Areas → "Add Area" first). Settings pages publish their slug;
// AddMenu consumes it. Null when not in a settings section.
interface AddContextValue {
  contextSlug: SettingsSlug | null;
  setContextSlug: (slug: SettingsSlug | null) => void;
  /** Latest create request, or null once consumed. */
  pendingAdd: AddRequest | null;
  /** Raise a create request (from AddMenu). */
  requestAdd: (slug: SettingsSlug, variant?: string | null) => void;
  /** Clear the request once the panel has acted on it. */
  clearPendingAdd: () => void;
}

const AddContext = createContext<AddContextValue | null>(null);

export function AddContextProvider({ children }: { children: ReactNode }) {
  const [contextSlug, setContextSlug] = useState<SettingsSlug | null>(null);
  const [pendingAdd, setPendingAdd] = useState<AddRequest | null>(null);

  const requestAdd = useCallback((slug: SettingsSlug, variant: string | null = null) => {
    setPendingAdd((prev) => ({ slug, variant, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const clearPendingAdd = useCallback(() => setPendingAdd(null), []);

  const value = useMemo(
    () => ({ contextSlug, setContextSlug, pendingAdd, requestAdd, clearPendingAdd }),
    [contextSlug, pendingAdd, requestAdd, clearPendingAdd],
  );
  return <AddContext.Provider value={value}>{children}</AddContext.Provider>;
}

export function useAddContext(): AddContextValue {
  const context = useContext(AddContext);
  if (!context) {
    throw new Error('useAddContext must be used within an AddContextProvider');
  }
  return context;
}
