import type { HassEntity } from '@/lib/homeassistant/types';

// ─────────────────────────────────────────────────────────────────────────────
// What makes a person trackable. A person record on its own is just a name: it
// reports "unknown" forever until something feeds it a location. That something
// is a device tracker, and the usual one is the companion app on a phone.
//
// The people summary and the profile page both need to know this, and they must
// agree — one saying "nobody home" while the other says you're set up would be
// the worst of both.
// ─────────────────────────────────────────────────────────────────────────────

/** Where the companion app lives. The one link worth hard-coding. */
export const COMPANION_APP_URL = 'https://companion.home-assistant.io/';

/** The device trackers feeding a person, if the record exposes them. */
export function personTrackers(person: HassEntity): string[] {
  const list = person.attributes.device_trackers;
  return Array.isArray(list) ? (list as string[]) : [];
}

/**
 * True when this person can actually be located. Either they name a tracker, or
 * they're already reporting coordinates — some integrations set the position
 * without listing the tracker that produced it.
 */
export function isTrackable(person: HassEntity): boolean {
  return personTrackers(person).length > 0 || typeof person.attributes.latitude === 'number';
}

/** Everyone the home can actually locate. */
export function trackedPeople(people: HassEntity[]): HassEntity[] {
  return people.filter(isTrackable);
}
