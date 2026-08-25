'use client';

import { useEffect, useState } from 'react';
import {
  mdiHomeVariant,
  mdiMapMarkerOutline,
  mdiEarth,
  mdiOpenInNew,
} from '@mdi/js';
import { Icon } from '../ui/Icon';
import { useHomeAssistant } from '@/hooks';
import { useHomeName, setHomeName } from '@/lib/homeName';
import { HomeModeSettings } from './HomeModeSettings';
import { useDebugFlags } from '@/contexts';
import type { HaCoreConfig } from '@/lib/homeassistant';

// Representative values so the page reads as a real home in demo mode (no live
// core config to fetch). Mirrors the demo home's zone coordinates.
const DEMO_CONFIG: HaCoreConfig = {
  location_name: 'Home',
  latitude: 52.3676,
  longitude: 4.9041,
  elevation: 3,
  time_zone: 'Europe/Amsterdam',
  currency: 'EUR',
  country: 'NL',
  language: 'en',
  unit_system: { length: 'km', mass: 'g', temperature: '°C', volume: 'L' },
};

function unitSystemLabel(cfg: HaCoreConfig): string {
  const t = cfg.unit_system.temperature;
  if (t === '°C') return 'Metric';
  if (t === '°F') return 'US customary';
  return 'Custom';
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 lg:p-ha-6 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)]">
      <div className="mb-ha-4 flex items-center gap-ha-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ha-xl bg-surface-low text-text-secondary">
          <Icon path={icon} size={20} />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-ha-3 py-2.5 border-b border-surface-lower last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right">{value}</span>
    </div>
  );
}

/**
 * Home Information — the page behind "Edit home" on the Home Center hero. Shows
 * the same core details Home Assistant manages (name, location, regional units)
 * as read-only fields with an "Edit in Home Assistant" deep link, plus the
 * Home Mode configuration which is app-local. Editable home name is app-local
 * too (localStorage), matching how onboarding sets it.
 */
export function HomeInformation() {
  const { demoMode, connected, haUrl, getCoreConfig } = useHomeAssistant();
  const { homeModeEnabled } = useDebugFlags();
  const homeName = useHomeName();
  const [nameDraft, setNameDraft] = useState(homeName);
  // Reconcile the editable field when the stored name changes elsewhere
  // (onboarding, another tab) — the render-time pattern, not an effect.
  const [seenName, setSeenName] = useState(homeName);
  if (seenName !== homeName) {
    setSeenName(homeName);
    setNameDraft(homeName);
  }

  // undefined = not fetched yet, null = fetched but unavailable, object = loaded.
  const [config, setConfig] = useState<HaCoreConfig | null | undefined>(undefined);

  useEffect(() => {
    if (demoMode || !connected) return;
    let cancelled = false;
    getCoreConfig().then((cfg) => {
      if (!cancelled) setConfig(cfg ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [demoMode, connected, getCoreConfig]);

  const effectiveConfig = demoMode ? DEMO_CONFIG : config;
  const loading = !demoMode && connected && effectiveConfig === undefined;

  const commitName = () => {
    const next = nameDraft.trim();
    if (next && next !== homeName) setHomeName(next);
    else setNameDraft(homeName);
  };

  const haGeneralUrl = haUrl ? `${haUrl.replace(/\/$/, '')}/config/general` : null;

  return (
    <div className="space-y-ha-6">
      <InfoCard title="Home name" icon={mdiHomeVariant}>
        <p className="mb-ha-3 text-sm text-text-secondary">
          Shown on your dashboard and across the app.
        </p>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="Home"
          className="w-full rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3 text-sm font-medium text-text-primary outline-none transition-colors focus:bg-surface-default"
        />
      </InfoCard>

      <InfoCard title="Location" icon={mdiMapMarkerOutline}>
        {loading ? (
          <div className="h-24 animate-pulse rounded-ha-2xl bg-surface-low" />
        ) : effectiveConfig ? (
          <div>
            <InfoRow label="Name" value={effectiveConfig.location_name || '—'} />
            <InfoRow
              label="Coordinates"
              value={`${effectiveConfig.latitude.toFixed(4)}, ${effectiveConfig.longitude.toFixed(4)}`}
            />
            <InfoRow label="Elevation" value={`${effectiveConfig.elevation} m`} />
            <InfoRow label="Time zone" value={effectiveConfig.time_zone || '—'} />
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">Connect to Home Assistant to see your location.</p>
        )}
      </InfoCard>

      <InfoCard title="Regional" icon={mdiEarth}>
        {loading ? (
          <div className="h-24 animate-pulse rounded-ha-2xl bg-surface-low" />
        ) : effectiveConfig ? (
          <div>
            <InfoRow label="Unit system" value={unitSystemLabel(effectiveConfig)} />
            <InfoRow label="Temperature" value={effectiveConfig.unit_system.temperature} />
            <InfoRow label="Currency" value={effectiveConfig.currency || '—'} />
            <InfoRow label="Country" value={effectiveConfig.country || '—'} />
            <InfoRow label="Language" value={effectiveConfig.language || '—'} />
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">Connect to Home Assistant to see regional settings.</p>
        )}
      </InfoCard>

      {/* Home Mode is app-local config, edited here directly. */}
      {homeModeEnabled && <HomeModeSettings />}

      {/* Location, regional and language settings are managed by Home Assistant
          itself — deep-link out rather than duplicate its editors. */}
      {!demoMode && haGeneralUrl && (
        <a
          href={haGeneralUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-ha-2 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary active:bg-surface-mid"
        >
          <Icon path={mdiOpenInNew} size={18} />
          Edit these in Home Assistant
        </a>
      )}
    </div>
  );
}
