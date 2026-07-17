'use client';

import { useMemo } from 'react';
import { useSidebarItemsContext, type SidebarItem } from '@/contexts';
import { useSidebarShortcuts, type SidebarShortcut } from '@/lib/sidebarShortcuts';

export type { SidebarItem };

function shortcutToItem(shortcut: SidebarShortcut): SidebarItem {
  return {
    id: shortcut.id,
    title: shortcut.label,
    icon: shortcut.icon,
    // Non-view shortcuts never navigate — surfaces intercept the click and
    // run the action instead; the hash href is an inert fallback.
    urlPath: shortcut.kind === 'view' && shortcut.path ? shortcut.path : `#${shortcut.id}`,
    type: 'dashboard',
    isShortcut: true,
    shortcut,
  };
}

/** Panel-derived items plus the user's own shortcuts, one merged pipeline. */
export function useSidebarItems() {
  const ctx = useSidebarItemsContext();
  const shortcuts = useSidebarShortcuts();
  const items = useMemo(
    () => [...ctx.items, ...shortcuts.map(shortcutToItem)],
    [ctx.items, shortcuts]
  );
  return { items, loading: ctx.loading, error: ctx.error };
}
