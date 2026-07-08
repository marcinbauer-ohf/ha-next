'use client';

import { useEffect, useRef, useState } from 'react';
import { useHomeAssistant, useHomeAssistantSelector, useConnectionAlive } from '@/hooks';
import {
  selectSystemUpdateInstall,
  areSystemUpdateInstallsEqual,
  type SystemUpdateInstall,
} from '@/lib/homeassistant/selectors';
import { SystemUpdateOverlay, type SystemUpdatePhase } from './SystemUpdateOverlay';

type Phase = 'idle' | SystemUpdatePhase;

// How long to keep the "ready" state up after the instance comes back and the
// update entity clears, so the transition doesn't blink past the user.
const SETTLE_MS = 2500;

// Dev-only preview: a real OS/Supervisor update can't be summoned on demand
// (and demo mode never triggers the overlay), so ⌘/Ctrl+Shift+U cycles through
// the phases for visual work. Dead-code-eliminated from production builds.
const PREVIEW_ENABLED = process.env.NODE_ENV !== 'production';
type PreviewStep = { phase: Phase; install: SystemUpdateInstall | null };
const PREVIEW_STEPS: PreviewStep[] = [
  { phase: 'idle', install: null },
  { phase: 'installing', install: { entityId: 'preview', component: 'os', label: 'Home Assistant Operating System', percentage: 42, targetVersion: '13.2' } },
  { phase: 'installing', install: { entityId: 'preview', component: 'core', label: 'Home Assistant Core', percentage: null, targetVersion: '2026.7.0' } },
  { phase: 'restarting', install: { entityId: 'preview', component: 'os', label: 'Home Assistant Operating System', percentage: 100, targetVersion: '13.2' } },
  { phase: 'settling', install: { entityId: 'preview', component: 'os', label: 'Home Assistant Operating System', percentage: 100, targetVersion: '13.2' } },
];

/**
 * Watches for a core-system update (OS/Supervisor/Core) installing and shows a
 * full-screen "updating" overlay in place of the app — which otherwise breaks
 * when the instance restarts and the socket drops.
 *
 * State machine (only ever leaves 'idle' after we witness a system install, so
 * an ordinary network blip never triggers it):
 *   installing  — entity reports in_progress, socket alive
 *   restarting  — socket dropped mid-update (HA is rebooting); latched here
 *   settling    — socket back and the update cleared; brief "ready" beat → idle
 */
export function SystemUpdateWatcher() {
  const { demoMode, configured } = useHomeAssistant();
  const alive = useConnectionAlive();
  const install = useHomeAssistantSelector(selectSystemUpdateInstall, areSystemUpdateInstallsEqual);

  const [phase, setPhase] = useState<Phase>('idle');
  // The entity vanishes from the store once HA goes offline, so remember the
  // last-seen install to keep labelling the overlay through the restart.
  const [lastInstall, setLastInstall] = useState<SystemUpdateInstall | null>(null);

  // Mirror the current phase into a ref the install/alive effect can read
  // without listing `phase` as a dependency (which would re-run it spuriously).
  const phaseRef = useRef<Phase>('idle');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSettle = () => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };

  useEffect(() => {
    const prev = phaseRef.current;

    if (demoMode || !configured) {
      clearSettle();
      if (prev !== 'idle') {
        setPhase('idle');
        setLastInstall(null);
      }
      return;
    }

    if (!alive) {
      // Socket down. Only meaningful once we've already seen an update begin —
      // otherwise this is just a disconnect and not our concern.
      clearSettle();
      if (prev !== 'idle') setPhase('restarting');
      return;
    }

    if (install) {
      clearSettle();
      setLastInstall(install);
      setPhase('installing');
      return;
    }

    // Socket alive, nothing installing.
    if (prev === 'idle') return;
    if (prev !== 'settling') {
      setPhase('settling');
      clearSettle();
      settleTimer.current = setTimeout(() => {
        setPhase('idle');
        setLastInstall(null);
      }, SETTLE_MS);
    }
  }, [install, alive, demoMode, configured]);

  useEffect(() => clearSettle, []);

  // Dev preview cycling (never wired in production).
  const [previewIndex, setPreviewIndex] = useState(0);
  useEffect(() => {
    if (!PREVIEW_ENABLED) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setPreviewIndex((i) => (i + 1) % PREVIEW_STEPS.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const preview = PREVIEW_ENABLED && previewIndex > 0 ? PREVIEW_STEPS[previewIndex] : null;

  const effectivePhase = preview ? preview.phase : phase;
  const effectiveInstall = preview ? preview.install : install ?? lastInstall;

  return (
    <SystemUpdateOverlay
      visible={effectivePhase !== 'idle'}
      install={effectiveInstall}
      phase={effectivePhase === 'idle' ? 'settling' : effectivePhase}
    />
  );
}
