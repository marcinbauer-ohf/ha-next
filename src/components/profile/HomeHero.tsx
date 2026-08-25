'use client';

import { mdiPencilOutline, mdiImagePlusOutline } from '@mdi/js';
import { Icon, HeroImage } from '../ui';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { useHomeName } from '@/lib/homeName';

// Shared height so the image, empty state, and hydration skeleton never shift
// the layout as the demo/real decision resolves.
const HERO_HEIGHT = 'h-40 sm:h-52 lg:h-60';

/**
 * Hero banner for the Home Center. On a real HA instance it shows the home's
 * name over the render with an "Edit home" control. In demo mode there is no
 * real home to represent, so it falls back to an empty "add your image" prompt.
 */
export function HomeHero({ onEdit }: { onEdit?: () => void }) {
  const homeName = useHomeName();
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
            className="inline-flex items-center gap-ha-1 rounded-full bg-black/35 px-ha-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-md transition-colors hover:bg-black/55 active:bg-black/65"
          >
            <Icon path={mdiPencilOutline} size={15} />
            Edit home
          </button>
        ) : undefined
      }
    />
  );
}
