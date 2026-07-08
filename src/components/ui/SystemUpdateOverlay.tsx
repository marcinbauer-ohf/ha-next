'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { HALogo } from './HALogo';
import { RingShaderBackground, useRingOrigin } from './RingShaderBackground';
import { useFeatureFlags, useWeatherParams } from '@/hooks';
import { mdiCheckCircle } from '@mdi/js';
import type { SystemUpdateInstall } from '@/lib/homeassistant/selectors';

/** Where the update flow is: installing → restarting (socket gone) → settling (back, confirming). */
export type SystemUpdatePhase = 'installing' | 'restarting' | 'settling';

interface SystemUpdateOverlayProps {
  visible: boolean;
  install: SystemUpdateInstall | null;
  phase: SystemUpdatePhase;
}

function statusLine(phase: SystemUpdatePhase, install: SystemUpdateInstall | null): string {
  const target = install?.targetVersion ? ` ${install.targetVersion}` : '';
  switch (phase) {
    case 'installing':
      return install?.percentage != null
        ? `Installing${target} — ${install.percentage}%`
        : `Installing the update${target}…`;
    case 'restarting':
      return 'Restarting your home. Reconnecting…';
    case 'settling':
      return 'Finishing up…';
  }
}

export function SystemUpdateOverlay({ visible, install, phase }: SystemUpdateOverlayProps) {
  // Match the screensaver wallpaper so this reads as the same family of screens.
  const { wavyBackgroundEnabled, pulseMode } = useFeatureFlags();
  const weatherParams = useWeatherParams();
  const ringOrigin = useRingOrigin();

  // Mount/fade lifecycle mirrors the screensaver: keep the node mounted through
  // the fade-out so the transition can play.
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    let raf1: number | null = null;
    let raf2: number | null = null;
    if (visible) {
      raf1 = requestAnimationFrame(() => {
        setShouldRender(true);
        raf2 = requestAnimationFrame(() => setIsVisible(true));
      });
    } else {
      raf1 = requestAnimationFrame(() => setIsVisible(false));
    }
    return () => {
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [visible]);

  const isImmersiveMode = !['classic', 'heartbeat', 'breathing', 'breathOrb'].includes(pulseMode);
  const showLabel = install?.label ?? 'Home Assistant';
  const percentage = install?.percentage ?? null;
  const settling = phase === 'settling';

  if (!shouldRender) return null;

  return (
    <div
      data-component="SystemUpdateOverlay"
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[110] bg-surface-default flex flex-col items-center justify-center px-ha-6 transition-opacity duration-500 ease-out select-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onTransitionEnd={() => {
        if (!visible && !isVisible) setShouldRender(false);
      }}
    >
      <RingShaderBackground
        wavy={wavyBackgroundEnabled}
        center={ringOrigin.center}
        reach={ringOrigin.reach}
        mode={pulseMode}
        weather={weatherParams}
        opaque
      />
      {isImmersiveMode && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(120% 120% at 50% 45%, color-mix(in srgb, var(--ha-color-surface-default) 72%, transparent) 0%, color-mix(in srgb, var(--ha-color-surface-default) 55%, transparent) 55%, color-mix(in srgb, var(--ha-color-surface-default) 30%, transparent) 100%)',
          }}
        />
      )}

      <div className="relative flex flex-col items-center text-center max-w-md">
        {/* Logo mark, gently pulsing while working; settles to a check when done */}
        <div className="relative mb-ha-6">
          {!settling && (
            <span className="absolute inset-0 rounded-full bg-ha-blue/15 animate-ping" aria-hidden />
          )}
          <div className="relative w-20 h-20 rounded-full bg-surface-low/70 border border-surface-lower flex items-center justify-center backdrop-blur-sm">
            {settling ? (
              <Icon path={mdiCheckCircle} size={40} className="text-green-500" />
            ) : (
              <HALogo size={44} className="animate-pulse" />
            )}
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold text-text-primary leading-tight">
          {settling ? 'Your home is ready' : 'Updating your home'}
        </h1>
        <p className="mt-ha-2 text-base text-text-secondary">{showLabel}</p>

        {/* Progress: determinate bar when a % is reported, animated shimmer when not */}
        {!settling && (
          <div className="mt-ha-6 w-64 max-w-full">
            <div className="h-1.5 w-full rounded-full bg-surface-lower overflow-hidden">
              {percentage != null ? (
                <div
                  className="h-full rounded-full bg-ha-blue transition-[width] duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              ) : (
                <div className="ha-indeterminate-bar h-full rounded-full bg-ha-blue" />
              )}
            </div>
            <p className="mt-ha-3 text-sm text-text-secondary tabular-nums">
              {statusLine(phase, install)}
            </p>
          </div>
        )}

        <p className="mt-ha-8 text-sm text-text-disabled leading-relaxed">
          This can take a few minutes. Your devices keep running — the screen
          returns on its own once the update is done.
        </p>
      </div>
    </div>
  );
}
