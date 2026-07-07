'use client';

import { useSyncExternalStore } from 'react';
import { mdiPencilOutline, mdiImagePlusOutline } from '@mdi/js';
import { Icon, HeroImage } from '../ui';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';

// Home name lives in localStorage (written by the onboarding wizard as
// `ha_home_name`) — there is no HA config read for it yet. useSyncExternalStore
// keeps SSR safe (server snapshot = 'Home', hydration reconciles to the stored
// value without a setState-in-effect) and live-updates if another tab changes it.
const LS_HOME_NAME = 'ha_home_name';

// Shared height so the image, empty state, and hydration skeleton never shift
// the layout as the demo/real decision resolves.
const HERO_HEIGHT = 'h-40 sm:h-52 lg:h-60';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
function getHomeName() {
  return localStorage.getItem(LS_HOME_NAME) || 'Home';
}
function getServerHomeName() {
  return 'Home';
}

/**
 * Hero banner for the Home Center. On a real HA instance it shows the home's
 * name over the render with an "Edit home" control. In demo mode there is no
 * real home to represent, so it falls back to an empty "add your image" prompt.
 */
export function HomeHero({ onEdit }: { onEdit?: () => void }) {
  const homeName = useSyncExternalStore(subscribe, getHomeName, getServerHomeName);
  const { demoMode, hydrated } = useHomeAssistant();

  // Before hydration `demoMode` is its default (false); render a neutral
  // skeleton rather than flashing the wrong hero for a frame.
  if (!hydrated) {
    return <div className={`animate-pulse rounded-ha-3xl bg-surface-low ${HERO_HEIGHT}`} />;
  }

  if (demoMode) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-ha-2 rounded-ha-3xl border-2 border-dashed border-surface-lower bg-surface-low px-ha-6 text-center ${HERO_HEIGHT}`}
      >
        <Icon path={mdiImagePlusOutline} size={30} className="text-text-tertiary" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-text-secondary">
            Add a photo of your home
          </p>
          <p className="text-xs text-text-tertiary">
            Connect your Home Assistant to personalize the Home Center with your own image.
          </p>
        </div>
      </div>
    );
  }

  return (
    <HeroImage
      src="/home-hero.jpg"
      alt={homeName}
      heightClassName={HERO_HEIGHT}
      objectPosition="center 45%"
      eyebrow="Your home"
      title={homeName}
      action={
        onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-ha-1 rounded-ha-pill bg-black/35 px-ha-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-md transition-colors hover:bg-black/55 active:bg-black/65"
          >
            <Icon path={mdiPencilOutline} size={15} />
            Edit home
          </button>
        ) : undefined
      }
    />
  );
}
