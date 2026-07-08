'use client';

import { useEffect } from 'react';
import { getConnection } from '@/lib/homeassistant';
import { emitHomePulse, PULSE_COLORS } from '@/lib/homePulseBus';

// Cadence of the connection ping. Kept calm (a couple of seconds) so the ripples
// read as a steady heartbeat, not a strobe. Loosely echoes the heartbeat mode's
// ~2.4s period.
const PING_INTERVAL_MS = 2500;

// Latency → ripple-width mapping. A crisp local instance (~20ms) draws a thin
// ring; a laggy one (500ms+) draws a fat, soft one. Round-trips outside this
// window clamp to the ends so a stall doesn't blow the ring up unboundedly.
const RTT_MIN_MS = 20;
const RTT_MAX_MS = 500;
const WIDTH_MIN = 0.7; // thinnest ripple (fast)
const WIDTH_MAX = 3.0; // fattest ripple (slow)

function latencyToWidth(rttMs: number): number {
  const clamped = Math.min(RTT_MAX_MS, Math.max(RTT_MIN_MS, rttMs));
  const t = (clamped - RTT_MIN_MS) / (RTT_MAX_MS - RTT_MIN_MS);
  return WIDTH_MIN + t * (WIDTH_MAX - WIDTH_MIN);
}

/**
 * While enabled, pings the live Home Assistant WebSocket on a calm cadence and
 * emits a `link` pulse per round-trip, its ripple width scaled by the measured
 * latency — a visible "ping to the instance" on the classic screensaver ring.
 *
 * No-op with no live connection (e.g. demo mode: getConnection() is null), so it
 * never fabricates a heartbeat the instance isn't actually answering. Emits no
 * meta, so the pulse ripples on the shader but is skipped by the pulse log.
 */
export function useHomePingPulse(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const conn = getConnection();
      if (!conn) {
        // Not connected yet (or demo mode) — idle and re-check next cadence.
        timer = setTimeout(tick, PING_INTERVAL_MS);
        return;
      }
      const started = performance.now();
      try {
        await conn.ping();
      } catch {
        // Socket down mid-flight — skip this beat rather than draw a bogus ping.
        if (!cancelled) timer = setTimeout(tick, PING_INTERVAL_MS);
        return;
      }
      if (cancelled) return;
      const rtt = performance.now() - started;
      emitHomePulse(PULSE_COLORS.link, undefined, latencyToWidth(rtt));
      timer = setTimeout(tick, PING_INTERVAL_MS);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
}
