// Local-only onboarding state. Nothing here is written to Home Assistant — the
// wizard collects a home layout into localStorage and then opens the dashboard.
// (See OnboardingWizard for persistence keys.)

export interface OnbFloor {
  id: string;
  name: string;
}

export interface OnbArea {
  id: string;
  name: string;
  floorId: string | null;
}

export interface OnboardingState {
  homeName: string;
  unitSystem: 'metric' | 'imperial';
  floors: OnbFloor[];
  areas: OnbArea[];
  /** deviceId → areaId (areaId references OnbArea.id). */
  deviceAreas: Record<string, string>;
}

export interface StepProps {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

let _seq = 0;
/** Cheap unique id for locally-created floors/areas. */
export function uid(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

export const INITIAL_STATE: OnboardingState = {
  homeName: 'Home',
  unitSystem: 'metric',
  floors: [],
  areas: [],
  deviceAreas: {},
};
