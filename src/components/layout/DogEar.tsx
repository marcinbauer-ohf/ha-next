'use client';

import clsx from 'clsx';
import { mdiArrowCollapseAll } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { useImmersiveMode, useTheme } from '@/hooks';
import { useDogEarConfig } from '@/hooks/useDogEarConfig';
import {
  useScreensaver,
  useSearchContext,
  useAssistantContext,
  useEditMode,
} from '@/contexts';
import { DOG_EAR_ACTION_META, type DogEarAction, type DogEarCorner } from '@/lib/dogEarActions';

interface Runner {
  run: () => void;
  active: boolean;
  /** Optional icon override (e.g. immersive shows a collapse glyph when on). */
  icon?: string;
}

/**
 * Resolve a configured action id into a runnable handler. All the context hooks
 * are read unconditionally (rules of hooks); the switch just picks one. Safe
 * because every dog-ear renders deep inside the app provider tree.
 */
function useDogEarRunner(action: DogEarAction): Runner | null {
  const { immersiveMode, toggleImmersiveMode } = useImmersiveMode();
  const { activate } = useScreensaver();
  const { openSearch } = useSearchContext();
  const { assistantOpen, toggleAssistant } = useAssistantContext();
  const { isEditing, toggleEditMode } = useEditMode();
  const { mode, setMode } = useTheme();

  switch (action) {
    case 'immersive':
      return { run: toggleImmersiveMode, active: immersiveMode, icon: immersiveMode ? mdiArrowCollapseAll : undefined };
    case 'screensaver':
      return { run: activate, active: false };
    case 'search':
      return { run: openSearch, active: false };
    case 'assistant':
      return { run: toggleAssistant, active: assistantOpen };
    case 'edit':
      return { run: toggleEditMode, active: isEditing };
    case 'theme':
      return { run: () => setMode(mode === 'dark' ? 'light' : 'dark'), active: mode === 'dark' };
    case 'none':
    default:
      return null;
  }
}

// Per-corner geometry: the triangular fold clips into the surface's rounded
// corner; the gradient folds away from the corner so it reads as raised.
const CORNER = {
  left: { anchor: 'top-0 left-0', clip: 'polygon(0 0, 100% 0, 0 100%)', grad: 'bg-gradient-to-br' },
  right: { anchor: 'top-0 right-0', clip: 'polygon(0 0, 100% 0, 100% 100%)', grad: 'bg-gradient-to-bl' },
} as const;

/**
 * A folded page corner ("dog-ear") shortcut. The corner determines its position
 * and fold direction; the action it runs is read from {@link useDogEarConfig}
 * and configurable in settings (defaults: left = immersive, right = screensaver).
 *
 * The button is a fixed-size square that flex-centers the action icon so the
 * icon never moves — only the gradient fold animates (it grows and brightens on
 * hover). The icon fades in on hover (desktop) or while pressed (touch). The
 * parent must be `relative` with `overflow-hidden` and a rounded corner.
 */
export function DogEar({ corner }: { corner: DogEarCorner }) {
  const { config } = useDogEarConfig();
  const action = config[corner];
  const runner = useDogEarRunner(action);

  if (!runner) return null; // action === 'none'

  const meta = DOG_EAR_ACTION_META[action];
  const geo = CORNER[corner];
  const iconPath = runner.icon ?? meta.icon;

  return (
    <button
      onClick={runner.run}
      aria-label={meta.label}
      title={meta.label}
      className={clsx('group absolute z-[70] flex h-14 w-14 items-center justify-center', geo.anchor)}
    >
      {/* Triangular gradient fold — grows + brightens on hover; icon stays put. */}
      <span
        aria-hidden
        className={clsx(
          'absolute h-9 w-9 opacity-70 transition-all duration-300 ease-out',
          'group-hover:h-14 group-hover:w-14 group-hover:opacity-100 group-active:h-14 group-active:w-14 group-active:opacity-100',
          geo.anchor,
          geo.grad,
          'from-text-tertiary/25 via-text-tertiary/10 to-transparent',
        )}
        style={{ clipPath: geo.clip }}
      />
      <Icon
        path={iconPath}
        size={20}
        className={clsx(
          'relative text-text-secondary opacity-0 transition-opacity duration-300 ease-out',
          'group-hover:opacity-100 group-active:opacity-100',
          runner.active && 'text-ha-blue',
        )}
      />
    </button>
  );
}
