'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { haptic } from '@/lib/haptics';
import type { StepProps } from '../types';
import { DISPLAY_FONT, EASE_OUT, QuietButton } from '../ui';

interface FinaleStepProps extends Pick<StepProps, 'state'> {
  /** Fires once the welcome moment has played — the flow then fades to the dashboard. */
  onFinish: () => void;
}

/**
 * The closing beat: a quiet lead-in, then the home's name at screensaver scale.
 * Auto-advances after a beat, but never traps anyone: tapping anywhere or the
 * quiet button finishes immediately, and reduced-motion gets shorter waits.
 */
export function FinaleStep({ state, onFinish }: FinaleStepProps) {
  const reduce = useReducedMotion();
  const [showName, setShowName] = useState(false);
  const finished = useRef(false);

  const named = state.homeName.trim();
  // A small true statement about what just happened — connected homes get their
  // rooms created for real; demo picks are saved for later, and we say so.
  const roomCount = state.rooms.length;
  const roomsLine =
    state.path === 'connect'
      ? (state.existingAreaCount ?? 0) > 0
        ? 'Your rooms came along, right where you left them.'
        : roomCount > 0
          ? `${roomCount} ${roomCount === 1 ? 'room is' : 'rooms are'} being set up in your Home Assistant.`
          : null
      : roomCount > 0
        ? 'We saved your rooms for the day you connect your real home.'
        : null;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  };

  useEffect(() => {
    haptic('success');
    const nameTimer = setTimeout(() => setShowName(true), reduce ? 250 : 900);
    const doneTimer = setTimeout(finish, reduce ? 2200 : 4200);
    return () => {
      clearTimeout(nameTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play-once choreography
  }, []);

  return (
    <div className="flex flex-col items-center text-center gap-ha-4" onClick={finish}>
      <motion.p
        initial={{ opacity: 0, y: reduce ? 0 : 14 }}
        animate={{ opacity: showName ? 0.7 : 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="text-lg md:text-xl text-text-secondary"
      >
        {named ? 'All set. Welcome home to' : 'All set.'}
      </motion.p>

      <motion.h1
        tabIndex={-1}
        initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }}
        animate={showName ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.9, ease: EASE_OUT }}
        className="text-5xl md:text-7xl font-semibold tracking-tight text-text-primary text-balance focus:outline-none"
        style={DISPLAY_FONT}
      >
        {named || 'Welcome home.'}
      </motion.h1>

      {roomsLine && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={showName ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.4, ease: EASE_OUT }}
          className="text-sm md:text-base text-text-tertiary"
        >
          {roomsLine}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={showName ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: reduce ? 0 : 0.8, ease: EASE_OUT }}
        className="mt-ha-2"
      >
        <QuietButton onClick={finish}>Take me home</QuietButton>
      </motion.div>
    </div>
  );
}
