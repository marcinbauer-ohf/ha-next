'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { HALogo } from '@/components/ui';
import type { StepProps } from '../types';
import { DISPLAY_FONT, PrimaryPill, StepSubtitle } from '../ui';

export function HelloStep({ next }: StepProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center text-center gap-ha-6">
      {/* Slow breathing logo — the screensaver's calm, not a loading spinner.
          No entry animation: the whole step slides in as one piece. */}
      <motion.div
        animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <HALogo size={64} />
      </motion.div>

      <div className="space-y-ha-3">
        <h1
          className="text-[2.6rem] leading-[1.08] md:text-6xl font-semibold tracking-tight text-text-primary"
          style={DISPLAY_FONT}
        >
          Let&apos;s make this home
        </h1>
        <StepSubtitle>
          A few easy questions, nothing here is permanent.
        </StepSubtitle>
      </div>

      <div className="flex flex-col items-center gap-ha-2 mt-ha-2">
        <PrimaryPill onClick={next}>Let&apos;s begin</PrimaryPill>
      </div>
    </div>
  );
}
