'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  mdiThemeLightDark,
  mdiPalette,
  mdiFormatFont,
  mdiImageFilterHdr,
  mdiPencilRuler,
  mdiArrowExpandAll,
  mdiRobotExcited,
  mdiWeatherNight,
  mdiViewSplitVertical,
  mdiBug,
  mdiTimerSand,
  mdiFlask,
  mdiWaves,
  mdiShimmer,
  mdiPulse,
  mdiEyeArrowRight,
  mdiFormatListNumbered,
  mdiRefresh,
  mdiHome,
  mdiCog,
  mdiLightningBolt,
  mdiPaletteSwatch,
  mdiCardBulleted,
} from '@mdi/js';
import { useTheme } from './useTheme';
import { useFont } from './useFont';
import { useFeatureFlags } from './useFeatureFlags';
import { useImmersiveMode } from './useImmersiveMode';
import { useHomeAssistant } from './useHomeAssistant';
import { useHomeCenterPrefs } from './useHomeCenterPrefs';
import {
  useScreensaver,
  useEditMode,
  useAssistantContext,
  useToast,
  useDebugFlags,
} from '@/contexts';
import {
  settingsNavSections,
  getSettingsHref,
  type SettingsNavLink,
} from '@/components/profile/settingsNavigation';

export type CommandGroup = 'command' | 'navigate' | 'debug';

export interface CommandItem {
  id: string;
  group: CommandGroup;
  icon: string;
  label: string;
  /** Extra terms to match against (aliases, synonyms). */
  keywords?: string[];
  /** Short pill shown on the right: current value or on/off state. */
  state?: string;
  /** Whether the toggle/state currently reads as "on" (drives the accent). */
  active?: boolean;
  /** Actions/navigation close the palette; live toggles keep it open. */
  closeOnRun?: boolean;
  run: () => void;
}

const onOff = (v: boolean) => (v ? 'On' : 'Off');

/**
 * Data-driven command registry for the palette. Subscribes to every prototype
 * surface (theme, font, flags, debug, navigation) and exposes a flat list of
 * runnable items with live state. Memoized so the always-mounted overlay only
 * rebuilds when something it shows actually changes.
 */
