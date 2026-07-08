'use client';

import { Icon } from '@/components/ui';
import { mdiChevronRight, mdiHomeAssistant, mdiHomeSearchOutline } from '@mdi/js';
import type { StepProps } from '../types';
import { Rise, StepSubtitle, StepTitle } from '../ui';

interface PathStepProps extends StepProps {
  /** Chosen "Connect my home" — records the path and advances to the connect step. */
  onConnect: () => void;
  /** Chosen "Look around the demo" — the sample home is already loaded. */
  onDemo: () => void;
}

const CARD_CLASS =
  'group w-full flex items-center gap-ha-4 text-left rounded-ha-3xl border border-surface-lower bg-surface-low/70 backdrop-blur-sm px-ha-5 py-ha-5 transition-all hover:bg-surface-low hover:border-fill-primary-normal hover:shadow-lg active:scale-[0.985]';

export function PathStep({ onConnect, onDemo }: PathStepProps) {
  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <Rise className="space-y-ha-3">
        <StepTitle>How would you like to start?</StepTitle>
        <StepSubtitle>You can switch between these anytime.</StepSubtitle>
      </Rise>

      <Rise delay={0.05} className="w-full max-w-[520px] mx-auto space-y-ha-3">
        <button type="button" className={CARD_CLASS} onClick={onConnect}>
          <span className="w-12 h-12 rounded-full bg-ha-blue/12 border border-ha-blue/25 flex items-center justify-center shrink-0">
            <Icon path={mdiHomeAssistant} size={26} className="text-ha-blue" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-semibold text-text-primary">
              Connect my home
            </span>
            <span className="block text-sm text-text-secondary leading-snug mt-0.5">
              Link this screen to your Home Assistant and see your real rooms and devices.
            </span>
          </span>
          <Icon
            path={mdiChevronRight}
            size={22}
            className="text-text-tertiary shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </button>

        <button type="button" className={CARD_CLASS} onClick={onDemo}>
          <span className="w-12 h-12 rounded-full bg-amber-500/12 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Icon path={mdiHomeSearchOutline} size={24} className="text-amber-500" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-semibold text-text-primary">
              Look around the demo home
            </span>
            <span className="block text-sm text-text-secondary leading-snug mt-0.5">
              Explore a fully furnished sample home first. No setup needed.
            </span>
          </span>
          <Icon
            path={mdiChevronRight}
            size={22}
            className="text-text-tertiary shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </Rise>
    </div>
  );
}
