'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui';
import { SimulationListModal } from '@/components/ui/SimulationListModal';
import { SystemStatusPanel, type HomeCenterSection } from '@/components/ui/SystemStatusPanel';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { useHeader, useScreensaver, useAddContext } from '@/contexts';
import { useFeatureFlags, useHomeAssistant, useHomeAssistantSelector, useImmersiveMode, useTheme, useFont, useDeviceStructure, useDeviceCardConfig, useIntegrations } from '@/hooks';
import { IntegrationsTable, IntegrationDetailView } from './IntegrationsPanel';
import { HomeCenterSectionsModal } from './HomeCenterSectionEditor';
import { TOGGLEABLE } from '@/lib/homeassistant/entityHelpers';
import type { EntitySlot, EntitySection } from '@/hooks/useDeviceCardConfig';
import { THEMES, type Background, type ColorMode, type Theme } from '@/hooks/useTheme';
import { areSimulationEntitiesEqual, selectSimulationEntities } from '@/lib/homeassistant/selectors';
import { createSimulatedActivityEntity, simulationPrefixes, type SimulationType } from '@/lib/homeassistant/simulatedActivities';
import { type SettingsSlug, allSettingsLinks } from './settingsNavigation';
import {
  mdiAlphaDBox,
  mdiCctv,
  mdiChevronLeft,
  mdiCog,
  mdiHomeAssistant,
  mdiOpenInNew,
  mdiPlay,
  mdiPrinter3d,
  mdiTimerOutline,
  mdiUpdate,
} from '@mdi/js';

interface SettingsDetailPageProps {
  slug: SettingsSlug;
  panelMode?: boolean;
}

interface SettingsMeta {
  title: string;
  description: string;
  icon: string;
  eyebrow: string;
  accentClassName: string;
}

