// A tiny pub/sub bus connecting toasts to the status-bar clock widget. When a
// toast is shown about a subject the clock widget also reports (a Home Center
// section — connectivity, updates, battery, …), the widget pulses to hint
// where that information lives. Module-level so the toast provider and the
// status bar don't need to share a React tree.

import type { HomeCenterSectionId } from '@/lib/homeCenter';

type Listener = (section: HomeCenterSectionId) => void;

const listeners = new Set<Listener>();

export function emitStatusPulse(section: HomeCenterSectionId): void {
  listeners.forEach((l) => l(section));
}

export function subscribeStatusPulse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Dev-only hook so the pulse can be triggered from the console / E2E checks.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__emitStatusPulse = emitStatusPulse;
}
