'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { CONTENT_SHELL } from '@/lib/layout';
import { Icon } from '../ui/Icon';
import { Sidebar, Accordion, AccordionSection, useIconSet, setIconSet, type IconSet } from '../ui';
import { HomeHero } from './HomeHero';
import { HomeInformation } from './HomeInformation';
import { ShortcutList } from '@/components/ui/KeyboardShortcutsDialog';
import { openShortcutsHelp } from '@/lib/keyboardShortcuts';
import { toggleCardTunerPanel } from '@/lib/cardTuner';
import { SystemStatusPanel, type HomeCenterSection } from '@/components/ui/SystemStatusPanel';
import { SetupScreen } from '@/components/ui/SetupScreen';
import { useHeader, useScreensaver, useAddContext, useDebugFlags, useCloseOnScreensaver, type BreadcrumbItem } from '@/contexts';
import { useFeatureFlags, useHomeAssistant, useHomeAssistantSelector, useImmersiveMode, useTheme, useFont, useDeviceStructure, useDeviceCardConfig, useIntegrations, useDevicesList, useAutomations } from '@/hooks';
import { IntegrationsTable, IntegrationDetailView } from './IntegrationsPanel';
import { DevicesTable, DeviceDetailView } from './DevicesPanel';
import { AutomationsTable } from './AutomationsPanel';
import { AreasEditor } from '../areas/AreasEditor';
import { AutomationEditor } from './AutomationEditor';
import { HomeCenterSectionsBody } from './HomeCenterSectionEditor';
import { TOGGLEABLE } from '@/lib/homeassistant/entityHelpers';
import type { EntitySlot, EntitySection } from '@/hooks/useDeviceCardConfig';
import { THEMES, type Background, type ColorMode, type Theme } from '@/hooks/useTheme';
import { useDogEarConfig } from '@/hooks/useDogEarConfig';
import { DOG_EAR_ACTIONS } from '@/lib/dogEarActions';
import { areSimulationEntitiesEqual, selectSimulationEntities, selectWeatherOptions, areWeatherOptionsEqual, selectEntityDomains, areEntityDomainsEqual } from '@/lib/homeassistant/selectors';
import { Dropdown } from '../ui/Dropdown';
import { useHaptics } from '@/lib/haptics';
import { createSimulatedActivityEntity, simulationPrefixes, type SimulationType } from '@/lib/homeassistant/simulatedActivities';
import {
  subscribeToUpdatePreview,
  getUpdatePreviewIndex,
  setUpdatePreviewIndex,
  clearUpdatePreview,
  UPDATE_PREVIEW_STEPS,
} from '@/lib/systemUpdatePreview';
import {
  subscribeToAppStatusPreview,
  getAppStatusPreviewIndex,
  setAppStatusPreviewIndex,
  clearAppStatusPreview,
  APP_STATUS_PREVIEW_STEPS,
} from '@/lib/appStatusPreview';
import { type SettingsSlug, allSettingsLinks, isAdminOnlySlug, homeCenterSectionTarget } from './settingsNavigation';
import {
  mdiAlphaDBox,
  mdiBeakerOutline,
  mdiCctv,
  mdiChevronLeft,
  mdiDatabaseOutline,
  mdiKeyboardOutline,
  mdiPaletteOutline,
  mdiTuneVariant,
  mdiClose,
  mdiCog,
  mdiPlayCircleOutline,
  mdiHomeAssistant,
  mdiInformation,
  mdiInformationOutline,
  mdiOpenInNew,
  mdiPlay,
  mdiPrinter3d,
  mdiRobotVacuum,
  mdiRobot,
  mdiTimerOutline,
  mdiUpdate,
  mdiCloudUpload,
  mdiShieldAlert,
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
                  aria-label="Back"
                  className="group flex min-h-11 items-center gap-ha-2 -ml-ha-1 -my-1 text-left"
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
        className={`${CONTENT_SHELL} [--list-top-pad:var(--ha-space-4)] lg:[--list-top-pad:var(--ha-space-5)] ${
          fill ? 'flex min-h-0 flex-1 flex-col' : 'space-y-ha-6'
        }`}
      >
        {children}
      </div>
    </AppSurfacePage>
  );
}


// `flush` drops the card chrome (border / surface / shadow / padding) so the
// block can sit inside a container that already is the card — e.g. an
// AccordionSection body. `hideTitle` omits the heading entirely, for when the
// container's header already names the section (avoids a redundant title).
type SettingsCardOptions = { flush?: boolean; hideTitle?: boolean };

