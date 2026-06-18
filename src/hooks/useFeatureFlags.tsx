'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ReactiveTriggerMode } from './useHomeEventReactor';
import { PULSE_MODES, type PulseIntensity, type PulseMode } from '@/components/ui/RingShaderBackground';

const LS_DESKTOP_SPLIT_VIEW_KEY = 'ha-flag-desktop-split-view';
const LS_OFFSCREEN_CHANGE_HINTS_KEY = 'ha-flag-offscreen-change-hints';
const LS_SCROLL_INDEX_KEY = 'ha-flag-scroll-index';
const LS_WAVY_BACKGROUND_KEY = 'ha-flag-wavy-background';
const LS_REACTIVE_BACKGROUND_KEY = 'ha-flag-reactive-background';
const LS_REACTIVE_TRIGGER_KEY = 'ha-flag-reactive-trigger';
const LS_REACTIVE_INTENSITY_KEY = 'ha-flag-reactive-intensity';
const LS_PULSE_WALLPAPER_REACTIVE_KEY = 'ha-flag-pulse-wallpaper-reactive';
const LS_REACTIVE_TRIGGER_LABELS_KEY = 'ha-flag-reactive-trigger-labels';
const LS_PULSE_MODE_KEY = 'ha-flag-pulse-mode';
const LS_WEATHER_ENTITY_KEY = 'ha-flag-weather-entity';
const LS_FAST_SCROLL_LABELS_KEY = 'ha-flag-fast-scroll-labels';

const REACTIVE_TRIGGER_MODES: ReactiveTriggerMode[] = ['toggles-errors', 'all', 'errors'];
const PULSE_INTENSITIES: PulseIntensity[] = ['subtle', 'bold'];

