'use client';

import { useMemo } from 'react';
import { useEntity, useHomeAssistantSelector } from './useHomeAssistant';
import { useFeatureFlags } from './useFeatureFlags';
import { selectWeatherOptions, areWeatherOptionsEqual } from '@/lib/homeassistant/selectors';
import { deriveWeatherParams, type WeatherParams } from '@/lib/weatherVisual';

/**
 * Resolves the live weather entity (the one chosen in settings, else the first
 * `weather.*` entity found) into shader-ready {@link WeatherParams} for the
 * abstract weather wallpaper. Recomputed only when the entity's state or the
 * attributes we actually read change.
 */
export function useWeatherParams(): WeatherParams {
  const { weatherEntityId } = useFeatureFlags();
  const options = useHomeAssistantSelector(selectWeatherOptions, areWeatherOptionsEqual);
  const resolvedId = weatherEntityId ?? options[0]?.value ?? '';
  const entity = useEntity(resolvedId);

  const a = entity?.attributes;
  return useMemo(
    () => deriveWeatherParams(entity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity?.entity_id, entity?.state, a?.temperature, a?.wind_speed, a?.cloud_coverage]
  );
}
