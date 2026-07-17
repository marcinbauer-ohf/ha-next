'use client';

import { useCallback } from 'react';
import { useHomeAssistant } from './useHomeAssistant';
import { useToast } from '@/contexts';
import { haptic } from '@/lib/haptics';
import type { SidebarShortcut } from '@/lib/sidebarShortcuts';
import { mdiPaletteOutline, mdiScriptTextOutline, mdiFlashOutline } from '@mdi/js';

/**
 * Executes a non-view sidebar shortcut: activates the scene/script, toggles
 * the device, or opens the external link. Demo-aware via useHomeAssistant's
 * callService/toggleEntity, with haptic + toast feedback so a "do" shortcut
 * never feels inert.
 */
export function useRunShortcut() {
  const { callService, toggleEntity } = useHomeAssistant();
  const { showToast } = useToast();

  return useCallback(
    async (shortcut: SidebarShortcut) => {
      haptic('impact');

      if (shortcut.kind === 'url' && shortcut.url) {
        window.open(shortcut.url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (shortcut.kind !== 'action' || !shortcut.entityId) return;
      const domain = shortcut.entityId.split('.')[0];

      if (domain === 'scene' || domain === 'script') {
        await callService({
          domain,
          service: 'turn_on',
          target: { entity_id: shortcut.entityId },
        });
        showToast({
          title: shortcut.label,
          subtitle: domain === 'scene' ? 'Scene activated' : 'Script started',
          icon: domain === 'scene' ? mdiPaletteOutline : mdiScriptTextOutline,
        });
        return;
      }

      await toggleEntity(shortcut.entityId);
      showToast({ title: shortcut.label, subtitle: 'Toggled', icon: mdiFlashOutline });
    },
    [callService, toggleEntity, showToast]
  );
}

/** Default icon per shortcut target, used when the target has none of its own. */
export function defaultShortcutIcon(kind: SidebarShortcut['kind'], entityId?: string): string {
  if (kind === 'url') return 'mdi:open-in-new';
  if (kind === 'action' && entityId) {
    const domain = entityId.split('.')[0];
    if (domain === 'scene') return 'mdi:palette-outline';
    if (domain === 'script') return 'mdi:script-text-outline';
    if (domain === 'light') return 'mdi:lightbulb-outline';
    if (domain === 'switch') return 'mdi:toggle-switch-outline';
    if (domain === 'fan') return 'mdi:fan';
  }
  return 'mdi:arrow-top-right';
}
