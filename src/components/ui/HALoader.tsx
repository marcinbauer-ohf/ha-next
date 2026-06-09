'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface HALoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// stroke = shared weight between ball border and track height
const SIZES = {
  sm: { stroke: 2, circle: 7,  trail: 38,  track: 90  },
  md: { stroke: 3, circle: 10, trail: 52,  track: 140 },
  lg: { stroke: 4, circle: 13, trail: 68,  track: 180 },
} as const;

export function HALoader({ size = 'md', className }: HALoaderProps) {
  const { stroke, circle, trail, track } = SIZES[size];

  // The trail div is `trail` px wide, ball sits at its right edge.
  // startX puts ball flush with left edge; endX puts ball flush with right edge.
  const startX = -(trail);
  const endX   = track - circle;

  return (
    <div
      className={clsx('relative flex-shrink-0', className)}
      style={{ width: track, height: circle }}
      role="status"
      aria-label="Loading"
    >
      {/* Track */}
      <div
        className="absolute inset-x-0 rounded-full bg-surface-low"
        style={{ height: stroke, top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* Trail + ball — bounces left ↔ right */}
      <motion.div
        className="absolute top-0 bottom-0"
        style={{ width: trail }}
        animate={{ x: [startX, endX] }}
        transition={{
          duration: 0.85,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      >
        {/* Gradient trail — transparent at left, bright at ball */}
        <div
          className="absolute inset-x-0 rounded-full bg-gradient-to-r from-transparent to-ha-blue/70"
          style={{ height: stroke, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Ball at the right edge of the trail */}
        <div
          className="absolute rounded-full bg-ha-blue"
          style={{
            width: circle,
            height: circle,
            right: 0,
            top: '50%',
            transform: 'translate(50%, -50%)',
            boxShadow: `0 0 ${circle}px ${circle / 2}px color-mix(in srgb, var(--ha-color-fill-primary-normal) 50%, transparent)`,
          }}
        />
      </motion.div>
    </div>
  );
}