function SettingsShell({
  children,
  panelMode,
  title,
  titleAction,
  onBack,
}: {
  children: React.ReactNode;
  panelMode?: boolean;
  title?: string;
  /** Optional control rendered at the end of the title row (panel mode), e.g. a cog. */
  titleAction?: React.ReactNode;
  /** When set (panel mode), the title becomes a back affordance: chevron + title. */
  onBack?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // Publish the pinned title's height as `--settings-header-h` so a list's own
  // sticky search (DataListView) can pin directly *below* the title instead of
  // sliding up over it. Measured (not hard-coded) because the live font switcher
  // changes the title's line height. Falls back to 0 when there's no title.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const titleEl = titleRef.current;
    if (!titleEl) {
      root.style.setProperty('--settings-header-h', '0px');
      return;
    }
    const apply = () => root.style.setProperty('--settings-header-h', `${titleEl.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(titleEl);
    return () => observer.disconnect();
  }, [title, onBack, titleAction, panelMode]);

  if (panelMode) {
    return (
      // `pt-ha-1` aligns the content column's top with the nav column's sticky search field.
      <div ref={rootRef} className="pt-ha-1">
        {(onBack || title) && (
          // Sticky title — stays pinned while content scrolls under it. A list's
          // own sticky search stacks just beneath via `--settings-header-h`.
          <div className="sticky top-0 z-20">
            <div ref={titleRef} className="flex items-center justify-between gap-ha-3 bg-surface-lower pb-ha-3">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="group flex items-center gap-ha-2 -ml-ha-1 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary transition-colors group-hover:bg-surface-low group-hover:text-text-primary">
                    <Icon path={mdiChevronLeft} size={22} />
                  </span>
                  <h1 className="text-3xl font-bold tracking-tight text-text-primary">{title}</h1>
                </button>
              ) : (
                <h1 className="text-3xl font-bold tracking-tight text-text-primary px-ha-1">{title}</h1>
              )}
              {titleAction}
            </div>
            {/* Fades content scrolling under the title (hidden behind a list's search when one pins below). */}
            <div className="h-6 bg-gradient-to-b from-surface-lower to-transparent pointer-events-none -mb-6" />
          </div>
        )}
        <div className="space-y-ha-6">{children}</div>
      </div>
    );
  }

  return (
    <AppSurfacePage>
      <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full space-y-ha-6">
        {children}
      </div>
    </AppSurfacePage>
  );
}


function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 lg:p-ha-6 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)]">
      <div className="mb-ha-4">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-ha-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; caption?: string }>;
}) {
  return (
    <div className="space-y-ha-2">
      <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className="flex flex-wrap gap-ha-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-ha-2xl border px-ha-4 py-ha-2 text-left transition-colors ${
                selected
                  ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
                  : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low'
              }`}
            >
              <div className="text-sm font-semibold">{option.label}</div>
              {option.caption && <div className="mt-1 text-xs opacity-80">{option.caption}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 flex items-center gap-ha-4 text-left hover:bg-surface-low transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{description}</div>
      </div>
      <div className={`h-6 w-11 rounded-full px-0.5 flex items-center transition-colors ${checked ? 'bg-ha-blue/50' : 'bg-surface-mid'}`}>
        <div className={`h-5 w-5 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

function ActionButton({
  label,
  onClick,
  tone = 'default',
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const toneClassNames = {
    default: 'border-surface-lower bg-surface-default text-text-primary hover:bg-surface-low',
    primary: 'border-ha-blue/20 bg-fill-primary-normal text-ha-blue hover:bg-fill-primary-quiet',
    danger: 'border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/15',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-ha-xl border px-ha-3 py-ha-2 text-sm font-medium transition-colors ${toneClassNames[tone]} ${
        disabled ? 'cursor-not-allowed opacity-45' : ''
      }`}
    >
      {label}
    </button>
  );
}

function formatLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

const themeLabels: Record<Theme, string> = {
  default: 'Default',
  glass: 'Glass',
  teenage: 'Teenage Engineering',
  cyberpunk: 'Cyberpunk',
  material: 'Material Design',
  eink: 'E-Ink',
  fallout: 'Fallout',
};

const backgroundLabels: Record<Background, string> = {
  gradient: 'Home Assistant background',
  image: 'Image',
  solid: 'Solid',
  none: 'None',
  pulse: 'Pulse',
};

const taskBarActivityDefinitions: Array<{
  type: SimulationType;
  title: string;
  description: string;
  reviewTitle: string;
  icon: string;
  singleToggle?: boolean;
  formatState: (count: number) => string;
}> = [
  {
    type: 'release',
    title: "What's New",
    description: 'Control the unread release-notes task so it can appear in the activity bar.',
    reviewTitle: "What's New in Home Assistant",
    icon: mdiUpdate,
    singleToggle: true,
    formatState: (count) => (count > 0 ? 'Unread release notes' : 'No unread release notes'),
  },
  {
    type: 'media',
    title: 'Simulate Media',
    description: 'Add or remove mock playback activity for speakers and media players.',
    reviewTitle: 'Simulate Media',
    icon: mdiPlay,
    formatState: (count) => (count > 0 ? `${count} playing` : 'Idle'),
  },
  {
    type: 'timer',
    title: 'Simulate Timer',
    description: 'Preview laundry, tea, or kitchen timer activity in the task bar.',
    reviewTitle: 'Simulate Timer',
    icon: mdiTimerOutline,
    formatState: (count) => (count > 0 ? `${count} active` : 'Idle'),
  },
  {
    type: 'camera',
    title: 'Simulate Camera',
    description: 'Surface motion events as activity for doorbells and cameras.',
    reviewTitle: 'Simulate Camera',
    icon: mdiCctv,
    formatState: (count) => (count > 0 ? `${count} motion events` : 'Idle'),
  },
  {
    type: 'printer',
    title: 'Simulate Printer',
    description: 'Show long-running print jobs in the same activity surface.',
    reviewTitle: 'Simulate Printer',
    icon: mdiPrinter3d,
    formatState: (count) => (count > 0 ? `${count} printing` : 'Idle'),
  },
];

const settingsMeta: Partial<Record<SettingsSlug, SettingsMeta>> = {
  developer: {
    title: 'Prototype & Debug Tools',
    description: 'Dashboards, theme, task bar, maintenance, and developer flags — every preview-only tool on one page.',
    icon: mdiAlphaDBox,
    eyebrow: 'Preview',
    accentClassName: 'border-orange-500/20',
  },
};

export function SettingsDetailPage({ slug, panelMode }: SettingsDetailPageProps) {
  const router = useRouter();
  const { setHeader } = useHeader();
  const { setContextSlug } = useAddContext();

  // Tell the top-bar "+" which section is open so it can hoist that section's
  // "Add …" action to the top. Covers both the two-column /settings page and
  // the /settings/[slug] detail route, since both render this component.
  useEffect(() => {
    setContextSlug(slug);
    return () => setContextSlug(null);
  }, [slug, setContextSlug]);
  const { desktopSplitViewEnabled, toggleDesktopSplitView, offscreenChangeHintsEnabled, toggleOffscreenChangeHints, scrollIndexEnabled, toggleScrollIndex, wavyBackgroundEnabled, toggleWavyBackground, reactiveBackgroundEnabled, toggleReactiveBackground, reactiveTriggerMode, setReactiveTriggerMode, reactiveIntensity, setReactiveIntensity, pulseWallpaperReactive, togglePulseWallpaperReactive } = useFeatureFlags();
  const { theme, mode, background, setTheme, setMode, setBackground } = useTheme();
  const { font, fonts, setFont } = useFont();
  const {
    clearCredentials,
    connected,
    connecting,
    demoMode,
    haUrl,
    enableDemoMode,
    error: connectionError,
    saveCredentials,
    setMockEntity,
  } = useHomeAssistant();
  const { immersiveMode, setImmersiveMode } = useImmersiveMode();
  const { isActive: screensaverActive, activate: activateScreensaver, dismiss: dismissScreensaver } = useScreensaver();
  const simulationEntities = useHomeAssistantSelector(selectSimulationEntities, areSimulationEntitiesEqual);

  // Device card configuration
  const { devices } = useDeviceStructure();
  const { setConfig } = useDeviceCardConfig();
  const [configureStatus, setConfigureStatus] = useState<'idle' | 'done'>('idle');

  // Home Center "Customize sections" modal (opened from the cog by the title).
  const [sectionsEditorOpen, setSectionsEditorOpen] = useState(false);

  // Master-detail drill-down within column 2. `detailId` is the selected row's id
  // (e.g. an integration platform key); null means we're showing the table.
  const { integrations } = useIntegrations();
  const [detailId, setDetailId] = useState<string | null>(null);
  // Reset the drill-down whenever the settings section changes — adjusted during
  // render (React's recommended pattern) rather than in an effect.
  const [drillSlug, setDrillSlug] = useState(slug);
  if (slug !== drillSlug) {
    setDrillSlug(slug);
    setDetailId(null);
  }
  const activeIntegration = slug === 'integrations' && detailId
    ? integrations.find((i) => i.id === detailId) ?? null
    : null;

  const autoConfigureDevices = useCallback(() => {
    const HIDDEN_DOMAINS = new Set(['update', 'button', 'event', 'number', 'select', 'text', 'scene', 'input_number', 'input_select', 'input_text', 'input_button']);
    const HIDDEN_DEVICE_CLASSES = new Set(['battery', 'signal_strength', 'connectivity', 'timestamp', 'voltage', 'current', 'energy_storage']);
    const HIDDEN_PATTERN = /\b(battery|signal|rssi|lqi|firmware|version|uptime|interval|link|ssid|bssid|mac|ip_address)\b/i;
    const GOOD_SENSOR_CLASSES = new Set(['temperature', 'humidity', 'power', 'energy', 'illuminance', 'pressure', 'co2', 'pm25', 'pm10', 'volatile_organic_compounds', 'moisture']);
    const GOOD_BINARY_CLASSES = new Set(['door', 'garage_door', 'window', 'motion', 'occupancy', 'smoke', 'gas', 'moisture', 'safety', 'vibration', 'lock']);

    for (const device of devices) {
      if (!device.primaryEntity) continue;
      const primaryId = device.primaryEntity.entity_id;
      const slots: EntitySlot[] = [];

      for (const entity of device.entities) {
        const [domain] = entity.entity_id.split('.');
        const dc = entity.attributes.device_class as string | undefined;
        const eid = entity.entity_id.toLowerCase();

        if (entity.entity_id === primaryId) {
          slots.push({ entity_id: entity.entity_id, size: 'lg', section: 'primary' });
          continue;
        }

        let section: EntitySection = 'hidden';
        if (!HIDDEN_DOMAINS.has(domain) && !(dc && HIDDEN_DEVICE_CLASSES.has(dc)) && !HIDDEN_PATTERN.test(eid)) {
          if (TOGGLEABLE.has(domain)) {
            section = 'secondary';
          } else if (domain === 'sensor' && dc && GOOD_SENSOR_CLASSES.has(dc)) {
            section = 'secondary';
          } else if (domain === 'binary_sensor' && dc && GOOD_BINARY_CLASSES.has(dc)) {
            section = 'secondary';
          } else if (domain === 'climate') {
            section = 'secondary';
          }
        }

        slots.push({ entity_id: entity.entity_id, size: 'lg', section });
      }

      setConfig(device.id, { slots });
    }

    setConfigureStatus('done');
    setTimeout(() => setConfigureStatus('idle'), 2500);
  }, [devices, setConfig]);

  const resetDashboard = useCallback(() => {
    for (const device of devices) {
      setConfig(device.id, { slots: [] });
    }
    localStorage.removeItem('ha_onboarding_v1');
    setConfigureStatus('done');
    setTimeout(() => setConfigureStatus('idle'), 2500);
  }, [devices, setConfig]);

  const [debugBadgesEnabled, setDebugBadgesEnabled] = useState(demoMode);
  const [mockLatencyEnabled, setMockLatencyEnabled] = useState(false);
  const [connectionSetupOpen, setConnectionSetupOpen] = useState(false);
  const [simulationModal, setSimulationModal] = useState<{ title: string; prefix: string } | null>(null);

  const allNavItems = allSettingsLinks;
  const navItem = allNavItems.find(item => item.slug === slug);
  const meta: SettingsMeta = settingsMeta[slug] ?? {
    title: navItem?.label ?? slug,
    description: navItem?.description ?? '',
    icon: navItem?.icon ?? mdiHomeAssistant,
    eyebrow: 'Home Assistant',
    accentClassName: 'border-ha-blue/20',
  };

  const resetLayoutToDefaults = useCallback(() => {
    setTheme('default');
    setMode('system');
    setBackground('none');
    setImmersiveMode(false);
  }, [setBackground, setImmersiveMode, setMode, setTheme]);

  const [devicesDashboardResetDone, setDevicesDashboardResetDone] = useState(false);
  const resetDevicesDashboard = useCallback(() => {
    localStorage.removeItem('ha_device_order');
    localStorage.removeItem('ha_device_card_configs');
    localStorage.removeItem('ha_onboarding_v1');
    setDevicesDashboardResetDone(true);
    setTimeout(() => setDevicesDashboardResetDone(false), 2500);
  }, []);

  const handleClearCredentials = useCallback(() => {
    const confirmed = window.confirm(
      demoMode
        ? 'Reload the populated demo home data?'
        : 'Disconnect Home Assistant and return to demo data?'
    );
    if (!confirmed) return;
    clearCredentials();
  }, [clearCredentials, demoMode]);

  const handleSaveCredentials = useCallback(async (url: string, token: string) => {
    await saveCredentials(url, token);
    setConnectionSetupOpen(false);
  }, [saveCredentials]);

  const handleUseDemoData = useCallback(() => {
    enableDemoMode();
    setConnectionSetupOpen(false);
  }, [enableDemoMode]);

  const getSimulatedEntities = useCallback((prefix: string) => {
    return simulationEntities.filter((entity) => entity.id.startsWith(prefix));
  }, [simulationEntities]);

  const addSimulation = useCallback((type: SimulationType) => {
    const prefix = simulationPrefixes[type];
    const existing = getSimulatedEntities(prefix);

    if (type === 'release') {
      existing
        .filter((entity) => entity.id !== prefix)
        .forEach((entity) => setMockEntity(entity.id, null));
      setMockEntity(prefix, createSimulatedActivityEntity(type, prefix));
      return;
    }

    if (existing.length === 0) {
      setMockEntity(prefix, createSimulatedActivityEntity(type, prefix));
      return;
    }

    let counter = 2;
    while (existing.some((entity) => entity.id === `${prefix}_${counter}`)) {
      counter += 1;
    }

    setMockEntity(`${prefix}_${counter}`, createSimulatedActivityEntity(type, `${prefix}_${counter}`));
  }, [getSimulatedEntities, setMockEntity]);

  const removeLastSimulation = useCallback((type: SimulationType) => {
    const prefix = simulationPrefixes[type];
    const existing = getSimulatedEntities(prefix);
    if (existing.length === 0) return;
    setMockEntity(existing[existing.length - 1].id, null);
  }, [getSimulatedEntities, setMockEntity]);

  const toggleReleaseSimulation = useCallback(() => {
    const prefix = simulationPrefixes.release;
    const existing = getSimulatedEntities(prefix);

    if (existing.length > 0) {
      existing.forEach((entity) => setMockEntity(entity.id, null));
      return;
    }

    setMockEntity(prefix, createSimulatedActivityEntity('release', prefix));
  }, [getSimulatedEntities, setMockEntity]);

  const openSimulationList = useCallback((title: string, prefix: string) => {
    setSimulationModal({ title, prefix });
  }, []);

  const removeSimulationById = useCallback((id: string) => {
    setMockEntity(id, null);
  }, [setMockEntity]);

  useEffect(() => {
    if (panelMode) return;
    // Drilled into a detail row → header shows the row, back clears the drill.
    if (activeIntegration) {
      setHeader({
        title: activeIntegration.name,
        subtitle: 'Integrations',
        icon: activeIntegration.icon,
        onBack: () => setDetailId(null),
      });
      return;
    }
    setHeader({
      title: meta.title,
      subtitle: 'Settings',
      icon: meta.icon,
      onBack: () => router.push('/settings'),
      // On the full-page Home Center route the title lives in the top bar, so the
      // "Customize sections" cog rides there instead of next to an in-content title.
      primaryAction: slug === 'home-center' ? { icon: mdiCog, onClick: () => setSectionsEditorOpen(true) } : undefined,
    });
  }, [activeIntegration, meta.icon, meta.title, panelMode, router, setHeader, slug]);

  const connectionLabel = demoMode
    ? 'Demo data'
    : connecting
      ? 'Connecting'
      : connected
        ? 'Connected'
        : 'Offline';

  const actions = null;

  // ── Prototype debugging tool card groups (used standalone and merged) ───────
  const renderDashboardsCards = () => (
    <SettingsCard
      title="Device cards"
      description="Configure which entities appear on each device card in the dashboard."
    >
      <div className="space-y-ha-3">
        <div className="flex items-start gap-ha-4 px-ha-4 py-ha-3 rounded-ha-xl bg-surface-low">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Auto-configure entities</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Analyses all {devices.length} devices and automatically assigns entities to Primary, Secondary, or Hidden based on their domain and type.
            </p>
          </div>
          <button
            type="button"
            onClick={autoConfigureDevices}
            className="shrink-0 px-ha-3 py-ha-2 rounded-ha-lg text-sm font-semibold bg-fill-primary-normal text-ha-blue hover:bg-fill-primary-quiet transition-colors"
          >
            {configureStatus === 'done' ? 'Done ✓' : 'Configure'}
          </button>
        </div>
        <div className="flex items-start gap-ha-4 px-ha-4 py-ha-3 rounded-ha-xl bg-surface-low">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Reset dashboard</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Clears all entity configuration. Each device will show only its primary entity card.
            </p>
          </div>
          <button
            type="button"
            onClick={resetDashboard}
            className="shrink-0 px-ha-3 py-ha-2 rounded-ha-lg text-sm font-semibold text-text-secondary bg-surface-mid hover:bg-surface-lower transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </SettingsCard>
  );

  const renderThemeCards = () => (
    <>
      <SettingsCard title="Immersive Mode" description="Expand dashboard content edge-to-edge for a cleaner shell on desktop and mobile. On by default on mobile.">
        <ToggleRow
          label="Immersive mode"
          description="Keep content expanded and reduce surrounding chrome while moving through subviews."
          checked={immersiveMode}
          onToggle={() => setImmersiveMode(!immersiveMode)}
        />
      </SettingsCard>

      <SettingsCard title="Color Mode" description="Switch the dashboard between light, dark, or device-following color modes.">
        <ChoiceGroup<ColorMode>
          label="Color mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'light', label: 'Light', caption: 'Always bright' },
            { value: 'dark', label: 'Dark', caption: 'Always dim' },
            { value: 'system', label: 'System', caption: 'Follow device preference' },
          ]}
        />
      </SettingsCard>

      <SettingsCard title="Theme Appearance" description="Cycle between the visual treatments used during dashboard design reviews.">
        <ChoiceGroup<Theme>
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={THEMES.map((entry) => ({
            value: entry,
            label: themeLabels[entry],
            caption: entry === 'glass' ? 'Layered and airy' : entry === 'eink' ? 'Paper-like contrast' : 'Ready to use',
          }))}
        />
      </SettingsCard>

      <SettingsCard title="Typeface" description="Swap the base UI font live. Every option is SIL OFL licensed — free to ship in Home Assistant with no licensing strings. Themed faces (Cyberpunk, Material, etc.) keep their own type. Shortcut: ⌘/Ctrl+Shift+F cycles fonts.">
        <ChoiceGroup<string>
          label="Font"
          value={font}
          onChange={setFont}
          options={fonts.map((entry) => ({
            value: entry.key,
            label: entry.label,
            caption: entry.caption,
          }))}
        />
      </SettingsCard>

      <SettingsCard title="Background" description="Set the dashboard backdrop without returning to the home screen.">
        <div className="space-y-ha-4">
          <ChoiceGroup<Background>
            label="Background"
            value={background}
            onChange={setBackground}
            options={[
              { value: 'gradient', label: 'Gradient', caption: 'Atmospheric surfaces' },
              { value: 'image', label: 'Image', caption: 'Large visual backdrop' },
              { value: 'pulse', label: 'Pulse', caption: 'Animated rings that react to your home' },
              { value: 'none', label: 'None', caption: 'Flat surfaces only' },
            ]}
          />
          {background === 'pulse' && (
            <div className="rounded-ha-2xl border border-surface-lower bg-surface-low/40 px-ha-4 py-ha-3">
              <ToggleRow
                label="Pulse on device toggles"
                description="Ripple a coloured wave across the wallpaper whenever a device turns on or off, or goes unavailable — gold for on, blue for off, red for errors."
                checked={pulseWallpaperReactive}
                onToggle={togglePulseWallpaperReactive}
              />
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Screensaver" description="Preview the idle clock state from settings instead of from the dashboard itself.">
        <ToggleRow
          label="Screensaver preview"
          description="Activate the full-screen clock now, or dismiss it if you are already previewing it."
          checked={screensaverActive}
          onToggle={screensaverActive ? dismissScreensaver : activateScreensaver}
        />
      </SettingsCard>

      <SettingsCard title="Desktop Split View" description="Keep the workspace split shortcut available without surfacing it on the dashboard.">
        <ToggleRow
          label="Desktop split view"
          description="Enable the split-workspace entry points used when comparing dashboards side by side."
          checked={desktopSplitViewEnabled}
          onToggle={toggleDesktopSplitView}
        />
      </SettingsCard>

      <SettingsCard title="Off-screen Change Hints" description="Surface a glowing cue at the dashboard edge when a card scrolled out of view changes state.">
        <ToggleRow
          label="Edge change hints"
          description="Pulse a bar at the top or bottom edge, aligned with the changed card. Tap it to scroll the card into view."
          checked={offscreenChangeHintsEnabled}
          onToggle={toggleOffscreenChangeHints}
        />
      </SettingsCard>

      <SettingsCard title="Scroll Index" description="Show a section scrubber on the right edge of the dashboard for jumping between rooms or types.">
        <ToggleRow
          label="Scroll index rail"
          description="A thin rail of section ticks that fades in while scrolling. Drag it to scrub, with a preview bubble showing the section name."
          checked={scrollIndexEnabled}
          onToggle={toggleScrollIndex}
        />
      </SettingsCard>
    </>
  );

  const renderTaskBarCards = () => (
    <>
      {taskBarActivityDefinitions.map((definition) => {
        const prefix = simulationPrefixes[definition.type];
        const count = getSimulatedEntities(prefix).length;

        return (
          <SettingsCard key={definition.type} title={definition.title} description={definition.description}>
            <div className="space-y-ha-4">
              <div className="flex items-start gap-ha-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                  <Icon path={definition.icon} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary">{definition.formatState(count)}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {count > 0
                      ? `${count} simulated ${count === 1 ? 'entity is' : 'entities are'} active for this task.`
                      : 'No simulated entities are active right now.'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-ha-2">
                {definition.singleToggle ? (
                  <ActionButton
                    label={count > 0 ? 'Clear activity' : 'Enable activity'}
                    onClick={toggleReleaseSimulation}
                    tone={count > 0 ? 'danger' : 'primary'}
                  />
                ) : (
                  <>
                    <ActionButton
                      label="Add activity"
                      onClick={() => addSimulation(definition.type)}
                      tone="primary"
                    />
                    <ActionButton
                      label="Remove last"
                      onClick={() => removeLastSimulation(definition.type)}
                      tone="danger"
                      disabled={count === 0}
                    />
                  </>
                )}
                <ActionButton
                  label="Review list"
                  onClick={() => openSimulationList(definition.reviewTitle, prefix)}
                />
              </div>
            </div>
          </SettingsCard>
        );
      })}
    </>
  );

  const renderMaintenanceCards = () => (
    <>
      <SettingsCard title="Connect My Data" description="Open the Home Assistant setup flow without leaving profile settings.">
        <div className="space-y-ha-4">
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3">
            <div className="flex items-center gap-ha-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                <Icon path={mdiHomeAssistant} size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  {connected && !demoMode ? 'Live Home Assistant connected' : 'Connection setup ready'}
                </div>
                <div className="text-sm text-text-secondary">
                  {demoMode ? 'Demo mode is active until you connect to a real instance.' : haUrl || 'Saved credentials appear here after a successful connection.'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-ha-2">
            <ActionButton
              label={connected && !demoMode ? 'Reconnect live data' : 'Open connection setup'}
              onClick={() => setConnectionSetupOpen(true)}
              tone="primary"
            />
            <ActionButton
              label="Use demo data"
              onClick={handleUseDemoData}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={demoMode ? 'Reload Demo Data' : 'Disconnect to Demo'} description="Refresh the sample home or step back out of the live connection without searching through the dashboard.">
        <div className="space-y-ha-4">
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3">
            <div className="text-sm font-semibold text-text-primary">
              {demoMode ? 'Sample home is currently active' : 'Live connection is currently active'}
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              {demoMode
                ? 'Reload the demo entities if you want a clean prototype state.'
                : 'Switch back to the bundled demo home when you want broader UI coverage.'}
            </div>
          </div>

          <ActionButton
            label={demoMode ? 'Reload demo home' : 'Disconnect and use demo'}
            onClick={handleClearCredentials}
            tone={demoMode ? 'default' : 'danger'}
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Reset Layout" description="Restore the presentation defaults that used to be one tap from the dashboard.">
        <div className="space-y-ha-4">
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3">
            <div className="text-sm font-semibold text-text-primary">Current dashboard preset</div>
            <div className="mt-1 text-sm text-text-secondary">
              {`${themeLabels[theme]} theme · ${mode === 'system' ? 'System mode' : `${formatLabel(mode)} mode`} · ${backgroundLabels[background]} background`}
            </div>
          </div>

          <ActionButton
            label="Restore dashboard defaults"
            onClick={resetLayoutToDefaults}
            tone="primary"
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Devices Dashboard" description="Reset the card order, visibility, and column widths you've customised in the Devices dashboard back to their defaults.">
        <ActionButton
          label={devicesDashboardResetDone ? 'Reset complete' : 'Reset devices layout'}
          onClick={resetDevicesDashboard}
          tone={devicesDashboardResetDone ? 'default' : 'danger'}
        />
      </SettingsCard>
    </>
  );

  const renderDeveloperCards = () => (
    <SettingsCard title="Preview controls" description="These toggles are useful when shaping the prototype experience.">
      <div className="space-y-ha-3">
        <ToggleRow
          label="Debug badges"
          description="Expose small diagnostic hints on cards and settings rows."
          checked={debugBadgesEnabled}
          onToggle={() => setDebugBadgesEnabled((value) => !value)}
        />
        <ToggleRow
          label="Mock latency"
          description="Add a small artificial delay to make loading and response states easier to review."
          checked={mockLatencyEnabled}
          onToggle={() => setMockLatencyEnabled((value) => !value)}
        />
        <ToggleRow
          label="Demo data mode"
          description="Return to the bundled sample home for broader coverage during UI review."
          checked={demoMode}
          onToggle={() => { if (!demoMode) enableDemoMode(); }}
        />
        <ToggleRow
          label="Wavy screensaver background"
          description="Use the squiggly rippling rings instead of the original perfect concentric circles on the screensaver."
          checked={wavyBackgroundEnabled}
          onToggle={toggleWavyBackground}
        />
        <ToggleRow
          label="Reactive screensaver background"
          description="Spawn a coloured ripple in the background when something happens at home — gold for on, blue for off, red for errors, amber for sensor jumps."
          checked={reactiveBackgroundEnabled}
          onToggle={toggleReactiveBackground}
        />
        {reactiveBackgroundEnabled && (
          <div className="rounded-ha-2xl border border-surface-lower bg-surface-low/40 px-ha-4 py-ha-4 space-y-ha-4">
            <ChoiceGroup
              label="React to"
              value={reactiveTriggerMode}
              onChange={setReactiveTriggerMode}
              options={[
                { value: 'toggles-errors', label: 'Toggles & errors', caption: 'On/off changes plus devices going unavailable' },
                { value: 'all', label: 'All changes', caption: 'Every change, including significant sensor jumps' },
                { value: 'errors', label: 'Errors only', caption: 'Only when a device goes unavailable' },
              ]}
            />
            <ChoiceGroup
              label="Ripple intensity"
              value={reactiveIntensity}
              onChange={setReactiveIntensity}
              options={[
                { value: 'subtle', label: 'Subtle tint', caption: 'Faint coloured line, ambient' },
                { value: 'bold', label: 'Bold bloom', caption: 'Bright, thicker ripple that pops' },
              ]}
            />
          </div>
        )}
      </div>
    </SettingsCard>
  );

  // ── Integrations (master-detail drill-down example) ───────────────────────
  // Sits before the haPath placeholder so this real table replaces the stub.
  if (slug === 'integrations') {
    // Full-page route: AppSurfacePage's root is `flex-1 min-h-0` and must be a
    // direct flex child of the AppShell column to get a bounded height (and thus
    // an inner scroll). This animation wrapper sits between them, so it has to
    // forward that flex sizing or the scroll container collapses and the page
    // can't scroll. In panelMode the wrapper lives inside a ScrollColumn and
    // needs no sizing.
    const paneFill = panelMode ? '' : 'flex flex-col flex-1 min-h-0';
    // Re-key on drill so the pane animates: detail slides in from the right,
    // the list slides back in from the left when you go back.
    if (activeIntegration) {
      return (
        <div key={`detail:${activeIntegration.id}`} className={`ha-pane-in ${paneFill}`}>
          <SettingsShell panelMode={panelMode} title={activeIntegration.name} onBack={() => setDetailId(null)}>
            <IntegrationDetailView integration={activeIntegration} />
          </SettingsShell>
        </div>
      );
    }
    return (
      <div key="list" className={`ha-pane-in ha-pane-in--back ${paneFill}`}>
        <SettingsShell panelMode={panelMode} title={meta.title}>
          <IntegrationsTable integrations={integrations} onSelect={setDetailId} />
        </SettingsShell>
      </div>
    );
  }

  // ── HA settings placeholder ───────────────────────────────────────────────
  if (navItem?.haPath) {
    return (
      <SettingsShell panelMode={panelMode} title={meta.title}>
        <div className="flex items-start gap-ha-4 p-ha-5 bg-fill-primary-quiet rounded-ha-2xl border border-ha-blue/15">
          <div className="w-10 h-10 rounded-ha-xl bg-ha-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon path={navItem.icon} size={20} className="text-ha-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary mb-ha-1">{navItem.label}</p>
            <p className="text-sm text-text-secondary mb-ha-4">{navItem.description}</p>
            <p className="text-[13px] text-text-tertiary mb-ha-3">
              In production this page connects to Home Assistant at:
            </p>
            <div className="flex items-center gap-ha-2 px-ha-3 py-ha-2 bg-surface-low rounded-ha-xl border border-surface-lower inline-flex w-fit">
              <Icon path={mdiHomeAssistant} size={14} className="text-text-tertiary flex-shrink-0" />
              <code className="text-xs text-text-secondary font-mono">{navItem.haPath}</code>
              <Icon path={mdiOpenInNew} size={12} className="text-text-disabled flex-shrink-0" />
            </div>
          </div>
        </div>
      </SettingsShell>
    );
  }

  if (slug === 'home-center') {
    // Each Home Center section deep-links to its settings home. Device-health
    // sections point at Devices/Entities (where you triage them); notifications,
    // updates, repairs and connectivity have their own status pages.
    const sectionSlug: Record<HomeCenterSection, SettingsSlug> = {
      notifications: 'notifications',
      updates: 'updates',
      repairs: 'repairs',
      issues: 'devices',
      battery: 'entities',
      backups: 'backups',
      connectivity: 'connectivity',
    };
    return (
      <>
        <SettingsShell
          panelMode={panelMode}
          title={meta.title}
          titleAction={
            <button
              type="button"
              onClick={() => setSectionsEditorOpen(true)}
              aria-label="Customize sections"
              title="Customize sections"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
            >
              <Icon path={mdiCog} size={20} />
            </button>
          }
        >
          <SystemStatusPanel onNavigate={(target) => router.push(`/settings/${sectionSlug[target]}`)} />
        </SettingsShell>
        <HomeCenterSectionsModal open={sectionsEditorOpen} onClose={() => setSectionsEditorOpen(false)} />
      </>
    );
  }

  if (slug === 'notifications' || slug === 'updates' || slug === 'repairs' || slug === 'connectivity') {
    return (
      <SettingsShell panelMode={panelMode} title={meta.title}>
        <SystemStatusPanel focus={slug} />
      </SettingsShell>
    );
  }

  if (slug === 'developer') {
    return (
      <>
        <SettingsShell panelMode={panelMode} title={meta.title}>
          <div className="space-y-ha-8">
            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Dashboards</SectionLabel>
              {renderDashboardsCards()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Theme and Display</SectionLabel>
              {renderThemeCards()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Task Bar Activities</SectionLabel>
              {renderTaskBarCards()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Maintenance</SectionLabel>
              {renderMaintenanceCards()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Developer Tools</SectionLabel>
              {renderDeveloperCards()}
            </div>
          </div>
        </SettingsShell>

        {simulationModal && (
          <SimulationListModal
            isOpen={true}
            onClose={() => setSimulationModal(null)}
            title={simulationModal.title}
            items={getSimulatedEntities(simulationModal.prefix)}
            onRemove={removeSimulationById}
          />
        )}

        {connectionSetupOpen && (
          <SetupScreen
            onSave={handleSaveCredentials}
            onUseDemo={handleUseDemoData}
            error={connectionError}
            connecting={connecting}
            onClose={() => setConnectionSetupOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <SettingsShell panelMode={panelMode} title={meta.title}>
      {renderDeveloperCards()}
    </SettingsShell>
  );
}
