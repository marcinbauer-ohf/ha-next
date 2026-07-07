'use client';

/**
 * Client-side lifecycle ledger for live activities, applying the platform
 * rules from Apple's ActivityKit/HIG and Android's Live Updates guidance:
 *
 * - Ending activities keep their final state visible for a short linger
 *   window instead of vanishing mid-glance.
 * - Event activities (camera) auto-expire instead of running forever.
 * - Data that stops updating is marked stale, never shown as fresh.
 * - A relevance score decides ordering, shared by every surface.
 * - Alerts fire only on can't-miss transitions, never on state drift.
 *
 * Module store (same pattern as the entity store): both the desktop status
 * bar and the mobile nav read one ledger, so the two surfaces always agree.
 */

import type { HassEntities } from '@/types';
import type {
  ActivityData,
  AlarmSummary,
  BackupRunningSummary,
  CameraSummary,
  MediaSummary,
  PrinterSummary,
  ReleaseNotesSummary,
  TimerSummary,
  UpdateInstallSummary,
  VacuumSummary,
} from '@/lib/homeassistant/selectors';
import { isDismissed, subscribeDismissals } from './dismissals';
import {
  ActivitiesSnapshot,
  ActivityItem,
  ActivityStatus,
  ActivityType,
  CAMERA_EVENT_TTL_MS,
  FRESHNESS_TTL_MS,
  LINGER_MS,
} from './types';

type AnySummary =
  | ReleaseNotesSummary
  | MediaSummary
  | TimerSummary
  | CameraSummary
  | PrinterSummary
  | VacuumSummary
  | UpdateInstallSummary
  | BackupRunningSummary
  | AlarmSummary;

interface Tracked {
  id: string;
  type: ActivityType;
  startedAt: number;
  endedAt: number | null;
  endLabel: string | null;
  alertAt: number | null;
  summary: AnySummary;
  /** Camera only: `since` of the event this entry tracks — a new value is a new event. */
  eventSince?: string;
}

const EMPTY_SNAPSHOT: ActivitiesSnapshot = {
  releaseNotes: [],
  players: [],
  timers: [],
  cameras: [],
  printers: [],
  vacuums: [],
  updateInstalls: [],
  backups: [],
  alarms: [],
  typeOrder: [],
};

/** Secondary type order when relevance ties — urgency-first, info last. */
const CANONICAL_TYPE_ORDER: ActivityType[] = [
  'alarm', 'camera', 'timer', 'update', 'printer', 'vacuum', 'media', 'backup', 'release',
];

const tracked = new Map<string, Tracked>();
let lastData: ActivityData | null = null;
let connected = true;
let snapshot: ActivitiesSnapshot = EMPTY_SNAPSHOT;
let peekEntitiesFn: (() => HassEntities) | null = null;
const listeners = new Set<() => void>();

