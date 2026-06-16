'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NotificationSummary } from '@/lib/homeassistant/selectors';

/**
 * A notification that has been surfaced to the user (usually as a toast) and
 * kept around so it survives dismissal. Lives in the Notifications view of
 * settings until the user acts on it or clears it.
 *
 * Superset of {@link NotificationSummary} (id/title/message) so it renders in
 * the same rows as Home Assistant's persistent_notification.* entities.
 */
export interface CenterNotification extends NotificationSummary {
  /** Optional leading icon / device image to mirror the originating toast. */
  icon?: string;
  image?: string;
  caption?: string;
  /** Re-run the toast's primary action (e.g. enter device setup). */
  onAct?: () => void;
  createdAt: number;
}

interface NotificationCenterValue {
  notifications: CenterNotification[];
  /** Record a notification. Replaces any existing entry with the same id. */
  addNotification: (n: Omit<CenterNotification, 'createdAt'>) => void;
  /** Drop a notification (acted on or cleared). */
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationCenterContext = createContext<NotificationCenterValue>({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {},
  clearAll: () => {},
});

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<CenterNotification[]>([]);

  const addNotification = useCallback((n: Omit<CenterNotification, 'createdAt'>) => {
    setNotifications((prev) => {
      // Stamp createdAt off the previous entry so repeated adds (rare) don't need
      // Date.now() here — newest sorts to the front by insertion order anyway.
      const createdAt = prev.length;
      const next = prev.filter((p) => p.id !== n.id);
      return [{ ...n, createdAt }, ...next];
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification, clearAll }),
    [notifications, addNotification, removeNotification, clearAll]
  );

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}
