'use client';

import { ToggleSwitch } from '@/components/ui';
import type { OnbAnalytics, StepProps } from '../types';
import { PrimaryPill, QuietButton, StepActions, StepSubtitle, StepTitle } from '../ui';

/**
 * The last question before the finale: what may be shared. Mirrors Home
 * Assistant's own analytics opt-in — same four buckets, plain-language copy,
 * everything off until it's turned on. Written to HA on a connected home when
 * the flow finishes (see OnboardingFlow.persistChoices).
 */

interface Row {
  key: keyof OnbAnalytics;
  label: string;
  description: string;
}

// The last three only mean anything alongside the basics, so they follow it —
// same dependency Home Assistant's own analytics settings enforce.
const ROWS: Row[] = [
  {
    key: 'base',
    label: 'Share the basics',
    description: 'Which version you run and how it was installed. Nothing about your home.',
  },
  {
    key: 'diagnostics',
    label: 'Send error reports',
    description: 'When something goes wrong, the crash details go to the developers.',
  },
  {
    key: 'usage',
    label: 'Share what you use',
    description: 'Which integrations and add-ons are set up — never what they see or do.',
  },
  {
    key: 'statistics',
    label: 'Share rough numbers',
    description: 'How many devices, rooms and automations you have. No names.',
  },
];

export function AnalyticsStep({ state, update, next }: StepProps) {
  const prefs = state.analytics;
  const shareNothing = () => {
    update({ analytics: { base: false, diagnostics: false, usage: false, statistics: false } });
    next();
  };

  const toggle = (key: keyof OnbAnalytics) =>
    update((s) => {
      const value = !s.analytics[key];
      // Turning the basics off takes the rest with it — the others are
      // meaningless on their own, and a silent half-on state would be a lie.
      if (key === 'base' && !value) {
        return { analytics: { base: false, diagnostics: false, usage: false, statistics: false } };
      }
      return { analytics: { ...s.analytics, [key]: value } };
    });

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <div className="space-y-ha-3">
        <StepTitle>Want to help make this better?</StepTitle>
        <StepSubtitle>
          Home Assistant runs on your own hardware, and none of this is needed for it to work.
          Sharing is entirely up to you, and you can change it any time.
        </StepSubtitle>
      </div>

      <ul className="w-full flex flex-col gap-ha-2 text-left">
        {ROWS.map((row) => {
          const locked = row.key !== 'base' && !prefs.base;
          return (
            <li
              key={row.key}
              className={`flex items-center gap-ha-4 rounded-ha-2xl bg-surface-low/70 backdrop-blur-sm border border-surface-lower px-ha-4 py-ha-3 transition-opacity ${
                locked ? 'opacity-45' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-primary">{row.label}</p>
                <p className="text-[13px] text-text-secondary leading-snug">{row.description}</p>
              </div>
              <ToggleSwitch
                size="sm"
                label={row.label}
                on={prefs[row.key]}
                disabled={locked}
                onToggle={() => toggle(row.key)}
              />
            </li>
          );
        })}
      </ul>

      {/* The last press of the flow, so it says where you are going. */}
      <StepActions
        primary={<PrimaryPill onClick={next}>Welcome home</PrimaryPill>}
        secondary={<QuietButton onClick={shareNothing}>Share nothing</QuietButton>}
      />
    </div>
  );
}
