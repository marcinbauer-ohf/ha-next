'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { HALogo } from '@/components/ui';
import type { StepProps } from '../types';
import { DISPLAY_FONT, EASE_OUT, PrimaryPill, QuietButton, Rise, StepSubtitle } from '../ui';

interface HelloStepProps extends StepProps {
  /** "I'll just look around" — leaves the flow with the demo home active. */
  onSkipAll: () => void;
}

export function HelloStep({ next, onSkipAll }: HelloStepProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center text-center gap-ha-6">
      <motion.div
        initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        {/* Slow breathing logo — the screensaver's calm, not a loading spinner. */}
        <motion.div
          animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <HALogo size={64} />
        </motion.div>
      </motion.div>

      <Rise delay={0.15} className="space-y-ha-3">
        <h1
          className="text-[2.6rem] leading-[1.08] md:text-6xl font-semibold tracking-tight text-text-primary"
          style={DISPLAY_FONT}
        >
          Let&apos;s set up home.
        </h1>
        <StepSubtitle>
          We&apos;ll make this screen feel like yours.
          <br className="hidden md:block" /> It takes about a minute — and nothing is set in stone.
        </StepSubtitle>
      </Rise>

      <Rise delay={0.3} className="flex flex-col items-center gap-ha-2 mt-ha-2">
        <PrimaryPill onClick={next}>Let&apos;s begin</PrimaryPill>
        <QuietButton onClick={onSkipAll}>I&apos;ll just look around first</QuietButton>
      </Rise>
    </div>
  );
}
