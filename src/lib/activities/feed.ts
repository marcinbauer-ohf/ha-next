import {
  mdiCloudUpload,
  mdiDoorbellVideo,
  mdiPlay,
  mdiPrinter3d,
  mdiRobotVacuum,
  mdiShieldAlert,
  mdiTimerOutline,
  mdiUpdate,
} from '@mdi/js';
import type { ActivitiesSnapshot, ActivityStatus, ActivityType } from './types';

// A single "Happening now" entry, flattened from the ledger snapshot. This is
// the shared model the Home Center surfaces render, so the settings panel and
// the dashboard pop-up never disagree about what's going on or in what order.
export type ActivityFeedTone = 'primary' | 'success' | 'danger';

export interface ActivityFeedItem {
  key: string;
  type: ActivityType;
  icon: string;
  tone: ActivityFeedTone;
  name: string;
  /** Live descriptor while active; final-state label once ended. */
  subtitle: string;
  /** 0–100 for active items with numeric progress, else null. */
  progress: number | null;
  phase: ActivityStatus['phase'];
  isStale: boolean;
}

// Icon + tone per activity type — kept here (not in the components) so both the
// desktop and mobile Home Center surfaces pull from one table.
const META: Record<ActivityType, { icon: string; tone: ActivityFeedTone }> = {
  release: { icon: mdiUpdate, tone: 'success' },
  media: { icon: mdiPlay, tone: 'primary' },
  timer: { icon: mdiTimerOutline, tone: 'primary' },
  camera: { icon: mdiDoorbellVideo, tone: 'danger' },
  printer: { icon: mdiPrinter3d, tone: 'primary' },
  vacuum: { icon: mdiRobotVacuum, tone: 'primary' },
  update: { icon: mdiUpdate, tone: 'primary' },
  backup: { icon: mdiCloudUpload, tone: 'primary' },
  alarm: { icon: mdiShieldAlert, tone: 'danger' },
};

// Ended items linger with their final-state label; active items show a live
// descriptor. Numeric progress is only meaningful while active.
const endedSubtitle = (status: ActivityStatus, live: string) =>
  status.phase === 'ended' ? status.endLabel || 'Done' : live;

const activeProgress = (status: ActivityStatus, value: number | null) =>
  status.phase === 'ended' ? null : value;

/**
 * Flatten a ledger snapshot into one relevance-ordered feed. Order follows the
 * snapshot's `typeOrder` (same as the status bar / mobile nav), so the most
 * important activity leads. Ended items are included so their final state
 * lingers briefly, matching the ledger's post-end summary window.
 */
export function buildActivityFeed(snapshot: ActivitiesSnapshot): ActivityFeedItem[] {
  const byType: Record<ActivityType, ActivityFeedItem[]> = {
    release: snapshot.releaseNotes.map(({ summary, status }) => ({
      key: `release:${summary.entityId}`, type: 'release', ...META.release,
      name: summary.name, subtitle: endedSubtitle(status, summary.version),
      progress: null, phase: status.phase, isStale: status.isStale,
    })),
    media: snapshot.players.map(({ summary, status }) => ({
      key: `media:${summary.entityId}`, type: 'media', ...META.media,
      name: summary.name, subtitle: endedSubtitle(status, summary.mediaTitle || summary.state),
      progress: null, phase: status.phase, isStale: status.isStale,
    })),
    timer: snapshot.timers.map(({ summary, status }) => ({
      key: `timer:${summary.entityId}`, type: 'timer', ...META.timer,
      name: summary.name, subtitle: endedSubtitle(status, summary.remaining),
      progress: null, phase: status.phase, isStale: status.isStale,
    })),
    camera: snapshot.cameras.map(({ summary, status }) => ({
      key: `camera:${summary.entityId}`, type: 'camera', ...META.camera,
      name: summary.name, subtitle: endedSubtitle(status, summary.event || 'Motion detected'),
      progress: null, phase: status.phase, isStale: status.isStale,
    })),
    printer: snapshot.printers.map(({ summary, status }) => ({
      key: `printer:${summary.entityId}`, type: 'printer', ...META.printer,
      name: summary.name, subtitle: endedSubtitle(status, `${summary.progress}% complete`),
      progress: activeProgress(status, summary.progress), phase: status.phase, isStale: status.isStale,
    })),
    vacuum: snapshot.vacuums.map(({ summary, status }) => ({
      key: `vacuum:${summary.entityId}`, type: 'vacuum', ...META.vacuum,
      name: summary.name, subtitle: endedSubtitle(status, `${summary.progress}% • ${summary.area || 'Cleaning'}`),
      progress: activeProgress(status, summary.progress), phase: status.phase, isStale: status.isStale,
    })),
    update: snapshot.updateInstalls.map(({ summary, status }) => ({
      key: `update:${summary.entityId}`, type: 'update', ...META.update,
      name: summary.name, subtitle: endedSubtitle(status, summary.percentage !== null ? `${summary.percentage}% installed` : 'Installing…'),
      progress: activeProgress(status, summary.percentage), phase: status.phase, isStale: status.isStale,
    })),
    backup: snapshot.backups.map(({ summary, status }) => ({
      key: `backup:${summary.entityId}`, type: 'backup', ...META.backup,
      name: summary.name, subtitle: endedSubtitle(status, summary.stage || (summary.progress !== null ? `${summary.progress}%` : 'Running…')),
      progress: activeProgress(status, summary.progress), phase: status.phase, isStale: status.isStale,
    })),
    alarm: snapshot.alarms.map(({ summary, status }) => ({
      key: `alarm:${summary.entityId}`, type: 'alarm', ...META.alarm,
      name: summary.name, subtitle: endedSubtitle(status, summary.state === 'triggered' ? 'Triggered' : summary.state === 'pending' ? 'Pending' : 'Arming'),
      progress: null, phase: status.phase, isStale: status.isStale,
    })),
  };

  return snapshot.typeOrder.flatMap((type) => byType[type]);
}
