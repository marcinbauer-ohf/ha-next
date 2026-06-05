'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface HALoaderProps {
  /** sm = inline tight spaces, md = content areas (default), lg = prominent / full-width */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Stroke weight is shared between circle border and bar height — they match visually.
const SIZES = {
  sm: { stroke: 2, circle: 8,  gap: 8  },
  md: { stroke: 3, circle: 12, gap: 10 },
  lg: { stroke: 4, circle: 16, gap: 12 },
} as const;

export function HALoader({ size = 'md', className }: HALoaderProps) {
  const { stroke, circle, gap } = SIZES[size];

  return (
    <div
      className={clsx('flex items-center w-full', className)}
      style={{ gap, height: Math.max(circle, stroke * 2) }}
      role="status"
      aria-label="Loading"
    >
      {/* Ring — same stroke weight as the bar height */}
      <motion.div
        className="flex-shrink-0 rounded-full border-ha-blue"
        style={{ width: circle, height: circle, borderWidth: stroke }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Track with bouncing gradient */}
      <div
        className="relative flex-1 overflow-hidden rounded-full bg-surface-low"
        style={{ height: stroke }}
      >
        <motion.div
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-ha-blue/50 to-ha-blue"
          animate={{ x: ['-100%', '300%'] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: [0.4, 0, 0.6, 1],
          }}
        />
      </div>
    </div>
  );
}
