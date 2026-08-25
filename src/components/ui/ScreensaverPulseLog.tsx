'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeHomePulse, type PulseKind, type PulseMeta } from '@/lib/homePulseBus';

// How long a trigger stays listed before it fades out, and how many we keep.
const ENTRY_TTL_MS = 6000;
const MAX_ENTRIES = 4;

// Short human descriptor + dot colour per semantic kind. Mirrors PULSE_COLORS
// but as CSS so the dot matches the ripple that just flew out.
const KIND_INFO: Record<PulseKind, { verb: string; dot: string }> = {
  on: { verb: 'turned on', dot: 'rgb(255,201,77)' },
  off: { verb: 'turned off', dot: 'rgb(128,168,217)' },
  error: { verb: 'unavailable', dot: 'rgb(255,77,77)' },
  alert: { verb: 'changed', dot: 'rgb(255,158,64)' },
  link: { verb: 'connected', dot: 'rgb(77,209,140)' },
};

interface LogEntry extends PulseMeta {
  id: number;
}

/**
 * A subtle bottom-center log on the screensaver naming the entity behind each
 * reactive ring ripple. Driven by the same home-pulse bus the shader consumes,
 * so the text and the coloured pulse always agree. Entries fade out after a few
 * seconds. Renders nothing when idle. Purely informational (pointer-events off).
 */
export function ScreensaverPulseLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    return subscribeHomePulse((_color, meta) => {
      if (!meta) return; // ambient/heartbeat pulses carry no label — skip
      const id = nextId.current++;
      setEntries((prev) => [{ id, ...meta }, ...prev].slice(0, MAX_ENTRIES));
      window.setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }, ENTRY_TTL_MS);
    });
  }, []);

  if (entries.length === 0) return null;

  return (
    <div
      // Sits clear of the talk widget, which docks at the same bottom edge: its
      // pill would blur the labels into its backdrop and its glow layer (h-52)
      // paints over them, so stack above (z-10) and clear the pill's height.
      className="absolute left-1/2 -translate-x-1/2 bottom-0 z-10 flex flex-col-reverse items-center gap-ha-1 px-ha-6 pointer-events-none max-w-[90vw] pb-[calc(env(safe-area-inset-bottom)+8.5rem)] lg:pb-[calc(env(safe-area-inset-bottom)+6rem)]"
      aria-hidden
    >
      {entries.map((e) => {
        const info = KIND_INFO[e.kind] ?? KIND_INFO.alert;
        return (
          <div
            key={e.id}
            // ha-surface-enter (fade + rise) — the tailwindcss-animate classes
            // this used (`animate-in fade-in …`) were never generated: the
            // plugin isn't installed, so they were dead classes.
            className="ha-surface-enter flex items-center gap-ha-2 rounded-full bg-black/55 border border-white/15 pl-ha-2 pr-ha-3 py-ha-1"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: info.dot }}
            />
            <span className="text-xs text-white font-medium truncate">{e.label}</span>
            <span className="text-xs text-white/50 truncate">{info.verb}</span>
          </div>
        );
      })}
    </div>
  );
}