export function useCommands(): CommandItem[] {
  const router = useRouter();
  const theme = useTheme();
  const font = useFont();
  const flags = useFeatureFlags();
  const immersive = useImmersiveMode();
  const ha = useHomeAssistant();
  const homeCenter = useHomeCenterPrefs();
  const screensaver = useScreensaver();
  const editMode = useEditMode();
  const assistant = useAssistantContext();
  const debug = useDebugFlags();
  const { showToast } = useToast();

  const fontLabel = font.fonts.find((f) => f.key === font.font)?.label ?? font.font;

  return useMemo<CommandItem[]>(() => {
    const prototypeReset = () => {
      try {
        localStorage.removeItem('ha_device_card_configs');
        localStorage.removeItem('ha_onboarding_v1');
        localStorage.removeItem('ha-home-center-order');
        localStorage.removeItem('ha-home-center-disabled');
      } catch {
        /* ignore */
      }
      homeCenter.reset();
      theme.setTheme('default');
      theme.setMode('system');
      theme.setBackground('gradient');
      font.setFont('theme');
      showToast({ title: 'Prototype reset', subtitle: 'Reloading with defaults…', icon: mdiRefresh });
      setTimeout(() => window.location.reload(), 650);
    };

    const commands: CommandItem[] = [
      // ── Commands ────────────────────────────────────────────────
      {
        id: 'cmd.color-mode',
        group: 'command',
        icon: mdiThemeLightDark,
        label: 'Toggle color mode',
        keywords: ['dark', 'light', 'system', 'appearance'],
        state: theme.mode,
        active: theme.mode === 'dark',
        run: theme.toggleMode,
      },
      {
        id: 'cmd.theme',
        group: 'command',
        icon: mdiPalette,
        label: 'Cycle theme',
        keywords: ['glass', 'cyberpunk', 'material', 'eink', 'fallout', 'teenage', 'skin', 'style'],
        state: theme.theme,
        run: theme.toggleTheme,
      },
      {
        id: 'cmd.font',
        group: 'command',
        icon: mdiFormatFont,
        label: 'Cycle typeface',
        keywords: ['font', 'typeface', 'noto', 'inter', 'plex', 'atkinson', 'figtree'],
        state: fontLabel,
        run: font.cycleFont,
      },
      {
        id: 'cmd.background',
        group: 'command',
        icon: mdiImageFilterHdr,
        label: 'Cycle background',
        keywords: ['wallpaper', 'gradient', 'image', 'pulse'],
        state: theme.background,
        run: theme.toggleBackground,
      },
      {
        id: 'cmd.edit',
        group: 'command',
        icon: mdiPencilRuler,
        label: 'Toggle edit mode',
        keywords: ['arrange', 'layout', 'dashboard', 'rearrange'],
        state: onOff(editMode.isEditing),
        active: editMode.isEditing,
        run: editMode.toggleEditMode,
      },
      {
        id: 'cmd.immersive',
        group: 'command',
        icon: mdiArrowExpandAll,
        label: 'Toggle immersive mode',
        keywords: ['fullscreen', 'edge', 'chrome'],
        state: onOff(immersive.immersiveMode),
        active: immersive.immersiveMode,
        run: () => immersive.toggleImmersiveMode(),
      },
      {
        id: 'cmd.assistant',
        group: 'command',
        icon: mdiRobotExcited,
        label: 'Toggle assistant',
        keywords: ['ai', 'chat', 'voice'],
        state: onOff(assistant.assistantOpen),
        active: assistant.assistantOpen,
        run: assistant.toggleAssistant,
      },
      {
        id: 'cmd.screensaver',
        group: 'command',
        icon: mdiWeatherNight,
        label: screensaver.isActive ? 'Dismiss screensaver' : 'Start screensaver',
        keywords: ['idle', 'clock', 'sleep'],
        closeOnRun: true,
        run: () => (screensaver.isActive ? screensaver.dismiss() : screensaver.activate()),
      },

      // ── Debug / prototype ───────────────────────────────────────
      {
        id: 'dbg.badges',
        group: 'debug',
        icon: mdiBug,
        label: 'Debug badges',
        keywords: ['diagnostic', 'hints'],
        state: onOff(debug.debugBadgesEnabled),
        active: debug.debugBadgesEnabled,
        run: debug.toggleDebugBadges,
      },
      {
        id: 'dbg.latency',
        group: 'debug',
        icon: mdiTimerSand,
        label: 'Mock latency',
        keywords: ['loading', 'delay', 'slow'],
        state: onOff(debug.mockLatencyEnabled),
        active: debug.mockLatencyEnabled,
        run: debug.toggleMockLatency,
      },
      {
        id: 'dbg.demo',
        group: 'debug',
        icon: mdiFlask,
        label: 'Demo data mode',
        keywords: ['sample', 'mock', 'fake'],
        state: onOff(ha.demoMode),
        active: ha.demoMode,
        run: () => {
          if (!ha.demoMode) ha.enableDemoMode();
        },
      },
      {
        id: 'dbg.split-view',
        group: 'debug',
        icon: mdiViewSplitVertical,
        label: 'Desktop split view',
        keywords: ['two pane', 'columns'],
        state: onOff(flags.desktopSplitViewEnabled),
        active: flags.desktopSplitViewEnabled,
        run: flags.toggleDesktopSplitView,
      },
      {
        id: 'dbg.wavy',
        group: 'debug',
        icon: mdiWaves,
        label: 'Wavy screensaver background',
        keywords: ['ripple', 'squiggle'],
        state: onOff(flags.wavyBackgroundEnabled),
        active: flags.wavyBackgroundEnabled,
        run: flags.toggleWavyBackground,
      },
      {
        id: 'dbg.reactive',
        group: 'debug',
        icon: mdiShimmer,
        label: 'Reactive screensaver background',
        keywords: ['react', 'pulse', 'events'],
        state: onOff(flags.reactiveBackgroundEnabled),
        active: flags.reactiveBackgroundEnabled,
        run: flags.toggleReactiveBackground,
      },
      {
        id: 'dbg.pulse-reactive',
        group: 'debug',
        icon: mdiPulse,
        label: 'Pulse wallpaper reactivity',
        keywords: ['ripple', 'toggles'],
        state: onOff(flags.pulseWallpaperReactive),
        active: flags.pulseWallpaperReactive,
        run: flags.togglePulseWallpaperReactive,
      },
      {
        id: 'dbg.offscreen-hints',
        group: 'debug',
        icon: mdiEyeArrowRight,
        label: 'Offscreen change hints',
        keywords: ['scroll', 'indicator'],
        state: onOff(flags.offscreenChangeHintsEnabled),
        active: flags.offscreenChangeHintsEnabled,
        run: flags.toggleOffscreenChangeHints,
      },
      {
        id: 'dbg.scroll-index',
        group: 'debug',
        icon: mdiFormatListNumbered,
        label: 'Scroll index rail',
        keywords: ['rail', 'alphabet', 'jump'],
        state: onOff(flags.scrollIndexEnabled),
        active: flags.scrollIndexEnabled,
        run: flags.toggleScrollIndex,
      },
      {
        id: 'dbg.reset',
        group: 'debug',
        icon: mdiRefresh,
        label: 'Prototype reset',
        keywords: ['clear', 'defaults', 'wipe', 'reset dashboard'],
        closeOnRun: true,
        run: prototypeReset,
      },

      // ── Navigation: top-level routes ────────────────────────────
      {
        id: 'nav.home',
        group: 'navigate',
        icon: mdiHome,
        label: 'Home',
        keywords: ['dashboard', 'overview'],
        closeOnRun: true,
        run: () => router.push('/'),
      },
      {
        id: 'nav.settings',
        group: 'navigate',
        icon: mdiCog,
        label: 'Settings',
        closeOnRun: true,
        run: () => router.push('/settings'),
      },
      {
        id: 'nav.energy',
        group: 'navigate',
        icon: mdiLightningBolt,
        label: 'Energy dashboard',
        keywords: ['power', 'consumption'],
        closeOnRun: true,
        run: () => router.push('/dashboard/energy'),
      },
      {
        id: 'nav.design-system',
        group: 'navigate',
        icon: mdiPaletteSwatch,
        label: 'Design system',
        keywords: ['storybook', 'components', 'dev'],
        closeOnRun: true,
        run: () => router.push('/dev/design-system'),
      },
      {
        id: 'nav.device-card',
        group: 'navigate',
        icon: mdiCardBulleted,
        label: 'Device card playground',
        keywords: ['dev', 'card'],
        closeOnRun: true,
        run: () => router.push('/dev/device-card'),
      },
    ];

    // Navigation: every settings section, derived so it stays in sync.
    for (const section of settingsNavSections) {
      for (const link of section.items as SettingsNavLink[]) {
        commands.push({
          id: `nav.settings.${link.slug}`,
          group: 'navigate',
          icon: link.icon,
          label: link.label,
          keywords: [section.title, link.description].filter(Boolean),
          closeOnRun: true,
          run: () => router.push(getSettingsHref(link.slug)),
        });
      }
    }

    return commands;
  }, [
    router,
    theme,
    font,
    fontLabel,
    flags,
    immersive,
    ha,
    homeCenter,
    screensaver,
    editMode,
    assistant,
    debug,
    showToast,
  ]);
}