interface FeatureFlagsContextValue {
  desktopSplitViewEnabled: boolean;
  setDesktopSplitViewEnabled: (value: boolean) => void;
  toggleDesktopSplitView: () => void;
  offscreenChangeHintsEnabled: boolean;
  setOffscreenChangeHintsEnabled: (value: boolean) => void;
  toggleOffscreenChangeHints: () => void;
  scrollIndexEnabled: boolean;
  setScrollIndexEnabled: (value: boolean) => void;
  toggleScrollIndex: () => void;
  wavyBackgroundEnabled: boolean;
  setWavyBackgroundEnabled: (value: boolean) => void;
  toggleWavyBackground: () => void;
  reactiveBackgroundEnabled: boolean;
  setReactiveBackgroundEnabled: (value: boolean) => void;
  toggleReactiveBackground: () => void;
  reactiveTriggerMode: ReactiveTriggerMode;
  setReactiveTriggerMode: (value: ReactiveTriggerMode) => void;
  reactiveIntensity: PulseIntensity;
  setReactiveIntensity: (value: PulseIntensity) => void;
  /** Show the bottom-center labels naming what triggered each reactive ripple. */
  reactiveTriggerLabelsEnabled: boolean;
  setReactiveTriggerLabelsEnabled: (value: boolean) => void;
  toggleReactiveTriggerLabels: () => void;
  /** When the "Pulse" wallpaper is active, ripple on device toggles/errors. */
  pulseWallpaperReactive: boolean;
  setPulseWallpaperReactive: (value: boolean) => void;
  togglePulseWallpaperReactive: () => void;
  /** Ambient style of the ring background / pulse wallpaper. */
  pulseMode: PulseMode;
  setPulseMode: (value: PulseMode) => void;
  /** Weather entity (entity_id) driving the 'weather' wallpaper. Null = auto/first. */
  weatherEntityId: string | null;
  setWeatherEntityId: (value: string | null) => void;
  /** Prototype: while flicking a dashboard fast, overlay each device card with
   *  just its name (large) so you can read what's flying past. */
  fastScrollLabelsEnabled: boolean;
  setFastScrollLabelsEnabled: (value: boolean) => void;
  toggleFastScrollLabels: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [desktopSplitViewEnabled, setDesktopSplitViewEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_DESKTOP_SPLIT_VIEW_KEY) === '1';
  });

  // Defaults on — opt-out flag. Only an explicit '0' disables it.
  const [offscreenChangeHintsEnabled, setOffscreenChangeHintsEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LS_OFFSCREEN_CHANGE_HINTS_KEY) !== '0';
  });

  const setDesktopSplitViewEnabled = useCallback((value: boolean) => {
    setDesktopSplitViewEnabledState(value);
    localStorage.setItem(LS_DESKTOP_SPLIT_VIEW_KEY, value ? '1' : '0');
  }, []);

  const toggleDesktopSplitView = useCallback(() => {
    setDesktopSplitViewEnabled(!desktopSplitViewEnabled);
  }, [desktopSplitViewEnabled, setDesktopSplitViewEnabled]);

  const setOffscreenChangeHintsEnabled = useCallback((value: boolean) => {
    setOffscreenChangeHintsEnabledState(value);
    localStorage.setItem(LS_OFFSCREEN_CHANGE_HINTS_KEY, value ? '1' : '0');
  }, []);

  const toggleOffscreenChangeHints = useCallback(() => {
    setOffscreenChangeHintsEnabled(!offscreenChangeHintsEnabled);
  }, [offscreenChangeHintsEnabled, setOffscreenChangeHintsEnabled]);

  // Scroll index rail — defaults on, opt-out. Only an explicit '0' disables it.
  const [scrollIndexEnabled, setScrollIndexEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LS_SCROLL_INDEX_KEY) !== '0';
  });

  const setScrollIndexEnabled = useCallback((value: boolean) => {
    setScrollIndexEnabledState(value);
    localStorage.setItem(LS_SCROLL_INDEX_KEY, value ? '1' : '0');
  }, []);

  const toggleScrollIndex = useCallback(() => {
    setScrollIndexEnabled(!scrollIndexEnabled);
  }, [scrollIndexEnabled, setScrollIndexEnabled]);

  // Default off — original radial background. Only explicit '1' enables the wavy variant.
  const [wavyBackgroundEnabled, setWavyBackgroundEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_WAVY_BACKGROUND_KEY) === '1';
  });

  const setWavyBackgroundEnabled = useCallback((value: boolean) => {
    setWavyBackgroundEnabledState(value);
    localStorage.setItem(LS_WAVY_BACKGROUND_KEY, value ? '1' : '0');
  }, []);

  const toggleWavyBackground = useCallback(() => {
    setWavyBackgroundEnabled(!wavyBackgroundEnabled);
  }, [wavyBackgroundEnabled, setWavyBackgroundEnabled]);

  // Reactive background — off by default.
  const [reactiveBackgroundEnabled, setReactiveBackgroundEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_REACTIVE_BACKGROUND_KEY) === '1';
  });

  const [reactiveTriggerMode, setReactiveTriggerModeState] = useState<ReactiveTriggerMode>(() => {
    if (typeof window === 'undefined') return 'toggles-errors';
    const stored = localStorage.getItem(LS_REACTIVE_TRIGGER_KEY);
    return REACTIVE_TRIGGER_MODES.includes(stored as ReactiveTriggerMode)
      ? (stored as ReactiveTriggerMode)
      : 'toggles-errors';
  });

  const [reactiveIntensity, setReactiveIntensityState] = useState<PulseIntensity>(() => {
    if (typeof window === 'undefined') return 'subtle';
    const stored = localStorage.getItem(LS_REACTIVE_INTENSITY_KEY);
    return PULSE_INTENSITIES.includes(stored as PulseIntensity) ? (stored as PulseIntensity) : 'subtle';
  });

  const setReactiveBackgroundEnabled = useCallback((value: boolean) => {
    setReactiveBackgroundEnabledState(value);
    localStorage.setItem(LS_REACTIVE_BACKGROUND_KEY, value ? '1' : '0');
  }, []);

  const toggleReactiveBackground = useCallback(() => {
    setReactiveBackgroundEnabled(!reactiveBackgroundEnabled);
  }, [reactiveBackgroundEnabled, setReactiveBackgroundEnabled]);

  const setReactiveTriggerMode = useCallback((value: ReactiveTriggerMode) => {
    setReactiveTriggerModeState(value);
    localStorage.setItem(LS_REACTIVE_TRIGGER_KEY, value);
  }, []);

  const setReactiveIntensity = useCallback((value: PulseIntensity) => {
    setReactiveIntensityState(value);
    localStorage.setItem(LS_REACTIVE_INTENSITY_KEY, value);
  }, []);

  // Trigger labels — default off so the screensaver stays clean; opt-in.
  const [reactiveTriggerLabelsEnabled, setReactiveTriggerLabelsEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_REACTIVE_TRIGGER_LABELS_KEY) === '1';
  });

  const setReactiveTriggerLabelsEnabled = useCallback((value: boolean) => {
    setReactiveTriggerLabelsEnabledState(value);
    localStorage.setItem(LS_REACTIVE_TRIGGER_LABELS_KEY, value ? '1' : '0');
  }, []);

  const toggleReactiveTriggerLabels = useCallback(() => {
    setReactiveTriggerLabelsEnabled(!reactiveTriggerLabelsEnabled);
  }, [reactiveTriggerLabelsEnabled, setReactiveTriggerLabelsEnabled]);

  // Pulse wallpaper reactivity — defaults on, so the wallpaper ripples on toggles.
  const [pulseWallpaperReactive, setPulseWallpaperReactiveState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LS_PULSE_WALLPAPER_REACTIVE_KEY) !== '0';
  });

  const setPulseWallpaperReactive = useCallback((value: boolean) => {
    setPulseWallpaperReactiveState(value);
    localStorage.setItem(LS_PULSE_WALLPAPER_REACTIVE_KEY, value ? '1' : '0');
  }, []);

  const togglePulseWallpaperReactive = useCallback(() => {
    setPulseWallpaperReactive(!pulseWallpaperReactive);
  }, [pulseWallpaperReactive, setPulseWallpaperReactive]);

  // Ambient ring style — defaults to the classic endless rings.
  const [pulseMode, setPulseModeState] = useState<PulseMode>(() => {
    if (typeof window === 'undefined') return 'classic';
    const stored = localStorage.getItem(LS_PULSE_MODE_KEY);
    return PULSE_MODES.includes(stored as PulseMode) ? (stored as PulseMode) : 'classic';
  });

  const setPulseMode = useCallback((value: PulseMode) => {
    setPulseModeState(value);
    localStorage.setItem(LS_PULSE_MODE_KEY, value);
  }, []);

  // Chosen weather entity for the 'weather' wallpaper. Null → consumers fall
  // back to the first weather.* entity they find.
  const [weatherEntityId, setWeatherEntityIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LS_WEATHER_ENTITY_KEY) || null;
  });

  const setWeatherEntityId = useCallback((value: string | null) => {
    setWeatherEntityIdState(value);
    if (value) localStorage.setItem(LS_WEATHER_ENTITY_KEY, value);
    else localStorage.removeItem(LS_WEATHER_ENTITY_KEY);
  }, []);

  // Fast-scroll name labels — prototype, off by default. Only explicit '1' enables.
  const [fastScrollLabelsEnabled, setFastScrollLabelsEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_FAST_SCROLL_LABELS_KEY) === '1';
  });

  const setFastScrollLabelsEnabled = useCallback((value: boolean) => {
    setFastScrollLabelsEnabledState(value);
    localStorage.setItem(LS_FAST_SCROLL_LABELS_KEY, value ? '1' : '0');
  }, []);

  const toggleFastScrollLabels = useCallback(() => {
    setFastScrollLabelsEnabled(!fastScrollLabelsEnabled);
  }, [fastScrollLabelsEnabled, setFastScrollLabelsEnabled]);

  return (
    <FeatureFlagsContext.Provider
      value={{
        desktopSplitViewEnabled,
        setDesktopSplitViewEnabled,
        toggleDesktopSplitView,
        offscreenChangeHintsEnabled,
        setOffscreenChangeHintsEnabled,
        toggleOffscreenChangeHints,
        scrollIndexEnabled,
        setScrollIndexEnabled,
        toggleScrollIndex,
        wavyBackgroundEnabled,
        setWavyBackgroundEnabled,
        toggleWavyBackground,
        reactiveBackgroundEnabled,
        setReactiveBackgroundEnabled,
        toggleReactiveBackground,
        reactiveTriggerMode,
        setReactiveTriggerMode,
        reactiveIntensity,
        setReactiveIntensity,
        reactiveTriggerLabelsEnabled,
        setReactiveTriggerLabelsEnabled,
        toggleReactiveTriggerLabels,
        pulseWallpaperReactive,
        setPulseWallpaperReactive,
        togglePulseWallpaperReactive,
        pulseMode,
        setPulseMode,
        weatherEntityId,
        setWeatherEntityId,
        fastScrollLabelsEnabled,
        setFastScrollLabelsEnabled,
        toggleFastScrollLabels,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}
