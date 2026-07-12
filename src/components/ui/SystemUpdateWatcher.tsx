'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useHomeAssistant, useHomeAssistantSelector, useConnectionAlive, useRestartPending } from '@/hooks';
import {
  selectSystemUpdateInstall,
  areSystemUpdateInstallsEqual,
  type SystemUpdateInstall,
} from '@/lib/homeassistant/selectors';
import {
  subscribeToUpdatePreview,
  getUpdatePreviewIndex,
  cycleUpdatePreview,
  clearUpdatePreview,
  UPDATE_PREVIEW_STEPS,
} from '@/lib/systemUpdatePreview';
import { SystemUpdateOverlay, type SystemUpdatePhase } from './SystemUpdateOverlay';

type Phase = 'idle' | SystemUpdatePhase;

// How long to keep the "ready" state up after the instance comes back and the
// update entity clears, so the transition doesn't blink past the user.
const SETTLE_MS = 2500;

// The ⌘/Ctrl+Shift+U shortcut (dev builds only) cycles the shared preview store;
// the "Prototype & Debug Tools" settings page drives the same store with buttons
// (available in the running prototype, not just dev). Real updates/restarts
// can't be summoned on demand, so both exist for visual work.
const PREVIEW_SHORTCUT_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Watches for a core-system update (OS/Supervisor/Core) installing and shows a
 * full-screen "updating" overlay in place of the app — which otherwise breaks
 * when the instance restarts and the socket drops.
 *
 * State machine (only ever leaves 'idle' on a real signal — a system install or
 * an explicit HA restart event — so an ordinary network blip never triggers it):
 *   installing  — entity reports in_progress, socket alive
 *   restarting  — HA signalled `homeassistant_stop` (any restart), OR the socket
 *                 dropped after we already saw activity; latched here
 *   settling    — socket back and update/restart cleared; brief "ready" beat → idle
 */
export function SystemUpdateWatcher() {
  const { demoMode, configured } = useHomeAssistant();
  const alive = useConnectionAlive();
  const restartPending = useRestartPending();
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

    // A system update in progress takes precedence and labels the overlay.
    if (install) {
      clearSettle();
      setLastInstall(install);
      setPhase('installing');
      return;
    }

    // Explicit restart signal (homeassistant_stop) — fires for any restart even
    // with no update behind it. Also latch here if the socket drops after we've
    // already seen activity (a blip while idle is still ignored).
    if (restartPending || (!alive && prev !== 'idle')) {
      clearSettle();
      if (prev !== 'restarting') setPhase('restarting');
      return;
    }

    // Socket down but we never saw an update or a restart signal — just a
    // disconnect, not our concern.
    if (!alive) return;

    // Socket alive, nothing installing, no restart pending.
    if (prev === 'idle') return;
    if (prev !== 'settling') {
      setPhase('settling');
      clearSettle();
      settleTimer.current = setTimeout(() => {
        setPhase('idle');
        setLastInstall(null);
      }, SETTLE_MS);
    }
  }, [install, alive, restartPending, demoMode, configured]);

  useEffect(() => clearSettle, []);

  // Preview state lives in a shared external store so both the ⌘⇧U shortcut and
  // the settings page drive the same overlay.
  const previewIndex = useSyncExternalStore(subscribeToUpdatePreview, getUpdatePreviewIndex, () => 0);
  useEffect(() => {
    if (!PREVIEW_SHORTCUT_ENABLED) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        cycleUpdatePreview();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const preview = previewIndex > 0 ? UPDATE_PREVIEW_STEPS[previewIndex] : null;

  // In preview mode the overlay covers the whole app (including the settings
  // page that launched it), so Esc must be able to close it too.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearUpdatePreview();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const effectivePhase = preview ? preview.phase : phase;
  const effectiveInstall = preview ? preview.install : install ?? lastInstall;

  return (
    <SystemUpdateOverlay
      visible={effectivePhase !== 'idle'}
      install={effectiveInstall}
      phase={effectivePhase === 'idle' ? 'settling' : effectivePhase}
      onDismissPreview={preview ? clearUpdatePreview : undefined}
    />
  );
}