function parseIso(value: string | undefined): number {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function parseClock(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function timerRemainingSec(summary: TimerSummary, now: number): number {
  if (summary.state === 'active' && summary.finishesAt) {
    const finish = parseIso(summary.finishesAt);
    if (Number.isFinite(finish)) return Math.max(0, (finish - now) / 1000);
  }
  return parseClock(summary.remaining);
}

function scoreActive(type: ActivityType, summary: AnySummary, now: number): number {
  switch (type) {
    case 'camera': {
      const age = now - parseIso((summary as CameraSummary).since);
      return Number.isFinite(age) && age < 120_000 ? 95 : 65;
    }
    case 'timer':
      return timerRemainingSec(summary as TimerSummary, now) < 60 ? 90 : 70;
    case 'printer':
      return (summary as PrinterSummary).progress >= 95 ? 75 : 50;
    case 'vacuum':
      return 45;
    case 'media':
      return (summary as MediaSummary).state === 'playing' ? 40 : 30;
    case 'release':
      return 20;
    case 'update':
      return 55;
    case 'backup':
      return 35;
    case 'alarm':
      return (summary as AlarmSummary).state === 'triggered' ? 100 : 85;
  }
}

const ENDED_RELEVANCE = 15;

function endActivity(entry: Tracked, now: number, endLabel: string | null, alert: boolean): void {
  if (LINGER_MS[entry.type] === 0) {
    tracked.delete(entry.id);
    return;
  }
  entry.endedAt = now;
  entry.endLabel = endLabel;
  if (alert) entry.alertAt = now;
}

/** End resolution when an entity leaves its qualifying state. */
function endFromExit(entry: Tracked, now: number): void {
  switch (entry.type) {
    case 'timer': {
      const summary = entry.summary as TimerSummary;
      // Finished → celebrate; cancelled mid-run → the user acted, drop silently.
      if (timerRemainingSec(summary, now) <= 1) {
        endActivity(entry, now, 'Done', true);
      } else {
        tracked.delete(entry.id);
      }
      return;
    }
    case 'printer': {
      const summary = entry.summary as PrinterSummary;
      if (summary.progress >= 99) {
        endActivity(entry, now, 'Print complete', true);
      } else {
        endActivity(entry, now, 'Print stopped', false);
      }
      return;
    }
    case 'vacuum': {
      const summary = entry.summary as VacuumSummary;
      endActivity(entry, now, summary.state === 'returning' ? 'Docked' : 'Finished', false);
      return;
    }
    case 'camera':
      // Ended card shows the event itself with a relative timestamp.
      endActivity(entry, now, null, false);
      return;
    case 'update': {
      const summary = entry.summary as UpdateInstallSummary;
      const label = summary.latestVersion ? `Updated to ${summary.latestVersion}` : 'Update installed';
      endActivity(entry, now, label, true);
      return;
    }
    case 'backup': {
      // Simulated removals delete the entity outright — peek finds nothing,
      // which reads as a plain success. Real backups persist with their
      // final state, so a failure is visible here.
      const entity = peekEntitiesFn?.()[entry.id];
      const failed = entity?.state === 'error' || (entity?.attributes.failed as boolean | undefined) === true;
      endActivity(entry, now, failed ? 'Backup failed' : 'Backup complete', true);
      return;
    }
    case 'alarm': {
      const wasTriggered = (entry.summary as AlarmSummary).state === 'triggered';
      const entity = peekEntitiesFn?.()[entry.id];
      const nextState = entity?.state;
      const label = nextState === 'disarmed' ? 'Disarmed' : nextState?.startsWith('armed') ? 'Armed' : 'Cleared';
      // Resolving a live trigger is worth a pulse; a calm arm/disarm isn't.
      endActivity(entry, now, label, wasTriggered);
      return;
    }
    default:
      endActivity(entry, now, null, false);
  }
}

function reconcileType<S extends AnySummary>(
  type: ActivityType,
  summaries: S[],
  now: number,
  getId: (summary: S) => string,
): void {
  const present = new Set<string>();

  summaries.forEach((summary) => {
    const id = getId(summary);
    present.add(id);
    const existing = tracked.get(id);

    if (!existing) {
      tracked.set(id, {
        id,
        type,
        startedAt: now,
        endedAt: null,
        endLabel: null,
        // A camera event appearing is a can't-miss moment; everything else
        // starts from a user action they already know about.
        alertAt: type === 'camera' ? now : null,
        summary,
        eventSince: type === 'camera' ? (summary as unknown as CameraSummary).since : undefined,
      });
      return;
    }

    const previousSummary = existing.summary;
    existing.summary = summary;

    if (type === 'camera') {
      const since = (summary as unknown as CameraSummary).since;
      if (existing.eventSince !== since) {
        // Same sensor, new event — restart the activity and alert.
        existing.eventSince = since;
        existing.startedAt = now;
        existing.endedAt = null;
        existing.endLabel = null;
        existing.alertAt = now;
        return;
      }
    }

    if (type === 'alarm') {
      const prevState = (previousSummary as unknown as AlarmSummary).state;
      const nextState = (summary as unknown as AlarmSummary).state;
      // Escalating to triggered is the one can't-miss alarm transition —
      // arming/pending shifts stay silent (best-practice: alert sparingly).
      if (nextState === 'triggered' && prevState !== 'triggered') {
        existing.alertAt = now;
      }
    }

    if (existing.endedAt !== null) {
      if (type === 'timer') {
        // Only revive a self-ended timer when it actually restarted.
        if (timerRemainingSec(summary as unknown as TimerSummary, now) > 1) {
          existing.endedAt = null;
          existing.endLabel = null;
          existing.startedAt = now;
        }
        return;
      }
      if (type === 'camera') return; // auto-expired; a new event revives above
      // Vacuum resumed, printer restarted, … — back to active.
      existing.endedAt = null;
      existing.endLabel = null;
    }
  });

  tracked.forEach((entry) => {
    if (entry.type !== type || present.has(entry.id)) return;
    if (entry.endedAt === null) {
      endFromExit(entry, now);
    }
  });
}

function reconcile(now: number): void {
  if (!lastData) return;

  reconcileType('release', lastData.activeReleaseNotes, now, (s) => s.entityId);
  reconcileType('media', lastData.activePlayers, now, (s) => s.entityId);
  reconcileType('timer', lastData.activeTimers, now, (s) => s.entityId);
  reconcileType('camera', lastData.activeCameras, now, (s) => s.entityId);
  reconcileType('printer', lastData.activePrinters, now, (s) => s.entityId);
  reconcileType('vacuum', lastData.activeVacuums, now, (s) => s.entityId);
  reconcileType('update', lastData.activeUpdateInstalls, now, (s) => s.entityId);
  reconcileType('backup', lastData.activeBackups, now, (s) => s.entityId);
  reconcileType('alarm', lastData.activeAlarms, now, (s) => s.entityId);

  tracked.forEach((entry) => {
    // Event activities auto-expire even when the sensor sticks on.
    if (entry.type === 'camera' && entry.endedAt === null) {
      const age = now - parseIso((entry.summary as CameraSummary).since);
      if (Number.isFinite(age) && age > CAMERA_EVENT_TTL_MS) {
        endActivity(entry, now, null, false);
      }
    }

    // A timer whose chronometer hit zero is done, even before HA flips state.
    if (entry.type === 'timer' && entry.endedAt === null) {
      const summary = entry.summary as TimerSummary;
      if (summary.state === 'active' && summary.finishesAt) {
        const finish = parseIso(summary.finishesAt);
        if (Number.isFinite(finish) && finish <= now - 1_000) {
          endActivity(entry, now, 'Done', true);
        }
      }
    }

    // Drop ended entries past their linger window or dismissed by the user.
    if (entry.endedAt !== null) {
      const expired = now - entry.endedAt > LINGER_MS[entry.type];
      if (expired || isDismissed(entry.id, `ended:${entry.endedAt}`)) {
        tracked.delete(entry.id);
      }
    }
  });
}

function isEntryStale(entry: Tracked, now: number): boolean {
  if (entry.endedAt !== null) return false;
  // Simulated entities are injected client-side and never re-report.
  if (entry.id.includes('simulated')) return false;
  if (!connected) return true;

  const ttl = FRESHNESS_TTL_MS[entry.type];
  if (!ttl || !peekEntitiesFn) return false;

  const entity = peekEntitiesFn()[entry.id];
  if (!entity) return false;
  const updated = parseIso(entity.last_updated);
  return Number.isFinite(updated) && now - updated > ttl;
}

function toStatus(entry: Tracked, now: number): ActivityStatus {
  return {
    phase: entry.endedAt === null ? 'active' : 'ended',
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    isStale: isEntryStale(entry, now),
    relevance: entry.endedAt === null ? scoreActive(entry.type, entry.summary, now) : ENDED_RELEVANCE,
    alertAt: entry.alertAt,
    endLabel: entry.endLabel,
  };
}

function collectType<S extends AnySummary>(type: ActivityType, now: number): ActivityItem<S>[] {
  const items: ActivityItem<S>[] = [];
  tracked.forEach((entry) => {
    if (entry.type !== type) return;
    if (type === 'release') {
      const summary = entry.summary as ReleaseNotesSummary;
      if (isDismissed(entry.id, summary.updatedAt)) return;
    }
    items.push({ summary: entry.summary as S, status: toStatus(entry, now) });
  });

  items.sort((a, b) =>
    b.status.relevance - a.status.relevance
    || a.status.startedAt - b.status.startedAt
    || getSummaryId(a.summary).localeCompare(getSummaryId(b.summary)));
  return items;
}

function getSummaryId(summary: AnySummary): string {
  return (summary as { entityId: string }).entityId;
}

function areStatusesEqual(a: ActivityStatus, b: ActivityStatus): boolean {
  return (
    a.phase === b.phase
    && a.startedAt === b.startedAt
    && a.endedAt === b.endedAt
    && a.isStale === b.isStale
    && a.relevance === b.relevance
    && a.alertAt === b.alertAt
    && a.endLabel === b.endLabel
  );
}

function areItemListsEqual<S>(previous: ActivityItem<S>[], next: ActivityItem<S>[]): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index].summary !== next[index].summary) return false;
    if (!areStatusesEqual(previous[index].status, next[index].status)) return false;
  }
  return true;
}

