'use client';

import { useEffect, useRef } from 'react';
import { useHomeAssistant } from './useHomeAssistant';
import { VACUUM_AREAS } from '@/lib/homeassistant/simulatedActivities';
import type { HassEntity } from '@/types';

// Entity id for the self-driving demo vacuum. Distinct from the manually-added
// `vacuum.simulated` debug entities so the two never clobber each other, and so
// this one is NOT counted in the debug "Vacuum" tally.
const AUTO_VACUUM_ID = 'vacuum.auto_simulated';

// Cycle timing (ms). A cleaning run climbs from 0→100% one tick at a time, then
// the robot "returns to dock" and disappears until the next random activation.
const TICK_MS = 2600;
const PROGRESS_PER_TICK = 6;
const FIRST_ACTIVATION_MIN = 9_000;
const FIRST_ACTIVATION_MAX = 22_000;
const NEXT_ACTIVATION_MIN = 40_000;
const NEXT_ACTIVATION_MAX = 110_000;
const RETURNING_MS = 6_000;

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickArea(): string {
  return VACUUM_AREAS[Math.floor(Math.random() * VACUUM_AREAS.length)];
}

function buildEntity(state: string, progress: number, area: string, battery: number): HassEntity {
  const now = new Date().toISOString();
  const remainingMin = Math.max(1, Math.round(((100 - progress) / 100) * 24));
  return {
    entity_id: AUTO_VACUUM_ID,
    state,
    attributes: {
      friendly_name: 'Robot Vacuum',
      progress: Math.round(progress),
      current_area: area,
      battery_level: Math.round(battery),
      fan_speed: 'Balanced',
      time_remaining: `00:${String(remainingMin).padStart(2, '0')}:00`,
    },
    last_changed: now,
    last_updated: now,
  };
}

/**
 * Runs a random robot-vacuum cleaning cycle in demo mode so the activity surface
 * (dashboard task bar + screensaver) has something that comes and goes on its
 * own. Gated on demo mode to honor the "never inject mock data onto a live
 * instance" rule — on a real connection only genuinely cleaning vacuums appear.
 */
export function useVacuumSimulator(): void {
  const { demoMode, setMockEntity } = useHomeAssistant();
  // Keep the latest setter in a ref so the driver loop doesn't restart on every
  // provider re-render (setMockEntity is memoised, but be defensive).
  const setMockEntityRef = useRef(setMockEntity);
  setMockEntityRef.current = setMockEntity;

  useEffect(() => {
    if (!demoMode) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const set = (entity: HassEntity | null) => setMockEntityRef.current(AUTO_VACUUM_ID, entity);

    const schedule = (fn: () => void, delay: number) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        fn();
      }, delay);
    };

    const startCycle = () => {
      const area = pickArea();
      let progress = randBetween(2, 10);
      let battery = randBetween(45, 95);
      set(buildEntity('cleaning', progress, area, battery));

      const tick = () => {
        progress += PROGRESS_PER_TICK;
        battery = Math.max(5, battery - randBetween(0.4, 1.2));

        if (progress >= 100) {
          set(buildEntity('returning', 100, area, battery));
          schedule(endCycle, RETURNING_MS);
          return;
        }

        set(buildEntity('cleaning', progress, area, battery));
        schedule(tick, TICK_MS);
      };

      schedule(tick, TICK_MS);
    };

    const endCycle = () => {
      set(null);
      schedule(startCycle, randBetween(NEXT_ACTIVATION_MIN, NEXT_ACTIVATION_MAX));
    };

    schedule(startCycle, randBetween(FIRST_ACTIVATION_MIN, FIRST_ACTIVATION_MAX));

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // Remove the mock entity so it doesn't linger after leaving demo mode.
      setMockEntityRef.current(AUTO_VACUUM_ID, null);
    };
  }, [demoMode]);
}
