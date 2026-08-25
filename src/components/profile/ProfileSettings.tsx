'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  mdiAccountGroupOutline,
  mdiBellOutline,
  mdiCellphoneCheck,
  mdiCellphoneLink,
  mdiMapMarkerAccountOutline,
  mdiOpenInNew,
  mdiPalette,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { Button, SectionLabel } from '../ui';
import { useHomeAssistant, useHomeAssistantEntities } from '@/hooks';
import { friendlyName, stateLabel } from '@/lib/homeassistant/entityHelpers';
import { resolveEntityPictureUrl } from '@/lib/utils';
import { COMPANION_APP_URL, isTrackable, personTrackers, trackedPeople } from '@/lib/presence';
import type { HassEntity } from '@/lib/homeassistant/types';

// ─────────────────────────────────────────────────────────────────────────────
// Your profile — one page instead of three.
//
// Home Assistant splits "you" across the profile page (name, theme, language),
// the People page (the person record and its device trackers) and the app store
// (the companion app that produces those trackers). Knowing which one to open
// is knowledge nobody should need, so this pulls the parts that answer "who am
// I and how does my home know where I am" into one place, and links out to the
// rest rather than reimplementing it.
// ─────────────────────────────────────────────────────────────────────────────

/** A row that leads somewhere — inside the app, or out to Home Assistant. */
function LinkRow({
  icon,
  label,
  description,
  external,
  onClick,
}: {
  icon: string;
  label: string;
  description: string;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-low"
    >
      <Icon path={icon} size={20} className="shrink-0 text-text-tertiary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-text-primary">{label}</span>
        <span className="truncate text-xs text-text-secondary">{description}</span>
      </span>
      {external && <Icon path={mdiOpenInNew} size={16} className="shrink-0 text-text-tertiary" />}
    </button>
  );
}

/**
 * How your home knows where you are. This is the part people get stuck on: a
 * person with no device tracker can never be "home", and nothing in the UI
 * previously said so — you just saw nobody home, forever.
 */
function TrackingCard({ person, haUrl }: { person: HassEntity | null; haUrl: string }) {
  const trackers = person ? personTrackers(person) : [];
  // Some integrations report a position without naming the tracker behind it.
  // That still counts as tracked — and it has to, or this page would say
  // "nothing is reporting" while the people map plots you on it.
  const locatedOnly = trackers.length === 0 && person != null && isTrackable(person);
  const tracked = trackers.length > 0 || locatedOnly;

  return (
    <div className="flex flex-col gap-ha-2">
      <SectionLabel inset>Being tracked</SectionLabel>
      <div className="overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default">
        {tracked ? (
          <>
            {locatedOnly && (
              <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
                <Icon path={mdiCellphoneCheck} size={20} className="shrink-0 text-green-500" />
                <span className="min-w-0 flex-1 text-sm text-text-primary">Your location is being reported</span>
                <span className="shrink-0 text-xs text-text-tertiary">Source not named</span>
              </div>
            )}
            {trackers.map((id) => (
              <div key={id} className="flex items-center gap-ha-3 border-b border-surface-lower px-ha-4 py-ha-3 last:border-0">
                <Icon path={mdiCellphoneCheck} size={20} className="shrink-0 text-green-500" />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{id.replace(/^device_tracker\./, '').replace(/_/g, ' ')}</span>
                <span className="shrink-0 text-xs text-text-tertiary">Reporting</span>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-start gap-ha-3 p-ha-4">
            <div className="flex items-center gap-ha-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-low text-ha-blue">
                <Icon path={mdiCellphoneLink} size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">Nothing is reporting your location</p>
                <p className="text-xs text-text-secondary">
                  Install the Home Assistant app on your phone and sign in. It becomes a tracker you can add here,
                  and then your home knows when you come and go.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              icon={mdiCellphoneLink}
              onClick={() => window.open(COMPANION_APP_URL, '_blank', 'noopener,noreferrer')}
            >
              Get the app
            </Button>
          </div>
        )}
      </div>
      {person && (
        <p className="px-ha-1 text-xs text-text-tertiary">
          {tracked
            ? `Currently ${stateLabel(person).toLowerCase()}.`
            : 'Once the app is signed in, add its tracker to your person in Home Assistant.'}
        </p>
      )}
      <a
        href={`${haUrl}/config/person`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-ha-1 text-xs font-semibold text-ha-blue hover:underline"
      >
        Manage people and their trackers →
      </a>
    </div>
  );
}

/**
 * The profile surface behind the profile card. `me` is the person record that
 * matches the signed-in user, when one can be found.
 */
export function ProfileSettings() {
  const router = useRouter();
  const { haUrl, currentUser } = useHomeAssistant();
  const entities = useHomeAssistantEntities();

  const people = useMemo(
    () => Object.values(entities).filter((e) => e.entity_id.startsWith('person.')),
    [entities],
  );

  // Match the person to the signed-in user by name — the person record carries
  // a user_id, but it isn't exposed on the state object, so the name is what
  // there is. A single-person home needs no matching at all.
  const me = useMemo(() => {
    if (people.length === 0) return null;
    if (people.length === 1) return people[0];
    const name = currentUser?.name?.toLowerCase();
    return people.find((p) => friendlyName(p).toLowerCase() === name) ?? people[0];
  }, [people, currentUser]);

  const displayName = me ? friendlyName(me) : currentUser?.name ?? 'You';
  const picture = me ? resolveEntityPictureUrl(haUrl, me.attributes.entity_picture as string | undefined) : null;
  const initials = displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const someoneTracked = trackedPeople(people).length > 0;

  return (
    <div className="flex flex-col gap-ha-5">
      {/* Who you are. */}
      <div className="flex items-center gap-ha-4 rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4">
        <Avatar src={picture ?? undefined} initials={initials} size="lg" className="h-16 w-16 shrink-0 bg-surface-mid" />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-text-primary">{displayName}</p>
          <p className="truncate text-sm text-text-secondary">
            {currentUser?.is_owner ? 'Owner of this home' : currentUser?.is_admin ? 'Administrator' : 'Member of this home'}
            {me ? ` · ${stateLabel(me)}` : ''}
          </p>
        </div>
      </div>

      <TrackingCard person={me} haUrl={haUrl} />

      {/* The rest of "you" — owned by Home Assistant, so these lead there
          rather than being half-reimplemented and drifting out of sync. */}
      <div className="flex flex-col gap-ha-2">
        <SectionLabel inset>Your settings</SectionLabel>
        <div className="overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default [&>*]:border-b [&>*]:border-surface-lower [&>*:last-child]:border-0">
          <LinkRow
            icon={mdiPalette}
            label="Appearance"
            description="Colour mode, theme, font and the background"
            onClick={() => router.push('/settings/developer')}
          />
          <LinkRow
            icon={mdiBellOutline}
            label="Notifications"
            description="What your home tells you about, and where"
            onClick={() => router.push('/settings/notifications')}
          />
          <LinkRow
            icon={mdiAccountGroupOutline}
            label="Everyone in this home"
            description={people.length > 0
              ? `${people.length} ${people.length === 1 ? 'person' : 'people'}${someoneTracked ? '' : ' · none tracked yet'}`
              : 'Nobody has been added yet'}
            external
            onClick={() => window.open(`${haUrl}/config/person`, '_blank', 'noopener,noreferrer')}
          />
          <LinkRow
            icon={mdiMapMarkerAccountOutline}
            label="Zones"
            description="The places your home recognises — home, work, school"
            external
            onClick={() => window.open(`${haUrl}/config/zone`, '_blank', 'noopener,noreferrer')}
          />
        </div>
      </div>
    </div>
  );
}
