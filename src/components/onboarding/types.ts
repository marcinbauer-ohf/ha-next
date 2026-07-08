// Local-only onboarding state. Nothing here is written to Home Assistant — the
// flow collects a home layout into localStorage and then reveals the dashboard.
// (See OnboardingFlow for persistence keys.)

export type OnboardingPath = 'connect' | 'demo' | null;

export interface OnbRoom {
  id: string;
  name: string;
  /** mdi path string for the room's chip icon. */
  icon: string;
  /** HA-style icon name (e.g. "mdi:sofa-outline") for the created area, when known. */
  haIcon?: string;
}

export interface OnboardingState {
  /** How the user chose to start — connect their own home or look around the demo. */
  path: OnboardingPath;
  homeName: string;
  unitSystem: 'metric' | 'imperial';
  rooms: OnbRoom[];
  /** Areas already present on the connected instance (null until known). */
  existingAreaCount: number | null;
}

export type OnboardingPatch =
  | Partial<OnboardingState>
  | ((s: OnboardingState) => Partial<OnboardingState>);

export interface StepProps {
  state: OnboardingState;
  /** Accepts a patch object or an updater fn — use the fn form for list toggles. */
  update: (patch: OnboardingPatch) => void;
  next: () => void;
  back: () => void;
}

let _seq = 0;
/** Cheap unique id for locally-created rooms. */
export function uid(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

/** Locale-guessed default so most people never think about units at all. */
function defaultUnitSystem(): 'metric' | 'imperial' {
  if (typeof navigator === 'undefined') return 'metric';
  const lang = navigator.language ?? '';
  return /-(US|LR|MM)$/i.test(lang) ? 'imperial' : 'metric';
}

export const INITIAL_STATE: OnboardingState = {
  path: null,
  homeName: '',
  unitSystem: defaultUnitSystem(),
  rooms: [],
  existingAreaCount: null,
};
