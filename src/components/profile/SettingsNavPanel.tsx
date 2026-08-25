'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Icon, SearchField, NavChevron } from '../ui';
import { Avatar } from '../ui/Avatar';
import { useHomeAssistant, useHomeAssistantSelector, useDeviceStructure } from '@/hooks';
import { getHaVersion } from '@/lib/homeassistant';
import { useDebugFlags } from '@/contexts';
import { APP_BUILD } from '@/lib/version';
import {
  arePrimaryPeopleEqual,
  selectPrimaryPerson,
} from '@/lib/homeassistant/selectors';
import {
  getVisibleSettingsNavSections,
  categoryAccents,
  settingsHasContent,
  type SettingsNavLink,
  type SettingsSlug,
} from './settingsNavigation';
import { mdiRestart, mdiRestartAlert, mdiPower } from '@mdi/js';
import { SectionLabel } from '../ui/SectionLabel';

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
  /** Scroll the active item into view on mount/active change (mobile bottom-sheet). */
  autoScrollActiveIntoView?: boolean;
  /** Drop the card chrome (own background, border, shadow) from every group —
      for the desktop rail, which already sits on its own column and would
      otherwise read as surfaces stacked inside surfaces. */
  flat?: boolean;
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
  // Sections without their own built-out UI render only the haPath stub. They
  // read as fully live rows — accent icon, normal label, hover, clickable — and
  // only the chevron greys out to say "there's nothing further in here yet".
  // Dimming the whole row instead made half the list look broken.
  const empty = !settingsHasContent(item.slug);
  // Active row: faint accent-tinted background + solid accent icon tile and
  // accent label/chevron. No left bar.
  const accentActive = isActive && !empty;

  return (
    <button
      type="button"
      onClick={onSelect}
      data-settings-slug={item.slug}
      title={empty ? 'Coming soon' : undefined}
      style={accentActive ? { backgroundColor: `${accent}1a` } : undefined}
      className={clsx(
        'group w-full flex items-center gap-ha-3 rounded-ha-xl px-ha-2 text-left transition-colors py-ha-2',
        subtitle && 'min-h-[48px]',
        isActive ? 'bg-surface-mid' : 'hover:bg-surface-mid/50 active:bg-surface-mid',
      )}
    >
      {/* Bare icon — accent-colored, no background tile. */}
      <div
        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
        style={{ color: accent }}
      >
        <Icon path={item.icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold leading-tight ${accentActive ? '' : 'text-text-primary'}`}
          style={accentActive ? { color: accent } : undefined}
        >
          {item.label}
        </p>
        {subtitle && (
          <p className="text-xs text-text-secondary truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      <span
        className={clsx(
          empty ? 'text-text-disabled opacity-50' : accentActive ? undefined : isActive ? 'text-text-secondary' : 'text-text-disabled',
        )}
        style={accentActive && !empty ? { color: accent } : undefined}
      >
        <NavChevron size={16} />
      </span>
    </button>
  );
}

export function SettingsNavPanel({ activeSlug, onSelect, bg = 'surface-lower', autoScrollActiveIntoView = false, flat = false }: SettingsNavPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { haUrl, connected, demoMode, callService, currentUser, isAdmin, previewAsNonAdmin, setPreviewAsNonAdmin } = useHomeAssistant();
  const { devices, services } = useDeviceStructure();
  const primaryPerson = useHomeAssistantSelector(selectPrimaryPerson, arePrimaryPeopleEqual);
  const { hideHomeCenterEnabled } = useDebugFlags();
  const [searchQuery, setSearchQuery] = useState('');
  const haVersion = getHaVersion();
  const systemControlsEnabled = connected && !demoMode && isAdmin;

  const runSystemCommand = useCallback(
    (cmd: (typeof SYSTEM_COMMANDS)[number]) => {
      if (!connected || demoMode || !isAdmin) return;
      const confirmed = window.confirm(
        `${cmd.label}? Home Assistant will be interrupted and may take a minute to come back.`,
      );
      if (!confirmed) return;
      callService({ domain: cmd.domain, service: cmd.service });
    },
    [connected, demoMode, isAdmin, callService],
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
    // Devices & Services — show live counts split by kind
    devices: `${devices.length} ${devices.length === 1 ? 'device' : 'devices'} · ${services.length} ${services.length === 1 ? 'service' : 'services'}`,
    integrations: demoMode ? '6 active' : connected ? '6 active' : 'Check connection',

    // System — timestamps / state
    backups: demoMode ? 'Last backup 2 hours ago' : connected ? 'Last backup 2 hours ago' : '',

    // Prototype & debug tools — live state
    developer: demoMode ? 'Demo data active' : '',
  }), [connected, demoMode, devices.length, services.length]);

  // When opened from the mobile bottom-sheet, bring the active item into view.
  // Runs once on the next frame (handles tab-switch where the sheet is already
  // open) and again after the sheet's open animation settles (~0.5s).
  useEffect(() => {
    if (!autoScrollActiveIntoView || !activeSlug) return;
    const scrollToActive = () => {
      const node = rootRef.current?.querySelector<HTMLElement>(`[data-settings-slug="${activeSlug}"]`);
      node?.scrollIntoView({ block: 'center', behavior: 'auto' });
    };
    const raf = requestAnimationFrame(scrollToActive);
    const timer = setTimeout(scrollToActive, 520);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [autoScrollActiveIntoView, activeSlug]);

  const visibleSections = useMemo(() => {
    const sections = getVisibleSettingsNavSections(isAdmin, hideHomeCenterEnabled);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q),
        ),
      }))
      .filter(section => section.items.length > 0);
  }, [searchQuery, isAdmin, hideHomeCenterEnabled]);

  // Developer Tools gets its own labeled card (like System), so split it out of
  // the unified categories card while keeping it in the search-filtered set.
  const navCardSections = visibleSections.filter((s) => s.title !== 'Developer Tools');
  const devToolsSection = visibleSections.find((s) => s.title === 'Developer Tools');

  // One card treatment for every group, so `flat` strips them all at once.
  // No horizontal padding when flat: the rows are the only thing in the column,
  // so they line up edge-to-edge with the search field and the profile card
  // above them. (Carded, the padding is the card's inner gutter and stays.)
  const groupClass = flat
    ? 'py-ha-1'
    : 'bg-surface-default rounded-ha-2xl border border-surface-lower shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden p-ha-2';

  return (
    <div ref={rootRef}>
      {/* Search — sticky at top, pinned with no drift. Mirrors DataListView's
          sticky search (devices list): a negative margin cancels the scroll
          container's top padding (`--list-top-pad`) so it pins immediately, an
          equal inner padding keeps the field in place while its opaque bg covers
          the band, and `--settings-header-h` (0 here) stacks it below any title.
          z-30 keeps it above the mobile bottom-sheet's own top fade (z-20). */}
      <div
        className={`sticky z-30 ${bg === 'surface-default' ? 'bg-surface-default' : 'bg-surface-lower'} pb-ha-2`}
        style={{
          top: 'var(--settings-header-h, 0px)',
          marginTop: 'calc(-1 * var(--list-top-pad, 0px))',
          paddingTop: 'calc(var(--list-top-pad, 0px) + var(--ha-space-1))',
        }}
      >
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search settings…"
          onClear={() => setSearchQuery('')}
        />
        {/* fade for nav items scrolling under the sticky search */}
        <div className={`h-4 bg-gradient-to-b ${bg === 'surface-default' ? 'from-surface-default' : 'from-surface-lower'} to-transparent pointer-events-none -mb-4`} />
      </div>

      {/* Profile card — below search, scrolls away. Clickable like the nav items. */}
      <button
        type="button"
        onClick={() => onSelect('profile')}
        data-settings-slug="profile"
        className={`group w-full text-left flex items-center gap-ha-4 transition-colors ${
          flat
            ? 'rounded-ha-2xl px-ha-3 py-ha-3 mb-ha-2'
            : 'rounded-ha-3xl p-ha-5 border border-surface-lower shadow-[0_18px_42px_-30px_rgba(15,23,42,0.32)] mb-ha-4'
        } ${
          activeSlug === 'profile' ? 'bg-surface-mid' : flat ? 'hover:bg-surface-mid/50 active:bg-surface-mid' : 'bg-surface-default hover:bg-surface-low active:bg-surface-mid'
        }`}
      >
        <Avatar src={user.picture} initials={user.initials} size="lg" className="ring-4 ring-surface-mid shadow flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-text-primary leading-tight">{user.name}</h2>
          <p className="text-[13px] text-text-secondary font-medium px-ha-2 py-0.5 bg-surface-mid rounded-full inline-block mt-0.5">
            {isAdmin ? 'Administrator' : 'Standard User'}
          </p>
        </div>
        <NavChevron size={20} className="text-text-disabled flex-shrink-0" />
      </button>

      {/* Only a real admin can see this — it can only ever downgrade the
          effective role, never let a real non-admin escalate. Lives outside
          the admin-only sections below so it stays reachable even while
          previewing as non-admin. */}
      {currentUser?.is_admin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPreviewAsNonAdmin(!previewAsNonAdmin); }}
          className={`w-full flex items-center justify-between gap-ha-3 px-ha-4 py-ha-2 rounded-ha-xl transition-colors ${flat ? 'mb-ha-2 hover:bg-surface-mid/50' : 'mb-ha-4 border border-surface-lower bg-surface-default hover:bg-surface-low'}`}
        >
          <span className="text-[13px] font-medium text-text-secondary">Preview as non-admin</span>
          <span
            className={`h-5 w-9 rounded-full px-0.5 flex items-center transition-colors flex-shrink-0 ${previewAsNonAdmin ? 'bg-ha-blue/50' : 'bg-surface-mid'}`}
          >
            <span className={`h-4 w-4 rounded-full bg-surface-default border border-surface-low shadow-sm transition-transform ${previewAsNonAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
        </button>
      )}

      {/* Nav sections — all categories share one card, grouped by extra spacing. */}
      <div className="pb-ha-5">
        {visibleSections.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-ha-6">No results for &ldquo;{searchQuery}&rdquo;</p>
        ) : navCardSections.length > 0 && (
          <div className={groupClass}>
            {navCardSections.map((section, idx) => {
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

      {/* Developer Tools — broken out as its own labeled part, like System.
          Still searchable, so it follows the filtered `devToolsSection`. */}
      {devToolsSection && (
        <div className="pb-ha-4">
          <SectionLabel inset className="pb-ha-2">{devToolsSection.title}</SectionLabel>
          <div className={groupClass}>
            {devToolsSection.items.map((item) => (
              <NavItem
                key={item.slug}
                item={item}
                subtitle={subtitles[item.slug] ?? ''}
                isActive={activeSlug === item.slug}
                onSelect={() => onSelect(item.slug)}
                accent={categoryAccents[devToolsSection.title] ?? '#64748b'}
              />
            ))}
          </div>
        </div>
      )}

      {/* System power controls — admin-only in real HA; hidden while searching too. */}
      {isAdmin && !searchQuery.trim() && (
        <div className="pb-ha-4">
          <SectionLabel inset className="pb-ha-2">System</SectionLabel>
          <div className={groupClass}>
            {SYSTEM_COMMANDS.map((cmd) => (
              <button
                key={cmd.key}
                type="button"
                disabled={!systemControlsEnabled}
                onClick={() => runSystemCommand(cmd)}
                className={`w-full flex items-center gap-ha-3 rounded-ha-xl px-ha-2 py-ha-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  cmd.danger
                    ? 'hover:bg-red-500/10 active:bg-red-500/15'
                    : 'hover:bg-surface-mid/50 active:bg-surface-mid'
                }`}
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-ha-lg flex-shrink-0 ${
                    cmd.danger ? 'bg-red-500/15 text-red-500' : 'bg-surface-mid text-text-secondary'
                  }`}
                >
                  <Icon path={cmd.icon} size={16} />
                </div>
                <span className={`text-sm font-semibold ${cmd.danger ? 'text-red-500' : 'text-text-primary'}`}>
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
