import type { SystemUpdateInstall } from '@/lib/homeassistant/selectors';
import type { SystemUpdatePhase } from '@/components/ui/SystemUpdateOverlay';

/**
 * Preview driver for the system-update / restart overlay.
 *
 * A real OS/Supervisor/Core update (or a live restart) can't be summoned on
 * demand, so this module lets the "Prototype & Debug Tools" settings page — and
 * the dev-only ⌘/Ctrl+Shift+U shortcut — force the overlay through each phase
 * for visual work. It's a tiny external store so the settings page and the
 * SystemUpdateWatcher (far apart in the tree) can drive one shared preview
 * without prop-drilling or context.
 *
 * Index 0 = off (no preview; the real state machine shows through).
 */

export type PreviewPhase = 'idle' | SystemUpdatePhase;
export interface UpdatePreviewStep {
  /** Short label for the settings buttons. */
  label: string;
  phase: PreviewPhase;
  install: SystemUpdateInstall | null;
}

export const UPDATE_PREVIEW_STEPS: UpdatePreviewStep[] = [
  { label: 'Off', phase: 'idle', install: null },
  { label: 'Installing (OS, %)', phase: 'installing', install: { entityId: 'preview', component: 'os', label: 'Home Assistant Operating System', percentage: 42, targetVersion: '13.2' } },
  { label: 'Installing (Core, no %)', phase: 'installing', install: { entityId: 'preview', component: 'core', label: 'Home Assistant Core', percentage: null, targetVersion: '2026.7.0' } },
  { label: 'Restarting (after update)', phase: 'restarting', install: { entityId: 'preview', component: 'os', label: 'Home Assistant Operating System', percentage: 100, targetVersion: '13.2' } },
  { label: 'Restarting (bare)', phase: 'restarting', install: null },
  { label: 'Ready', phase: 'settling', install: { entityId: 'preview', component: 'os', label: 'Home Assistant Operating System', percentage: 100, targetVersion: '13.2' } },
];

type Listener = (index: number) => void;
const listeners = new Set<Listener>();
let previewIndex = 0;

function emit() {
  listeners.forEach((listener) => listener(previewIndex));
}

export function subscribeToUpdatePreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUpdatePreviewIndex(): number {
  return previewIndex;
}

export function setUpdatePreviewIndex(index: number): void {
  const next = ((index % UPDATE_PREVIEW_STEPS.length) + UPDATE_PREVIEW_STEPS.length) % UPDATE_PREVIEW_STEPS.length;
  if (next === previewIndex) return;
  previewIndex = next;
  emit();
}

/** Advance to the next step, wrapping back to Off. Used by the ⌘⇧U shortcut. */
export function cycleUpdatePreview(): void {
  setUpdatePreviewIndex(previewIndex + 1);
}

export function clearUpdatePreview(): void {
  setUpdatePreviewIndex(0);
}
