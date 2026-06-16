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
      className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col-reverse items-center gap-ha-1 px-ha-6 pointer-events-none max-w-[90vw]"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 5rem)` }}
      aria-hidden
    >
      {entries.map((e) => {
        const info = KIND_INFO[e.kind] ?? KIND_INFO.alert;
        return (
          <div
            key={e.id}
            className="flex items-center gap-ha-2 rounded-ha-pill bg-surface-mid/55 backdrop-blur-md border border-white/10 pl-ha-2 pr-ha-3 py-ha-1 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: info.dot }}
            />
            <span className="text-xs text-text-primary font-medium truncate">{e.label}</span>
            <span className="text-xs text-text-disabled truncate">{info.verb}</span>
          </div>
        );
      })}
    </div>
  );
}
