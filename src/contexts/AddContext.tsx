'use client';

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { SettingsSlug } from '@/components/profile/settingsNavigation';

// Tracks which settings section the user is currently viewing, so the top-bar
// "+" (AddMenu) can hoist that section's "Add …" action to the top of the list
// (e.g. viewing Areas → "Add Area" first). Settings pages publish their slug;
// AddMenu consumes it. Null when not in a settings section.
interface AddContextValue {
  contextSlug: SettingsSlug | null;
  setContextSlug: (slug: SettingsSlug | null) => void;
}

const AddContext = createContext<AddContextValue | null>(null);

export function AddContextProvider({ children }: { children: ReactNode }) {
  const [contextSlug, setContextSlug] = useState<SettingsSlug | null>(null);
  const value = useMemo(() => ({ contextSlug, setContextSlug }), [contextSlug]);
  return <AddContext.Provider value={value}>{children}</AddContext.Provider>;
}

export function useAddContext(): AddContextValue {
  const context = useContext(AddContext);
  if (!context) {
    throw new Error('useAddContext must be used within an AddContextProvider');
  }
  return context;
}
