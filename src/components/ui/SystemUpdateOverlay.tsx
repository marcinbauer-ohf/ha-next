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
  /**
   * When set, the overlay is being shown as a debug preview: clicking anywhere
   * dismisses it and a hint appears. Undefined for the real update/restart flow,
   * which must not be dismissable by the user.
   */
  onDismissPreview?: () => void;
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

export function SystemUpdateOverlay({ visible, install, phase, onDismissPreview }: SystemUpdateOverlayProps) {
  // Warp shader background — same wallpaper as onboarding, so update/restart
  // reads as the same family of screens.
  const { wavyBackgroundEnabled } = useFeatureFlags();
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

  const isImmersiveMode = true;
  const showLabel = install?.label ?? 'Home Assistant';
  const percentage = install?.percentage ?? null;
  const settling = phase === 'settling';
  // Restart with no update entity behind it (e.g. Settings → System → Restart).
  const bareRestart = phase === 'restarting' && !install;

  const heading = settling
    ? 'Your home is ready'
    : bareRestart
      ? 'Restarting your home'
      : 'Updating your home';

  if (!shouldRender) return null;

  return (
    <div
      data-component="SystemUpdateOverlay"
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[110] bg-surface-default flex flex-col items-center justify-center px-ha-6 transition-opacity duration-500 ease-out select-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${onDismissPreview ? 'cursor-pointer' : ''}`}
      onClick={onDismissPreview}
      onTransitionEnd={() => {
        if (!visible && !isVisible) setShouldRender(false);
      }}
    >
      <RingShaderBackground
        wavy={wavyBackgroundEnabled}
        center={ringOrigin.center}
        reach={ringOrigin.reach}
        mode="warp"
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
        {/* Bare logo — no circle, matching the onboarding hero. Gently pulsing
            while working; settles to a check when done. */}
        <div className="relative mb-ha-6">
          {settling ? (
            <Icon path={mdiCheckCircle} size={64} className="text-green-500" />
          ) : (
            <HALogo size={64} className="animate-pulse" />
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold text-text-primary leading-tight">
          {heading}
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
          returns on its own once your home is back.
        </p>

        {onDismissPreview && (
          <p className="mt-ha-6 text-xs font-medium uppercase tracking-wide text-text-disabled">
            Preview · tap anywhere or press Esc to close
          </p>
        )}
      </div>
    </div>
  );
}
