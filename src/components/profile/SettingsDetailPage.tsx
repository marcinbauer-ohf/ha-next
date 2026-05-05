'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { Icon } from '../ui/Icon';
import { useHeader } from '@/contexts';
import { useHomeAssistant, useImmersiveMode } from '@/hooks';
import { THEMES, type Background, type ColorMode, type Theme } from '@/hooks/useTheme';
import { useTheme } from '@/hooks';
import { getSettingsHref, type SettingsSlug } from './settingsNavigation';
import {
  mdiAlphaDBox,
  mdiBell,
  mdiCellphone,
  mdiCheckCircle,
  mdiChevronRight,
  mdiCloud,
  mdiCog,
  mdiDatabase,
  mdiDevices,
  mdiFlash,
  mdiFolderHome,
  mdiInformation,
  mdiPalette,
  mdiRefresh,
  mdiShieldAccount,
  mdiTabletDashboard,
  mdiViewDashboard,
  mdiWifi,
} from '@mdi/js';

interface SettingsDetailPageProps {
  slug: SettingsSlug;
}

interface SettingsMeta {
  title: string;
  description: string;
  icon: string;
  eyebrow: string;
  accentClassName: string;
}

function SettingsShell({
  meta,
  children,
  actions,
}: {
  meta: SettingsMeta;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <AppSurfacePage>
      <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full space-y-ha-6">
          <div className={`rounded-ha-3xl border bg-surface-default p-ha-6 lg:p-ha-8 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.32)] ${meta.accentClassName}`}>
            <div className="flex flex-col gap-ha-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-ha-3">
                <span className="inline-flex items-center gap-ha-2 rounded-full bg-surface-default/70 px-ha-3 py-ha-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                  <Icon path={meta.icon} size={14} />
                  {meta.eyebrow}
                </span>
                <div>
                  <h2 className="text-2xl lg:text-3xl font-semibold text-text-primary">{meta.title}</h2>
                  <p className="mt-ha-2 max-w-2xl text-sm lg:text-base text-text-secondary">{meta.description}</p>
                </div>
              </div>
              {actions && <div className="flex flex-wrap gap-ha-2">{actions}</div>}
            </div>
          </div>
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

function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: 'primary' | 'success' | 'warning' | 'default' }>;
}) {
  const toneClassNames: Record<NonNullable<(typeof items)[number]['tone']>, string> = {
    primary: 'text-ha-blue bg-fill-primary-normal',
    success: 'text-green-600 bg-green-500/10',
    warning: 'text-yellow-600 bg-yellow-500/10',
    default: 'text-text-primary bg-surface-mid/60',
  };

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-ha-3">
      {items.map((item) => {
        const tone = item.tone ?? 'default';
        return (
          <div key={item.label} className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 shadow-[0_12px_24px_-28px_rgba(15,23,42,0.28)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">{item.label}</div>
            <div className={`mt-ha-3 inline-flex rounded-full px-ha-3 py-ha-1 text-sm font-semibold ${toneClassNames[tone]}`}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
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
      <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-text-tertiary">{label}</div>
      <div className="flex flex-wrap gap-ha-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-ha-2xl border px-ha-4 py-ha-3 text-left transition-colors ${
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
      className="w-full rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-4 flex items-center gap-ha-4 text-left hover:bg-surface-low transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        <div className="mt-1 text-sm text-text-secondary">{description}</div>
      </div>
      <div className={`h-7 w-12 rounded-full px-0.5 flex items-center transition-colors ${checked ? 'bg-ha-blue/50' : 'bg-surface-mid'}`}>
        <div className={`h-6 w-6 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<string[]>;
}) {
  return (
    <div className="overflow-x-auto rounded-ha-2xl border border-surface-lower bg-surface-default">
      <table className="min-w-full text-left">
        <thead className="bg-surface-low">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-ha-4 py-ha-3 text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t border-surface-lower bg-surface-default">
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className="px-ha-4 py-ha-3 text-sm text-text-secondary whitespace-nowrap">
                  <span className={cellIndex === 0 ? 'font-medium text-text-primary' : ''}>{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

const settingsMeta: Record<SettingsSlug, SettingsMeta> = {
  interface: {
    title: 'Theme and Display',
    description: 'Fine tune the app look and feel, including visual preset, color mode, background treatment, and interaction density.',
    icon: mdiPalette,
    eyebrow: 'Appearance',
    accentClassName: 'border-ha-blue/20',
  },
  dashboards: {
    title: 'Dashboards',
    description: 'Choose where the app should land, how room pages behave, and which dashboard surfaces stay pinned for quick access.',
    icon: mdiViewDashboard,
    eyebrow: 'Navigation',
    accentClassName: 'border-green-500/20',
  },
  cloud: {
    title: 'Home Assistant Cloud',
    description: 'Control remote access, backups, voice relay, and the services that keep your instance reachable away from home.',
    icon: mdiCloud,
    eyebrow: 'Connectivity',
    accentClassName: 'border-sky-500/20',
  },
  'mobile-app': {
    title: 'Companion App',
    description: 'Review synced devices, mobile sensors, notification delivery, and the shortcuts that should appear on phones and tablets.',
    icon: mdiCellphone,
    eyebrow: 'Mobile',
    accentClassName: 'border-violet-500/20',
  },
  system: {
    title: 'General Settings',
    description: 'Adjust everyday behavior for navigation, automation refresh, diagnostics, and the way system services surface in the UI.',
    icon: mdiCog,
    eyebrow: 'System',
    accentClassName: 'border-yellow-500/20',
  },
  about: {
    title: 'About Home Assistant',
    description: 'See what build you are previewing, where its data comes from, and the latest product notes included in this prototype.',
    icon: mdiInformation,
    eyebrow: 'About',
    accentClassName: 'border-slate-400/20',
  },
  security: {
    title: 'Security',
    description: 'Manage session trust, approval flows, and the guardrails that protect companion devices and browser access.',
    icon: mdiShieldAccount,
    eyebrow: 'Access',
    accentClassName: 'border-red-500/20',
  },
  developer: {
    title: 'Developer Tools',
    description: 'Toggle preview-only diagnostics, inspect mocked integrations, and keep the prototype friendly for rapid iteration.',
    icon: mdiAlphaDBox,
    eyebrow: 'Preview',
    accentClassName: 'border-orange-500/20',
  },
};

export function SettingsDetailPage({ slug }: SettingsDetailPageProps) {
  const router = useRouter();
  const { setHeader } = useHeader();
  const { theme, mode, background, setTheme, setMode, setBackground } = useTheme();
  const { connected, connecting, demoMode, haUrl, enableDemoMode } = useHomeAssistant();
  const { immersiveMode, setImmersiveMode } = useImmersiveMode();
  const [compactCards, setCompactCards] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [defaultDashboard, setDefaultDashboard] = useState<'overview' | 'energy' | 'security' | 'climate'>('overview');
  const [alwaysUseDefault, setAlwaysUseDefault] = useState(false);
  const [showRoomBadges, setShowRoomBadges] = useState(true);
  const [remoteAccessEnabled, setRemoteAccessEnabled] = useState(true);
  const [autoBackups, setAutoBackups] = useState(true);
  const [voiceRelayEnabled, setVoiceRelayEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [sensorSyncEnabled, setSensorSyncEnabled] = useState(true);
  const [criticalAlertsEnabled, setCriticalAlertsEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(true);
  const [trustedNetworkLogin, setTrustedNetworkLogin] = useState(true);
  const [debugBadgesEnabled, setDebugBadgesEnabled] = useState(demoMode);
  const [mockLatencyEnabled, setMockLatencyEnabled] = useState(false);

  const meta = settingsMeta[slug];

  useEffect(() => {
    setHeader({
      title: meta.title,
      subtitle: 'Settings',
      icon: meta.icon,
      onBack: () => router.push('/profile'),
    });
  }, [meta.icon, meta.title, router, setHeader]);

  const connectionLabel = demoMode
    ? 'Demo data'
    : connecting
      ? 'Connecting'
      : connected
        ? 'Connected'
        : 'Offline';

  const interfaceTableRows = useMemo(
    () => [
      ['Theme preset', formatLabel(theme), 'Global', 'Live'],
      ['Color mode', formatLabel(mode), 'Display', 'Live'],
      ['Background', formatLabel(background), 'Display', 'Live'],
      ['Compact cards', compactCards ? 'Enabled' : 'Disabled', 'Density', 'Preview'],
      ['Reduced motion', reducedMotion ? 'Enabled' : 'Disabled', 'Animation', 'Preview'],
    ],
    [background, compactCards, mode, reducedMotion, theme]
  );

  const dashboardTableRows = useMemo(
    () => [
      ['Overview', defaultDashboard === 'overview' ? 'Default' : 'Available', 'Whole home', '2m ago'],
      ['Energy', defaultDashboard === 'energy' ? 'Default' : 'Available', 'Insights', '14m ago'],
      ['Security', defaultDashboard === 'security' ? 'Default' : 'Available', 'Alerts', '1h ago'],
      ['Climate', defaultDashboard === 'climate' ? 'Default' : 'Available', 'Comfort', 'Yesterday'],
    ],
    [defaultDashboard]
  );

  const cloudTableRows = useMemo(
    () => [
      ['Remote access', remoteAccessEnabled ? 'Enabled' : 'Disabled', demoMode ? 'Preview tunnel' : 'Remote endpoint', 'Healthy'],
      ['Encrypted backups', autoBackups ? 'Nightly' : 'Manual', 'Cloud vault', 'Ready'],
      ['Voice relay', voiceRelayEnabled ? 'Enabled' : 'Disabled', 'Assistant routing', voiceRelayEnabled ? 'Beta' : 'Idle'],
      ['Webhook bridge', connected ? 'Linked' : 'Waiting', haUrl || 'No server yet', connected ? 'Healthy' : 'Pending'],
    ],
    [autoBackups, connected, demoMode, haUrl, remoteAccessEnabled, voiceRelayEnabled]
  );

  const mobileTableRows = useMemo(
    () => [
      ['iPhone 15 Pro', 'Primary', pushEnabled ? 'Push ready' : 'Muted', '2m ago'],
      ['iPad Mini', 'Wall panel', sensorSyncEnabled ? 'Sensors synced' : 'Sensors off', '12m ago'],
      ['Apple Watch', 'Companion', criticalAlertsEnabled ? 'Critical alerts' : 'Passive only', '29m ago'],
    ],
    [criticalAlertsEnabled, pushEnabled, sensorSyncEnabled]
  );

  const systemTableRows = useMemo(
    () => [
      ['Connection source', connectionLabel, demoMode ? 'Local demo entities' : haUrl || 'Awaiting address', 'Current'],
      ['Automation refresh', autoRefreshEnabled ? '15s' : 'Manual', 'Dashboard cards', 'Live'],
      ['Immersive mode default', immersiveMode ? 'Enabled' : 'Disabled', 'Desktop shell', 'Live'],
      ['Analytics', analyticsEnabled ? 'Enabled' : 'Disabled', 'Preview diagnostics', 'Local only'],
    ],
    [analyticsEnabled, autoRefreshEnabled, connectionLabel, demoMode, haUrl, immersiveMode]
  );

  const aboutTableRows = useMemo(
    () => [
      ['Prototype channel', demoMode ? 'Preview demo' : 'Connected environment', demoMode ? 'Bundled sample home' : 'Live Home Assistant data'],
      ['UI package', 'Next.js 16 preview shell', 'Route-driven dashboard prototype'],
      ['Activity feed', 'Live and simulated', 'Screensaver, navigation, and settings'],
      ['Release notes', '2026.2.1 sample notes', 'Included in demo entities'],
    ],
    [demoMode]
  );

  const securityTableRows = useMemo(
    () => [
      ['Chrome on MacBook Pro', 'Current session', 'Warsaw', 'Trusted'],
      ['Companion App on iPhone', 'Biometric unlock', 'Home Wi-Fi', mfaRequired ? 'MFA enforced' : 'Biometric only'],
      ['Wall dashboard iPad', trustedNetworkLogin ? 'Trusted network' : 'Manual approval', 'Kitchen', 'Pinned'],
    ],
    [mfaRequired, trustedNetworkLogin]
  );

  const developerTableRows = useMemo(
    () => [
      ['Demo entities', demoMode ? 'Enabled' : 'Live connection', 'Entity overlay and mock activities'],
      ['Debug badges', debugBadgesEnabled ? 'Visible' : 'Hidden', 'Card-level preview markers'],
      ['Mock latency', mockLatencyEnabled ? '250ms' : 'Disabled', 'Interaction timing preview'],
      ['Navigation logging', 'Ready', 'Client route transitions'],
    ],
    [debugBadgesEnabled, demoMode, mockLatencyEnabled]
  );

  const actions = (
    <>
      <Link
        href="/profile"
        className="inline-flex items-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm font-medium text-text-primary hover:bg-surface-low transition-colors"
      >
        Settings home
        <Icon path={mdiChevronRight} size={16} className="text-text-secondary" />
      </Link>
      <Link
        href={getSettingsHref(slug === 'developer' ? 'system' : 'developer')}
        className="inline-flex items-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm font-medium text-text-primary hover:bg-surface-low transition-colors"
      >
        {slug === 'developer' ? 'Open system settings' : 'Open dev tools'}
        <Icon path={mdiChevronRight} size={16} className="text-text-secondary" />
      </Link>
    </>
  );

  if (slug === 'interface') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'Theme', value: formatLabel(theme), tone: 'primary' },
            { label: 'Mode', value: formatLabel(mode), tone: 'default' },
            { label: 'Background', value: formatLabel(background), tone: 'default' },
            { label: 'Density', value: compactCards ? 'Compact' : 'Comfortable', tone: 'success' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SettingsCard title="Visual preset" description="These controls update the live app shell immediately.">
            <div className="space-y-ha-4">
              <ChoiceGroup<Theme>
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={THEMES.map((entry) => ({
                  value: entry,
                  label: formatLabel(entry),
                  caption: entry === 'glass' ? 'Layered and airy' : entry === 'eink' ? 'Paper-like contrast' : 'Ready to use',
                }))}
              />
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
              <ChoiceGroup<Background>
                label="Background"
                value={background}
                onChange={setBackground}
                options={[
                  { value: 'gradient', label: 'Gradient', caption: 'Atmospheric surfaces' },
                  { value: 'image', label: 'Image', caption: 'Large visual backdrop' },
                  { value: 'none', label: 'None', caption: 'Flat surfaces only' },
                ]}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Interface preferences" description="Preview-only toggles for this prototype session.">
            <div className="space-y-ha-3">
              <ToggleRow
                label="Compact cards"
                description="Tighten vertical rhythm and keep more controls visible on one screen."
                checked={compactCards}
                onToggle={() => setCompactCards((value) => !value)}
              />
              <ToggleRow
                label="Reduced motion"
                description="Tone down transitions and animated flourishes during navigation."
                checked={reducedMotion}
                onToggle={() => setReducedMotion((value) => !value)}
              />
              <ToggleRow
                label="Desktop immersive mode"
                description="Keep content expanded and edge-to-edge when moving through subviews."
                checked={immersiveMode}
                onToggle={() => setImmersiveMode(!immersiveMode)}
              />
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="Applied settings" description="A quick audit table for the current presentation layer.">
          <DataTable
            headers={['Setting', 'Value', 'Area', 'State']}
            rows={interfaceTableRows}
          />
        </SettingsCard>
      </SettingsShell>
    );
  }

  if (slug === 'dashboards') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'Default', value: formatLabel(defaultDashboard), tone: 'primary' },
            { label: 'Pinned views', value: '4', tone: 'success' },
            { label: 'Room badges', value: showRoomBadges ? 'Visible' : 'Hidden', tone: 'default' },
            { label: 'Route mode', value: alwaysUseDefault ? 'Always default' : 'Resume last view', tone: 'warning' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[1fr_1fr]">
          <SettingsCard title="Landing behavior" description="Choose how the app decides where to start.">
            <div className="space-y-ha-4">
              <ChoiceGroup<'overview' | 'energy' | 'security' | 'climate'>
                label="Default dashboard"
                value={defaultDashboard}
                onChange={setDefaultDashboard}
                options={[
                  { value: 'overview', label: 'Overview', caption: 'Whole-home snapshot' },
                  { value: 'energy', label: 'Energy', caption: 'Usage and production' },
                  { value: 'security', label: 'Security', caption: 'Doors, cameras, alerts' },
                  { value: 'climate', label: 'Climate', caption: 'Comfort and HVAC' },
                ]}
              />
              <ToggleRow
                label="Always use default"
                description="Open the selected dashboard every time instead of returning to the last view."
                checked={alwaysUseDefault}
                onToggle={() => setAlwaysUseDefault((value) => !value)}
              />
              <ToggleRow
                label="Show room badges"
                description="Keep counts and state summaries visible on room shortcuts."
                checked={showRoomBadges}
                onToggle={() => setShowRoomBadges((value) => !value)}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Pinned collections" description="These surfaces stay easy to reach from the dashboard picker.">
            <div className="grid gap-ha-3 sm:grid-cols-2">
              {[
                { icon: mdiFolderHome, label: 'Overview', detail: 'Primary landing view' },
                { icon: mdiFlash, label: 'Energy', detail: 'Live consumption trends' },
                { icon: mdiShieldAccount, label: 'Security', detail: 'Camera and door status' },
                { icon: mdiTabletDashboard, label: 'Climate', detail: 'Comfort controls' },
              ].map((item) => (
                <div key={item.label} className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4">
                  <div className="flex items-center gap-ha-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                      <Icon path={item.icon} size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                      <div className="text-sm text-text-secondary">{item.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="Dashboard surfaces" description="Status and freshness for the main views available in this prototype.">
          <DataTable headers={['Dashboard', 'Role', 'Scope', 'Last opened']} rows={dashboardTableRows} />
        </SettingsCard>
      </SettingsShell>
    );
  }

  if (slug === 'cloud') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'Connection', value: connectionLabel, tone: connected ? 'success' : demoMode ? 'warning' : 'default' },
            { label: 'Backups', value: autoBackups ? 'Nightly' : 'Manual', tone: 'primary' },
            { label: 'Voice relay', value: voiceRelayEnabled ? 'Enabled' : 'Disabled', tone: 'default' },
            { label: 'Remote URL', value: remoteAccessEnabled ? 'Ready' : 'Off', tone: 'success' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[1fr_1fr]">
          <SettingsCard title="Cloud services" description="Preview how remote services are expected to behave.">
            <div className="space-y-ha-3">
              <ToggleRow
                label="Remote access"
                description="Allow access to the instance from outside the local network."
                checked={remoteAccessEnabled}
                onToggle={() => setRemoteAccessEnabled((value) => !value)}
              />
              <ToggleRow
                label="Encrypted cloud backups"
                description="Run nightly backups and keep the latest successful snapshot off-site."
                checked={autoBackups}
                onToggle={() => setAutoBackups((value) => !value)}
              />
              <ToggleRow
                label="Voice relay"
                description="Forward assistant actions through cloud relay for faster remote requests."
                checked={voiceRelayEnabled}
                onToggle={() => setVoiceRelayEnabled((value) => !value)}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Service overview" description="Current assumptions for the connected or demo environment.">
            <div className="grid gap-ha-3">
              {[
                { icon: mdiCloud, title: 'Cloud gateway', detail: demoMode ? 'Preview tunnel for the sample home' : haUrl || 'Awaiting a Home Assistant URL' },
                { icon: mdiDatabase, title: 'Backup retention', detail: autoBackups ? '14 rolling snapshots retained' : 'Backups created manually' },
                { icon: mdiWifi, title: 'Webhook bridge', detail: connected ? 'Secure webhook routes ready' : 'Routes activate after connection' },
              ].map((item) => (
                <div key={item.title} className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 flex items-center gap-ha-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                    <Icon path={item.icon} size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                    <div className="text-sm text-text-secondary">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="Cloud capability table" description="A compact operational view for remote services.">
          <DataTable headers={['Capability', 'Mode', 'Target', 'Status']} rows={cloudTableRows} />
        </SettingsCard>
      </SettingsShell>
    );
  }

  if (slug === 'mobile-app') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'Devices', value: '3 active', tone: 'primary' },
            { label: 'Push', value: pushEnabled ? 'Enabled' : 'Muted', tone: pushEnabled ? 'success' : 'warning' },
            { label: 'Sensor sync', value: sensorSyncEnabled ? 'On' : 'Off', tone: 'default' },
            { label: 'Critical alerts', value: criticalAlertsEnabled ? 'On' : 'Off', tone: 'warning' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[0.95fr_1.05fr]">
          <SettingsCard title="Mobile behavior" description="Control what companion devices are allowed to report and receive.">
            <div className="space-y-ha-3">
              <ToggleRow
                label="Push notifications"
                description="Allow dashboards and automations to send standard notifications."
                checked={pushEnabled}
                onToggle={() => setPushEnabled((value) => !value)}
              />
              <ToggleRow
                label="Sensor sync"
                description="Keep battery, network, and location sensors updated from companion devices."
                checked={sensorSyncEnabled}
                onToggle={() => setSensorSyncEnabled((value) => !value)}
              />
              <ToggleRow
                label="Critical alerts"
                description="Bypass silent mode for alarms, safety notices, and entry events."
                checked={criticalAlertsEnabled}
                onToggle={() => setCriticalAlertsEnabled((value) => !value)}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Shortcut surfaces" description="Tiles that stay one tap away inside the companion app.">
            <div className="grid gap-ha-3 sm:grid-cols-2">
              {[
                { icon: mdiViewDashboard, label: 'Overview snapshot', detail: 'Open to the main dashboard' },
                { icon: mdiBell, label: 'Critical alerts', detail: 'Jump straight to active notifications' },
                { icon: mdiDevices, label: 'Room controls', detail: 'Favorite device cards' },
                { icon: mdiCloud, label: 'Remote access', detail: 'Launch the secure external URL' },
              ].map((item) => (
                <div key={item.label} className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4">
                  <div className="flex items-center gap-ha-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                      <Icon path={item.icon} size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                      <div className="text-sm text-text-secondary">{item.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="Synced devices" description="Status for the companion surfaces attached to this preview.">
          <DataTable headers={['Device', 'Role', 'Delivery', 'Last seen']} rows={mobileTableRows} />
        </SettingsCard>
      </SettingsShell>
    );
  }

  if (slug === 'system') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'Source', value: connectionLabel, tone: connected ? 'success' : demoMode ? 'warning' : 'default' },
            { label: 'Refresh', value: autoRefreshEnabled ? '15s' : 'Manual', tone: 'primary' },
            { label: 'Immersive', value: immersiveMode ? 'Enabled' : 'Disabled', tone: 'default' },
            { label: 'Analytics', value: analyticsEnabled ? 'On' : 'Off', tone: 'warning' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[1fr_1fr]">
          <SettingsCard title="System behavior" description="These switches define how the shell behaves during day-to-day use.">
            <div className="space-y-ha-3">
              <ToggleRow
                label="Auto refresh dashboards"
                description="Refresh status-driven cards periodically while the app is open."
                checked={autoRefreshEnabled}
                onToggle={() => setAutoRefreshEnabled((value) => !value)}
              />
              <ToggleRow
                label="Desktop immersive mode"
                description="Prefer edge-to-edge desktop layout as the resting state."
                checked={immersiveMode}
                onToggle={() => setImmersiveMode(!immersiveMode)}
              />
              <ToggleRow
                label="Local analytics"
                description="Collect anonymous preview metrics in local storage for future tuning."
                checked={analyticsEnabled}
                onToggle={() => setAnalyticsEnabled((value) => !value)}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Service cards" description="Fast-glance status blocks for the active environment.">
            <div className="grid gap-ha-3">
              {[
                { icon: mdiCloud, title: 'Connection mode', detail: demoMode ? 'Running with bundled demo entities' : haUrl || 'Waiting for a live server' },
                { icon: mdiRefresh, title: 'Live refresh', detail: autoRefreshEnabled ? 'Background refresh every 15 seconds' : 'Manual refresh only' },
                { icon: mdiDatabase, title: 'Local diagnostics', detail: analyticsEnabled ? 'Local metrics buffered for analysis' : 'No diagnostics retained' },
              ].map((item) => (
                <div key={item.title} className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 flex items-center gap-ha-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                    <Icon path={item.icon} size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                    <div className="text-sm text-text-secondary">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="System state table" description="Useful values when reviewing the behavior of the current shell.">
          <DataTable headers={['Setting', 'Value', 'Scope', 'State']} rows={systemTableRows} />
        </SettingsCard>
      </SettingsShell>
    );
  }

  if (slug === 'about') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'Build', value: 'Preview shell', tone: 'primary' },
            { label: 'Data source', value: demoMode ? 'Bundled sample home' : 'Connected instance', tone: demoMode ? 'warning' : 'success' },
            { label: 'Activity feed', value: 'Enabled', tone: 'success' },
            { label: 'Release notes', value: 'Included', tone: 'default' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[1fr_1fr]">
          <SettingsCard title="Build summary" description="What this prototype is currently representing.">
            <div className="space-y-ha-3">
              {[
                { icon: mdiCheckCircle, title: 'Route-driven shell', detail: 'Settings pages, dashboards, and subviews render inside the same main content area.' },
                { icon: mdiCloud, title: 'Dual data mode', detail: demoMode ? 'Using the richer built-in fake dataset.' : 'Connected to your Home Assistant environment.' },
                { icon: mdiFlash, title: 'Activity-aware UI', detail: 'Live and simulated activities can surface in screensaver and mobile status views.' },
              ].map((item) => (
                <div key={item.title} className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 flex items-start gap-ha-4">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                    <Icon path={item.icon} size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                    <div className="mt-1 text-sm text-text-secondary">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard title="Recent notes" description="A compact changelog for the prototype direction.">
            <div className="space-y-ha-3">
              {[
                'New users now start in a populated demo home instead of a blocking setup screen.',
                'Maintenance includes a route back to live Home Assistant connection setup.',
                'Mobile navigation restores the correct active tab after closing search.',
                'Settings now open dedicated pages in the main content area.',
              ].map((note) => (
                <div key={note} className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm text-text-secondary">
                  {note}
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="Build detail table" description="Reference metadata for what this preview is surfacing.">
          <DataTable headers={['Topic', 'Value', 'Notes']} rows={aboutTableRows} />
        </SettingsCard>
      </SettingsShell>
    );
  }

  if (slug === 'security') {
    return (
      <SettingsShell meta={meta} actions={actions}>
        <StatGrid
          items={[
            { label: 'MFA', value: mfaRequired ? 'Required' : 'Optional', tone: mfaRequired ? 'success' : 'warning' },
            { label: 'Trusted networks', value: trustedNetworkLogin ? 'Enabled' : 'Disabled', tone: 'default' },
            { label: 'Sessions', value: '3 active', tone: 'primary' },
            { label: 'Approval flow', value: 'Biometric', tone: 'success' },
          ]}
        />

        <div className="grid gap-ha-4 xl:grid-cols-[1fr_1fr]">
          <SettingsCard title="Access policy" description="Preview controls for how users and companion devices are approved.">
            <div className="space-y-ha-3">
              <ToggleRow
                label="Require MFA"
                description="Enforce a second factor on browser sign-in and sensitive settings changes."
                checked={mfaRequired}
                onToggle={() => setMfaRequired((value) => !value)}
              />
              <ToggleRow
                label="Allow trusted network sign-in"
                description="Skip manual approval when the request comes from a known local network."
                checked={trustedNetworkLogin}
                onToggle={() => setTrustedNetworkLogin((value) => !value)}
              />
              <ToggleRow
                label="Biometric confirmation"
                description="Use Face ID or Touch ID for protected actions inside the companion app."
                checked={true}
                onToggle={() => undefined}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Security guidance" description="Current posture for the devices present in this preview.">
            <div className="space-y-ha-3">
              {[
                'Browser access is tied to session trust and can be tightened per device.',
                'Companion devices inherit biometric approval when critical actions are enabled.',
                'Trusted network logic only applies when the route is known to be local.',
              ].map((note) => (
                <div key={note} className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm text-text-secondary">
                  {note}
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard title="Active sessions" description="Representative browser and companion sessions for this account.">
          <DataTable headers={['Session', 'Access', 'Location', 'State']} rows={securityTableRows} />
        </SettingsCard>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell meta={meta} actions={actions}>
      <StatGrid
        items={[
          { label: 'Data mode', value: demoMode ? 'Demo entities' : 'Live integration', tone: demoMode ? 'warning' : 'success' },
          { label: 'Debug badges', value: debugBadgesEnabled ? 'Visible' : 'Hidden', tone: 'primary' },
          { label: 'Mock latency', value: mockLatencyEnabled ? 'Enabled' : 'Disabled', tone: 'default' },
          { label: 'Inspector', value: 'Ready', tone: 'success' },
        ]}
      />

      <div className="grid gap-ha-4 xl:grid-cols-[1fr_1fr]">
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
              onToggle={() => {
                if (!demoMode) enableDemoMode();
              }}
            />
          </div>
        </SettingsCard>

        <SettingsCard title="Developer shortcuts" description="Helpful destinations while iterating on the prototype.">
          <div className="grid gap-ha-3">
            {[
              { href: getSettingsHref('system'), icon: mdiCog, label: 'System settings', detail: 'Review live shell behavior and connection state' },
              { href: getSettingsHref('about'), icon: mdiInformation, label: 'About page', detail: 'See build notes and preview scope' },
              { href: getSettingsHref('cloud'), icon: mdiCloud, label: 'Cloud settings', detail: 'Check live versus demo connectivity assumptions' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 flex items-center gap-ha-4 hover:bg-surface-low transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
                  <Icon path={item.icon} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                  <div className="text-sm text-text-secondary">{item.detail}</div>
                </div>
                <Icon path={mdiChevronRight} size={18} className="text-text-secondary" />
              </Link>
            ))}
          </div>
        </SettingsCard>
      </div>

      <SettingsCard title="Prototype diagnostics" description="A lightweight table for state that often matters during UI iteration.">
        <DataTable headers={['Flag', 'State', 'Purpose']} rows={developerTableRows} />
      </SettingsCard>
    </SettingsShell>
  );
}