function buildSnapshot(now: number): ActivitiesSnapshot {
  const next: ActivitiesSnapshot = {
    releaseNotes: collectType<ReleaseNotesSummary>('release', now),
    players: collectType<MediaSummary>('media', now),
    timers: collectType<TimerSummary>('timer', now),
    cameras: collectType<CameraSummary>('camera', now),
    printers: collectType<PrinterSummary>('printer', now),
    vacuums: collectType<VacuumSummary>('vacuum', now),
    updateInstalls: collectType<UpdateInstallSummary>('update', now),
    backups: collectType<BackupRunningSummary>('backup', now),
    alarms: collectType<AlarmSummary>('alarm', now),
    typeOrder: [],
  };

  const listsByType: Record<ActivityType, ActivityItem<AnySummary>[]> = {
    release: next.releaseNotes,
    media: next.players,
    timer: next.timers,
    camera: next.cameras,
    printer: next.printers,
    vacuum: next.vacuums,
    update: next.updateInstalls,
    backup: next.backups,
    alarm: next.alarms,
  };

  next.typeOrder = CANONICAL_TYPE_ORDER
    .filter((type) => listsByType[type].length > 0)
    .sort((a, b) => listsByType[b][0].status.relevance - listsByType[a][0].status.relevance
      || CANONICAL_TYPE_ORDER.indexOf(a) - CANONICAL_TYPE_ORDER.indexOf(b));

  return next;
}

