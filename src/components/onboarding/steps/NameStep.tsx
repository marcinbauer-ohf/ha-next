'use client';

import { useEffect, useRef } from 'react';
import type { StepProps } from '../types';
import { DISPLAY_FONT, PrimaryPill, Rise, StepSubtitle, StepTitle } from '../ui';

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
      <Rise className="space-y-ha-3">
        <StepTitle>What should we call your home?</StepTitle>
        <StepSubtitle>This name greets you on the dashboard. Pick anything you like.</StepSubtitle>
      </Rise>

      <Rise delay={0.05} className="w-full flex flex-col items-center gap-ha-5">
        <form onSubmit={submit} className="w-full flex flex-col items-center gap-ha-5">
          {/* The typed name is the hero — bigger than the question itself. */}
          <input
            ref={inputRef}
            type="text"
            value={state.homeName}
            onChange={(e) => update({ homeName: e.target.value })}
            placeholder="Home"
            maxLength={24}
            aria-label="Home name"
            className="w-full max-w-[480px] bg-transparent text-center text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary placeholder:text-text-tertiary/50 select-text caret-ha-blue border-0 border-b-2 border-text-primary/15 focus:border-ha-blue focus:outline-none pb-ha-3 transition-colors"
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

          {/* One small preference, demoted below the main beat. */}
          <div className="flex items-center gap-ha-3">
            <span className="text-[13px] text-text-tertiary">Show temperatures in</span>
            <div className="flex rounded-ha-pill bg-surface-low/80 border border-surface-lower p-0.5">
              {(
                [
                  { value: 'metric', label: '°C' },
                  { value: 'imperial', label: '°F' },
                ] as const
              ).map((u) => {
                const selected = state.unitSystem === u.value;
                return (
                  <button
                    key={u.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ unitSystem: u.value })}
                    className={`h-7 px-ha-3 rounded-ha-pill text-[13px] font-semibold transition-colors ${
                      selected
                        ? 'bg-text-primary text-surface-default shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {u.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Rise>
    </div>
  );
}
