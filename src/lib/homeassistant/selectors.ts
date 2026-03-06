'use client';

import type { HassEntities } from '@/types';

const RELEASE_NOTES_PREFIX = 'update.home_assistant_release_notes_simulated';
const SIMULATION_PREFIXES = [
  RELEASE_NOTES_PREFIX,
  'media_player.simulated',
  'timer.simulated',
  'binary_sensor.camera_simulated',
  'sensor.printer.simulated',
  'sensor.printer_simulated',
] as const;

export interface PersonSummary {
  id: string;
  name: string;
  state: string;
  picture?: string;
  initials: string;
}

export interface UpdateSummary {
  id: string;
  name: string;
  picture?: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  message?: string;
}

export interface ReleaseNotesSummary {
  entityId: string;
  name: string;
  version: string;
  summary: string;
  notes: string[];
  updatedAt: string;
}

export interface MediaSummary {
  entityId: string;
  name: string;
  state: string;
  mediaTitle?: string;
  mediaArtist?: string;
  entityPicture?: string;
}

export interface TimerSummary {
  entityId: string;
  name: string;
  state: string;
  remaining: string;
  duration: string;
  durationSec: number;
  finishesAt?: string;
}

export interface CameraSummary {
  entityId: string;
  name: string;
  state: string;
  event?: string;
  entityPicture?: string;
}

export interface PrinterSummary {
  entityId: string;
  name: string;
  state: string;
  progress: number;
  fileName?: string;
  remainingTime?: string;
  entityPicture?: string;
}

export interface OfflineDeviceSummary {
  id: string;
  name: string;
}

export interface ActivityData {
  activeUpdates: UpdateSummary[];
  activeNotifications: NotificationSummary[];
  activeReleaseNotes: ReleaseNotesSummary[];
  activePlayers: MediaSummary[];
  activeTimers: TimerSummary[];
  activeCameras: CameraSummary[];
  activePrinters: PrinterSummary[];
  offlineDevices: OfflineDeviceSummary[];
  user: PersonSummary | null;
  isRemoteConnected: boolean;
}

export interface PeoplePresence {
  peopleHome: PersonSummary[];
  peopleAway: PersonSummary[];
}

export interface ScreensaverData {
  pendingUpdates: number;
  notificationCount: number;
  isRemoteConnected: boolean;
  offlineCount: number;
  user: PersonSummary | null;
}

export interface SimulationEntitySummary {
  id: string;
  name: string;
  state: string;
}

