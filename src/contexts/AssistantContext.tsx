'use client';

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface AssistantContextType {
  assistantOpen: boolean;
  /** Query handed over from the merged search UI, consumed by the overlay on open. */
  initialQuery: string | null;
  openAssistant: (initialQuery?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | null>(null);

  const openAssistant = useCallback((query?: string) => {
    setInitialQuery(query?.trim() || null);
    setAssistantOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const toggleAssistant = useCallback(() => {
    setInitialQuery(null);
    setAssistantOpen(prev => !prev);
  }, []);

  const value = useMemo(
    () => ({ assistantOpen, initialQuery, openAssistant, closeAssistant, toggleAssistant }),
    [assistantOpen, initialQuery, openAssistant, closeAssistant, toggleAssistant],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistantContext must be used within an AssistantProvider');
  }
  return context;
}
