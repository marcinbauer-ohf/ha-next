'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { Icon } from '../ui/Icon';
import { SectionLabel, useIconSet, setIconSet, type IconSet } from '../ui';
import { SimulationListModal } from '@/components/ui/SimulationListModal';
import { SystemStatusPanel, type HomeCenterSection } from '@/components/ui/SystemStatusPanel';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { useHeader, useScreensaver, useAddContext, useDebugFlags, type BreadcrumbItem } from '@/contexts';
import { useFeatureFlags, useHomeAssistant, useHomeAssistantSelector, useImmersiveMode, useTheme, useFont, useDeviceStructure, useDeviceCardConfig, useIntegrations, useDevicesList, useAutomations } from '@/hooks';
import { IntegrationsTable, IntegrationDetailView } from './IntegrationsPanel';
import { DevicesTable, DeviceDetailView } from './DevicesPanel';
import { AutomationsTable } from './AutomationsPanel';
import { AreasFloorsPanel } from './AreasFloorsPanel';
import { AutomationEditor } from './AutomationEditor';
import { HomeCenterSectionsModal } from './HomeCenterSectionEditor';
import { TOGGLEABLE } from '@/lib/homeassistant/entityHelpers';
import type { EntitySlot, EntitySection } from '@/hooks/useDeviceCardConfig';
import { THEMES, type Background, type ColorMode, type Theme } from '@/hooks/useTheme';
import { useDogEarConfig } from '@/hooks/useDogEarConfig';
import { DOG_EAR_ACTIONS } from '@/lib/dogEarActions';
import { areSimulationEntitiesEqual, selectSimulationEntities, selectWeatherOptions, areWeatherOptionsEqual } from '@/lib/homeassistant/selectors';
import { Dropdown } from '../ui/Dropdown';
import { useHaptics } from '@/lib/haptics';
import { createSimulatedActivityEntity, simulationPrefixes, type SimulationType } from '@/lib/homeassistant/simulatedActivities';
import { type SettingsSlug, allSettingsLinks } from './settingsNavigation';
import {
  mdiAlphaDBox,
  mdiCctv,
  mdiChevronLeft,
  mdiCog,
  mdiHomeAssistant,
  mdiInformation,
  mdiInformationOutline,
  mdiOpenInNew,
  mdiPlay,
  mdiPrinter3d,
  mdiRobot,
  mdiTimerOutline,
  mdiUpdate,
} from '@mdi/js';
import pkgInfo from '../../../package.json';

