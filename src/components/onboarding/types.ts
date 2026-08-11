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
  /** Which storey it sits on, as an index into `floorNames` (0 = ground). */
  floor: number;
}

export interface OnboardingState {
  /** How the user chose to start — connect their own home or look around the demo. */
  path: OnboardingPath;
  homeName: string;
  /** How many storeys the home has — 1 means "no floors worth naming". */
  floorCount: number;
  rooms: OnbRoom[];
  /** Areas already present on the connected instance (null until known). */
  existingAreaCount: number | null;
  /** Floors already present on the connected instance (null until known). */
  existingFloorCount: number | null;
}

export const MAX_FLOORS = 8;

const FLOOR_NAMES = [
  'Ground floor',
  'First floor',
  'Second floor',
  'Third floor',
  'Fourth floor',
  'Fifth floor',
  'Sixth floor',
  'Seventh floor',
];

/** Tab-width labels for the same storeys. */
const FLOOR_SHORT = ['Ground', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

/** Names for the first `count` storeys, ground up. */
export function floorNames(count: number): string[] {
  return FLOOR_NAMES.slice(0, Math.min(count, MAX_FLOORS));
}

export function floorShortNames(count: number): string[] {
  return FLOOR_SHORT.slice(0, Math.min(count, MAX_FLOORS));
}

/** Rooms above the top storey move down to it, so lowering the count loses none. */
export function clampRoomsToFloors(rooms: OnbRoom[], count: number): OnbRoom[] {
  const top = Math.max(0, Math.min(count, MAX_FLOORS) - 1);
  return rooms.map((r) => (r.floor > top ? { ...r, floor: top } : r));
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

export const INITIAL_STATE: OnboardingState = {
  path: null,
  homeName: '',
  floorCount: 1,
  rooms: [],
  existingAreaCount: null,
  existingFloorCount: null,
};
