'use client';

import { IconButton} from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { mdiMinus, mdiPlus } from '@mdi/js';
import { clampRoomsToFloors, floorNames, MAX_FLOORS, type StepProps } from '../types';
import { DISPLAY_FONT, PrimaryPill, StepActions, StepSubtitle, StepTitle } from '../ui';

/** How many storeys the home has. The next step puts rooms on them. */
export function FloorsStep({ state, update, next }: StepProps) {
  const count = state.floorCount;

  const bump = (delta: number) => {
    const value = Math.min(MAX_FLOORS, Math.max(1, count + delta));
    if (value === count) return;
    haptic('select');
    // Losing a storey must not silently lose its rooms — they move down.
    update((s) => ({ floorCount: value, rooms: clampRoomsToFloors(s.rooms, value) }));
  };

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <div className="space-y-ha-3">
        <StepTitle>How many floors does your home have?</StepTitle>
        <StepSubtitle>
          {(state.existingFloorCount ?? 0) > 0
            ? 'This is what Home Assistant already knows — adjust it if it looks off.'
            : 'Floors group your rooms. One is perfectly normal.'}
        </StepSubtitle>
      </div>

      <div className="w-full flex flex-col items-center gap-ha-5">
        <div className="flex items-center gap-ha-5">
          <StepperButton label="One floor fewer" icon={mdiMinus} onClick={() => bump(-1)} disabled={count <= 1} />
          {/* The count is the hero, same scale as the home-name step. */}
          <output
            aria-live="polite"
            className="min-w-[3ch] text-5xl md:text-6xl font-semibold tracking-tight text-text-primary tabular-nums"
            style={DISPLAY_FONT}
          >
            {count}
          </output>
          <StepperButton label="One floor more" icon={mdiPlus} onClick={() => bump(1)} disabled={count >= MAX_FLOORS} />
        </div>

        <p className="text-[13px] text-text-tertiary max-w-[420px]">{floorNames(count).join(' · ')}</p>

        <StepActions primary={<PrimaryPill onClick={next}>Continue</PrimaryPill>} />
      </div>
    </div>
  );
}

function StepperButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <IconButton icon={icon} label={label} size="lg" filled onClick={onClick} disabled={disabled} />
  );
}
