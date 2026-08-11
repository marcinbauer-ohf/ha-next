'use client';

import { useEffect, useRef } from 'react';
import type { StepProps } from '../types';
import { BIG_FIELD_CLASS, DISPLAY_FONT, PrimaryPill, StepSubtitle, StepTitle } from '../ui';

const SUGGESTIONS = ['Our place', 'The nest', 'Casa', 'Hygge house'];

export function NameStep({ state, update, next }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Desktop only — on mobile the keyboard would cover half the step.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    next();
  };

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <div className="space-y-ha-3">
        <StepTitle>What should we call your home?</StepTitle>
        <StepSubtitle>This name greets you on the dashboard. Pick anything you like.</StepSubtitle>
      </div>

      <div className="w-full flex flex-col items-center gap-ha-5">
        <form onSubmit={submit} className="w-full flex flex-col items-center gap-ha-5">
          {/* The typed name is the hero — a regular field, inflated. */}
          <input
            ref={inputRef}
            type="text"
            value={state.homeName}
            onChange={(e) => update({ homeName: e.target.value })}
            placeholder="Home"
            maxLength={24}
            aria-label="Home name"
            className={BIG_FIELD_CLASS}
            style={DISPLAY_FONT}
          />

          <div className="flex flex-wrap justify-center gap-ha-2" aria-label="Name ideas">
            {SUGGESTIONS.map((s) => {
              const selected = state.homeName === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ homeName: selected ? '' : s })}
                  className={`h-9 px-ha-4 rounded-ha-pill text-sm font-medium border transition-colors ${
                    selected
                      ? 'bg-ha-blue border-ha-blue text-white shadow-md shadow-ha-blue/20'
                      : 'bg-surface-low/70 border-surface-lower text-text-secondary hover:text-text-primary hover:bg-surface-low'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <PrimaryPill type="submit">Continue</PrimaryPill>
        </form>
      </div>
    </div>
  );
}
