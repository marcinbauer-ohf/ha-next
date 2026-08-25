'use client';

import { useState } from 'react';
import { Icon, IconButton} from '@/components/ui';
import { haptic } from '@/lib/haptics';
import {
  mdiBedOutline,
  mdiCheck,
  mdiCountertop,
  mdiDesk,
  mdiDoorOpen,
  mdiDumbbell,
  mdiGarage,
  mdiPlus,
  mdiShower,
  mdiSofaOutline,
  mdiTableChair,
  mdiTeddyBear,
  mdiTree,
  mdiWashingMachine,
} from '@mdi/js';
import { floorNames, uid, type OnbRoom, type StepProps } from '../types';
import { PrimaryPill, StepActions, StepSubtitle, StepTitle } from '../ui';

const PRESETS: Array<{ name: string; icon: string; haIcon: string }> = [
  { name: 'Living room', icon: mdiSofaOutline, haIcon: 'mdi:sofa-outline' },
  { name: 'Kitchen', icon: mdiCountertop, haIcon: 'mdi:countertop' },
  { name: 'Bedroom', icon: mdiBedOutline, haIcon: 'mdi:bed-outline' },
  { name: 'Bathroom', icon: mdiShower, haIcon: 'mdi:shower' },
  { name: 'Office', icon: mdiDesk, haIcon: 'mdi:desk' },
  { name: 'Dining room', icon: mdiTableChair, haIcon: 'mdi:table-chair' },
  { name: 'Hallway', icon: mdiDoorOpen, haIcon: 'mdi:door-open' },
  { name: 'Kids room', icon: mdiTeddyBear, haIcon: 'mdi:teddy-bear' },
  { name: 'Laundry', icon: mdiWashingMachine, haIcon: 'mdi:washing-machine' },
  { name: 'Garage', icon: mdiGarage, haIcon: 'mdi:garage' },
  { name: 'Garden', icon: mdiTree, haIcon: 'mdi:tree' },
  { name: 'Gym', icon: mdiDumbbell, haIcon: 'mdi:dumbbell' },
];

interface RoomsStepProps extends StepProps {
  /** Which storey this step is asking about (0 = ground). */
  floor: number;
}

/**
 * Rooms on ONE storey — the flow repeats this step per floor, which is harder
 * to walk past than a tab strip above the chips.
 */
export function RoomsStep({ state, update, next, floor: active }: RoomsStepProps) {
  const [custom, setCustom] = useState('');

  const count = state.floorCount;
  const names = floorNames(count);

  /** Tapping a room puts it on the active floor — or takes it out if it's already there. */
  const toggle = (name: string, icon: string, haIcon?: string) => {
    haptic('select');
    update((s) => {
      const existing = s.rooms.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (!existing) return { rooms: [...s.rooms, { id: uid('room'), name, icon, haIcon, floor: active }] };
      if (existing.floor === active) return { rooms: s.rooms.filter((r) => r.id !== existing.id) };
      // Already picked on another storey — move it here rather than duplicating.
      return { rooms: s.rooms.map((r) => (r.id === existing.id ? { ...r, floor: active } : r)) };
    });
  };

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = custom.trim();
    setCustom('');
    if (!name) return;
    haptic('select');
    update((s) =>
      s.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())
        ? {}
        : { rooms: [...s.rooms, { id: uid('room'), name, icon: mdiDoorOpen, floor: active }] },
    );
  };

  const onFloor = (r: OnbRoom) => r.floor === active;
  // Only this floor's picks are shown — seeing other storeys' rooms greyed out
  // read as clutter, so switching tabs now shows a clean slate.
  const extras = state.rooms.filter(
    (r) => onFloor(r) && !PRESETS.some((p) => p.name.toLowerCase() === r.name.toLowerCase()),
  );
  const here = state.rooms.filter(onFloor).length;

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <div className="space-y-ha-3">
        <StepTitle>
          {count > 1
            ? `Which rooms are on the ${names[active].toLowerCase()}?`
            : 'Which rooms do you have?'}
        </StepTitle>
        <StepSubtitle>
          {state.path === 'connect'
            ? 'Tap the ones in your home — we’ll set them up in Home Assistant for you.'
            : 'Tap the ones in your home. Nothing is final — you can change this anytime.'}
        </StepSubtitle>
      </div>

      <div className="w-full flex flex-col items-center gap-ha-5">

        <div
          className="flex flex-wrap justify-center gap-ha-2"
          role="group"
          aria-label={count > 1 ? `Rooms on the ${names[active]}` : 'Rooms'}
        >
          {PRESETS.map((p) => {
            const room = state.rooms.find((r) => r.name.toLowerCase() === p.name.toLowerCase());
            const here = room ? onFloor(room) : false;
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={here}
                onClick={() => toggle(p.name, p.icon, p.haIcon)}
                className={`inline-flex items-center gap-ha-2 h-11 pl-ha-3 pr-ha-4 rounded-full border text-sm font-medium transition-all active:scale-95 ${
                  here
                    ? 'bg-ha-blue text-white border-ha-blue shadow-md shadow-ha-blue/20'
                    : 'bg-surface-low/70 backdrop-blur-sm border-surface-lower text-text-primary hover:bg-surface-low hover:border-fill-primary-normal'
                }`}
              >
                <Icon path={p.icon} size={17} className={here ? 'text-white/90' : 'text-text-secondary'} />
                {p.name}
              </button>
            );
          })}

          {/* Custom rooms the presets don't cover, shown in the same chip row. */}
          {extras.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed
              onClick={() => update((s) => ({ rooms: s.rooms.filter((x) => x.id !== r.id) }))}
              className="inline-flex items-center gap-ha-2 h-11 pl-ha-3 pr-ha-4 rounded-full border text-sm font-medium bg-ha-blue text-white border-ha-blue shadow-md shadow-ha-blue/20 transition-all active:scale-95"
            >
              <Icon path={mdiCheck} size={17} />
              {r.name}
            </button>
          ))}
        </div>

        <form onSubmit={addCustom} className="flex items-center gap-ha-2 w-full max-w-[340px]">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add your own room…"
            maxLength={24}
            aria-label={count > 1 ? `Add your own room on the ${names[active]}` : 'Add your own room'}
            className="flex-1 h-11 px-ha-4 rounded-full bg-surface-low/70 backdrop-blur-sm text-sm text-text-primary placeholder:text-text-tertiary select-text focus:outline-none transition-colors"
          />
          <IconButton icon={mdiPlus} label="Add room" size="lg" filled disabled={!custom.trim()} />
        </form>

        {/* The hint rides in the reserved secondary row, so it can come and go
            without ever moving the CTA. */}
        <StepActions
          primary={
            // min-width keeps the pill from resizing/recentering as the label changes.
            <div className="min-w-[260px] flex justify-center">
              <PrimaryPill onClick={next}>
                {here > 0 ? `Continue with ${here} ${here === 1 ? 'room' : 'rooms'}` : 'Continue'}
              </PrimaryPill>
            </div>
          }
          secondary={
            here === 0 ? (
              <p className="text-[13px] text-text-tertiary text-center text-balance">
                {count > 1
                  ? 'Nothing on this floor? Just continue — you can add rooms whenever.'
                  : 'Not sure yet? That’s fine — continue and add rooms whenever.'}
              </p>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
