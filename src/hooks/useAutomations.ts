'use client';

import { useCallback, useMemo } from 'react';
import { useHomeAssistant, useHomeAssistantSelector } from './useHomeAssistant';
import type { HassEntities, HassEntity } from '@/types';

// ── Automations list data ────────────────────────────────────────────────────
// Mirrors the integrations pattern: live data comes from `automation.*`
// entities on a real connection; demo mode ships its own plausible sample set.
// The two sources are never mixed.

export interface AutomationSummary {
  /** The automation's entity id (`automation.<slug>`) — the row key. */
  id: string;
  name: string;
  /** Entity state `on` means the automation is enabled. */
  enabled: boolean;
  /** ISO timestamp of the last run, or null if it never fired. */
  lastTriggered: string | null;
  /** Run mode: single / restart / queued / parallel. Null if unknown. */
  mode: string | null;
  /** True while the automation is mid-run (`current` attribute > 0). */
  running: boolean;
  /** Numeric config id (attribute `id`) — needed to fetch the real flow. */
  numericId: string | null;
  demo: boolean;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function buildDemoAutomations(now: Date): AutomationSummary[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const base = { mode: 'single' as string | null, running: false, numericId: null, demo: true };
  return [
    { id: 'automation.morning_routine', name: 'Morning Routine', enabled: true, lastTriggered: ago(6 * HOUR), ...base },
    { id: 'automation.night_lights_off', name: 'Night Lights Off', enabled: true, lastTriggered: ago(14 * HOUR), ...base },
    { id: 'automation.motion_hallway', name: 'Hallway Motion Lights', enabled: true, lastTriggered: ago(22 * 60 * 1000), ...base, mode: 'restart', running: true },
    { id: 'automation.away_mode', name: 'Away Mode', enabled: false, lastTriggered: ago(9 * DAY), ...base },
    { id: 'automation.sunset_blinds', name: 'Close Blinds at Sunset', enabled: true, lastTriggered: ago(16 * HOUR), ...base },
    { id: 'automation.laundry_done', name: 'Laundry Done Notification', enabled: true, lastTriggered: ago(2 * DAY), ...base, mode: 'queued' },
    { id: 'automation.frost_warning', name: 'Frost Warning', enabled: true, lastTriggered: null, ...base },
    { id: 'automation.guest_mode', name: 'Guest Mode', enabled: false, lastTriggered: null, ...base },
    { id: 'automation.vacation_lighting', name: 'Vacation Lighting', enabled: false, lastTriggered: ago(31 * DAY), ...base },
    { id: 'automation.doorbell_snapshot', name: 'Doorbell Camera Snapshot', enabled: true, lastTriggered: ago(3 * HOUR), ...base },
  ];
}

function areAutomationEntityListsEqual(previous: HassEntity[], next: HassEntity[]): boolean {
  if (previous.length !== next.length) return false;
  for (let i = 0; i < previous.length; i += 1) {
    const a = previous[i];
    const b = next[i];
    if (a !== b && (a.entity_id !== b.entity_id || a.state !== b.state || a.last_updated !== b.last_updated)) {
      return false;
    }
  }
  return true;
}

// Module-level so the selector keeps a stable identity — the selector hook's
// cache is keyed on it, and an inline arrow would return a fresh array every
// render (which cascades into effects keyed on derived objects).
const selectAutomationEntities = (entities: HassEntities): HassEntity[] =>
  Object.values(entities).filter((e) => e.entity_id.startsWith('automation.'));

export function useAutomations(): { automations: AutomationSummary[]; loading: boolean } {
  const { connected, demoMode } = useHomeAssistant();

  const automationEntities = useHomeAssistantSelector(
    selectAutomationEntities,
    areAutomationEntityListsEqual,
  );

  // Demo layout only when there is no live connection — never mixed with live data.
  const useDemoData = demoMode && !connected;

  const automations = useMemo<AutomationSummary[]>(() => {
    if (useDemoData) return buildDemoAutomations(new Date());
    return automationEntities
      .map((entity) => ({
        id: entity.entity_id,
        name:
          (entity.attributes.friendly_name as string | undefined) ??
          entity.entity_id.split('.')[1].replace(/_/g, ' '),
        enabled: entity.state === 'on',
        lastTriggered: (entity.attributes.last_triggered as string | null | undefined) ?? null,
        mode: (entity.attributes.mode as string | undefined) ?? null,
        running: ((entity.attributes.current as number | undefined) ?? 0) > 0,
        numericId: (entity.attributes.id as string | undefined) ?? null,
        demo: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [useDemoData, automationEntities]);

  return { automations, loading: connected && automationEntities.length === 0 };
}

/**
 * Imperative automation controls, used by the dashboard cards and the detail
 * panel. Thin wrappers over `callService` — enabling/disabling and firing run
 * through the same connection as everything else; demo mode no-ops gracefully
 * (callService is a no-op when not connected).
 */
export function useAutomationActions() {
  const { callService } = useHomeAssistant();

  const triggerAutomation = useCallback(
    (id: string) =>
      callService({ domain: 'automation', service: 'trigger', target: { entity_id: id } }),
    [callService],
  );

  const setAutomationEnabled = useCallback(
    (id: string, on: boolean) =>
      callService({
        domain: 'automation',
        service: on ? 'turn_on' : 'turn_off',
        target: { entity_id: id },
      }),
    [callService],
  );

  return { triggerAutomation, setAutomationEnabled };
}

/** "2 h ago" style label for the list rows; null → "Never triggered". */
export function formatLastTriggered(iso: string | null): string {
  if (!iso) return 'Never triggered';
  const delta = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(delta) || delta < 0) return 'Never triggered';
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'Triggered just now';
  if (minutes < 60) return `Triggered ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Triggered ${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Triggered ${days} ${days === 1 ? 'day' : 'days'} ago`;
  const months = Math.floor(days / 30);
  return `Triggered ${months} ${months === 1 ? 'month' : 'months'} ago`;
}
