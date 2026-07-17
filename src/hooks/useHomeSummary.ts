'use client';

// "While you were away" phrases for the screensaver's talk-to-your-home pill.
// Composed from the live activity ledger (vacuums, timers, cameras, …),
// people coming and going, and ambient state (lights on) — jargon-free, one
// sentence each, ordered urgent-first. Empty when nothing noteworthy
// happened, so callers can fall back to the static invitation.

import { useMemo } from 'react';
import { useActivities } from './useActivities';
import { useEntitiesByDomain, useLightsOn } from './useEntities';
import type { HassEntity } from '@/lib/homeassistant';

/** Mirrors the person presence rule in selectors.ts: overlapping zones make
 *  `state` a zone name, so `in_zones` must be consulted, never raw state. */
function isPersonHome(entity: HassEntity): boolean {
  if (entity.state === 'home') return true;
  const inZones = entity.attributes.in_zones;
  return (
    Array.isArray(inZones) &&
    inZones.some(
      (zone) => typeof zone === 'string' && zone.toLowerCase().replace(/^zone\./, '') === 'home'
    )
  );
}

/** Ended ledger items only count if they ended inside the window; active ones
 *  are always "now" and always count. */
function inWindow(status: { phase: string; endedAt: number | null }, sinceTs: number): boolean {
  return status.phase === 'active' || (status.endedAt !== null && status.endedAt >= sinceTs);
}

export function useHomeSummary(sinceTs: number): string[] {
  const { activities } = useActivities();
  const persons = useEntitiesByDomain('person');
  const lightsOn = useLightsOn();

  return useMemo(() => {
    const phrases: string[] = [];

    // Urgent first — alarm states lead everything else.
    for (const a of activities.alarms) {
      if (a.status.isStale || !inWindow(a.status, sinceTs)) continue;
      phrases.push(
        a.summary.state === 'triggered'
          ? `${a.summary.name} was triggered`
          : `${a.summary.name} is ${a.summary.state}`
      );
    }

    // People coming and going since the window opened.
    for (const p of persons) {
      const changed = Date.parse(p.last_changed ?? '');
      if (!Number.isFinite(changed) || changed < sinceTs) continue;
      const name = (p.attributes.friendly_name as string | undefined) || 'Someone';
      phrases.push(isPersonHome(p) ? `${name} arrived home` : `${name} left home`);
    }

    for (const v of activities.vacuums) {
      if (v.status.isStale || !inWindow(v.status, sinceTs)) continue;
      phrases.push(
        v.status.phase === 'active'
          ? `${v.summary.name} is cleaning${v.summary.area ? ` the ${v.summary.area}` : ''}`
          : `${v.summary.name} finished cleaning`
      );
    }

    for (const t of activities.timers) {
      if (!inWindow(t.status, sinceTs)) continue;
      phrases.push(
        t.status.phase === 'active'
          ? `${t.summary.name} has ${t.summary.remaining} left`
          : `${t.summary.name} finished`
      );
    }

    for (const c of activities.cameras) {
      if (c.status.isStale || !inWindow(c.status, sinceTs)) continue;
      phrases.push(`Movement at the ${c.summary.name}`);
    }

    for (const pr of activities.printers) {
      if (pr.status.isStale || !inWindow(pr.status, sinceTs)) continue;
      phrases.push(
        pr.status.phase === 'active'
          ? `${pr.summary.name} is printing`
          : `${pr.summary.name} finished printing`
      );
    }

    for (const u of activities.updateInstalls) {
      if (u.status.isStale || !inWindow(u.status, sinceTs)) continue;
      phrases.push(
        u.status.phase === 'active'
          ? `${u.summary.name} is updating`
          : `${u.summary.name} finished updating`
      );
    }

    for (const b of activities.backups) {
      if (b.status.isStale || !inWindow(b.status, sinceTs)) continue;
      phrases.push(b.status.phase === 'active' ? 'A backup is running' : 'Backup finished');
    }

    // Media only while it's actually playing.
    for (const m of activities.players) {
      if (m.status.isStale || m.status.phase !== 'active') continue;
      if (m.summary.mediaTitle) phrases.push(`“${m.summary.mediaTitle}” is playing`);
    }

    // Ambient closer — never leads, always true "right now" state.
    if (lightsOn > 0) {
      phrases.push(lightsOn === 1 ? 'One light is still on' : `${lightsOn} lights are still on`);
    }

    return phrases;
  }, [activities, persons, lightsOn, sinceTs]);
}
