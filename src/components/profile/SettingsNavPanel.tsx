'use client';

import React, { useMemo, useState } from 'react';
import { Icon, SectionLabel, SearchField } from '../ui';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector, useImmersiveMode, useTheme, useDevices } from '@/hooks';
import {
  arePrimaryPeopleEqual,
  areSimulationEntitiesEqual,
  selectPrimaryPerson,
  selectSimulationEntities,
} from '@/lib/homeassistant/selectors';
import {
  settingsNavSections,
  type SettingsNavLink,
  type SettingsSlug,
} from './settingsNavigation';
import { mdiChevronRight } from '@mdi/js';

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
}: {
  item: SettingsNavLink;
  subtitle: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-ha-3 px-ha-4 text-left transition-colors border-b border-surface-low/40 last:border-0 ${
        subtitle ? 'py-ha-3 min-h-[60px]' : 'py-ha-3'
      } ${
        isActive
          ? 'bg-surface-mid'
          : 'hover:bg-surface-mid/50 active:bg-surface-mid'
      }`}
    >
      <div className={`w-9 h-9 flex items-center justify-center rounded-ha-xl flex-shrink-0 transition-colors ${
        isActive ? 'bg-surface-low text-text-primary' : 'bg-surface-mid text-text-secondary'
      }`}>
        <Icon path={item.icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-text-primary">
          {item.label}
        </p>
        {subtitle && (
          <p className="text-[11px] text-text-secondary truncate mt-0.5">{subtitle}</p>
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
  const { haUrl, connected, demoMode } = useHomeAssistant();
  const { theme, mode } = useTheme();
  const { immersiveMode } = useImmersiveMode();
  const { devices } = useDevices();
  const primaryPerson = useHomeAssistantSelector(selectPrimaryPerson, arePrimaryPeopleEqual);
  const simulationEntities = useHomeAssistantSelector(selectSimulationEntities, areSimulationEntitiesEqual);
  const [searchQuery, setSearchQuery] = useState('');

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

  const themeLabel = useMemo(() => {
    const names: Record<string, string> = {
      default: 'Default', glass: 'Glass', teenage: 'Teenage Engineering',
      cyberpunk: 'Cyberpunk', material: 'Material Design', eink: 'E-Ink', fallout: 'Fallout',
    };
    return names[theme] ?? theme;
  }, [theme]);

  // Only show subtitles when they carry real info (status, counts, timestamps, calls to action).
  // Empty string = no subtitle rendered.
  const subtitles = useMemo<Partial<Record<SettingsSlug, string>>>(() => ({
    // Devices — show live counts
    devices: `${devices.length} registered`,
    integrations: demoMode ? '6 active' : connected ? '6 active' : 'Check connection',

    // System — timestamps / state
    backups: demoMode ? 'Last backup 2 hours ago' : connected ? 'Last backup 2 hours ago' : '',
    maintenance: demoMode ? 'Demo mode active' : connected ? 'Connected' : 'Not connected',

    // Prototype tools — live state
    dashboards: `${devices.length} devices`,
    'theme-layout': `${themeLabel} · ${mode === 'system' ? 'Auto' : mode}`,
    'task-bar': simulationEntities.length > 0
      ? `${simulationEntities.length} ${simulationEntities.length === 1 ? 'activity' : 'activities'} running`
      : '',
    developer: demoMode ? 'Demo data active' : '',
  }), [connected, demoMode, devices.length, immersiveMode, mode, simulationEntities.length, themeLabel]);

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
          <p className="text-[11px] text-text-secondary font-medium px-ha-2 py-0.5 bg-surface-mid rounded-full inline-block mt-0.5">
            Administrator
          </p>
        </div>
        <Icon path={mdiChevronRight} size={20} className="text-text-disabled flex-shrink-0" />
      </button>

      {/* Nav sections */}
      <div className="space-y-ha-5 pb-ha-5">
        {visibleSections.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-ha-6">No results for &ldquo;{searchQuery}&rdquo;</p>
        ) : (
          visibleSections.map((section) => (
            <div key={section.title || '__top'}>
              {section.title && <SectionLabel className="px-ha-2 mb-ha-3">{section.title}</SectionLabel>}
              <div className="bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden">
                {section.items.map((item) => (
                  <NavItem
                    key={item.slug}
                    item={item}
                    subtitle={subtitles[item.slug] ?? ''}
                    isActive={activeSlug === item.slug}
                    onSelect={() => onSelect(item.slug)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
