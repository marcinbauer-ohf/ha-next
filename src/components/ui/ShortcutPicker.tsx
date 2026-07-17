'use client';

// "Add shortcut" picker — desktop modal / mobile bottom sheet (ModalSheet).
// Sections: places in the app to pin, scenes & scripts to run, devices to
// toggle, and a custom external link. Selecting a row saves the shortcut and
// closes; the new tile appears in the sidebar / mobile nav immediately.

import { useEffect, useMemo, useState } from 'react';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { MdiIcon } from './MdiIcon';
import { Icon } from './Icon';
import { useEntitiesByDomain } from '@/hooks/useEntities';
import { useToast } from '@/contexts';
import {
  addShortcut,
  useSidebarShortcuts,
  type ShortcutKind,
} from '@/lib/sidebarShortcuts';
import { haptic } from '@/lib/haptics';
import { mdiPlus, mdiCheck, mdiMagnify, mdiOpenInNew } from '@mdi/js';
import { clsx } from 'clsx';

interface PickerRow {
  key: string;
  kind: ShortcutKind;
  label: string;
  sublabel: string;
  icon: string;
  path?: string;
  entityId?: string;
}

// Places worth pinning that aren't already sidebar items. Icons are mdi:names
// (the shortcut store's format), not @mdi/js paths.
const VIEW_ROWS: PickerRow[] = [
  { key: 'view:activity', kind: 'view', label: 'Happening now', sublabel: 'Live activity across your home', icon: 'mdi:pulse', path: '/settings/activity' },
  { key: 'view:notifications', kind: 'view', label: 'Notifications', sublabel: 'Active notifications', icon: 'mdi:bell-outline', path: '/settings/notifications' },
  { key: 'view:updates', kind: 'view', label: 'Updates', sublabel: 'Available updates', icon: 'mdi:update', path: '/settings/updates' },
  { key: 'view:repairs', kind: 'view', label: 'Repairs', sublabel: 'Suggested fixes for your setup', icon: 'mdi:wrench-outline', path: '/settings/repairs' },
  { key: 'view:connectivity', kind: 'view', label: 'Connectivity', sublabel: 'Home and remote access status', icon: 'mdi:web', path: '/settings/connectivity' },
  { key: 'view:home-center', kind: 'view', label: 'Home Center', sublabel: 'Your home at a glance', icon: 'mdi:home-variant-outline', path: '/settings/home-center' },
];

const ACTION_ICON: Record<string, string> = {
  scene: 'mdi:palette-outline',
  script: 'mdi:script-text-outline',
  light: 'mdi:lightbulb-outline',
  switch: 'mdi:toggle-switch-outline',
  fan: 'mdi:fan',
};

function entityRow(entityId: string, name: string, sublabel: string): PickerRow {
  const domain = entityId.split('.')[0];
  return {
    key: `action:${entityId}`,
    kind: 'action',
    label: name,
    sublabel,
    icon: ACTION_ICON[domain] ?? 'mdi:flash-outline',
    entityId,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-ha-2">
        {title}
      </div>
      <div className="space-y-ha-1">{children}</div>
    </div>
  );
}

