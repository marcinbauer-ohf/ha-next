'use client';

import { useCallback, useState } from 'react';

const LS_KEY = 'ha-sidebar-expanded';

/**
 * Desktop sidebar expanded state (wide rail with labels vs icon-only rail),
 * persisted per browser. Read lazily: on the server this is always false, but
 * the shell renders nothing until `hydrated`, so the value never hits the DOM
 * before the client owns it.
 */
export function useSidebarExpanded() {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_KEY) === '1';
  });

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return { expanded, toggle };
}
