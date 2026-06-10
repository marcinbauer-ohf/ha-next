'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Icon, SearchField } from '../ui';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector, useDeviceStructure } from '@/hooks';
import { getHaVersion } from '@/lib/homeassistant';
import { APP_BUILD } from '@/lib/version';
import {
  arePrimaryPeopleEqual,
  selectPrimaryPerson,
} from '@/lib/homeassistant/selectors';
import {
  settingsNavSections,
  categoryAccents,
  type SettingsNavLink,
  type SettingsSlug,
} from './settingsNavigation';
import { mdiChevronRight, mdiRestart, mdiRestartAlert, mdiPower } from '@mdi/js';

// Most common Home Assistant system power commands — mirrors the power menu on
// HA's own Settings → System page. Reboot/shutdown are Supervisor services
// (hassio.*) and only work on Supervised/OS installs; on core-only installs the
// call errors harmlessly (callService swallows it).
const SYSTEM_COMMANDS = [
  { key: 'restart', label: 'Restart Home Assistant', icon: mdiRestart, domain: 'homeassistant', service: 'restart', danger: false },
  { key: 'reboot', label: 'Reboot Host', icon: mdiRestartAlert, domain: 'hassio', service: 'host_reboot', danger: false },
  { key: 'shutdown', label: 'Shut Down', icon: mdiPower, domain: 'hassio', service: 'host_shutdown', danger: true },
] as const;

interface SettingsNavPanelProps {
  activeSlug: SettingsSlug | null;
  onSelect: (slug: SettingsSlug) => void;
  /** Background color token for sticky search gradient — match the container. Default: surface-lower (desktop page) */
  bg?: 'surface-lower' | 'surface-default';
}