export function ShortcutPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const { showToast } = useToast();
  const existing = useSidebarShortcuts();

  const scenes = useEntitiesByDomain('scene');
  const scripts = useEntitiesByDomain('script');
  const lights = useEntitiesByDomain('light');
  const switches = useEntitiesByDomain('switch');

  // Fresh form every time the picker opens. rAF-wrapped so the compiler lint
  // doesn't see a synchronous setState-in-effect.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      setQuery('');
      setLinkLabel('');
      setLinkUrl('');
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const taken = useMemo(() => {
    const paths = new Set(existing.map((s) => s.path).filter(Boolean));
    const entities = new Set(existing.map((s) => s.entityId).filter(Boolean));
    return { paths, entities };
  }, [existing]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (row: PickerRow) => !q || row.label.toLowerCase().includes(q);

    const friendly = (e: { entity_id: string; attributes: Record<string, unknown> }) =>
      typeof e.attributes.friendly_name === 'string'
        ? e.attributes.friendly_name
        : e.entity_id.split('.')[1].replace(/_/g, ' ');

    return [
      { title: 'Places', rows: VIEW_ROWS.filter(matches) },
      {
        title: 'Scenes & scripts',
        rows: [
          ...scenes.map((e) => entityRow(e.entity_id, friendly(e), 'Scene — runs on tap')),
          ...scripts.map((e) => entityRow(e.entity_id, friendly(e), 'Script — runs on tap')),
        ].filter(matches),
      },
      {
        title: 'Devices',
        rows: [
          ...lights.map((e) => entityRow(e.entity_id, friendly(e), 'Light — toggles on tap')),
          ...switches.map((e) => entityRow(e.entity_id, friendly(e), 'Switch — toggles on tap')),
        ].filter(matches),
      },
    ].filter((section) => section.rows.length > 0);
  }, [query, scenes, scripts, lights, switches]);

  const pick = (row: PickerRow) => {
    addShortcut({
      kind: row.kind,
      label: row.label,
      icon: row.icon,
      path: row.path,
      entityId: row.entityId,
    });
    haptic('impact');
    showToast({ title: row.label, subtitle: 'Added to your sidebar', icon: mdiCheck });
    onClose();
  };

  const linkValid = linkLabel.trim().length > 0 && /^https?:\/\/.+/i.test(linkUrl.trim());
  const addLink = () => {
    if (!linkValid) return;
    addShortcut({
      kind: 'url',
      label: linkLabel.trim(),
      icon: 'mdi:open-in-new',
      url: linkUrl.trim(),
    });
    haptic('impact');
    showToast({ title: linkLabel.trim(), subtitle: 'Added to your sidebar', icon: mdiCheck });
    onClose();
  };

  return (
    <ModalSheet open={open} onClose={onClose} maxWidth={480}>
      <div className="p-ha-5 pt-ha-4 space-y-ha-4" data-component="ShortcutPicker">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Add shortcut</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Pin a place, a scene, or anything you use often.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-ha-2 h-11 px-ha-3 rounded-ha-xl bg-surface-low border border-surface-lower focus-within:border-ha-blue/50 transition-colors">
          <Icon path={mdiMagnify} size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary"
          />
        </div>

        {sections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.rows.map((row) => {
              const added = row.path
                ? taken.paths.has(row.path)
                : row.entityId
                  ? taken.entities.has(row.entityId)
                  : false;
              return (
                <button
                  key={row.key}
                  type="button"
                  disabled={added}
                  onClick={() => pick(row)}
                  className={clsx(
                    'w-full flex items-center gap-ha-3 p-ha-2 rounded-ha-xl text-left transition-colors',
                    added ? 'opacity-50' : 'hover:bg-surface-low active:bg-surface-low'
                  )}
                >
                  <span className="w-10 h-10 flex-shrink-0 rounded-ha-lg bg-surface-low flex items-center justify-center">
                    <MdiIcon icon={row.icon} size={20} className="text-text-secondary" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-text-primary truncate">
                      {row.label}
                    </span>
                    <span className="block text-xs text-text-secondary truncate">
                      {row.sublabel}
                    </span>
                  </span>
                  <Icon
                    path={added ? mdiCheck : mdiPlus}
                    size={18}
                    className={clsx('flex-shrink-0', added ? 'text-ha-blue' : 'text-text-tertiary')}
                  />
                </button>
              );
            })}
          </Section>
        ))}

        {/* Custom link */}
        <Section title="Custom link">
          <div className="space-y-ha-2 p-ha-3 rounded-ha-xl bg-surface-low/60 border border-surface-lower">
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Name"
              className="w-full h-10 px-ha-3 rounded-ha-lg bg-surface-default border border-surface-lower outline-none focus:border-ha-blue/50 text-sm text-text-primary placeholder:text-text-tertiary transition-colors"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="w-full h-10 px-ha-3 rounded-ha-lg bg-surface-default border border-surface-lower outline-none focus:border-ha-blue/50 text-sm text-text-primary placeholder:text-text-tertiary transition-colors"
            />
            <button
              type="button"
              disabled={!linkValid}
              onClick={addLink}
              className={clsx(
                'w-full h-10 rounded-ha-lg flex items-center justify-center gap-ha-2 text-sm font-semibold transition-colors',
                linkValid
                  ? 'bg-ha-blue text-white hover:bg-ha-blue/90'
                  : 'bg-surface-low text-text-tertiary'
              )}
            >
              <Icon path={mdiOpenInNew} size={16} />
              Add link
            </button>
          </div>
        </Section>
      </div>
    </ModalSheet>
  );
}
