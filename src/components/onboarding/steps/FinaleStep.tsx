'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { haptic } from '@/lib/haptics';
import { DISPLAY_FONT } from '../ui';

interface FinaleStepProps {
  /** Fires once the welcome line has played — the flow then fades to the dashboard. */
  onFinish: () => void;
}

/** The closing beat: one line, then the dashboard. Tap to skip the wait. */
export function FinaleStep({ onFinish }: FinaleStepProps) {
  const reduce = useReducedMotion();
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  };

  useEffect(() => {
    haptic('success');
    const doneTimer = setTimeout(finish, reduce ? 1200 : 2200);
    return () => clearTimeout(doneTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play-once choreography
  }, []);

  return (
    <div className="flex flex-col items-center text-center" onClick={finish}>
      {/* No entry animation of its own — the step slides in as one piece. */}
      <h1
        tabIndex={-1}
        className="text-4xl md:text-6xl font-semibold tracking-tight text-text-primary text-balance focus:outline-none"
        style={DISPLAY_FONT}
      >
        All set, welcome home
      </h1>
    </div>
  );
}
