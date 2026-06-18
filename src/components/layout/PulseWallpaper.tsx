'use client';

import { RingShaderBackground, useRingOrigin } from '@/components/ui/RingShaderBackground';
import { useFeatureFlags, useHomeEventReactor, useHomeAssistant, useWeatherParams } from '@/hooks';
import { PULSE_COLORS } from '@/lib/homePulseBus';

/**
 * The "Pulse" dashboard wallpaper: an animated ring background painted behind
 * the whole shell.
 *
 * The steady ambient rings are tinted by Home Assistant connection health —
 * green while the instance is reachable, red if the link drops — so the
 * always-on pulse itself reads as a connection monitor. (The faster coloured
 * ripples that fly out on device toggles/errors are separate and stay keyed to
 * their event, gated by the `pulseWallpaperReactive` flag.)
 *
 * Kept as its own component (mounted only when the pulse background is active)
 * so its live entity subscription — via useHomeEventReactor — doesn't re-render
 * the entire AppShell on every state change when the wallpaper is off.
 */
export function PulseWallpaper() {
  const { wavyBackgroundEnabled, pulseWallpaperReactive, pulseMode } = useFeatureFlags();
  const weatherParams = useWeatherParams();
  const { connected, connecting, demoMode } = useHomeAssistant();
  useHomeEventReactor(pulseWallpaperReactive, 'toggles-errors');

  // Shared origin: bottom edge below lg, centred on desktop (useRingOrigin).
  const { center, reach } = useRingOrigin();

  // Tint the steady rings by link health. While connecting (transient) keep the
  // neutral default so a brief reconnect doesn't flash red. Demo counts healthy.
  const tint = connecting && !demoMode ? null
    : connected || demoMode ? PULSE_COLORS.link
    : PULSE_COLORS.error;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <RingShaderBackground
        wavy={wavyBackgroundEnabled}
        reactive={pulseWallpaperReactive}
        intensity="subtle"
        tint={tint}
        center={center}
        reach={reach}
        mode={pulseMode}
        weather={weatherParams}
      />
    </div>
  );
}
