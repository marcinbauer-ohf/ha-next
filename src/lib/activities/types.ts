import type {
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

export type ActivityType =
  | 'release'
  | 'media'
  | 'timer'
  | 'camera'
  | 'printer'
  | 'vacuum'
  | 'update'
  | 'backup'
  | 'alarm';

/**
 * Live-activity lifecycle phase. `ended` items linger with their final state
 * for a short window (Apple's post-end summary pattern) before dropping out.
 */
export type ActivityPhase = 'active' | 'ended';

export interface ActivityStatus {
  phase: ActivityPhase;
  /** Client clock (ms) when the activity was first seen in a qualifying state. */
  startedAt: number;
  /** Client clock (ms) when it left the qualifying state; null while active. */
  endedAt: number | null;
  /**
   * True when the backing entity stopped reporting within its freshness
   * window, or the HA connection dropped. UI must show stale data as stale,
   * never as fresh.
   */
  isStale: boolean;
  /**
   * Relative priority — higher wins the leading dock slot and the mobile cap.
   * Ties break on startedAt (earlier first), mirroring ActivityKit semantics.
   */
  relevance: number;
  /**
   * Set at alert-worthy transitions only (new camera event, timer done,
   * print complete). State drift never alerts.
   */
  alertAt: number | null;
  /** Final-state label for the ended card ("Done", "Print complete"). */
  endLabel: string | null;
}

export interface ActivityItem<S> {
  summary: S;
  status: ActivityStatus;
}

export interface ActivitiesSnapshot {
  releaseNotes: ActivityItem<ReleaseNotesSummary>[];
  players: ActivityItem<MediaSummary>[];
  timers: ActivityItem<TimerSummary>[];
  cameras: ActivityItem<CameraSummary>[];
  printers: ActivityItem<PrinterSummary>[];
  vacuums: ActivityItem<VacuumSummary>[];
  updateInstalls: ActivityItem<UpdateInstallSummary>[];
  backups: ActivityItem<BackupRunningSummary>[];
  alarms: ActivityItem<AlarmSummary>[];
  /**
   * Types with at least one visible item, highest relevance first. Both the
   * desktop dock and the mobile nav render in this order so the two surfaces
   * never disagree about what matters most.
   */
  typeOrder: ActivityType[];
}

/** How long an ended activity's final state stays visible, per type (ms). */
export const LINGER_MS: Record<ActivityType, number> = {
  timer: 60_000,
  printer: 120_000,
  vacuum: 120_000,
  camera: 120_000,
  media: 0,
  release: 0,
  update: 90_000,
  backup: 90_000,
  alarm: 180_000,
};

/**
 * How long an active entity may go without a state_changed before its data
 * counts as outdated (ms). Types that self-tick client-side (timer), are
 * purely informational (release), or are state-driven with no numeric
 * progress to go stale (alarm) are exempt.
 */
export const FRESHNESS_TTL_MS: Partial<Record<ActivityType, number>> = {
  media: 15 * 60_000,
  printer: 15 * 60_000,
  vacuum: 10 * 60_000,
  update: 20 * 60_000,
  backup: 30 * 60_000,
};

/** Camera events auto-end this long after last_changed, even if the sensor sticks on. */
export const CAMERA_EVENT_TTL_MS = 5 * 60_000;

/** How long a fresh alert keeps its attention styling (ms). */
export const ALERT_WINDOW_MS = 2_500;
