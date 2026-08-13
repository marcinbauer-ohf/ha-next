import type { AppStatus } from '@/contexts';

/**
 * Preview driver for the app-icon status markers (installing / stopped /
 * error / update available).
 *
 * The real states come from the Supervisor, so most of them can't be summoned
 * on demand — you'd have to actually stop an add-on or catch an update mid
 * install. This tiny external store lets the "Prototype & Debug Tools" settings
 * page paint a chosen state onto every app icon in the sidebar and mobile nav,
 * exactly like `systemUpdatePreview` does for the full-screen overlay.
 *
 * Index 0 = off (real Supervisor state shows through).
 */

export interface AppStatusPreviewStep {
  label: string;
  description: string;
  /** Applied round-robin across the app icons, so one step can show several states. */
  statuses: AppStatus[];
}

export const APP_STATUS_PREVIEW_STEPS: AppStatusPreviewStep[] = [
  { label: 'Off', description: '', statuses: [] },
  {
    label: 'Every state at once',
    description: 'Each app icon takes the next state in turn — needs a few apps to show them all',
    statuses: [
      { kind: 'installing', progress: 35 },
      { kind: 'stopped' },
      { kind: 'update' },
      { kind: 'installing', progress: null },
      { kind: 'error' },
    ],
  },
  {
    label: 'Installing',
    description: 'Filling bar — 15%, 60%, then the no-percentage shimmer',
    statuses: [
      { kind: 'installing', progress: 15 },
      { kind: 'installing', progress: 60 },
      { kind: 'installing', progress: null },
    ],
  },
  { label: 'Stopped', description: 'Dimmed icon with the stop marker', statuses: [{ kind: 'stopped' }] },
  { label: 'Not running', description: 'Dimmed icon with the red alert marker', statuses: [{ kind: 'error' }] },
  { label: 'Update available', description: 'Full-colour icon with the blue arrow marker', statuses: [{ kind: 'update' }] },
];

type Listener = (version: number) => void;
const listeners = new Set<Listener>();
let previewIndex = 0;
// Bumped on every emit, including each progress tick — subscribers key off this
// rather than the index, which stands still while a fake install climbs.
let version = 0;
let progress = 0;
let ticker: ReturnType<typeof setInterval> | undefined;

function emit() {
  version += 1;
  listeners.forEach((listener) => listener(version));
}

/** A previewed install with a percentage has to climb, or it reads as stuck. */
function stepClimbs(index: number): boolean {
  return !!APP_STATUS_PREVIEW_STEPS[index]?.statuses.some(
    (status) => status.kind === 'installing' && status.progress != null
  );
}

function stopClimbing() {
  if (ticker) clearInterval(ticker);
  ticker = undefined;
  progress = 0;
}

export function subscribeToAppStatusPreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAppStatusPreviewIndex(): number {
  return previewIndex;
}

/** Snapshot for useSyncExternalStore — changes on index *and* progress ticks. */
export function getAppStatusPreviewVersion(): number {
  return version;
}

export function setAppStatusPreviewIndex(index: number): void {
  const next =
    ((index % APP_STATUS_PREVIEW_STEPS.length) + APP_STATUS_PREVIEW_STEPS.length) %
    APP_STATUS_PREVIEW_STEPS.length;
  if (next === previewIndex) return;
  previewIndex = next;
  stopClimbing();
  if (stepClimbs(next)) {
    ticker = setInterval(() => {
      progress = (progress + 4) % 108; // overshoots 100 so the bar rests full a beat
      emit();
    }, 300);
  }
  emit();
}

export function clearAppStatusPreview(): void {
  setAppStatusPreviewIndex(0);
}

/** The status to paint on the app at `position` in the rail, or undefined when off. */
export function previewAppStatus(index: number, position: number): AppStatus | undefined {
  const step = APP_STATUS_PREVIEW_STEPS[index];
  if (!step?.statuses.length) return undefined;
  const status = step.statuses[position % step.statuses.length];
  if (status.kind !== 'installing' || status.progress == null) return status;
  // Each icon starts from its own offset, so a row of them doesn't march in lockstep.
  return {
    kind: 'installing',
    progress: Math.min(100, (status.progress + progress + position * 17) % 108),
  };
}
