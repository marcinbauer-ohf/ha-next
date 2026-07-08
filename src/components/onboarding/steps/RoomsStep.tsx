'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';
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
import { uid, type OnbRoom, type StepProps } from '../types';
import { PrimaryPill, Rise, StepSubtitle, StepTitle } from '../ui';

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

export function RoomsStep({ state, update, next }: StepProps) {
  const [custom, setCustom] = useState('');

  const selectedNames = new Set(state.rooms.map((r) => r.name.toLowerCase()));

  // Functional patches: rapid taps land within one React batch, so building the
  // next list from render-time state would drop all but the last toggle.
  const toggle = (name: string, icon: string, haIcon?: string) => {
    haptic('select');
    update((s) =>
      s.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())
        ? { rooms: s.rooms.filter((r) => r.name.toLowerCase() !== name.toLowerCase()) }
        : { rooms: [...s.rooms, { id: uid('room'), name, icon, haIcon }] },
    );
  };

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = custom.trim();
    if (!name || selectedNames.has(name.toLowerCase())) {
      setCustom('');
      return;
    }
    haptic('select');
    update((s) =>
      s.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())
        ? {}
        : { rooms: [...s.rooms, { id: uid('room'), name, icon: mdiDoorOpen }] },
    );
    setCustom('');
  };

  const count = state.rooms.length;

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <Rise className="space-y-ha-3">
        <StepTitle>Which rooms do you have?</StepTitle>
        <StepSubtitle>
          {state.path === 'connect'
            ? 'Tap the ones in your home — we’ll set them up in Home Assistant for you.'
            : 'Tap the ones in your home. Nothing is final — you can change this anytime.'}
        </StepSubtitle>
      </Rise>

      <Rise delay={0.05} className="w-full flex flex-col items-center gap-ha-5">
        <div className="flex flex-wrap justify-center gap-ha-2" role="group" aria-label="Rooms">
          {PRESETS.map((p) => {
            const selected = selectedNames.has(p.name.toLowerCase());
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(p.name, p.icon, p.haIcon)}
                className={`inline-flex items-center gap-ha-2 h-11 pl-ha-3 pr-ha-4 rounded-ha-pill border text-sm font-medium transition-all active:scale-95 ${
                  selected
                    ? 'bg-ha-blue text-white border-ha-blue shadow-md shadow-ha-blue/20'
                    : 'bg-surface-low/70 backdrop-blur-sm border-surface-lower text-text-primary hover:bg-surface-low hover:border-fill-primary-normal'
                }`}
              >
                <Icon path={p.icon} size={17} className={selected ? 'text-white/90' : 'text-text-secondary'} />
                {p.name}
              </button>
            );
          })}

          {/* Custom rooms the presets don't cover, shown in the same chip row. */}
          {state.rooms
            .filter((r) => !PRESETS.some((p) => p.name.toLowerCase() === r.name.toLowerCase()))
            .map((r: OnbRoom) => (
              <button
                key={r.id}
                type="button"
                aria-pressed
                onClick={() => update({ rooms: state.rooms.filter((x) => x.id !== r.id) })}
                className="inline-flex items-center gap-ha-2 h-11 pl-ha-3 pr-ha-4 rounded-ha-pill border text-sm font-medium bg-ha-blue text-white border-ha-blue shadow-md shadow-ha-blue/20 transition-all active:scale-95"
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
            aria-label="Add your own room"
            className="flex-1 h-11 px-ha-4 rounded-ha-pill bg-surface-low/70 backdrop-blur-sm border border-surface-lower text-sm text-text-primary placeholder:text-text-tertiary select-text focus:outline-none focus:ring-2 focus:ring-ha-blue/40 focus:border-ha-blue/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!custom.trim()}
            aria-label="Add room"
            className="w-11 h-11 rounded-full bg-surface-low border border-surface-lower flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-mid transition-colors disabled:opacity-40"
          >
            <Icon path={mdiPlus} size={20} />
          </button>
        </form>

        <div className="flex flex-col items-center gap-ha-2">
          {/* min-width keeps the pill from resizing/recentering as the label
              flips between "Continue" and "Continue with N rooms". */}
          <div className="min-w-[260px] flex justify-center">
            <PrimaryPill onClick={next}>
              {count > 0 ? `Continue with ${count} ${count === 1 ? 'room' : 'rooms'}` : 'Continue'}
            </PrimaryPill>
          </div>
          {/* Reserved line so the hint appearing/disappearing never shifts the CTA. */}
          <p className="text-[13px] text-text-tertiary min-h-[1.25rem]" aria-hidden={count > 0}>
            {count === 0 ? 'Not sure yet? That’s fine — skip ahead and add rooms whenever.' : ''}
          </p>
        </div>
      </Rise>
    </div>
  );
}
