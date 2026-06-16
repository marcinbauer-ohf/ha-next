import {
  mdiArrowExpandAll,
  mdiWeatherNight,
  mdiMagnify,
  mdiRobotExcited,
  mdiThemeLightDark,
  mdiPencilRuler,
  mdiCancel,
} from '@mdi/js';

/** Which surface corner a dog-ear lives in. */
export type DogEarCorner = 'left' | 'right';

/** The action a dog-ear runs when tapped. Extend here to offer more shortcuts. */
export type DogEarAction =
  | 'immersive'
  | 'screensaver'
  | 'search'
  | 'assistant'
  | 'theme'
  | 'edit'
  | 'none';

export interface DogEarActionMeta {
  id: DogEarAction;
  label: string;
  description: string;
  icon: string;
}

/** Ordered list shown in settings; also the source for the id→meta lookup. */
export const DOG_EAR_ACTIONS: DogEarActionMeta[] = [
  { id: 'immersive', label: 'Immersive mode', description: 'Expand content edge-to-edge and hide chrome', icon: mdiArrowExpandAll },
  { id: 'screensaver', label: 'Screensaver', description: 'Start the full-screen idle clock', icon: mdiWeatherNight },
  { id: 'search', label: 'Search', description: 'Open the search overlay', icon: mdiMagnify },
  { id: 'assistant', label: 'Assistant', description: 'Toggle the AI assistant panel', icon: mdiRobotExcited },
  { id: 'theme', label: 'Light / dark', description: 'Toggle between light and dark mode', icon: mdiThemeLightDark },
  { id: 'edit', label: 'Edit layout', description: 'Toggle dashboard edit mode', icon: mdiPencilRuler },
  { id: 'none', label: 'Off', description: 'Hide this corner shortcut', icon: mdiCancel },
];

export const DOG_EAR_ACTION_META = Object.fromEntries(
  DOG_EAR_ACTIONS.map((a) => [a.id, a]),
) as Record<DogEarAction, DogEarActionMeta>;

/** Left corner = immersive, right corner = screensaver, matching the originals. */
export const DEFAULT_DOG_EAR_CONFIG: Record<DogEarCorner, DogEarAction> = {
  left: 'immersive',
  right: 'screensaver',
};
