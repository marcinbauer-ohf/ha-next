'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { haptic } from '@/lib/haptics';
import { DISPLAY_FONT, EASE_OUT } from '../ui';

interface FinaleStepProps {
  /** Fires once the reveal has played — the flow then fades to the dashboard. */
  onFinish: () => void;
}

/**
 * The closing beat, and nothing more: the veil clears off the live dashboard
 * already running under this flow while the shell eases toward the camera, so
 * the last press opens onto the real home instead of cutting to it.
 *
 * Full-bleed — mounted straight on the flow root, not the centred step column.
 * Tap to skip.
 */
export function FinaleStep({ onFinish }: FinaleStepProps) {
  const reduce = useReducedMotion();
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  };

  // The shell underneath eases toward the camera as the veil lifts. Driven by an
  // attribute + CSS so the dashboard doesn't need to know this flow exists (see
  // ha-finale-dolly in globals.css).
  useEffect(() => {
    if (reduce) return;
    document.documentElement.dataset.finale = 'walk';
    return () => {
      delete document.documentElement.dataset.finale;
    };
  }, [reduce]);

  useEffect(() => {
    haptic('success');
    const doneTimer = setTimeout(finish, reduce ? 900 : 1500);
    return () => clearTimeout(doneTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play-once choreography
  }, []);

  return (
    <div className="absolute inset-0 z-30 overflow-hidden" onClick={finish}>
      {/* Dark and out of focus at first, clearing to nothing well before the
          flow unmounts — so the handoff is this one fade, not a second one
          stacked on top of it. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 backdrop-blur-[16px] bg-black/85"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.6 : 1.3, delay: reduce ? 0 : 0.1, ease: EASE_OUT }}
      />

      {/* Nothing visible left to announce — the heading stays for screen readers. */}
      <h1 tabIndex={-1} className="sr-only focus:outline-none" style={DISPLAY_FONT}>
        All set, welcome home
      </h1>
    </div>
  );
}
