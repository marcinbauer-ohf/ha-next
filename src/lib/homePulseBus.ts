// A tiny pub/sub bus carrying "something happened in the home" pulses to the
// reactive ring background. The reactor hook (useHomeEventReactor) emits a
// semantic colour; the RingShaderBackground subscribes and spawns a coloured
// ripple. Kept framework-free and module-level so the producer and the
// animation loop don't need to share a React tree.

/** Normalised RGB in 0..1, ready to hand straight to WebGL / canvas. */
export type PulseColor = [number, number, number];

type Listener = (color: PulseColor) => void;

const listeners = new Set<Listener>();

export function emitHomePulse(color: PulseColor): void {
  listeners.forEach((l) => l(color));
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
} as const;
