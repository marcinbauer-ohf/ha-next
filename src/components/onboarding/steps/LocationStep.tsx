'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { mdiCrosshairsGps } from '@mdi/js';
import { Icon } from '@/components/ui';
import { useHomeAssistant } from '@/hooks';
import { haptic } from '@/lib/haptics';
import type { OnbLocation, StepProps } from '../types';
import { PrimaryPill, QuietButton, StepActions, StepSubtitle, StepTitle } from '../ui';

// leaflet reads `window` on import — keep it out of the server bundle.
const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => <div className="h-[240px] md:h-[300px] rounded-ha-3xl bg-surface-low/60 animate-pulse" />,
});

/**
 * Optional: where the home sits. Feeds Home Assistant's own latitude/longitude
 * (sunrise/sunset, weather, presence), so on a connected home it's written to
 * core config when the flow finishes — see OnboardingFlow.persistChoices.
 */
export function LocationStep({ state, update, next }: StepProps) {
  const { connected, demoMode, getCoreConfig } = useHomeAssistant();
  // Centre handed to the map: prefill or "use my location". Panning updates the
  // answer, never this, so the map isn't yanked back under the finger.
  const [center, setCenter] = useState<OnbLocation | null>(state.location);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(false);

  // Start from whatever Home Assistant already knows, so an existing home only
  // has to confirm. Demo mode has no core config to read — world view instead.
  useEffect(() => {
    if (state.location || demoMode || !connected) return;
    let cancelled = false;
    getCoreConfig().then((cfg) => {
      if (cancelled || !cfg) return;
      setCenter({ lat: cfg.latitude, lng: cfg.longitude });
    });
    return () => {
      cancelled = true;
    };
  }, [state.location, demoMode, connected, getCoreConfig]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return setLocateError(true);
    setLocating(true);
    setLocateError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        haptic('select');
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocateError(true);
      },
      { timeout: 10_000 },
    );
  };

  const picked = state.location;

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <div className="space-y-ha-3">
        <StepTitle>Where is your home?</StepTitle>
        <StepSubtitle>
          Move the map so the pin sits on your home. It&apos;s how sunrise, sunset and weather
          know where you are.
        </StepSubtitle>
      </div>

      <div className="w-full flex flex-col items-center gap-ha-3">
        <div className="w-full" aria-label="Home location map">
          <LocationMap center={center} onChange={(loc) => update({ location: loc })} />
        </div>

        <div className="flex items-center gap-ha-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-ha-2 h-10 px-ha-4 rounded-ha-pill bg-surface-low/70 backdrop-blur-sm border border-surface-lower text-sm font-medium text-text-primary hover:bg-surface-low transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            <Icon path={mdiCrosshairsGps} size={17} />
            {locating ? 'Finding you…' : 'Use my current location'}
          </button>
        </div>

        <p className="text-[13px] text-text-tertiary min-h-[1.25rem]" aria-live="polite">
          {locateError
            ? "Couldn't get your location — move the map instead."
            : picked
              ? `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`
              : 'Nothing picked yet'}
        </p>

        <StepActions>
          <PrimaryPill onClick={next} disabled={!picked}>
            Continue
          </PrimaryPill>
          <QuietButton
            onClick={() => {
              update({ location: null });
              next();
            }}
          >
            Skip for now
          </QuietButton>
        </StepActions>
      </div>
    </div>
  );
}