interface SettingsDetailPageProps {
  slug: SettingsSlug;
  panelMode?: boolean;
  /**
   * Fired when a focused editor (e.g. the automation editor) opens or closes,
   * so the two-column settings page can slide its nav column away.
   */
  onEditorFocusChange?: (focused: boolean) => void;
  /**
   * In the two-column workspace, selecting a Home Center section should swap the
   * active section in place (left-nav selection + right column) instead of
   * navigating to the standalone single-column route. When omitted (standalone
   * route), section links fall back to `router.push`.
   */
  onSelectSection?: (slug: SettingsSlug) => void;
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
  fill,
}: {
  children: React.ReactNode;
  panelMode?: boolean;
  title?: string;
  /** Optional control rendered at the end of the title row (panel mode), e.g. a cog. */
  titleAction?: React.ReactNode;
  /** When set (panel mode), the title becomes a back affordance: chevron + title. */
  onBack?: () => void;
  /**
   * Fill the available height and let the child own its scroll (a single fixed
   * card whose contents scroll, not the page). The child must handle scrolling —
   * e.g. DataListView's `fillHeight`.
   */
  fill?: boolean;
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
      <div ref={rootRef} className={fill ? 'flex h-full min-h-0 flex-col' : undefined}>
        {(onBack || title) && (
          // Sticky title — stays pinned while content scrolls under it. A list's
          // own sticky search stacks just beneath via `--settings-header-h`. The
          // `pt-ha-1` lives *inside* the sticky (not on the scroll root) so there's
          // no scrollable gap above it — otherwise the header drifts ~4px before
          // pinning. It still aligns the title with the nav column's search field.
          <div className="sticky top-0 z-20">
            <div ref={titleRef} className="flex items-center justify-between gap-ha-3 bg-surface-lower pt-ha-1 pb-ha-3">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="group flex items-center gap-ha-2 -ml-ha-1 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary transition-colors group-hover:bg-surface-low group-hover:text-text-primary">
                    <Icon path={mdiChevronLeft} size={22} />
                  </span>
                  <h1 className="text-2xl leading-none font-semibold text-text-primary capitalize">{title}</h1>
                </button>
              ) : (
                <h1 className="text-2xl leading-none font-semibold text-text-primary capitalize px-ha-1">{title}</h1>
              )}
              {titleAction}
            </div>
          </div>
        )}
        <div className={fill ? 'flex min-h-0 flex-1 flex-col' : 'space-y-ha-6'}>{children}</div>
      </div>
    );
  }

  return (
    <AppSurfacePage scrollClassName={fill ? 'h-full flex flex-col min-h-0' : ''}>
      {/* `--list-top-pad` mirrors <main>'s top padding (pt-ha-4 / lg:pt-ha-5) so a
          list's sticky search can absorb it and pin under the top bar without drift. */}
      <div
        className={`max-w-[1240px] mx-auto lg:px-ha-8 w-full [--list-top-pad:var(--ha-space-4)] lg:[--list-top-pad:var(--ha-space-5)] ${
          fill ? 'flex min-h-0 flex-1 flex-col' : 'space-y-ha-6'
        }`}
      >
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
                  ? 'border-transparent bg-surface-mid text-ha-blue'
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

// Label + description on the left, a single action button on the right. Used to
// stack maintenance/reset actions inside one card instead of one card per action.
function ActionRow({
  label,
  description,
  buttonLabel,
  onClick,
  tone = 'default',
}: {
  label: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
}) {
  return (
    <div className="flex flex-col gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{description}</div>
      </div>
      <div className="shrink-0">
        <ActionButton label={buttonLabel} onClick={onClick} tone={tone} />
      </div>
    </div>
  );
}

// One read-only label/value line for the Diagnostics card.
function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-ha-4 px-ha-4 py-ha-3">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-sm font-medium text-text-primary">{value}</dd>
    </div>
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

const themeCaptions: Partial<Record<Theme, string>> = {
  glass: 'Layered and airy',
  eink: 'Paper-like contrast',
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
    description: 'Data, appearance, behavior, and prototyping flags — every preview-only tool on one page.',
    icon: mdiAlphaDBox,
    eyebrow: 'Preview',
    accentClassName: 'border-orange-500/20',
  },
};