function NavItem({
  item,
  subtitle,
  isActive,
  onSelect,
  accent,
}: {
  item: SettingsNavLink;
  subtitle: string;
  isActive: boolean;
  onSelect: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-ha-3 px-ha-4 text-left transition-colors border-b border-surface-low/40 last:border-0 py-ha-3 ${
        subtitle ? 'min-h-[60px]' : ''
      } ${
        isActive ? 'bg-surface-mid' : 'hover:bg-surface-mid/50 active:bg-surface-mid'
      }`}
    >
      {/* Colored icon tile — translucent tint reads on both light and dark themes. */}
      <div
        className="w-9 h-9 flex items-center justify-center rounded-ha-xl flex-shrink-0"
        style={{ backgroundColor: `${accent}24`, color: accent }}
      >
        <Icon path={item.icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-text-primary">
          {item.label}
        </p>
        {subtitle && (
          <p className="text-[13px] text-text-secondary truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      <Icon
        path={mdiChevronRight}
        size={16}
        className={isActive ? 'text-text-secondary' : 'text-text-disabled'}
      />
    </button>
  );
}

export function SettingsNavPanel({ activeSlug, onSelect, bg = 'surface-lower' }: SettingsNavPanelProps) {
  const { haUrl, connected, demoMode, callService } = useHomeAssistant();
  const { devices } = useDeviceStructure();
  const primaryPerson = useHomeAssistantSelector(selectPrimaryPerson, arePrimaryPeopleEqual);
  const [searchQuery, setSearchQuery] = useState('');
  const haVersion = getHaVersion();
  const systemControlsEnabled = connected && !demoMode;

  const runSystemCommand = useCallback(
    (cmd: (typeof SYSTEM_COMMANDS)[number]) => {
      if (!connected || demoMode) return;
      const confirmed = window.confirm(
        `${cmd.label}? Home Assistant will be interrupted and may take a minute to come back.`,
      );
      if (!confirmed) return;
      callService({ domain: cmd.domain, service: cmd.service });
    },
    [connected, demoMode, callService],
  );

  const user = useMemo(() => {
    if (primaryPerson) {
      return {
        name: primaryPerson.name || 'User',
        picture: primaryPerson.picture ? `${haUrl}${primaryPerson.picture}` : undefined,
        initials: primaryPerson.initials,
      };
    }
    return { name: 'Home Assistant User', picture: undefined, initials: 'U' };
  }, [primaryPerson, haUrl]);

  // Only show subtitles when they carry real info (status, counts, timestamps, calls to action).
  // Empty string = no subtitle rendered.
  const subtitles = useMemo<Partial<Record<SettingsSlug, string>>>(() => ({
    // Devices — show live counts
    devices: `${devices.length} registered`,
    integrations: demoMode ? '6 active' : connected ? '6 active' : 'Check connection',

    // System — timestamps / state
    backups: demoMode ? 'Last backup 2 hours ago' : connected ? 'Last backup 2 hours ago' : '',

    // Prototype & debug tools — live state
    developer: demoMode ? 'Demo data active' : '',
  }), [connected, demoMode, devices.length]);

  const visibleSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return settingsNavSections;
    return settingsNavSections
      .map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q),
        ),
      }))
      .filter(section => section.items.length > 0);
  }, [searchQuery]);

  return (
    <div>
      {/* Search — sticky at top. z-30 keeps it above the mobile bottom-sheet's own top fade (z-20). */}
      <div className="sticky top-0 z-30">
        <div className={`${bg === 'surface-default' ? 'bg-surface-default' : 'bg-surface-lower'} pt-ha-1 pb-ha-3`}>
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search settings…"
            onClear={() => setSearchQuery('')}
          />
        </div>
        {/* Gradient fades nav items scrolling under the sticky search */}
        <div className={`h-6 bg-gradient-to-b ${bg === 'surface-default' ? 'from-surface-default' : 'from-surface-lower'} to-transparent pointer-events-none`} />
      </div>

      {/* Profile card — below search, scrolls away. Clickable like the nav items. */}
      <button
        type="button"
        onClick={() => onSelect('profile')}
        className={`w-full text-left flex items-center gap-ha-4 rounded-ha-3xl p-ha-5 border border-surface-lower shadow-[0_18px_42px_-30px_rgba(15,23,42,0.32)] mb-ha-4 transition-colors ${
          activeSlug === 'profile' ? 'bg-surface-mid' : 'bg-surface-default hover:bg-surface-low active:bg-surface-mid'
        }`}
      >
        <Avatar src={user.picture} initials={user.initials} size="lg" className="ring-4 ring-surface-mid shadow flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-text-primary leading-tight">{user.name}</h2>
          <p className="text-[13px] text-text-secondary font-medium px-ha-2 py-0.5 bg-surface-mid rounded-full inline-block mt-0.5">
            Administrator
          </p>
        </div>
        <Icon path={mdiChevronRight} size={20} className="text-text-disabled flex-shrink-0" />
      </button>

      {/* Nav sections — all categories share one card, grouped by extra spacing. */}
      <div className="pb-ha-5">
        {visibleSections.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-ha-6">No results for &ldquo;{searchQuery}&rdquo;</p>
        ) : (
          <div className="bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
            {visibleSections.map((section, idx) => {
              const accent = categoryAccents[section.title] ?? '#64748b';
              return (
                <div key={section.title || '__top'} className={idx > 0 ? 'pt-ha-4' : ''}>
                  {section.items.map((item) => (
                    <NavItem
                      key={item.slug}
                      item={item}
                      subtitle={subtitles[item.slug] ?? ''}
                      isActive={activeSlug === item.slug}
                      onSelect={() => onSelect(item.slug)}
                      accent={accent}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* System power controls — hidden while searching to keep results clean. */}
      {!searchQuery.trim() && (
        <div className="pb-ha-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-text-tertiary px-ha-3 pb-ha-2">
            System
          </p>
          <div className="bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
            {SYSTEM_COMMANDS.map((cmd) => (
              <button
                key={cmd.key}
                type="button"
                disabled={!systemControlsEnabled}
                onClick={() => runSystemCommand(cmd)}
                className={`w-full flex items-center gap-ha-3 px-ha-4 py-ha-3 text-left border-b border-surface-low/40 last:border-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  cmd.danger
                    ? 'hover:bg-red-500/10 active:bg-red-500/15'
                    : 'hover:bg-surface-mid/50 active:bg-surface-mid'
                }`}
              >
                <div
                  className={`w-9 h-9 flex items-center justify-center rounded-ha-xl flex-shrink-0 ${
                    cmd.danger ? 'bg-red-500/15 text-red-500' : 'bg-surface-mid text-text-secondary'
                  }`}
                >
                  <Icon path={cmd.icon} size={18} />
                </div>
                <span className={`text-[13px] font-semibold ${cmd.danger ? 'text-red-500' : 'text-text-primary'}`}>
                  {cmd.label}
                </span>
              </button>
            ))}
          </div>
          {!systemControlsEnabled && (
            <p className="text-[13px] text-text-tertiary px-ha-3 pt-ha-2">
              Connect to Home Assistant to use system controls.
            </p>
          )}
        </div>
      )}

      {/* Running software version — pinned at the very bottom of the column. */}
      <div className="pt-ha-1 pb-ha-6 text-center">
        <p className="text-[13px] text-text-tertiary">
          {connected && haVersion
            ? `Home Assistant ${haVersion}`
            : demoMode
              ? 'Demo mode'
              : 'Not connected'}
        </p>
        <p className="text-[13px] text-text-disabled mt-0.5">Dashboard {APP_BUILD}</p>
      </div>
    </div>
  );
}