export interface EntitySearchMatch {
  id: string;
  name: string;
  state: string;
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function buildInitials(name?: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((segment) => segment[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

function areStringArraysEqual(previous: string[], next: string[]): boolean {
  if (previous.length !== next.length) return false;

  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) return false;
  }

  return true;
}

function areArraysEqual<T>(
  previous: T[],
  next: T[],
  isSameItem: (previousItem: T, nextItem: T) => boolean
): boolean {
  if (previous.length !== next.length) return false;

  for (let index = 0; index < previous.length; index += 1) {
    if (!isSameItem(previous[index], next[index])) {
      return false;
    }
  }

  return true;
}

function areNullableValuesEqual<T>(
  previous: T | null,
  next: T | null,
  isSameItem: (previousItem: T, nextItem: T) => boolean
): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return isSameItem(previous, next);
}

function compareByEntityId<T extends { entityId: string }>(previous: T, next: T): number {
  return previous.entityId.localeCompare(next.entityId);
}

function compareById<T extends { id: string }>(previous: T, next: T): number {
  return previous.id.localeCompare(next.id);
}

function arePersonSummariesEqual(previous: PersonSummary, next: PersonSummary): boolean {
  return (
    previous.id === next.id &&
    previous.name === next.name &&
    previous.state === next.state &&
    previous.picture === next.picture &&
    previous.initials === next.initials
  );
}

function areUpdateSummariesEqual(previous: UpdateSummary, next: UpdateSummary): boolean {
  return (
    previous.id === next.id &&
    previous.name === next.name &&
    previous.picture === next.picture
  );
}

function areNotificationSummariesEqual(previous: NotificationSummary, next: NotificationSummary): boolean {
  return (
    previous.id === next.id &&
    previous.title === next.title &&
    previous.message === next.message
  );
}

function areReleaseNotesSummariesEqual(previous: ReleaseNotesSummary, next: ReleaseNotesSummary): boolean {
  return (
    previous.entityId === next.entityId &&
    previous.name === next.name &&
    previous.version === next.version &&
    previous.summary === next.summary &&
    previous.updatedAt === next.updatedAt &&
    areStringArraysEqual(previous.notes, next.notes)
  );
}

function areMediaSummariesEqual(previous: MediaSummary, next: MediaSummary): boolean {
  return (
    previous.entityId === next.entityId &&
    previous.name === next.name &&
    previous.state === next.state &&
    previous.mediaTitle === next.mediaTitle &&
    previous.mediaArtist === next.mediaArtist &&
    previous.entityPicture === next.entityPicture
  );
}

function areTimerSummariesEqual(previous: TimerSummary, next: TimerSummary): boolean {
  return (
    previous.entityId === next.entityId &&
    previous.name === next.name &&
    previous.state === next.state &&
    previous.remaining === next.remaining &&
    previous.duration === next.duration &&
    previous.durationSec === next.durationSec &&
    previous.finishesAt === next.finishesAt
  );
}

function areCameraSummariesEqual(previous: CameraSummary, next: CameraSummary): boolean {
  return (
    previous.entityId === next.entityId &&
    previous.name === next.name &&
    previous.state === next.state &&
    previous.event === next.event &&
    previous.entityPicture === next.entityPicture
  );
}

function arePrinterSummariesEqual(previous: PrinterSummary, next: PrinterSummary): boolean {
  return (
    previous.entityId === next.entityId &&
    previous.name === next.name &&
    previous.state === next.state &&
    previous.progress === next.progress &&
    previous.fileName === next.fileName &&
    previous.remainingTime === next.remainingTime &&
    previous.entityPicture === next.entityPicture
  );
}

function areOfflineDevicesEqual(previous: OfflineDeviceSummary, next: OfflineDeviceSummary): boolean {
  return previous.id === next.id && previous.name === next.name;
}

function areEntitySearchMatchesItemEqual(previous: EntitySearchMatch, next: EntitySearchMatch): boolean {
  return (
    previous.id === next.id &&
    previous.name === next.name &&
    previous.state === next.state
  );
}

function toPersonSummary(entityId: string, entity: HassEntities[string]): PersonSummary {
  const friendlyName = (entity.attributes.friendly_name as string | undefined) || 'User';

  return {
    id: entityId,
    name: friendlyName,
    state: entity.state,
    picture: entity.attributes.entity_picture as string | undefined,
    initials: buildInitials(friendlyName),
  };
}

export function selectPrimaryPerson(entities: HassEntities): PersonSummary | null {
  const firstPersonEntry = Object.entries(entities).find(([entityId]) => entityId.startsWith('person.'));
  if (!firstPersonEntry) return null;
  return toPersonSummary(firstPersonEntry[0], firstPersonEntry[1]);
}

export function arePrimaryPeopleEqual(previous: PersonSummary | null, next: PersonSummary | null): boolean {
  return areNullableValuesEqual(previous, next, arePersonSummariesEqual);
}

export function selectPeoplePresence(entities: HassEntities): PeoplePresence {
  const allPeople = Object.entries(entities)
    .filter(([entityId]) => entityId.startsWith('person.'))
    .map(([entityId, entity]) => toPersonSummary(entityId, entity));

  return {
    peopleHome: allPeople.filter((person) => person.state === 'home'),
    peopleAway: allPeople.filter((person) => person.state !== 'home'),
  };
}

export function arePeoplePresenceEqual(previous: PeoplePresence, next: PeoplePresence): boolean {
  return (
    areArraysEqual(previous.peopleHome, next.peopleHome, arePersonSummariesEqual) &&
    areArraysEqual(previous.peopleAway, next.peopleAway, arePersonSummariesEqual)
  );
}

export function selectScreensaverData(entities: HassEntities): ScreensaverData {
  let pendingUpdates = 0;
  let notificationCount = 0;
  let offlineCount = 0;
  let cloudConnected = false;
  let remoteUiConnected = false;
  let user: PersonSummary | null = null;

  Object.entries(entities).forEach(([entityId, entity]) => {
    if (entityId.startsWith('update.') && entity.state === 'on') {
      pendingUpdates += 1;
    }

    if (entityId.startsWith('persistent_notification.')) {
      notificationCount += 1;
    }

    if (!user && entityId.startsWith('person.')) {
      user = toPersonSummary(entityId, entity);
    }

    if (entityId === 'cloud.cloud' && entity.state === 'connected') {
      cloudConnected = true;
    }

    if (entityId === 'binary_sensor.remote_ui' && entity.state === 'on') {
      remoteUiConnected = true;
    }

    if (
      entity.attributes.device_id !== undefined &&
      entity.attributes.device_id !== null &&
      (entity.state === 'unavailable' || entity.state === 'unknown')
    ) {
      offlineCount += 1;
    }
  });

  return {
    pendingUpdates,
    notificationCount,
    isRemoteConnected: cloudConnected || remoteUiConnected,
    offlineCount,
    user,
  };
}

export function areScreensaverDataEqual(previous: ScreensaverData, next: ScreensaverData): boolean {
  return (
    previous.pendingUpdates === next.pendingUpdates &&
    previous.notificationCount === next.notificationCount &&
    previous.isRemoteConnected === next.isRemoteConnected &&
    previous.offlineCount === next.offlineCount &&
    areNullableValuesEqual(previous.user, next.user, arePersonSummariesEqual)
  );
}

export function selectSimulationEntities(entities: HassEntities): SimulationEntitySummary[] {
  return Object.entries(entities)
    .filter(([entityId]) => SIMULATION_PREFIXES.some((prefix) => entityId.startsWith(prefix)))
    .map(([entityId, entity]) => ({
      id: entityId,
      name: (entity.attributes.friendly_name as string | undefined) || entityId,
      state: entity.state,
    }))
    .sort(compareById);
}

export function areSimulationEntitiesEqual(
  previous: SimulationEntitySummary[],
  next: SimulationEntitySummary[]
): boolean {
  return areArraysEqual(
    previous,
    next,
    (previousItem, nextItem) =>
      previousItem.id === nextItem.id &&
      previousItem.name === nextItem.name &&
      previousItem.state === nextItem.state
  );
}

export function selectActivityData(entities: HassEntities): ActivityData {
  const activeUpdates: UpdateSummary[] = [];
  const activeNotifications: NotificationSummary[] = [];
  const activeReleaseNotes: ReleaseNotesSummary[] = [];
  const activePlayers: MediaSummary[] = [];
  const activeTimers: TimerSummary[] = [];
  const activeCameras: CameraSummary[] = [];
  const activePrinters: PrinterSummary[] = [];
  const offlineDevices: OfflineDeviceSummary[] = [];
  let user: PersonSummary | null = null;
  let cloudConnected = false;
  let remoteUiConnected = false;

  Object.entries(entities).forEach(([entityId, entity]) => {
    if (!user && entityId.startsWith('person.')) {
      user = toPersonSummary(entityId, entity);
    }

    if (entityId.startsWith('update.') && entity.state === 'on') {
      activeUpdates.push({
        id: entityId,
        name: (entity.attributes.friendly_name as string | undefined) || entityId,
        picture: entity.attributes.entity_picture as string | undefined,
      });
    }

    if (entityId.startsWith('persistent_notification.')) {
      activeNotifications.push({
        id: entityId,
        title: (entity.attributes.title as string | undefined)
          || (entity.attributes.friendly_name as string | undefined)
          || 'System Notification',
        message: entity.attributes.message as string | undefined,
      });
    }

    if (entityId === RELEASE_NOTES_PREFIX && entity.state === 'on') {
      const rawNotes = entity.attributes.release_notes;
      const notes = Array.isArray(rawNotes)
        ? rawNotes.map((item) => String(item))
        : typeof rawNotes === 'string'
          ? [rawNotes]
          : [];

      activeReleaseNotes.push({
        entityId,
        name: String(entity.attributes.friendly_name || 'Home Assistant release notes'),
        version: String(entity.attributes.latest_version || entity.attributes.release_version || 'Latest'),
        summary: String(entity.attributes.release_summary || 'See what is new in Home Assistant.'),
        notes,
        updatedAt: entity.last_updated,
      });
    }

    if (entityId.startsWith('media_player.') && (entity.state === 'playing' || entity.state === 'paused')) {
      activePlayers.push({
        entityId,
        name: String(entity.attributes.friendly_name || entityId),
        state: entity.state,
        mediaTitle: entity.attributes.media_title as string | undefined,
        mediaArtist: entity.attributes.media_artist as string | undefined,
        entityPicture: entity.attributes.entity_picture as string | undefined,
      });
    }

    if (entityId.startsWith('timer.') && (entity.state === 'active' || entity.state === 'paused')) {
      const duration = String(entity.attributes.duration || '0:00:00');
      activeTimers.push({
        entityId,
        name: String(entity.attributes.friendly_name || entityId),
        state: entity.state,
        remaining: String(entity.attributes.remaining || '0:00:00'),
        duration,
        durationSec: parseTimeToSeconds(duration),
        finishesAt: entity.attributes.finishes_at as string | undefined,
      });
    }

    if (
      (entityId.startsWith('binary_sensor.camera_simulated') && entity.state === 'on') ||
      (entityId.startsWith('camera.') && (entity.state === 'motion' || entity.state === 'person'))
    ) {
      activeCameras.push({
        entityId,
        name: String(entity.attributes.friendly_name || 'Front Door'),
        state: entity.state,
        event: (entity.attributes.event_type as string | undefined) || 'Movement detected',
        entityPicture: entity.attributes.entity_picture as string | undefined,
      });
    }

    if (entity.state.toLowerCase() === 'printing') {
      const isPrinter = (
        entityId.startsWith('sensor.printer_simulated') ||
        entityId.startsWith('sensor.printer_') ||
        entityId.includes('printer')
      );

      if (isPrinter) {
        activePrinters.push({
          entityId,
          name: String(entity.attributes.friendly_name || entityId),
          state: entity.state,
          progress: Number(entity.attributes.progress || 0),
          fileName: (entity.attributes.file_name as string | undefined)
            || (entity.attributes.friendly_name as string | undefined)
            || 'Printing',
          remainingTime: (entity.attributes.time_remaining as string | undefined) || '00:00:00',
          entityPicture: entity.attributes.entity_picture as string | undefined,
        });
      }
    }

    if (entityId === 'cloud.cloud' && entity.state === 'connected') {
      cloudConnected = true;
    }

    if (entityId === 'binary_sensor.remote_ui' && entity.state === 'on') {
      remoteUiConnected = true;
    }

    if (
      entity.attributes.device_id !== undefined &&
      entity.attributes.device_id !== null &&
      (entity.state === 'unavailable' || entity.state === 'unknown')
    ) {
      offlineDevices.push({
        id: entity.entity_id,
        name: (entity.attributes.friendly_name as string | undefined) || entity.entity_id,
      });
    }
  });

  activeUpdates.sort(compareById);
  activeNotifications.sort(compareById);
  activeReleaseNotes.sort(compareByEntityId);
  activePlayers.sort(compareByEntityId);
  activeTimers.sort(compareByEntityId);
  activeCameras.sort(compareByEntityId);
  activePrinters.sort(compareByEntityId);
  offlineDevices.sort(compareById);

  return {
    activeUpdates,
    activeNotifications,
    activeReleaseNotes,
    activePlayers,
    activeTimers,
    activeCameras,
    activePrinters,
    offlineDevices,
    user,
    isRemoteConnected: cloudConnected || remoteUiConnected,
  };
}

export function areActivityDataEqual(previous: ActivityData, next: ActivityData): boolean {
  return (
    previous.isRemoteConnected === next.isRemoteConnected &&
    areArraysEqual(previous.activeUpdates, next.activeUpdates, areUpdateSummariesEqual) &&
    areArraysEqual(previous.activeNotifications, next.activeNotifications, areNotificationSummariesEqual) &&
    areArraysEqual(previous.activeReleaseNotes, next.activeReleaseNotes, areReleaseNotesSummariesEqual) &&
    areArraysEqual(previous.activePlayers, next.activePlayers, areMediaSummariesEqual) &&
    areArraysEqual(previous.activeTimers, next.activeTimers, areTimerSummariesEqual) &&
    areArraysEqual(previous.activeCameras, next.activeCameras, areCameraSummariesEqual) &&
    areArraysEqual(previous.activePrinters, next.activePrinters, arePrinterSummariesEqual) &&
    areArraysEqual(previous.offlineDevices, next.offlineDevices, areOfflineDevicesEqual) &&
    areNullableValuesEqual(previous.user, next.user, arePersonSummariesEqual)
  );
}

export function selectMatchingEntities(entities: HassEntities, query: string): EntitySearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return Object.entries(entities)
    .filter(([entityId, entity]) => {
      const friendlyName = String(entity.attributes.friendly_name || entityId);
      const state = String(entity.state || '');

      return (
        friendlyName.toLowerCase().includes(normalizedQuery) ||
        entityId.toLowerCase().includes(normalizedQuery) ||
        state.toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 12)
    .map(([entityId, entity]) => ({
      id: entityId,
      name: String(entity.attributes.friendly_name || entityId),
      state: String(entity.state || ''),
    }));
}

export function areEntitySearchMatchesEqual(previous: EntitySearchMatch[], next: EntitySearchMatch[]): boolean {
  return areArraysEqual(previous, next, areEntitySearchMatchesItemEqual);
}