export function SettingsDetailPage({ slug, panelMode, onEditorFocusChange, onSelectSection }: SettingsDetailPageProps) {
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
  const { desktopSplitViewEnabled, toggleDesktopSplitView, offscreenChangeHintsEnabled, toggleOffscreenChangeHints, scrollIndexEnabled, toggleScrollIndex, wavyBackgroundEnabled, toggleWavyBackground, reactiveBackgroundEnabled, toggleReactiveBackground, reactiveTriggerMode, setReactiveTriggerMode, reactiveIntensity, setReactiveIntensity, reactiveTriggerLabelsEnabled, toggleReactiveTriggerLabels, pulseWallpaperReactive, togglePulseWallpaperReactive, pulseMode, setPulseMode, weatherEntityId, setWeatherEntityId, fastScrollLabelsEnabled, toggleFastScrollLabels } = useFeatureFlags();
  const { theme, mode, background, setTheme, setMode, setBackground } = useTheme();
  const iconSet = useIconSet();
  const { font, fonts, setFont } = useFont();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled, supported: hapticsSupported } = useHaptics();
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
  const { config: dogEarConfig, setCorner: setDogEarCorner } = useDogEarConfig();
  const simulationEntities = useHomeAssistantSelector(selectSimulationEntities, areSimulationEntitiesEqual);
  const weatherOptions = useHomeAssistantSelector(selectWeatherOptions, areWeatherOptionsEqual);

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
  // The row last drilled into. Unlike `detailId` it survives going back, so the
  // list can mark which item you just returned from. Cleared on section change.
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setLastOpenedId(id);
  }, []);
  // Reset the drill-down whenever the settings section changes — adjusted during
  // render (React's recommended pattern) rather than in an effect.
  const [drillSlug, setDrillSlug] = useState(slug);
  if (slug !== drillSlug) {
    setDrillSlug(slug);
    setDetailId(null);
    setLastOpenedId(null);
  }

  // Automation editor's "Info" panel visibility, toggled from the top-bar info
  // icon. Default-open on desktop (it's a docked sidebar) but default-closed on
  // mobile, where it's a bottom sheet that should only appear on an explicit tap.
  // Re-evaluated (render-phase, so no flash) each time a different automation
  // opens; the matchMedia read is client-only and runs post-hydration.
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoForId, setInfoForId] = useState<string | null>(null);
  if (detailId !== infoForId) {
    setInfoForId(detailId);
    setInfoOpen(
      (slug === 'automations' || slug === 'devices') && detailId != null &&
        typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
    );
  }
  const activeIntegration = slug === 'integrations' && detailId
    ? integrations.find((i) => i.id === detailId) ?? null
    : null;
  const { devices: deviceList } = useDevicesList();
  const activeDevice = slug === 'devices' && detailId
    ? deviceList.find((d) => d.id === detailId) ?? null
    : null;
  const { automations } = useAutomations();
  const activeAutomation = slug === 'automations' && detailId
    ? automations.find((a) => a.id === detailId) ?? null
    : null;

  // Let the settings workspace collapse its nav column while a focused editor
  // is open. Reset on unmount so leaving the section restores the column.
  const editorFocused = !!activeAutomation;
  useEffect(() => {
    onEditorFocusChange?.(editorFocused);
    return () => onEditorFocusChange?.(false);
  }, [editorFocused, onEditorFocusChange]);

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

  const { debugBadgesEnabled, toggleDebugBadges, mockLatencyEnabled, toggleMockLatency } = useDebugFlags();
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
    // Top-bar breadcrumb trail for a drilled-in detail. "Settings" is ambient
    // page context in the two-column workspace (static crumb) but a real link
    // back to the settings home on the full-page route; the section crumb always
    // clears the drill back to its list.
    const detailCrumbs = (sectionLabel: string): BreadcrumbItem[] => [
      // Two-column workspace: jump back to the default section (Home Center) in
      // place. Full-page route: navigate to the settings home.
      { label: 'Settings', onClick: panelMode ? () => onSelectSection?.('home-center') : () => router.push('/settings') },
      { label: sectionLabel, onClick: () => setDetailId(null) },
    ];

    if (panelMode) {
      // Two-column workspace: the top bar normally reads "Settings". A nav item
      // is always open at the section root, so no back arrow there. Drilling
      // DEEPER into a detail pane (integration / device / automation editor)
      // promotes that row's name to the title and shows a back arrow that clears
      // the drill (returning to the section's list).
      if (activeAutomation) {
        setHeader({
          title: activeAutomation.name,
          subtitle: 'Settings',
          breadcrumbs: detailCrumbs('Automations'),
          icon: mdiRobot,
          onBack: () => setDetailId(null),
          primaryAction: { icon: infoOpen ? mdiInformation : mdiInformationOutline, onClick: () => setInfoOpen((v) => !v) },
        });
      } else if (activeDevice) {
        setHeader({
          title: activeDevice.name,
          subtitle: 'Settings',
          breadcrumbs: detailCrumbs('Devices'),
          icon: activeDevice.icon,
          onBack: () => setDetailId(null),
          primaryAction: { icon: infoOpen ? mdiInformation : mdiInformationOutline, onClick: () => setInfoOpen((v) => !v) },
        });
      } else if (activeIntegration) {
        setHeader({ title: activeIntegration.name, subtitle: 'Settings', breadcrumbs: detailCrumbs('Integrations'), icon: activeIntegration.icon, onBack: () => setDetailId(null) });
      } else {
        // Section root: the selected nav item owns the title with "Settings" as
        // the eyebrow above it. Back returns to wherever you opened settings from
        // (a dashboard or app) — section switches happen in the nav column and
        // don't push history, so `router.back()` skips straight past them.
        setHeader({
          title: meta.title,
          subtitle: 'Settings',
          icon: meta.icon,
          onBack: () => router.back(),
        });
      }
      return;
    }
    // Drilled into a detail row → header shows the row, back clears the drill.
    if (activeIntegration) {
      setHeader({
        title: activeIntegration.name,
        subtitle: 'Integrations',
        breadcrumbs: detailCrumbs('Integrations'),
        icon: activeIntegration.icon,
        onBack: () => setDetailId(null),
      });
      return;
    }
    if (activeDevice) {
      setHeader({
        title: activeDevice.name,
        subtitle: 'Devices',
        breadcrumbs: detailCrumbs('Devices'),
        icon: activeDevice.icon,
        onBack: () => setDetailId(null),
        primaryAction: { icon: infoOpen ? mdiInformation : mdiInformationOutline, onClick: () => setInfoOpen((v) => !v) },
      });
      return;
    }
    if (activeAutomation) {
      setHeader({
        title: activeAutomation.name,
        subtitle: 'Automations',
        breadcrumbs: detailCrumbs('Automations'),
        icon: mdiRobot,
        onBack: () => setDetailId(null),
        primaryAction: { icon: infoOpen ? mdiInformation : mdiInformationOutline, onClick: () => setInfoOpen((v) => !v) },
      });
      return;
    }
    setHeader({
      title: meta.title,
      subtitle: 'Settings',
      icon: meta.icon,
      onBack: () => router.push('/settings'),
    });
  }, [activeAutomation, activeDevice, activeIntegration, infoOpen, meta.icon, meta.title, onSelectSection, panelMode, router, setHeader, slug]);

  const connectionLabel = demoMode
    ? 'Demo data'
    : connecting
      ? 'Connecting'
      : connected
        ? 'Connected'
        : 'Offline';

  // ── Prototype debugging tool card groups (used standalone and merged) ───────

  // Data source + read-only diagnostics. The old page had three places that
  // talked about demo/live (Connect, Reload Demo, and a "Demo data mode" toggle);
  // they're merged here into one status + action block plus a diagnostics readout.
  const renderDataCards = () => {
    const totalEntities = devices.reduce((sum, device) => sum + device.entities.length, 0);
    return (
      <>
        <SettingsCard
          title="Data source"
          description="Connect a live Home Assistant instance or fall back to the bundled demo home."
        >
          <div className="space-y-ha-4">
            <div className="flex items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-low/50 px-ha-4 py-ha-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                <Icon path={mdiHomeAssistant} size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">
                  {demoMode ? 'Demo home active' : connected ? 'Live Home Assistant connected' : 'Not connected'}
                </div>
                <div className="truncate text-sm text-text-secondary">
                  {demoMode ? 'Sample data — connect to use your real instance.' : haUrl || 'Saved credentials appear here after connecting.'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-ha-2">
              <ActionButton
                label={connected && !demoMode ? 'Reconnect live data' : 'Connect live data'}
                onClick={() => setConnectionSetupOpen(true)}
                tone="primary"
              />
              {demoMode ? (
                <ActionButton label="Reload demo home" onClick={handleClearCredentials} />
              ) : (
                <>
                  <ActionButton label="Disconnect to demo" onClick={handleClearCredentials} tone="danger" />
                  <ActionButton label="Use demo data" onClick={handleUseDemoData} />
                </>
              )}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Diagnostics" description="Read-only snapshot of the current build and connection.">
          <dl className="divide-y divide-surface-lower overflow-hidden rounded-ha-2xl border border-surface-lower">
            <DiagnosticRow label="App version" value={pkgInfo.version} />
            <DiagnosticRow label="Data source" value={connectionLabel} />
            <DiagnosticRow label="Instance URL" value={demoMode ? 'Demo' : haUrl || '—'} />
            <DiagnosticRow label="Devices" value={String(devices.length)} />
            <DiagnosticRow label="Entities" value={String(totalEntities)} />
            <DiagnosticRow label="Simulated entities" value={String(simulationEntities.length)} />
          </dl>
        </SettingsCard>
      </>
    );
  };

  // Pure visual treatment — every choice group stacked in a single card instead
  // of one card per setting (color mode, theme, font, background each used to be
  // its own full card).
  const renderAppearanceCard = () => (
    <SettingsCard title="Appearance" description="Visual treatment of the dashboard — applied live.">
      <div className="space-y-ha-6">
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
        <ChoiceGroup<Theme>
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={THEMES.map((entry) => ({
            value: entry,
            label: themeLabels[entry],
            caption: themeCaptions[entry] ?? 'Ready to use',
          }))}
        />
        <ChoiceGroup<string>
          label="Typeface · ⌘/Ctrl+Shift+F cycles"
          value={font}
          onChange={setFont}
          options={fonts.map((entry) => ({
            value: entry.key,
            label: entry.label,
            caption: entry.caption,
          }))}
        />
        <ChoiceGroup<IconSet>
          label="Icon set · debug"
          value={iconSet}
          onChange={setIconSet}
          options={[
            { value: 'mdi', label: 'Material (MDI)', caption: 'Default — filled glyphs, full coverage' },
            { value: 'phosphor', label: 'Phosphor', caption: 'Closest coverage to MDI, fewest fallbacks' },
            { value: 'lucide', label: 'Lucide', caption: 'Thin stroke outlines — most visible contrast' },
            { value: 'tabler', label: 'Tabler', caption: 'Stroke, consistent 24px grid' },
          ]}
        />
        <div className="space-y-ha-3">
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
            <ToggleRow
              label="Pulse on device toggles"
              description="Ripple a coloured wave across the wallpaper whenever a device turns on or off, or goes unavailable — gold for on, blue for off, red for errors."
              checked={pulseWallpaperReactive}
              onToggle={togglePulseWallpaperReactive}
            />
          )}
        </div>
      </div>
    </SettingsCard>
  );

  // The two folded-corner shortcuts, merged from two single-choice cards.
  const renderCornerCard = () => (
    <SettingsCard
      title="Corner shortcuts"
      description="Folded-corner shortcuts on every dashboard surface. Hover (desktop) or press-and-hold (touch) reveals them."
    >
      <div className="space-y-ha-6">
        <ChoiceGroup<string>
          label="Top-left action"
          value={dogEarConfig.left}
          onChange={(id) => setDogEarCorner('left', id as (typeof DOG_EAR_ACTIONS)[number]['id'])}
          options={DOG_EAR_ACTIONS.map((a) => ({ value: a.id, label: a.label, caption: a.description }))}
        />
        <ChoiceGroup<string>
          label="Top-right action"
          value={dogEarConfig.right}
          onChange={(id) => setDogEarCorner('right', id as (typeof DOG_EAR_ACTIONS)[number]['id'])}
          options={DOG_EAR_ACTIONS.map((a) => ({ value: a.id, label: a.label, caption: a.description }))}
        />
      </div>
    </SettingsCard>
  );

  // Interaction/motion behavior toggles — six single-toggle cards collapsed into
  // one stack of rows.
  const renderBehaviorCard = () => (
    <SettingsCard title="Dashboard behavior" description="Interaction and motion behaviors across the dashboard.">
      <div className="space-y-ha-3">
        <ToggleRow
          label="Immersive mode"
          description="Expand content edge-to-edge and reduce surrounding chrome. On by default on mobile."
          checked={immersiveMode}
          onToggle={() => setImmersiveMode(!immersiveMode)}
        />
        <ToggleRow
          label="Edge change hints"
          description="Pulse a bar at the top or bottom edge when an off-screen card changes. Tap it to scroll the card into view."
          checked={offscreenChangeHintsEnabled}
          onToggle={toggleOffscreenChangeHints}
        />
        <ToggleRow
          label="Scroll index rail"
          description="A thin rail of section ticks that fades in while scrolling. Drag to scrub between rooms or types."
          checked={scrollIndexEnabled}
          onToggle={toggleScrollIndex}
        />
        <ToggleRow
          label="Fast-scroll name labels · prototype"
          description="While you flick a dashboard fast, overlay each card with just its name (large) so you can read what's flying past. Detail returns the moment you slow down."
          checked={fastScrollLabelsEnabled}
          onToggle={toggleFastScrollLabels}
        />
        <ToggleRow
          label="Desktop split view"
          description="Enable the split-workspace entry points used when comparing dashboards side by side."
          checked={desktopSplitViewEnabled}
          onToggle={toggleDesktopSplitView}
        />
        <ToggleRow
          label="Haptic feedback"
          description={hapticsSupported
            ? 'Short vibrations confirm toggles, drops, and gestures. Android only.'
            : 'Not available in this browser (no Vibration API — e.g. iOS Safari). Kept for when you open on a supported device.'}
          checked={hapticsEnabled}
          onToggle={() => setHapticsEnabled(!hapticsEnabled)}
        />
      </div>
    </SettingsCard>
  );

  // Everything screensaver in one place — preview + both background flags + the
  // reactive sub-options. Previously the preview lived under "Theme and Display"
  // while wavy/reactive lived under "Developer Tools".
  const renderScreensaverCard = () => (
    <SettingsCard title="Screensaver" description="The idle full-screen clock and its animated background.">
      <div className="space-y-ha-3">
        <ToggleRow
          label="Screensaver preview"
          description="Activate the full-screen clock now, or dismiss it if you are already previewing it."
          checked={screensaverActive}
          onToggle={screensaverActive ? dismissScreensaver : activateScreensaver}
        />
        <ToggleRow
          label="Wavy background"
          description="Use squiggly rippling rings instead of perfect concentric circles."
          checked={wavyBackgroundEnabled}
          onToggle={toggleWavyBackground}
        />
        <ToggleRow
          label="Reactive background"
          description="Spawn a coloured ripple when something happens at home — gold for on, blue for off, red for errors, amber for sensor jumps."
          checked={reactiveBackgroundEnabled}
          onToggle={toggleReactiveBackground}
        />
        {reactiveBackgroundEnabled && (
          <div className="space-y-ha-4 rounded-ha-2xl border border-surface-lower bg-surface-low/40 px-ha-4 py-ha-4">
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
            <ToggleRow
              label="Show trigger labels"
              description="Name the entity behind each ripple in a small pill at the bottom of the screensaver."
              checked={reactiveTriggerLabelsEnabled}
              onToggle={toggleReactiveTriggerLabels}
            />
          </div>
        )}
        <ChoiceGroup
          label="Background style"
          value={pulseMode}
          onChange={setPulseMode}
          options={[
            { value: 'classic', label: 'Classic rings', caption: 'Endless concentric rings (original)' },
            { value: 'heartbeat', label: 'Heartbeat', caption: 'Calm lub-dub ping rings on a steady cadence' },
            { value: 'breathing', label: 'Breathing depth', caption: 'Layered soft rings that slowly inhale and exhale' },
            { value: 'aurora', label: 'Aurora', caption: 'Soft drifting ribbons of colour (northern lights)' },
            { value: 'bokeh', label: 'Bokeh', caption: 'Soft light orbs drifting slowly upward' },
            { value: 'dawn', label: 'Dawn', caption: 'A slow flowing colour wash, no hard shapes' },
            { value: 'breathOrb', label: 'Breath orb', caption: 'One soft glow gently expanding and contracting' },
            { value: 'weather', label: 'Weather', caption: 'Abstract, reactive ambience driven by a weather entity' },
          ]}
        />
        {pulseMode === 'weather' && (
          <div className="space-y-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-low/40 px-ha-4 py-ha-4">
            <div className="flex items-center justify-between gap-ha-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">Weather entity</p>
                <p className="text-[13px] text-text-secondary">
                  Drives the abstract weather wallpaper — temperature, clouds, rain, snow and wind.
                </p>
              </div>
              {weatherOptions.length > 0 ? (
                <Dropdown
                  options={weatherOptions}
                  value={weatherEntityId ?? weatherOptions[0].value}
                  onChange={setWeatherEntityId}
                  align="right"
                />
              ) : (
                <span className="shrink-0 text-sm text-text-disabled">No weather entities</span>
              )}
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );

  // Five per-activity cards condensed into one card of compact rows.
  const renderSimulatedActivityCard = () => (
    <SettingsCard title="Simulated activity" description="Inject mock task-bar activity to preview the activity surface.">
      <div className="space-y-ha-2">
        {taskBarActivityDefinitions.map((definition) => {
          const prefix = simulationPrefixes[definition.type];
          const count = getSimulatedEntities(prefix).length;

          return (
            <div
              key={definition.type}
              className="flex flex-col gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-ha-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                  <Icon path={definition.icon} size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary">{definition.title}</div>
                  <div className="truncate text-xs text-text-secondary">{definition.formatState(count)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-ha-2 sm:justify-end">
                {definition.singleToggle ? (
                  <ActionButton
                    label={count > 0 ? 'Clear' : 'Enable'}
                    onClick={toggleReleaseSimulation}
                    tone={count > 0 ? 'danger' : 'primary'}
                  />
                ) : (
                  <>
                    <ActionButton label="Add" onClick={() => addSimulation(definition.type)} tone="primary" />
                    <ActionButton
                      label="Remove"
                      onClick={() => removeLastSimulation(definition.type)}
                      tone="danger"
                      disabled={count === 0}
                    />
                  </>
                )}
                <ActionButton label="Review" onClick={() => openSimulationList(definition.reviewTitle, prefix)} />
              </div>
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );

  // All "reset/restore to defaults" actions, previously split between the
  // "Dashboards" and "Maintenance" sections.
  const renderResetsCard = () => (
    <SettingsCard title="Reset & restore" description="Roll dashboard customisations back to their defaults.">
      <div className="space-y-ha-2">
        <ActionRow
          label="Auto-configure device cards"
          description={`Analyse all ${devices.length} devices and assign entities to Primary, Secondary, or Hidden by domain and type.`}
          buttonLabel={configureStatus === 'done' ? 'Done ✓' : 'Configure'}
          onClick={autoConfigureDevices}
          tone="primary"
        />
        <ActionRow
          label="Reset device cards"
          description="Clear all entity configuration. Each device shows only its primary entity card."
          buttonLabel="Reset"
          onClick={resetDashboard}
        />
        <ActionRow
          label="Restore appearance defaults"
          description={`${themeLabels[theme]} · ${mode === 'system' ? 'System' : formatLabel(mode)} · ${backgroundLabels[background]} → Default · System · None.`}
          buttonLabel="Restore"
          onClick={resetLayoutToDefaults}
          tone="primary"
        />
        <ActionRow
          label="Reset devices dashboard"
          description="Restore card order, visibility, and column widths in the Devices dashboard."
          buttonLabel={devicesDashboardResetDone ? 'Reset complete' : 'Reset'}
          onClick={resetDevicesDashboard}
          tone="danger"
        />
      </div>
    </SettingsCard>
  );

  // Diagnostic overlays / simulated conditions. The old "Demo data mode" toggle
  // moved into the Data source card; screensaver flags moved to the screensaver
  // card — so this is now just the developer-only flags.
  const renderDeveloperFlagsCard = () => (
    <SettingsCard title="Developer flags" description="Diagnostic overlays and simulated conditions.">
      <div className="space-y-ha-3">
        <ToggleRow
          label="Debug badges"
          description="Expose small diagnostic hints on cards and settings rows."
          checked={debugBadgesEnabled}
          onToggle={toggleDebugBadges}
        />
        <ToggleRow
          label="Mock latency"
          description="Add a small artificial delay to make loading and response states easier to review."
          checked={mockLatencyEnabled}
          onToggle={toggleMockLatency}
        />
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
    // The list view fills the column and scrolls internally (fixed card); in
    // panelMode it fills `h-full`, on the full-page route `flex-1`.
    const listFill = panelMode ? 'flex flex-col h-full min-h-0' : 'flex flex-col flex-1 min-h-0';
    // Re-key on drill so the pane animates: detail slides in from the right,
    // the list slides back in from the left when you go back.
    if (activeIntegration) {
      return (
        <div key={`detail:${activeIntegration.id}`} className={`ha-pane-in ${paneFill}`}>
          {/* In panelMode the title rides the top bar (see header effect); only the
              full-page route needs the in-content title + back chevron. */}
          <SettingsShell panelMode={panelMode} title={panelMode ? undefined : activeIntegration.name} onBack={panelMode ? undefined : () => setDetailId(null)}>
            <IntegrationDetailView integration={activeIntegration} />
          </SettingsShell>
        </div>
      );
    }
    return (
      <div key="list" className={`ha-pane-in ha-pane-in--back ${listFill}`}>
        <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title} fill>
          <IntegrationsTable integrations={integrations} onSelect={openDetail} lastOpenedId={lastOpenedId} />
        </SettingsShell>
      </div>
    );
  }

  // ── Devices (master-detail drill-down) ────────────────────────────────────
  // Same shape as integrations; the detail pane is the device page (info card +
  // entities split into Controls / Sensors / Diagnostic).
  if (slug === 'devices') {
    const paneFill = panelMode ? '' : 'flex flex-col flex-1 min-h-0';
    const listFill = panelMode ? 'flex flex-col h-full min-h-0' : 'flex flex-col flex-1 min-h-0';
    if (activeDevice) {
      return (
        <div key={`detail:${activeDevice.id}`} className={`ha-pane-in ${paneFill}`}>
          <SettingsShell panelMode={panelMode} title={panelMode ? undefined : activeDevice.name} onBack={panelMode ? undefined : () => setDetailId(null)}>
            <DeviceDetailView device={activeDevice} infoOpen={infoOpen} onCloseInfo={() => setInfoOpen(false)} />
          </SettingsShell>
        </div>
      );
    }
    return (
      <div key="list" className={`ha-pane-in ha-pane-in--back ${listFill}`}>
        <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title} fill>
          <DevicesTable devices={deviceList} onSelect={openDetail} lastOpenedId={lastOpenedId} />
        </SettingsShell>
      </div>
    );
  }

  // ── Automations (master list → flow editor drill-down) ────────────────────
  // Same master-detail shape as integrations; the detail pane is the
  // When / And if / Then do editor with its node-config sidebar.
  if (slug === 'automations') {
    const paneFill = panelMode ? '' : 'flex flex-col flex-1 min-h-0';
    const listFill = panelMode ? 'flex flex-col h-full min-h-0' : 'flex flex-col flex-1 min-h-0';
    if (activeAutomation) {
      return (
        <div key={`detail:${activeAutomation.id}`} className={`ha-pane-in ${paneFill}`}>
          <SettingsShell panelMode={panelMode} title={panelMode ? undefined : activeAutomation.name} onBack={panelMode ? undefined : () => setDetailId(null)}>
            <AutomationEditor key={activeAutomation.id} automation={activeAutomation} onExit={() => setDetailId(null)} infoOpen={infoOpen} onCloseInfo={() => setInfoOpen(false)} />
          </SettingsShell>
        </div>
      );
    }
    return (
      <div key="list" className={`ha-pane-in ha-pane-in--back ${listFill}`}>
        <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title} fill>
          <AutomationsTable automations={automations} onSelect={openDetail} lastOpenedId={lastOpenedId} />
        </SettingsShell>
      </div>
    );
  }

  // ── Areas & Floors (combined registry editor) ────────────────────────────
  // One panel manages both floors (section headers) and the areas grouped under
  // them; create/edit happen in modal editors, so no master-detail drill here.
  if (slug === 'areas') {
    return (
      <div key="areas" className={`ha-pane-in ${panelMode ? '' : 'flex flex-col flex-1 min-h-0'}`}>
        <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
          <AreasFloorsPanel />
        </SettingsShell>
      </div>
    );
  }

  // ── HA settings placeholder ───────────────────────────────────────────────
  if (navItem?.haPath) {
    return (
      <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
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
          title={panelMode ? undefined : meta.title}
        >
          <SystemStatusPanel
            onNavigate={(target) => {
              const targetSlug = sectionSlug[target];
              // In the two-column workspace, select the section in place; on the
              // standalone route, navigate to its single-column page.
              if (onSelectSection) onSelectSection(targetSlug);
              else router.push(`/settings/${targetSlug}`);
            }}
          />
          {/* "Customize sections" moved off the top-bar cog into a subtle
              secondary button at the bottom of the Home Center content. */}
          <button
            type="button"
            onClick={() => setSectionsEditorOpen(true)}
            className="w-full flex items-center justify-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary active:bg-surface-mid"
          >
            <Icon path={mdiCog} size={18} />
            Customize sections
          </button>
        </SettingsShell>
        <HomeCenterSectionsModal open={sectionsEditorOpen} onClose={() => setSectionsEditorOpen(false)} />
      </>
    );
  }

  if (slug === 'notifications' || slug === 'updates' || slug === 'repairs' || slug === 'connectivity') {
    return (
      <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
        <SystemStatusPanel focus={slug} />
      </SettingsShell>
    );
  }

  if (slug === 'developer') {
    return (
      <>
        <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
          <div className="space-y-ha-8">
            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Data &amp; diagnostics</SectionLabel>
              {renderDataCards()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Appearance</SectionLabel>
              {renderAppearanceCard()}
              {renderCornerCard()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Dashboard behavior</SectionLabel>
              {renderBehaviorCard()}
              {renderScreensaverCard()}
            </div>

            <div className="space-y-ha-4">
              <SectionLabel className="px-ha-1">Prototyping</SectionLabel>
              {renderSimulatedActivityCard()}
              {renderResetsCard()}
              {renderDeveloperFlagsCard()}
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

        <SetupScreen
          open={connectionSetupOpen}
          onSave={handleSaveCredentials}
          onUseDemo={handleUseDemoData}
          error={connectionError}
          connecting={connecting}
          onClose={() => setConnectionSetupOpen(false)}
        />
      </>
    );
  }

  return (
    <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
      {renderDeveloperFlagsCard()}
    </SettingsShell>
  );
}
