'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector, useTheme } from '@/hooks';
import { arePrimaryPeopleEqual, selectPrimaryPerson } from '@/lib/homeassistant/selectors';
import { getSettingsHref, settingsNavSections, settingsQuickActions, type SettingsNavLink } from './settingsNavigation';
import { mdiChevronRight } from '@mdi/js';

interface ProfileContentProps {
  onNavigate?: () => void;
}

interface ProfileItemProps {
  item: SettingsNavLink;
  value: string;
  onNavigate?: () => void;
}

function ProfileItem({ item, value, onNavigate }: ProfileItemProps) {
  return (
    <Link
      href={getSettingsHref(item.slug)}
      onClick={onNavigate}
      className="w-full flex items-center gap-ha-4 px-ha-4 py-ha-4 hover:bg-surface-mid/50 active:bg-surface-mid transition-colors text-left group first:rounded-t-ha-2xl last:rounded-b-ha-2xl border-b border-surface-low/40 last:border-0 min-h-[64px]"
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-ha-xl flex-shrink-0 bg-surface-mid text-text-secondary group-hover:text-text-primary group-hover:bg-surface-lower transition-colors">
        <Icon path={item.icon} size={22} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-text-primary leading-tight">{item.label}</p>
        <p className="text-sm text-text-secondary truncate mt-0.5">{value}</p>
      </div>

      <Icon path={mdiChevronRight} size={22} className="text-text-disabled flex-shrink-0" />
    </Link>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-ha-2">
      {title && (
        <h3 className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider px-ha-2">
          {title}
        </h3>
      )}
      <div className="bg-surface-default rounded-ha-2xl border border-surface-lower overflow-hidden shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
        {children}
      </div>
    </div>
  );
}

function formatThemeName(value: string) {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

export function ProfileContent({ onNavigate }: ProfileContentProps) {
  const { haUrl, connected, demoMode } = useHomeAssistant();
  const { theme, mode } = useTheme();
  const primaryPerson = useHomeAssistantSelector(selectPrimaryPerson, arePrimaryPeopleEqual);

  const user = React.useMemo(() => {
    if (primaryPerson) {
      return {
        name: primaryPerson.name || 'User',
        picture: primaryPerson.picture ? `${haUrl}${primaryPerson.picture}` : undefined,
        initials: primaryPerson.initials,
      };
    }
    return { name: 'Home Assistant User', picture: undefined, initials: 'U' };
  }, [primaryPerson, haUrl]);

  const itemSummaries = React.useMemo<Record<SettingsNavLink['slug'], string>>(() => ({
    interface: `${formatThemeName(theme)} theme · ${mode === 'system' ? 'Follow system' : formatThemeName(mode)}`,
    dashboards: 'Overview is default · Room cards enabled',
    cloud: demoMode ? 'Preview mode active' : connected ? 'Remote access available' : 'Connection not active',
    'mobile-app': '2 devices synced · Critical alerts on',
    system: 'Automation, navigation, and service behavior',
    about: demoMode ? 'Preview build with demo data' : 'Live environment details and release notes',
    security: 'Sessions, MFA, and trusted devices',
    developer: demoMode ? 'Mock data and preview tools ready' : 'Feature flags and connection diagnostics',
  }), [connected, demoMode, mode, theme]);

  return (
    <div className="space-y-ha-7 lg:space-y-ha-8 pb-ha-8 max-w-2xl lg:max-w-none mx-auto">
      <div className="bg-surface-default rounded-ha-3xl p-ha-6 lg:p-ha-8 border border-surface-lower shadow-[0_18px_42px_-30px_rgba(15,23,42,0.32)]">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-ha-5 lg:gap-ha-8">
          <div className="relative flex-shrink-0">
            <Avatar
              src={user.picture}
              initials={user.initials}
              size="xl"
              className="ring-4 ring-surface-mid shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 bg-surface-mid w-6 h-6 rounded-full border-4 border-surface-low shadow-sm" />
          </div>

          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-text-primary mb-1">{user.name}</h2>
            <p className="text-sm text-text-secondary font-medium inline-block px-ha-3 py-1 bg-surface-mid rounded-full mb-ha-5">
              Administrator
            </p>

            <div className="grid grid-cols-2 gap-ha-3 lg:max-w-md">
              {settingsQuickActions.map((action) => (
                <Link
                  key={action.slug}
                  href={getSettingsHref(action.slug)}
                  onClick={onNavigate}
                  className="flex flex-col items-center justify-center p-ha-4 bg-surface-low hover:bg-surface-mid rounded-ha-2xl border border-surface-lower transition-colors gap-ha-1 text-center"
                >
                  <Icon path={action.icon} size={24} className="text-text-secondary" />
                  <span className="text-xs font-bold text-text-primary uppercase tracking-tight">{action.label}</span>
                  <span className="text-[11px] text-text-secondary leading-tight">{action.description}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-ha-6 space-y-ha-6 lg:space-y-0">
        {settingsNavSections.map((section) => (
          <div key={section.title} className="space-y-ha-6">
            <Section title={section.title}>
              {section.items.map((item) => (
                <ProfileItem
                  key={item.slug}
                  item={item}
                  value={itemSummaries[item.slug]}
                  onNavigate={onNavigate}
                />
              ))}
            </Section>
          </div>
        ))}
      </div>
    </div>
  );
}
