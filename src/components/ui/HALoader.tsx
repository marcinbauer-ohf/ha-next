'use client';

import { clsx } from 'clsx';

interface HALoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Dot diameter per size; the rings reach 3.4x that (see the keyframes). */
const DOT = { sm: 8, md: 11, lg: 14 } as const;
/** How far the outermost ring travels, so the box can reserve it. */
const RING_SCALE = 3.4;

// The global squircle rule (`[data-squircle="on"] *`) is unlayered CSS, so it
// beats any utility class: a `rounded-full` dot comes out an iOS-style
// superellipse — a rounded square, which is the one shape a pulsing circle must
// not be. Same opt-out the assistant's mic orb uses: inline style outranks it.
const TRUE_CIRCLE = { cornerShape: 'round' } as React.CSSProperties;

/**
 * The app's in-page loading indicator — a small pulsing node with rings leaving
 * it, echoing the logo shown while the project boots. For the small bits of
 * content that load on their own: a chart fetching history, a dialog's body, a
 * discovery scan.
 *
 * Not the boot splash (see Preloader), and deliberately not a spinner: this
 * appears inside panels that are already busy, so the whole thing animates on
 * the compositor via CSS keyframes rather than competing for the main thread.
 *
 * Previously a ball bouncing along a 90–180px track, which read as a progress
 * bar that never progressed and was far wider than the slots it sits in.
 */
export function HALoader({ size = 'md', className }: HALoaderProps) {
  const dot = DOT[size];
  // The box is the widest the rings ever get, so nothing reflows as they leave.
  const box = Math.round(dot * RING_SCALE);
  const ring = { width: dot, height: dot, ...TRUE_CIRCLE };

  return (
    <div
      className={clsx('relative flex flex-shrink-0 items-center justify-center', className)}
      style={{ width: box, height: box }}
      role="status"
      aria-label="Loading"
    >
      {/* Two rings, half a cycle apart, so one is always in flight. */}
      <span className="ha-pulse-loader-ring absolute rounded-full border border-ha-blue" style={ring} />
      <span
        className="ha-pulse-loader-ring absolute rounded-full border border-ha-blue"
        style={{ ...ring, animationDelay: '0.9s' }}
      />
      {/* The node: the logo's dot, at the logo's blue, with the soft glow the app
          gives a live element. Glow scaled to the dot — a fixed blur swamps sm. */}
      <span
        className="ha-pulse-loader-dot rounded-full bg-ha-blue"
        style={{
          width: dot,
          height: dot,
          ...TRUE_CIRCLE,
          boxShadow: `0 0 ${dot}px 1px color-mix(in srgb, var(--ha-color-blue) 40%, transparent)`,
        }}
      />
    </div>
  );
}
