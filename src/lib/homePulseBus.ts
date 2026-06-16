// A tiny pub/sub bus carrying "something happened in the home" pulses to the
// reactive ring background. The reactor hook (useHomeEventReactor) emits a
// semantic colour; the RingShaderBackground subscribes and spawns a coloured
// ripple. Kept framework-free and module-level so the producer and the
// animation loop don't need to share a React tree.

/** Normalised RGB in 0..1, ready to hand straight to WebGL / canvas. */
export type PulseColor = [number, number, number];

/** Semantic kind of a pulse — keys of PULSE_COLORS (see below). */
export type PulseKind = keyof typeof PULSE_COLORS;

/**
 * Optional human-readable context about *what* triggered a pulse, so a UI (the
 * screensaver pulse log) can show it. The shader background ignores this.
 */
export interface PulseMeta {
  /** Friendly name of the entity that changed. */
  label: string;
  /** Which semantic class the change fell into. */
  kind: PulseKind;
}

type Listener = (color: PulseColor, meta?: PulseMeta) => void;

const listeners = new Set<Listener>();

export function emitHomePulse(color: PulseColor, meta?: PulseMeta): void {
  listeners.forEach((l) => l(color, meta));
}

export function subscribeHomePulse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Semantic palette — colour encodes *what kind* of thing happened, per the
// design call. Tuned to read clearly over both light and dark backgrounds.
export const PULSE_COLORS = {
  on: [1.0, 0.79, 0.3] as PulseColor,     // warm gold — turned on / active / recovered
  off: [0.5, 0.66, 0.85] as PulseColor,   // cool slate-blue — turned off / inactive
  error: [1.0, 0.3, 0.3] as PulseColor,   // red — went unavailable / unknown
  alert: [1.0, 0.62, 0.25] as PulseColor, // amber — significant sensor jump
  link: [0.3, 0.82, 0.55] as PulseColor,  // green — connection heartbeat (instance reachable)
} as const;
