'use client';

import React from 'react';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import { arePrimaryPeopleEqual, selectPrimaryPerson } from '@/lib/homeassistant/selectors';
import {
  mdiChevronRight,
  mdiPalette,
  mdiTranslate,
  mdiViewDashboard,
  mdiCloud,
  mdiCellphone,
  mdiCog,
  mdiInformation,
  mdiLogout,
  mdiWeatherNight,
  mdiCompare,
  mdiShieldAccount,
  mdiAlphaDBox,
} from '@mdi/js';

interface ProfileItemProps {
  icon: string;
  label: string;
  value?: string;
  onClick?: () => void;
  isSwitch?: boolean;
  isOn?: boolean;
}

function ProfileItem({ icon, label, value, onClick, isSwitch, isOn }: ProfileItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-ha-4 px-ha-4 py-ha-4 hover:bg-surface-mid/50 active:bg-surface-mid transition-colors text-left group first:rounded-t-ha-2xl last:rounded-b-ha-2xl border-b border-surface-low/40 last:border-0 min-h-[64px]"
    >
      {/* Icon badge */}
      <div className="w-10 h-10 flex items-center justify-center rounded-ha-xl flex-shrink-0 bg-surface-mid text-text-secondary group-hover:text-text-primary group-hover:bg-surface-lower transition-colors">
        <Icon path={icon} size={22} />
      </div>

      {/* Label + value */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-text-primary leading-tight">{label}</p>
        {value && <p className="text-sm text-text-secondary truncate mt-0.5">{value}</p>}
      </div>

      {/* Right control */}
      <div className="flex items-center gap-ha-2 flex-shrink-0">
        {isSwitch ? (
          <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-0.5 ${isOn ? 'bg-text-secondary/45' : 'bg-surface-mid'}`}>
            <div className={`w-6 h-6 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        ) : (
          <Icon path={mdiChevronRight} size={22} className="text-text-disabled" />
        )}
      </div>
    </button>
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
      <div className="bg-surface-low rounded-ha-2xl border border-surface-low/80 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function ProfileContent() {
  const { haUrl } = useHomeAssistant();
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

  return (
    <div className="space-y-ha-7 lg:space-y-ha-8 pb-ha-8 max-w-2xl lg:max-w-none mx-auto">
      {/* User Header Card */}
      <div className="bg-surface-low rounded-ha-3xl p-ha-6 lg:p-ha-8 border border-surface-low/80">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-ha-5 lg:gap-ha-8">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar
              src={user.picture}
              initials={user.initials}
              size="xl"
              className="ring-4 ring-surface-mid shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 bg-surface-mid w-6 h-6 rounded-full border-4 border-surface-low shadow-sm" />
          </div>

          {/* User info */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-text-primary mb-1">{user.name}</h2>
            <p className="text-sm text-text-secondary font-medium inline-block px-ha-3 py-1 bg-surface-mid rounded-full mb-ha-5">
              Administrator
            </p>

            {/* Quick-action buttons */}
            <div className="grid grid-cols-2 gap-ha-3 lg:max-w-xs">
              <button className="flex flex-col items-center justify-center p-ha-4 bg-surface-mid/40 hover:bg-surface-mid rounded-ha-2xl border border-surface-low/70 transition-colors gap-ha-1">
                <Icon path={mdiShieldAccount} size={24} className="text-text-secondary" />
                <span className="text-xs font-bold text-text-primary uppercase tracking-tight">Security</span>
              </button>
              <button className="flex flex-col items-center justify-center p-ha-4 bg-surface-mid/40 hover:bg-surface-mid rounded-ha-2xl border border-surface-low/70 transition-colors gap-ha-1">
                <Icon path={mdiAlphaDBox} size={24} className="text-text-secondary" />
                <span className="text-xs font-bold text-text-primary uppercase tracking-tight">Dev Tools</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: two-column layout for settings sections */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-ha-6 space-y-ha-6 lg:space-y-0">
        {/* Left column */}
        <div className="space-y-ha-6">
          {/* User Interface */}
          <Section title="User Interface">
            <ProfileItem
              icon={mdiPalette}
              label="Theme"
              value="Backend-selected"
            />
            <ProfileItem
              icon={mdiWeatherNight}
              label="Dark Mode"
              isSwitch
              isOn={true}
            />
            <ProfileItem
              icon={mdiTranslate}
              label="Language"
              value="English (US)"
            />
          </Section>

          {/* Dashboards */}
          <Section title="Dashboards">
            <ProfileItem
              icon={mdiViewDashboard}
              label="Default Dashboard"
              value="Overview"
            />
            <ProfileItem
              icon={mdiCompare}
              label="Always Use Default"
              isSwitch
              isOn={false}
            />
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-ha-6">
          {/* Connection & App */}
          <Section title="Connection & App">
            <ProfileItem
              icon={mdiCloud}
              label="Home Assistant Cloud"
              value="Connected"
            />
            <ProfileItem
              icon={mdiCellphone}
              label="Companion App"
              value="iOS Preview v2024.1"
            />
          </Section>

          {/* System */}
          <Section title="System">
            <ProfileItem
              icon={mdiCog}
              label="General Settings"
            />
            <ProfileItem
              icon={mdiInformation}
              label="About Home Assistant"
              value="2024.2.0"
            />
            <ProfileItem
              icon={mdiLogout}
              label="Log Out"
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
