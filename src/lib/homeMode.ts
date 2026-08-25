'use client';

import { useSyncExternalStore } from 'react';
import {
  mdiHomeVariant,
  mdiHome,
  mdiHomeExportOutline,
  mdiWeatherNight,
  mdiBeach,
  mdiAccountGroup,
} from '@mdi/js';
import { useEntity } from '@/hooks/useHomeAssistant';
import { useDebugFlags } from '@/contexts/DebugFlagsContext';
import type { HassEntity } from '@/lib/homeassistant/types';

type HassEntities = Record<string, HassEntity>;

/**
 * The home-mode helper entity — an HA `input_select` / `select` the user picks
 * in Home Center settings. Its current option ("Home", "Away", "Night", …) is
 * shown as a display-only chip across the dashboard, lock screen and Home
 * Center. localStorage-backed (`ha_home_mode_entity`) so every surface agrees,
 * same-tab and cross-tab. Empty string = not configured (nothing shown).
 *
 * Switching modes is left to the user's own HA automations — this only reads.
 */

const LS_HOME_MODE_ENTITY = 'ha_home_mode_entity';
// Soft default so a fresh install (and the demo) shows the mode chip with no
// setup. Harmless on a real instance that lacks it — useEntity yields undefined
// and the chip stays hidden. Explicitly clearing writes CLEARED so the default
// doesn't creep back.
const DEFAULT_ENTITY = 'input_select.home_mode';
const CLEARED = '__none__';

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getEntityId(): string {
  try {
    const raw = localStorage.getItem(LS_HOME_MODE_ENTITY);
    if (raw === null) return DEFAULT_ENTITY; // never set → soft default
    if (raw === '' || raw === CLEARED) return ''; // explicitly cleared
    return raw;
  } catch {
    return DEFAULT_ENTITY;
  }
}

function getServerEntityId(): string {
  return DEFAULT_ENTITY;
}

/** Live configured mode-helper entity_id (SSR-safe, same-tab + cross-tab). */
export function useHomeModeEntityId(): string {
  return useSyncExternalStore(subscribe, getEntityId, getServerEntityId);
}

/** Persist the chosen mode-helper entity_id (empty string clears it). */
export function setHomeModeEntityId(entityId: string): void {
  try {
    localStorage.setItem(LS_HOME_MODE_ENTITY, entityId || CLEARED);
  } catch {
    /* private mode — non-fatal */
  }
  emit();
}

// Map a mode name (case-insensitive keyword match) to an icon so the chip reads
// at a glance regardless of the user's exact option labels. First match wins.
const MODE_ICONS: { match: RegExp; icon: string }[] = [
  { match: /vacation|holiday|trip/, icon: mdiBeach },
  { match: /night|sleep|bed/, icon: mdiWeatherNight },
  { match: /away|out|gone|empty/, icon: mdiHomeExportOutline },
  { match: /guest|visitor|party/, icon: mdiAccountGroup },
  { match: /home|here|day/, icon: mdiHome },
];

export function iconForMode(mode: string): string {
  const m = mode.toLowerCase();
  for (const { match, icon } of MODE_ICONS) if (match.test(m)) return icon;
  return mdiHomeVariant;
}

export interface HomeModeInfo {
  entityId: string;
  /** Current option, e.g. "Away". */
  current: string;
  /** All selectable options from the helper. */
  options: string[];
  /** Icon matched to the current option. */
  icon: string;
}

/**
 * Live home-mode reading: the configured helper's current option + metadata, or
 * `null` when unconfigured / the entity is missing / unavailable. Re-renders on
 * option change (via useEntity).
 */
export function useHomeMode(): HomeModeInfo | null {
  // One gate for every surface — the chip, the Home Center card, the dialog.
  // Off by default (see the home-mode developer flag).
  const { homeModeEnabled } = useDebugFlags();
  const entityId = useHomeModeEntityId();
  const entity = useEntity(entityId);
  if (!homeModeEnabled || !entityId || !entity) return null;
  const current = entity.state;
  if (!current || current === 'unavailable' || current === 'unknown') return null;
  const options = Array.isArray(entity.attributes.options)
    ? (entity.attributes.options as string[])
    : [];
  return { entityId, current, options, icon: iconForMode(current) };
}

/** Candidate helper entities the user can pick as the home-mode source. */
export interface ModeEntityChoice {
  entityId: string;
  label: string;
}

/** input_select / select entities from the store, as picker choices. */
export function modeEntityChoices(entities: HassEntities): ModeEntityChoice[] {
  return Object.values(entities)
    .filter(
      (e) =>
        e.entity_id.startsWith('input_select.') || e.entity_id.startsWith('select.'),
    )
    .map((e) => ({
      entityId: e.entity_id,
      label: (e.attributes.friendly_name as string | undefined) || e.entity_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
