'use client';

import { RingShaderBackground } from '@/components/ui/RingShaderBackground';
import { useFeatureFlags, useHomeEventReactor } from '@/hooks';

/**
 * The "Pulse" dashboard wallpaper: an animated ring background painted behind
 * the whole shell that ripples in response to live device toggles/errors.
 *
 * Kept as its own component (mounted only when the pulse background is active)
 * so its live entity subscription — via useHomeEventReactor — doesn't re-render
 * the entire AppShell on every state change when the wallpaper is off.
 */
export function PulseWallpaper() {
  const { wavyBackgroundEnabled, pulseWallpaperReactive } = useFeatureFlags();
  useHomeEventReactor(pulseWallpaperReactive, 'toggles-errors');

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <RingShaderBackground
        wavy={wavyBackgroundEnabled}
        reactive={pulseWallpaperReactive}
        intensity="subtle"
      />
    </div>
  );
}
