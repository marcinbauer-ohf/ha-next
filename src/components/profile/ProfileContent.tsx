'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { Icon, ListSection, SectionLabel } from '../ui';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector, useImmersiveMode, useTheme, useFeatureFlags } from '@/hooks';
import {
  arePrimaryPeopleEqual,
  areSimulationEntitiesEqual,
  selectPrimaryPerson,
  selectSimulationEntities,
} from '@/lib/homeassistant/selectors';
import { getSettingsHref, settingsNavSections, type SettingsNavLink } from './settingsNavigation';
import { mdiChevronRight, mdiInformationOutline } from '@mdi/js';
import { Tooltip } from '../ui/Tooltip';
import { useScreensaver } from '@/contexts';
import { createSimulatedActivityEntity, simulationPrefixes, type SimulationType } from '@/lib/homeassistant/simulatedActivities';
import type { ColorMode } from '@/hooks/useTheme';

interface ProfileContentProps {
  onNavigate?: () => void;
  onClose?: () => void;
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
  return <ListSection title={title} className="shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">{children}</ListSection>;
}

function DebugSectionHeader({ label }: { label: string }) {
  return (
    <div className="px-ha-4 pt-ha-3 pb-ha-1 border-b border-surface-low/40">
      <SectionLabel>{label}</SectionLabel>
    </div>
  );
}

function DebugRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-ha-4 py-ha-3 border-b border-surface-low/40 last:border-0 gap-ha-4 min-h-[48px]">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <div className="flex items-center gap-ha-2 flex-shrink-0">{children}</div>
    </div>
  );
}

function DebugToggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`h-6 w-10 rounded-full px-0.5 flex items-center transition-colors flex-shrink-0 ${checked ? 'bg-ha-blue/50' : 'bg-surface-mid'}`}
    >
      <div className={`h-5 w-5 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

const SIM_DEFS: Array<{ type: Exclude<SimulationType, 'release'>; label: string }> = [
  { type: 'media', label: 'Media' },
  { type: 'timer', label: 'Timer' },
  { type: 'camera', label: 'Camera' },
  { type: 'printer', label: 'Printer' },
];

export function ProfileContent({ onNavigate, onClose }: ProfileContentProps) {
  const { haUrl, demoMode, setMockEntity, enableDemoMode } = useHomeAssistant();
  const { mode, setTheme, setMode, setBackground } = useTheme();
  const { immersiveMode, toggleImmersiveMode } = useImmersiveMode();
  const { desktopSplitViewEnabled, toggleDesktopSplitView } = useFeatureFlags();
  const { isActive: screensaverActive, activate: activateScreensaver, dismiss: dismissScreensaver } = useScreensaver();
  const primaryPerson = useHomeAssistantSelector(selectPrimaryPerson, arePrimaryPeopleEqual);
  const simulationEntities = useHomeAssistantSelector(selectSimulationEntities, areSimulationEntitiesEqual);

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

  const itemSummaries = React.useMemo<Partial<Record<SettingsNavLink['slug'], string>>>(() => ({
    developer: demoMode ? 'Mock data and preview tools ready' : 'Feature flags and connection diagnostics',
  }), [demoMode]);

  const getSimCount = useCallback((prefix: string) =>
    simulationEntities.filter((e) => e.id.startsWith(prefix)).length,
  [simulationEntities]);

  const addSim = useCallback((type: Exclude<SimulationType, 'release'>) => {
    const prefix = simulationPrefixes[type];
    const existing = simulationEntities.filter((e) => e.id.startsWith(prefix));
    if (existing.length === 0) {
      setMockEntity(prefix, createSimulatedActivityEntity(type, prefix));
      return;
    }
    let counter = 2;
    while (existing.some((e) => e.id === `${prefix}_${counter}`)) counter++;
    setMockEntity(`${prefix}_${counter}`, createSimulatedActivityEntity(type, `${prefix}_${counter}`));
  }, [simulationEntities, setMockEntity]);

  const removeSim = useCallback((type: Exclude<SimulationType, 'release'>) => {
    const prefix = simulationPrefixes[type];
    const existing = simulationEntities.filter((e) => e.id.startsWith(prefix));
    if (existing.length === 0) return;
    setMockEntity(existing[existing.length - 1].id, null);
  }, [simulationEntities, setMockEntity]);

  const toggleRelease = useCallback(() => {
    const prefix = simulationPrefixes.release;
    const existing = simulationEntities.filter((e) => e.id.startsWith(prefix));
    if (existing.length > 0) {
      existing.forEach((e) => setMockEntity(e.id, null));
    } else {
      setMockEntity(prefix, createSimulatedActivityEntity('release', prefix));
    }
  }, [simulationEntities, setMockEntity]);

  const resetLayout = useCallback(() => {
    setTheme('default');
    setMode('system');
    setBackground('none');
    if (immersiveMode) toggleImmersiveMode();
  }, [setTheme, setMode, setBackground, immersiveMode, toggleImmersiveMode]);

  const releaseCount = getSimCount(simulationPrefixes.release);

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

            <Link
              href="/settings"
              onClick={onNavigate}
              className="inline-flex items-center gap-ha-2 px-ha-4 py-ha-2 bg-surface-low hover:bg-surface-mid rounded-ha-xl border border-surface-lower transition-colors text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              <Icon path={mdiChevronRight} size={16} className="text-text-disabled" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-ha-6 space-y-ha-6 lg:space-y-0">
        {settingsNavSections.map((section) => (
          <div key={section.title} className="space-y-ha-6">
            <Section title={section.title}>
              {section.title === 'Prototype Debugging Tools' ? (
                <>
                  <DebugSectionHeader label="Theme & Layout" />

                  <DebugRow label="Color mode">
                    {(['light', 'dark', 'system'] as ColorMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`px-ha-3 py-1 rounded-ha-lg text-xs font-semibold transition-colors ${
                          mode === m ? 'bg-fill-primary-normal text-ha-blue' : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {m === 'system' ? 'Auto' : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </DebugRow>

                  <DebugRow label="Immersive mode">
                    <DebugToggle checked={immersiveMode} onToggle={() => toggleImmersiveMode()} />
                  </DebugRow>

                  <DebugRow
                    label={
                      <span className="flex items-center gap-ha-2">
                        Desktop split view
                        <span className="text-[13px] font-normal text-text-tertiary">(experimental)</span>
                        <Tooltip content="Opens two dashboard panels side by side for quick comparison" placement="right">
                          <Icon path={mdiInformationOutline} size={13} className="text-text-tertiary cursor-default" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <DebugToggle checked={desktopSplitViewEnabled} onToggle={toggleDesktopSplitView} />
                  </DebugRow>

                  <DebugRow label="Screensaver">
                    <button
                      type="button"
                      onClick={screensaverActive ? dismissScreensaver : activateScreensaver}
                      className="text-xs font-semibold text-ha-blue"
                    >
                      {screensaverActive ? 'Dismiss' : 'Activate'}
                    </button>
                  </DebugRow>

                  <DebugSectionHeader label="Task Bar" />

                  <DebugRow label="What's New">
                    <DebugToggle checked={releaseCount > 0} onToggle={toggleRelease} />
                  </DebugRow>

                  {SIM_DEFS.map(({ type, label }) => {
                    const count = getSimCount(simulationPrefixes[type]);
                    return (
                      <DebugRow key={type} label={label}>
                        <span className="text-xs text-text-tertiary w-6 text-right tabular-nums">{count}</span>
                        <button
                          type="button"
                          onClick={() => removeSim(type)}
                          disabled={count === 0}
                          className="w-6 h-6 rounded-ha-md flex items-center justify-center text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-mid transition-colors disabled:opacity-30"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => addSim(type)}
                          className="w-6 h-6 rounded-ha-md flex items-center justify-center text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-mid transition-colors"
                        >
                          +
                        </button>
                      </DebugRow>
                    );
                  })}

                  <DebugSectionHeader label="Maintenance" />

                  <DebugRow label="Demo data">
                    <DebugToggle checked={demoMode} onToggle={() => { if (!demoMode) enableDemoMode(); }} />
                  </DebugRow>

                  <DebugRow label="Reset layout">
                    <button
                      type="button"
                      onClick={resetLayout}
                      className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Reset
                    </button>
                  </DebugRow>
                </>
              ) : (
                section.items.map((item) => (
                  <ProfileItem
                    key={item.slug}
                    item={item}
                    value={itemSummaries[item.slug] ?? item.description}
                    onNavigate={onNavigate}
                  />
                ))
              )}
            </Section>
          </div>
        ))}
      </div>
    </div>
  );
}
