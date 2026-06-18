import type { HassEntity } from '@/types';

/**
 * Normalised, render-ready weather parameters fed to the abstract "weather"
 * wallpaper shader. Everything is 0..1 (except temp, which is -1..1) so the
 * shader can mix between visual states without knowing HA's vocabulary.
 */
export interface WeatherParams {
  /** Cloud cover / haze amount. */
  clouds: number;
  /** Rain intensity (diagonal streaks). */
  rain: number;
  /** Snow intensity (drifting flakes). */
  snow: number;
  /** Wind — slants rain, speeds drift. */
  wind: number;
  /** Temperature, cold(-1) → hot(+1), drives the warm/cool wash. */
  temp: number;
  /** 1 day, 0 night — darkens the wash + hides the sun glow. */
  day: number;
}

// Calm, neutral default (used when no entity is chosen / found).
export const NEUTRAL_WEATHER: WeatherParams = { clouds: 0.3, rain: 0, snow: 0, wind: 0.2, temp: 0, day: 1 };

// Per-condition cloud / rain / snow baselines. HA's standard `weather` states.
// (temp + wind come from attributes; day is derived from the condition.)
const CONDITIONS: Record<string, { clouds: number; rain: number; snow: number }> = {
  'clear-night': { clouds: 0.05, rain: 0, snow: 0 },
  sunny: { clouds: 0.05, rain: 0, snow: 0 },
  partlycloudy: { clouds: 0.45, rain: 0, snow: 0 },
  cloudy: { clouds: 0.9, rain: 0, snow: 0 },
  fog: { clouds: 0.75, rain: 0, snow: 0 },
  windy: { clouds: 0.4, rain: 0, snow: 0 },
  'windy-variant': { clouds: 0.6, rain: 0, snow: 0 },
  rainy: { clouds: 0.85, rain: 0.6, snow: 0 },
  pouring: { clouds: 0.95, rain: 1.0, snow: 0 },
  'lightning-rainy': { clouds: 0.95, rain: 0.8, snow: 0 },
  lightning: { clouds: 0.8, rain: 0.3, snow: 0 },
  hail: { clouds: 0.9, rain: 0.7, snow: 0.2 },
  snowy: { clouds: 0.8, rain: 0, snow: 0.85 },
  'snowy-rainy': { clouds: 0.85, rain: 0.45, snow: 0.45 },
  exceptional: { clouds: 0.5, rain: 0, snow: 0 },
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Derive the shader params from a HA weather entity (or null → neutral). */
export function deriveWeatherParams(entity: HassEntity | undefined | null): WeatherParams {
  if (!entity) return NEUTRAL_WEATHER;

  const condition = entity.state;
  const base = CONDITIONS[condition] ?? { clouds: 0.4, rain: 0, snow: 0 };
  const attrs = entity.attributes ?? {};

  // Prefer a real cloud_coverage reading (0..100) when the integration provides it.
  const coverage = typeof attrs.cloud_coverage === 'number' ? attrs.cloud_coverage / 100 : null;
  const clouds = coverage != null ? Math.max(base.clouds * 0.5, coverage) : base.clouds;

  // Temperature −10°C → +35°C mapped to −1..+1.
  const tempC = typeof attrs.temperature === 'number' ? attrs.temperature : 15;
  const temp = Math.min(1, Math.max(-1, (tempC - 12.5) / 22.5));

  // Wind 0 → 40 (km/h or mph, either reads fine) mapped to 0..1.
  const windRaw = typeof attrs.wind_speed === 'number' ? attrs.wind_speed : 8;
  const wind = clamp01(windRaw / 40);

  return {
    clouds: clamp01(clouds),
    rain: clamp01(base.rain),
    snow: clamp01(base.snow),
    wind,
    temp,
    day: condition === 'clear-night' ? 0 : 1,
  };
}