function SettingsCard({
  title,
  description,
  children,
  flush,
  hideTitle,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
} & SettingsCardOptions) {
  return (
    <section
      className={
        flush
          ? ''
          : 'rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 lg:p-ha-6 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)]'
      }
    >
      {!hideTitle && (
        <div className={flush ? 'mb-ha-3' : 'mb-ha-4'}>
          <h3 className={flush ? 'text-[13px] font-semibold uppercase tracking-wide text-text-tertiary' : 'text-lg font-semibold text-text-primary'}>{title}</h3>
          {description && <p className="mt-ha-1 text-sm text-text-secondary">{description}</p>}
        </div>
      )}
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
  options: Array<{ value: T; label: string; caption?: string; preview?: string }>;
}) {
  return (
    <div className="space-y-ha-2">
      <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className="flex flex-wrap gap-ha-2">
        {options.map((option) => {
          const selected = option.value === value;
          const tone = selected
            ? 'border-transparent bg-surface-mid text-ha-blue'
            : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low';
          // Options that ship a preview render the selectable label alongside a
          // "Preview" button (can't nest a button inside a button).
          if (option.preview) {
            return (
              <div key={option.value} className={`flex items-center gap-ha-2 rounded-ha-2xl border px-ha-3 py-ha-2 transition-colors ${tone}`}>
                <button type="button" onClick={() => onChange(option.value)} className="min-w-0 text-left">
                  <div className="text-sm font-semibold">{option.label}</div>
                  {option.caption && <div className="mt-1 text-xs opacity-80">{option.caption}</div>}
                </button>
                <FeaturePreview src={option.preview} label={option.label} />
              </div>
            );
          }
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-ha-2xl border px-ha-4 py-ha-2 text-left transition-colors ${tone}`}
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

// Like ChoiceGroup but several options can be on at once (allow-list). `caption`
// under the label explains what an empty selection means. Selected pills glow
// blue; unselected are muted — same visual language as ChoiceGroup.
function MultiChoiceGroup<T extends string>({
  label,
  caption,
  values,
  onToggle,
  options,
}: {
  label: string;
  caption?: string;
  values: readonly T[];
  onToggle: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="space-y-ha-2">
      <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</div>
      {caption && <div className="text-[13px] text-text-secondary">{caption}</div>}
      <div className="flex flex-wrap gap-ha-2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          const tone = selected
            ? 'border-transparent bg-surface-mid text-ha-blue'
            : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low';
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(option.value)}
              className={`rounded-ha-2xl border px-ha-4 py-ha-2 text-sm font-semibold transition-colors ${tone}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A compact "Preview" trigger that opens the feature's looping GIF (see
// public/previews, regenerated by scripts/capture-previews.mjs) in a modal
// lightbox — so the page never autoplays a wall of clips at once. Self-contained
// (owns its open state) and stops click propagation so it never toggles or
// selects the control it sits next to.
function FeaturePreview({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnScreensaver(open, close);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={`Preview: ${label}`}
        className="shrink-0 inline-flex items-center gap-ha-1 rounded-ha-xl border border-surface-lower bg-surface-default px-ha-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
      >
        <Icon path={mdiPlayCircleOutline} size={15} />
        Preview
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[120] flex items-center justify-center p-ha-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="absolute inset-0 bg-black/60" onClick={close} />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`${label} preview`}
                className="relative w-full max-w-lg overflow-hidden rounded-ha-3xl border border-surface-lower bg-surface-default shadow-2xl"
                initial={{ scale: 0.94, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 4 }}
                transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <div className="flex items-center justify-between gap-ha-3 border-b border-surface-lower px-ha-5 py-ha-3">
                  <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close preview"
                    className="flex h-8 w-8 items-center justify-center rounded-ha-lg text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
                  >
                    <Icon path={mdiClose} size={18} />
                  </button>
                </div>
                <div className="bg-surface-low">
                  {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF, no Next/Image optimisation */}
                  <img src={src} alt={`${label} preview`} className="block h-auto w-full select-none" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
  previewSrc,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  /** Optional GIF shown behind a "Preview" button (see {@link FeaturePreview}). */
  previewSrc?: string;
}) {
  return (
    <div className="flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 transition-colors hover:bg-surface-low">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="flex min-w-0 flex-1 items-center gap-ha-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{label}</div>
          <div className="mt-0.5 text-xs text-text-secondary">{description}</div>
        </div>
        <div className={`h-6 w-11 rounded-full px-0.5 flex items-center transition-colors ${checked ? 'bg-ha-blue/50' : 'bg-surface-mid'}`}>
          <div className={`h-5 w-5 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
      </button>
      {previewSrc && <FeaturePreview src={previewSrc} label={label} />}
    </div>
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
    default: 'bg-surface-low text-text-primary hover:bg-surface-lower',
    primary: 'bg-ha-blue/10 text-ha-blue hover:bg-ha-blue/15',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/15',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-ha-xl px-ha-3 py-ha-2 text-sm font-medium transition-colors ${toneClassNames[tone]} ${
        disabled ? 'cursor-not-allowed opacity-45' : ''
      }`}
    >
      {label}
    </button>
  );
}

// Label + description on the left, a single action button on the right. A
// borderless list row — stack several inside a {@link RowGroup} so they read as
// one grouped card with divided items, not one card per action.
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
    <div className="flex flex-col gap-ha-3 px-ha-4 py-ha-3 sm:flex-row sm:items-center">
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

// Grouped-list container: wraps borderless rows (ToggleRow / ActionRow / the
// simulated-activity rows) into a single bordered card, auto-dividing adjacent
// rows — the same chrome as the ui ListSection, kept local so these settings
// rows don't each render their own card. Merges a stack of row-cards into one.
function RowGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default',
        '[&>*]:border-b [&>*]:border-surface-lower [&>*:last-child]:border-0',
        className,
      )}
    >
      {children}
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
  'default-tinted': 'Default Tinted',
  glass: 'Glass',
  teenage: 'Teenage Engineering',
  cyberpunk: 'Cyberpunk',
  material: 'Material Design',
  'material-ha': 'Home Assistant Material',
  eink: 'E-Ink',
  fallout: 'Fallout',
};

const themeCaptions: Partial<Record<Theme, string>> = {
  'default-tinted': 'Default, with a hint of HA blue in the surfaces',
  glass: 'Layered and airy',
  'material-ha': 'Material Design in HA blue, rounded buttons',
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
  icon: string;
  singleToggle?: boolean;
  formatState: (count: number) => string;
}> = [
  {
    type: 'release',
    title: "What's New",
    description: 'Control the unread release-notes task so it can appear in the activity bar.',
    icon: mdiUpdate,
    singleToggle: true,
    formatState: (count) => (count > 0 ? 'Unread release notes' : 'No unread release notes'),
  },
  {
    type: 'media',
    title: 'Simulate Media',
    description: 'Add or remove mock playback activity for speakers and media players.',
    icon: mdiPlay,
    formatState: (count) => (count > 0 ? `${count} playing` : 'Idle'),
  },
  {
    type: 'timer',
    title: 'Simulate Timer',
    description: 'Preview laundry, tea, or kitchen timer activity in the task bar.',
    icon: mdiTimerOutline,
    formatState: (count) => (count > 0 ? `${count} active` : 'Idle'),
  },
  {
    type: 'camera',
    title: 'Simulate Camera',
    description: 'Surface motion events as activity for doorbells and cameras.',
    icon: mdiCctv,
    formatState: (count) => (count > 0 ? `${count} motion events` : 'Idle'),
  },
  {
    type: 'printer',
    title: 'Simulate Printer',
    description: 'Show long-running print jobs in the same activity surface.',
    icon: mdiPrinter3d,
    formatState: (count) => (count > 0 ? `${count} printing` : 'Idle'),
  },
  {
    type: 'vacuum',
    title: 'Simulate Vacuum',
    description: 'Add a robot vacuum cleaning job. A random cleaning cycle also runs on its own in demo mode.',
    icon: mdiRobotVacuum,
    formatState: (count) => (count > 0 ? `${count} cleaning` : 'Idle'),
  },
  {
    type: 'update_install',
    title: 'Simulate Update Install',
    description: 'Show a Home Assistant Core update actively installing, distinct from unread release notes.',
    icon: mdiUpdate,
    formatState: (count) => (count > 0 ? `${count} installing` : 'Idle'),
  },
  {
    type: 'backup_run',
    title: 'Simulate Backup',
    description: 'Show a backup actively running, distinct from the last-completed backup status.',
    icon: mdiCloudUpload,
    formatState: (count) => (count > 0 ? `${count} running` : 'Idle'),
  },
  {
    type: 'alarm',
    title: 'Simulate Alarm',
    description: 'Add an alarm panel in the arming/pending exit-delay state.',
    icon: mdiShieldAlert,
    formatState: (count) => (count > 0 ? `${count} arming` : 'Idle'),
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

// The Prototype & Debug page is a master-detail drill (same shape as Devices /
// Integrations): five grouped rows instead of ten stacked cards. `detailId`
// holds the selected group key here (developer has no other detail meaning).
const DEV_GROUPS = [
  { key: 'data', label: 'Data & diagnostics', description: 'Data source, connection, build info', icon: mdiDatabaseOutline },
  { key: 'appearance', label: 'Appearance', description: 'Colour mode, theme, font, background, corner shortcuts', icon: mdiPaletteOutline },
  { key: 'behavior', label: 'Dashboard behavior', description: 'Interaction, motion, and the screensaver', icon: mdiTuneVariant },
  { key: 'prototyping', label: 'Prototyping', description: 'Simulated activity, resets, developer flags', icon: mdiBeakerOutline },
  { key: 'keyboard', label: 'Keyboard', description: 'Desktop shortcut reference', icon: mdiKeyboardOutline },
] as const;

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
  const { desktopSplitViewEnabled, toggleDesktopSplitView, offscreenChangeHintsEnabled, toggleOffscreenChangeHints, scrollIndexEnabled, toggleScrollIndex, wavyBackgroundEnabled, toggleWavyBackground, reactiveBackgroundEnabled, toggleReactiveBackground, reactiveTriggerKinds, toggleReactiveTriggerKind, reactiveTriggerDomains, toggleReactiveTriggerDomain, setReactiveTriggerDomains, reactiveIntensity, setReactiveIntensity, reactiveTriggerLabelsEnabled, toggleReactiveTriggerLabels, pulseWallpaperReactive, togglePulseWallpaperReactive, pulseMode, setPulseMode, weatherEntityId, setWeatherEntityId, fastScrollLabelsEnabled, toggleFastScrollLabels, assistVisualizationEnabled, toggleAssistVisualization } = useFeatureFlags();
  const { theme, mode, background, squircle, setTheme, setMode, setBackground, toggleSquircle } = useTheme();
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
    isAdmin,
  } = useHomeAssistant();

  // Defense in depth: both callers (the /settings/[slug] route and the
  // two-column workspace) already keep an admin-only slug from reaching this
  // component, but bail on render too in case a future caller doesn't.
  const gated = isAdminOnlySlug(slug) && !isAdmin;
  const { immersiveMode, setImmersiveMode } = useImmersiveMode();
  const { isActive: screensaverActive, activate: activateScreensaver, dismiss: dismissScreensaver } = useScreensaver();
  const { config: dogEarConfig, setCorner: setDogEarCorner } = useDogEarConfig();
  const simulationEntities = useHomeAssistantSelector(selectSimulationEntities, areSimulationEntitiesEqual);
  const weatherOptions = useHomeAssistantSelector(selectWeatherOptions, areWeatherOptionsEqual);
  const entityDomains = useHomeAssistantSelector(selectEntityDomains, areEntityDomainsEqual);

  // Device card configuration
  const { devices } = useDeviceStructure();
  const { setConfig } = useDeviceCardConfig();
  const [configureStatus, setConfigureStatus] = useState<'idle' | 'done'>('idle');

  // Home Center "Customize sections" editor — opens in the shared right-side
  // <Sidebar> (docked rail on desktop, bottom sheet on mobile).
  const [sectionsEditorOpen, setSectionsEditorOpen] = useState(false);

  // Master-detail drill-down within column 2. `detailId` is the selected row's id
  // (e.g. an integration platform key); null means we're showing the table.
  const { integrations } = useIntegrations();
  // Deep link: `/settings/<slug>?device=<id>` (or ?detail=) opens straight into
  // that row's detail view — e.g. the device more-info dialog's "Open device
  // page" action. useSearchParams (not window.location) so the value is correct
  // during client navigation; seeded once, the drillSlug reset below leaves it
  // alone since slug === drillSlug on the first render.
  const searchParams = useSearchParams();
  const initialDetailId = searchParams.get('device') ?? searchParams.get('detail');
  const [detailId, setDetailId] = useState<string | null>(initialDetailId);
  // The row last drilled into. Unlike `detailId` it survives going back, so the
  // list can mark which item you just returned from. Cleared on section change.
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(initialDetailId);
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
  // is open. Reset on unmount so leaving the section restores the column. Areas
  // V2 is itself a full editor (list + map), so it focuses for the whole section.
  const editorFocused = !!activeAutomation || slug === 'areas';
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

  const { hideHomeCenterEnabled, toggleHideHomeCenter, hideCardImagesEnabled, toggleHideCardImages, sidebarPreviewsEnabled, toggleSidebarPreviews, dashboardFilterEnabled, toggleDashboardFilter, mobileNavAutoHideEnabled, toggleMobileNavAutoHide } = useDebugFlags();
  const [connectionSetupOpen, setConnectionSetupOpen] = useState(false);

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
          breadcrumbs: detailCrumbs('Devices & Services'),
          icon: activeDevice.icon,
          onBack: () => setDetailId(null),
          primaryAction: { icon: infoOpen ? mdiInformation : mdiInformationOutline, onClick: () => setInfoOpen((v) => !v) },
        });
      } else if (activeIntegration) {
        setHeader({ title: activeIntegration.name, subtitle: 'Settings', breadcrumbs: detailCrumbs('Integrations'), icon: activeIntegration.icon, onBack: () => setDetailId(null) });
      } else if (slug === 'areas') {
        // Areas is a focused full-editor (nav collapses), so back returns to the
        // settings workspace (re-showing the nav) rather than exiting via history.
        setHeader({
          title: meta.title,
          subtitle: 'Settings',
          icon: meta.icon,
          onBack: () => onSelectSection?.('home-center'),
        });
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
        subtitle: 'Devices & Services',
        breadcrumbs: detailCrumbs('Devices & Services'),
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
  const renderDataCards = (opts: SettingsCardOptions = {}) => {
    const totalEntities = devices.reduce((sum, device) => sum + device.entities.length, 0);
    return (
      <>
        <SettingsCard
          title="Data source"
          description="Connect a live Home Assistant instance or fall back to the bundled demo home."
          {...opts}
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

        <SettingsCard title="Diagnostics" description="Read-only snapshot of the current build and connection." {...opts}>
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
  const renderAppearanceCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard title="Appearance" description="Visual treatment of the dashboard — applied live." {...opts}>
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
            <RowGroup>
              <ToggleRow
                label="Pulse on device toggles"
                description="Ripple a coloured wave across the wallpaper whenever a device turns on or off, or goes unavailable — gold for on, blue for off, red for errors."
                checked={pulseWallpaperReactive}
                onToggle={togglePulseWallpaperReactive}
              />
            </RowGroup>
          )}
        </div>
      </div>
    </SettingsCard>
  );

  // The two folded-corner shortcuts, merged from two single-choice cards.
  const renderCornerCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard
      title="Corner shortcuts"
      description="Folded-corner shortcuts on every dashboard surface. Hover (desktop) or press-and-hold (touch) reveals them."
      {...opts}
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
  const renderBehaviorCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard title="Dashboard behavior" description="Interaction and motion behaviors across the dashboard." {...opts}>
      <RowGroup>
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
          previewSrc="/previews/edge-change-hints.gif"
        />
        <ToggleRow
          label="Scroll index rail"
          description="A thin rail of section ticks along the screen edge. Drag to scrub between rooms or types; swipe the selected one inward to open its page. On touch it follows the side you scroll on."
          checked={scrollIndexEnabled}
          onToggle={toggleScrollIndex}
          previewSrc="/previews/scroll-index-rail.gif"
        />
        <ToggleRow
          label="Fast-scroll name labels · prototype"
          description="While you flick a dashboard fast, overlay each card with just its name (large) so you can read what's flying past. Detail returns the moment you slow down."
          checked={fastScrollLabelsEnabled}
          onToggle={toggleFastScrollLabels}
          previewSrc="/previews/fast-scroll-labels.gif"
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
      </RowGroup>
    </SettingsCard>
  );

  // Everything screensaver in one place — preview + both background flags + the
  // reactive sub-options. Previously the preview lived under "Theme and Display"
  // while wavy/reactive lived under "Developer Tools".
  const renderScreensaverCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard title="Screensaver" description="The idle full-screen clock and its animated background." {...opts}>
      <div className="space-y-ha-3">
        <RowGroup>
          <ToggleRow
            label="Screensaver preview"
            description="Activate the full-screen clock now, or dismiss it if you are already previewing it."
            checked={screensaverActive}
            onToggle={screensaverActive ? dismissScreensaver : activateScreensaver}
          />
          <ToggleRow
            label="Advanced Assist visualization"
            description="Show the summary of your home on the lock screen, and the “Ask your home” field in the bottom bar. Turn it off for a plain clock — you can still ask your home from search."
            checked={assistVisualizationEnabled}
            onToggle={toggleAssistVisualization}
          />
          <ToggleRow
            label="Wavy background"
            description="Use squiggly rippling rings instead of perfect concentric circles."
            checked={wavyBackgroundEnabled}
            onToggle={toggleWavyBackground}
            previewSrc="/previews/screensaver-wavy.gif"
          />
          <ToggleRow
            label="Reactive background"
            description="Spawn a coloured ripple when something happens at home — gold for on, blue for off, red for errors, amber for sensor jumps."
            checked={reactiveBackgroundEnabled}
            onToggle={toggleReactiveBackground}
            previewSrc="/previews/screensaver-reactive.gif"
          />
        </RowGroup>
        {reactiveBackgroundEnabled && (
          <div className="space-y-ha-4 rounded-ha-2xl border border-surface-lower bg-surface-low/40 px-ha-4 py-ha-4">
            <MultiChoiceGroup
              label="React to"
              caption="Which kinds of change spawn a ripple and a tip. Turn all off to silence it."
              values={reactiveTriggerKinds}
              onToggle={toggleReactiveTriggerKind}
              options={[
                { value: 'on', label: 'Turned on' },
                { value: 'off', label: 'Turned off' },
                { value: 'error', label: 'Unavailable' },
                { value: 'alert', label: 'Sensor jumps' },
              ]}
            />
            <div className="space-y-ha-2">
              <MultiChoiceGroup
                label="Device types"
                caption={
                  reactiveTriggerDomains.length === 0
                    ? 'All device types can trigger. Pick some to limit it.'
                    : `Only these ${reactiveTriggerDomains.length} device type${reactiveTriggerDomains.length === 1 ? '' : 's'} trigger.`
                }
                values={reactiveTriggerDomains}
                onToggle={toggleReactiveTriggerDomain}
                options={entityDomains.map((d) => ({ value: d, label: d.replace(/_/g, ' ') }))}
              />
              {reactiveTriggerDomains.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReactiveTriggerDomains([])}
                  className="text-xs font-medium text-ha-blue transition-opacity hover:opacity-80"
                >
                  Clear — allow all device types
                </button>
              )}
            </div>
            <ChoiceGroup
              label="Ripple intensity"
              value={reactiveIntensity}
              onChange={setReactiveIntensity}
              options={[
                { value: 'subtle', label: 'Subtle tint', caption: 'Faint coloured line, ambient' },
                { value: 'bold', label: 'Bold bloom', caption: 'Bright, thicker ripple that pops' },
              ]}
            />
            <RowGroup>
              <ToggleRow
                label="Show trigger labels"
                description="Name the entity behind each ripple in a small pill at the bottom of the screensaver."
                checked={reactiveTriggerLabelsEnabled}
                onToggle={toggleReactiveTriggerLabels}
              />
            </RowGroup>
          </div>
        )}
        <ChoiceGroup
          label="Background style"
          value={pulseMode}
          onChange={setPulseMode}
          options={[
            { value: 'classic', label: 'Classic rings', caption: 'Endless concentric rings (original)', preview: '/previews/pulse-classic.gif' },
            { value: 'heartbeat', label: 'Heartbeat', caption: 'Calm lub-dub ping rings on a steady cadence', preview: '/previews/pulse-heartbeat.gif' },
            { value: 'breathing', label: 'Breathing depth', caption: 'Layered soft rings that slowly inhale and exhale', preview: '/previews/pulse-breathing.gif' },
            { value: 'aurora', label: 'Aurora', caption: 'Soft drifting ribbons of colour (northern lights)', preview: '/previews/pulse-aurora.gif' },
            { value: 'bokeh', label: 'Bokeh', caption: 'Soft light orbs drifting slowly upward', preview: '/previews/pulse-bokeh.gif' },
            { value: 'dawn', label: 'Dawn', caption: 'A slow flowing colour wash, no hard shapes', preview: '/previews/pulse-dawn.gif' },
            { value: 'breathOrb', label: 'Breath orb', caption: 'One soft glow gently expanding and contracting', preview: '/previews/pulse-breathOrb.gif' },
            { value: 'weather', label: 'Weather', caption: 'Abstract, reactive ambience driven by a weather entity', preview: '/previews/pulse-weather.gif' },
            { value: 'warp', label: 'Warp', caption: 'Liquid flowing colour, violet to magenta to white', preview: '/previews/pulse-warp.gif' },
            { value: 'northernLights', label: 'Northern lights', caption: 'Volumetric aurora curtains over a starry night sky', preview: '/previews/pulse-northernLights.gif' },
            { value: 'meshGradient', label: 'Mesh gradient', caption: 'Flowing colour spots blending with organic distortion', preview: '/previews/pulse-meshGradient.gif' },
            { value: 'grainGradient', label: 'Grain gradient', caption: 'Drifting blob banded in colour with grainy texture', preview: '/previews/pulse-grainGradient.gif' },
            { value: 'paperWarp', label: 'Color warp', caption: 'Marbled colour fields swirled through layered distortion', preview: '/previews/pulse-paperWarp.gif' },
            { value: 'simplexNoise', label: 'Simplex flow', caption: 'Soft stepped colour contours flowing upward', preview: '/previews/pulse-simplexNoise.gif' },
            { value: 'metaballs', label: 'Metaballs', caption: 'Warm gooey orbs wandering and merging, lava-lamp style', preview: '/previews/pulse-metaballs.gif' },
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
  // Drives the shared preview store the SystemUpdateWatcher reads, so the
  // full-screen update/restart overlay can be shown on demand (no real update or
  // reboot needed). Index 0 = off.
  const updatePreviewIndex = useSyncExternalStore(
    subscribeToUpdatePreview,
    getUpdatePreviewIndex,
    () => 0,
  );
  const renderScreenPreviewCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard
      title="Full-screen overlays"
      description="Replay the full-screen screens that normally only appear on their own — the first-run welcome flow and the “updating your home” / “restarting” overlay."
      {...opts}
    >
      <RowGroup>
        <div className="flex flex-col gap-ha-3 px-ha-4 py-ha-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text-primary">Onboarding</div>
            <div className="mt-0.5 text-xs text-text-secondary">
              First-run welcome flow — opens in a preview that doesn’t touch the real gate
            </div>
          </div>
          <div className="shrink-0">
            <ActionButton
              label="Open"
              onClick={() => router.push('/dev/onboarding')}
              tone="primary"
            />
          </div>
        </div>
        {UPDATE_PREVIEW_STEPS.slice(1).map((step, i) => {
          const index = i + 1;
          const active = updatePreviewIndex === index;
          return (
            <div key={step.label} className="flex flex-col gap-ha-3 px-ha-4 py-ha-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text-primary">{step.label}</div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {step.phase === 'installing'
                    ? step.install?.percentage != null
                      ? 'Determinate progress bar'
                      : 'Indeterminate shimmer (no percentage)'
                    : step.phase === 'restarting'
                      ? step.install
                        ? '“Updating your home” — reconnecting'
                        : '“Restarting your home” — bare reboot copy'
                      : '“Your home is ready” confirmation'}
                </div>
              </div>
              <div className="shrink-0">
                <ActionButton
                  label={active ? 'Hide' : 'Show'}
                  onClick={() => (active ? clearUpdatePreview() : setUpdatePreviewIndex(index))}
                  tone={active ? 'danger' : 'primary'}
                />
              </div>
            </div>
          );
        })}
      </RowGroup>
    </SettingsCard>
  );

  // Paints the app-icon status markers onto every app in the sidebar and mobile
  // nav. Real states come from the Supervisor (an add-on has to actually be
  // stopped or updating), so this is the only way to see them on demand.
  const appStatusPreviewIndex = useSyncExternalStore(
    subscribeToAppStatusPreview,
    getAppStatusPreviewIndex,
    () => 0,
  );
  const renderAppStatusCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard
      title="App icon states"
      description="Show the status markers on the app icons in the sidebar — installing, stopped, not running, update available."
      {...opts}
    >
      <RowGroup>
        {APP_STATUS_PREVIEW_STEPS.slice(1).map((step, i) => {
          const index = i + 1;
          const active = appStatusPreviewIndex === index;
          return (
            <div key={step.label} className="flex flex-col gap-ha-3 px-ha-4 py-ha-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text-primary">{step.label}</div>
                <div className="mt-0.5 text-xs text-text-secondary">{step.description}</div>
              </div>
              <div className="shrink-0">
                <ActionButton
                  label={active ? 'Hide' : 'Show'}
                  onClick={() => (active ? clearAppStatusPreview() : setAppStatusPreviewIndex(index))}
                  tone={active ? 'danger' : 'primary'}
                />
              </div>
            </div>
          );
        })}
      </RowGroup>
    </SettingsCard>
  );

  const renderSimulatedActivityCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard title="Simulated activity" description="Inject mock task-bar activity to preview the activity surface." {...opts}>
      <RowGroup>
        {taskBarActivityDefinitions.map((definition) => {
          const prefix = simulationPrefixes[definition.type];
          const count = getSimulatedEntities(prefix).length;

          return (
            <div
              key={definition.type}
              className="flex flex-col gap-ha-3 px-ha-4 py-ha-3 sm:flex-row sm:items-center"
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
              </div>
            </div>
          );
        })}
      </RowGroup>
    </SettingsCard>
  );

  // All "reset/restore to defaults" actions, previously split between the
  // "Dashboards" and "Maintenance" sections.
  const renderResetsCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard title="Reset & restore" description="Roll dashboard customisations back to their defaults." {...opts}>
      <RowGroup>
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
      </RowGroup>
    </SettingsCard>
  );

  // Diagnostic overlays / simulated conditions. The old "Demo data mode" toggle
  // moved into the Data source card; screensaver flags moved to the screensaver
  // card — so this is now just the developer-only flags.
  const renderDeveloperFlagsCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard title="Developer flags" description="Diagnostic overlays and simulated conditions." {...opts}>
      <RowGroup>
        <ToggleRow
          label="Sidebar hover previews"
          description="Hovering a dashboard or app in the sidebar shows a snapshot of the view. Off falls back to the plain label pill."
          checked={sidebarPreviewsEnabled}
          onToggle={toggleSidebarPreviews}
        />
        <ToggleRow
          label="Dashboard filter pill"
          description="The floating floor / grouping control on the home dashboard. Off hides it and drops any floor filter with it, so nothing is filtered out invisibly."
          checked={dashboardFilterEnabled}
          onToggle={toggleDashboardFilter}
        />
        <ToggleRow
          label="Mobile nav auto-hide"
          description="The bottom nav slides away as you scroll down and after 10s of no input, and comes back on the next scroll. Off pins it in place."
          checked={mobileNavAutoHideEnabled}
          onToggle={toggleMobileNavAutoHide}
        />
        <ToggleRow
          label="Hide device card images"
          description="Drop the product render from device cards and show the entity icon beside the name and state instead, like a tile card. Cards shrink to the next height step."
          checked={hideCardImagesEnabled}
          onToggle={toggleHideCardImages}
        />
        <ToggleRow
          label="Hide Home Center"
          description="Desktop drops the whole bottom bar (Ask your home, activities and the clock pill); mobile drops the Home Center tab. Its settings entry is hidden on both."
          checked={hideHomeCenterEnabled}
          onToggle={toggleHideHomeCenter}
        />
        <ActionRow
          label="Device card tuner"
          description="Floating panel with live sliders for card typography, spacing, and image size (⇧⌘X). Tweaks persist until reset."
          buttonLabel="Open"
          onClick={() => toggleCardTunerPanel(true)}
        />
        <ToggleRow
          label="Squircle corners"
          description="Smooth every rounded corner into an iOS-style superellipse (⇧⌘U). Best seen on soft themes like Default, Glass, Material and Teenage."
          checked={squircle}
          onToggle={toggleSquircle}
        />
      </RowGroup>
    </SettingsCard>
  );

  // Living reference for the keyboard bindings — generated from the same
  // registry as the ? overlay, so it can't drift from the real handlers.
  const renderShortcutsCard = (opts: SettingsCardOptions = {}) => (
    <SettingsCard
      title="Keyboard shortcuts"
      description="Desktop bindings for driving and debugging the prototype. Letter keys only fire outside text fields; press ? anywhere for this list as an overlay."
      {...opts}
    >
      <div className="space-y-ha-5">
        <ShortcutList />
        <div className="flex flex-wrap gap-ha-2">
          <ActionButton label="Show overlay" onClick={openShortcutsHelp} />
        </div>
      </div>
    </SettingsCard>
  );

  // Defense in depth: a non-admin reaching an admin-only slug (direct nav,
  // stale link) gets bounced by the effect above — render nothing meanwhile
  // rather than the gated page.
  if (gated) return null;

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
          <AreasEditor onExit={panelMode ? () => onSelectSection?.('home-center') : () => router.push('/settings')} />
        </SettingsShell>
      </div>
    );
  }

  // ── Home Information (behind the Home Center hero "Edit home") ────────────
  // Home name, location + regional (read-only, deep-linked to HA) and the
  // app-local Home Mode config. Sits before the haPath placeholder.
  if (slug === 'home-information') {
    return (
      <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
        <HomeInformation />
      </SettingsShell>
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
    // Each Home Center section deep-links to its settings home (shared map, so
    // the panel filters non-admin sections against the same destinations).
    const sectionSlug: Record<HomeCenterSection, SettingsSlug> = homeCenterSectionTarget;
    const sectionsHeader = {
      title: 'Customize sections',
      subtitle: 'Reorder & toggle status sections',
      onClose: () => setSectionsEditorOpen(false),
    };
    return (
      <>
        <SettingsShell
          panelMode={panelMode}
          title={panelMode ? undefined : meta.title}
        >
          {/* Flex row so the editor can dock as a sibling rail on the right (lg+);
              the status content column shrinks to make room. */}
          <div className="flex items-start gap-ha-5">
            <div className="min-w-0 flex-1 space-y-ha-6">
              <HomeHero
                onEdit={isAdmin ? () => {
                  if (onSelectSection) onSelectSection('home-information');
                  else router.push('/settings/home-information');
                } : undefined}
              />
              <SystemStatusPanel
                onNavigate={(target) => {
                  const targetSlug = sectionSlug[target];
                  // In the two-column workspace, select the section in place; on the
                  // standalone route, navigate to its single-column page.
                  if (onSelectSection) onSelectSection(targetSlug);
                  else router.push(`/settings/${targetSlug}`);
                }}
              />
              {/* "Customize sections" reorders/toggles the status sections above.
                  Admin-only: a non-admin has just Notifications left, and the
                  editor would otherwise re-expose the admin section names. */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setSectionsEditorOpen((v) => !v)}
                  className="w-full flex items-center justify-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary active:bg-surface-mid"
                >
                  <Icon path={mdiCog} size={18} />
                  Customize sections
                </button>
              )}
            </div>

            {/* Docked editor rail (lg+), sticky below the pinned title. Reuses the
                same <Sidebar> chrome as the devices / automation editors. */}
            {sectionsEditorOpen && (
              <Sidebar
                resizable
                {...sectionsHeader}
                className="ha-pane-in sticky z-20 hidden flex-shrink-0 lg:flex"
                style={{
                  top: 'calc(var(--settings-header-h, 0px) + 4px)',
                  maxHeight: 'calc(100vh - var(--settings-header-h, 0px) - 24px)',
                }}
              >
                <HomeCenterSectionsBody />
              </Sidebar>
            )}
          </div>
        </SettingsShell>

        {/* Below lg the same panel rises as a bottom sheet. Portaled to the body —
            the pane-transition wrapper is transformed during its animation, which
            would otherwise clip this fixed overlay to the page. */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {sectionsEditorOpen && (
              <>
                <motion.div
                  key="sections-sheet-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="lg:hidden fixed inset-0 z-[100] bg-black/70"
                  onClick={() => setSectionsEditorOpen(false)}
                />
                <motion.div
                  key="sections-sheet"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="lg:hidden fixed inset-x-0 bottom-0 z-[100] px-ha-2"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
                >
                  <div className="flex justify-center pb-ha-2">
                    <div className="h-1.5 w-9 rounded-full bg-white/40" />
                  </div>
                  <Sidebar {...sectionsHeader} className="flex max-h-[82vh]">
                    <HomeCenterSectionsBody />
                  </Sidebar>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
      </>
    );
  }

  if (slug === 'activity' || slug === 'notifications' || slug === 'updates' || slug === 'repairs' || slug === 'connectivity') {
    return (
      <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
        <SystemStatusPanel focus={slug} />
      </SettingsShell>
    );
  }

  if (slug === 'developer') {
    // The five groups' original cards, keyed by group so the accordion can render
    // each section's body on demand.
    // All flush (the accordion section is the card). `hideTitle` drops the sub
    // title where it just repeats the accordion header (Appearance / Dashboard
    // behavior / Keyboard); multi-part groups keep sub titles to tell the parts
    // apart (Data source vs Diagnostics, the three prototyping tools, etc.).
    const renderDevGroupCards = (key: (typeof DEV_GROUPS)[number]['key']) => {
      switch (key) {
        case 'data':
          return renderDataCards({ flush: true });
        case 'appearance':
          return (<>{renderAppearanceCard({ flush: true, hideTitle: true })}{renderCornerCard({ flush: true })}</>);
        case 'behavior':
          return (<>{renderBehaviorCard({ flush: true, hideTitle: true })}{renderScreensaverCard({ flush: true })}</>);
        case 'prototyping':
          return (<>{renderSimulatedActivityCard({ flush: true })}{renderAppStatusCard({ flush: true })}{renderScreenPreviewCard({ flush: true })}{renderResetsCard({ flush: true })}{renderDeveloperFlagsCard({ flush: true })}</>);
        case 'keyboard':
          return renderShortcutsCard({ flush: true, hideTitle: true });
        default:
          return null;
      }
    };
    return (
      <>
        <SettingsShell panelMode={panelMode} title={panelMode ? undefined : meta.title}>
          {/* Ten cards collapsed into five collapsible accordion sections (reuses
              the ui Accordion — same grouped-card chrome as the settings lists).
              The first group opens by default; each section holds the cards that
              originally sat under its label. */}
          <Accordion>
            {DEV_GROUPS.map((group, i) => (
              <AccordionSection
                key={group.key}
                title={group.label}
                description={group.description}
                icon={group.icon}
                defaultOpen={i === 0}
              >
                {/* Flush sub-sections separated by a hairline (adjacent-sibling
                    rule) instead of nested card borders. */}
                <div className="[&>section+section]:mt-ha-5 [&>section+section]:border-t [&>section+section]:border-surface-lower [&>section+section]:pt-ha-5">
                  {renderDevGroupCards(group.key)}
                </div>
              </AccordionSection>
            ))}
          </Accordion>
        </SettingsShell>

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
