'use client';

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getUserData, setUserData } from '@/lib/homeassistant';
import { useHomeAssistant } from './useHomeAssistant';

/**
 * Syncs a map-shaped store (area geometry / device placements) with HA's
 * per-user frontend storage, so the floor plan follows the account instead of
 * living in one browser's localStorage.
 *
 * Contract: localStorage stays the instant-paint cache; once connected, the
 * remote copy wins (it's the shared truth). If the remote key is empty but
 * local has data — the pre-sync installs — local is pushed up as the seed.
 * The returned ref turns true after that first reconcile; callers gate remote
 * writes on it so a not-yet-loaded (empty) state can never clobber the server.
 */
export function useRemoteMapSync<T extends Record<string, unknown>>(
  key: string,
  setState: Dispatch<SetStateAction<T>>,
  localLoaded: MutableRefObject<boolean>,
): MutableRefObject<boolean> {
  const { connected, demoMode } = useHomeAssistant();
  const synced = useRef(false);

  useEffect(() => {
    if (!connected || demoMode || synced.current || !localLoaded.current) return;
    let cancelled = false;
    getUserData<T>(key).then((remote) => {
      if (cancelled) return;
      if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
        setState(remote);
      } else {
        setState((cur) => {
          if (Object.keys(cur).length > 0) void setUserData(key, cur);
          return cur;
        });
      }
      synced.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [connected, demoMode, key, setState, localLoaded]);

  return synced;
}

/** Persist helper: mirrors to HA user data once the initial reconcile ran. */
export function persistRemoteMap(key: string, value: unknown, synced: MutableRefObject<boolean>): void {
  if (synced.current) void setUserData(key, value);
}