function rebuild(now: number): void {
  const next = buildSnapshot(now);
  const unchanged =
    areItemListsEqual(snapshot.releaseNotes, next.releaseNotes)
    && areItemListsEqual(snapshot.players, next.players)
    && areItemListsEqual(snapshot.timers, next.timers)
    && areItemListsEqual(snapshot.cameras, next.cameras)
    && areItemListsEqual(snapshot.printers, next.printers)
    && areItemListsEqual(snapshot.vacuums, next.vacuums)
    && areItemListsEqual(snapshot.updateInstalls, next.updateInstalls)
    && areItemListsEqual(snapshot.backups, next.backups)
    && areItemListsEqual(snapshot.alarms, next.alarms)
    && snapshot.typeOrder.length === next.typeOrder.length
    && snapshot.typeOrder.every((type, index) => next.typeOrder[index] === type);

  if (unchanged) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------
// Public store API
// ---------------------------------------------------------------------------

export function ingestActivityData(data: ActivityData, isConnected: boolean): void {
  lastData = data;
  connected = isConnected;
  const now = Date.now();
  reconcile(now);
  rebuild(now);
}

export function attachEntityPeek(peek: () => HassEntities): void {
  peekEntitiesFn = peek;
}

export function subscribeActivities(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActivitiesSnapshot(): ActivitiesSnapshot {
  return snapshot;
}

export function getEmptyActivitiesSnapshot(): ActivitiesSnapshot {
  return EMPTY_SNAPSHOT;
}

/** Dismissal key for an ended activity card. */
export function endedDismissKey(status: ActivityStatus): string {
  return `ended:${status.endedAt ?? 0}`;
}

let tickerConsumers = 0;
let tickerId: ReturnType<typeof setInterval> | null = null;

/**
 * Keep the 1s lifecycle tick running while any consumer is mounted. The tick
 * drives time-based transitions: linger expiry, camera auto-end, timers
 * hitting zero, staleness, and age-dependent relevance.
 */
export function retainActivitiesTicker(): () => void {
  tickerConsumers += 1;
  if (!tickerId) {
    tickerId = setInterval(() => {
      const now = Date.now();
      reconcile(now);
      rebuild(now);
    }, 1_000);
  }
  return () => {
    tickerConsumers -= 1;
    if (tickerConsumers <= 0 && tickerId) {
      clearInterval(tickerId);
      tickerId = null;
    }
  };
}

// Dismissing from any surface re-derives the snapshot everywhere.
subscribeDismissals(() => {
  const now = Date.now();
  reconcile(now);
  rebuild(now);
});
