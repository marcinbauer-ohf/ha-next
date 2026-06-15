'use client';

import { useMemo } from 'react';
import { Icon } from '../ui/Icon';
import { DataListView } from '../ui';
import type { DataListConfig } from '../ui';
import { formatLastTriggered, type AutomationSummary } from '@/hooks/useAutomations';
import { mdiChevronRight, mdiRobot } from '@mdi/js';

function StatusPill({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <span className="rounded-full px-ha-2 py-0.5 text-[13px] font-semibold uppercase tracking-wide bg-surface-mid text-text-tertiary">
      Disabled
    </span>
  );
}

/** Icon tile shared by row and grid card — violet, the Automation section accent. */
function AutomationGlyph({ tileClass, iconSize }: { tileClass: string; iconSize: number }) {
  return (
    <div className={`${tileClass} bg-violet-500/15 text-violet-500`}>
      <Icon path={mdiRobot} size={iconSize} />
    </div>
  );
}

/** A single automation row — the renderRow for DataListView. */
function AutomationRow({
  automation,
  onSelect,
}: {
  automation: AutomationSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(automation.id)}
      className="w-full flex items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-mid/50 active:bg-surface-mid"
    >
      <AutomationGlyph
        tileClass="w-9 h-9 flex items-center justify-center rounded-ha-xl flex-shrink-0"
        iconSize={18}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-ha-2 min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-text-primary truncate">
            {automation.name}
          </p>
          <StatusPill enabled={automation.enabled} />
        </div>
        <p className="text-[13px] text-text-secondary truncate mt-0.5">
          {formatLastTriggered(automation.lastTriggered)}
        </p>
      </div>
      <Icon path={mdiChevronRight} size={16} className="text-text-disabled flex-shrink-0" />
    </button>
  );
}

/** A single automation tile — the renderCard for DataListView's grid layout. */
function AutomationTile({
  automation,
  onSelect,
}: {
  automation: AutomationSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(automation.id)}
      className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 text-left shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] transition-colors hover:bg-surface-low active:bg-surface-mid"
    >
      <div className="flex items-start gap-ha-3">
        <AutomationGlyph
          tileClass="w-11 h-11 flex items-center justify-center rounded-ha-xl flex-shrink-0"
          iconSize={22}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight text-text-primary truncate">
            {automation.name}
          </p>
          <div className="mt-0.5 flex items-center gap-ha-2">
            <span className="text-[13px] text-text-tertiary truncate">
              {formatLastTriggered(automation.lastTriggered)}
            </span>
          </div>
        </div>
        <Icon path={mdiChevronRight} size={16} className="text-text-disabled flex-shrink-0" />
      </div>
      <div className="mt-ha-3 flex items-center justify-between gap-ha-2">
        <span className="text-[13px] text-text-secondary">
          {automation.enabled ? 'Enabled' : ''}
        </span>
        <StatusPill enabled={automation.enabled} />
      </div>
    </button>
  );
}

/**
 * Master view: the automations list in settings column 2 — same DataListView
 * pattern as the integrations table (search / sort / group / filter / layout).
 */
export function AutomationsTable({
  automations,
  onSelect,
}: {
  automations: AutomationSummary[];
  onSelect: (id: string) => void;
}) {
  const config = useMemo<DataListConfig<AutomationSummary>>(() => ({
    keyOf: (a) => a.id,
    searchText: (a) => a.name,
    searchPlaceholder: 'Search automations…',
    sortOptions: [
      { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
      {
        id: 'last-triggered',
        label: 'Last triggered',
        // Most recent first; never-triggered automations sink to the bottom.
        compare: (a, b) =>
          (b.lastTriggered ? new Date(b.lastTriggered).getTime() : 0) -
            (a.lastTriggered ? new Date(a.lastTriggered).getTime() : 0) ||
          a.name.localeCompare(b.name),
      },
    ],
    groupOptions: [
      {
        id: 'status',
        label: 'Status',
        groupOf: (a) => (a.enabled ? { key: 'enabled', title: 'Enabled' } : { key: 'disabled', title: 'Disabled' }),
        compareGroups: (a, b) => (a.key === 'enabled' ? 0 : 1) - (b.key === 'enabled' ? 0 : 1),
      },
    ],
    filterGroups: [
      {
        id: 'status',
        mode: 'facet',
        chips: [
          { id: 'enabled', label: 'Enabled', predicate: (a) => a.enabled, defaultActive: true },
          { id: 'disabled', label: 'Disabled', predicate: (a) => !a.enabled, defaultActive: true },
        ],
      },
    ],
    renderRow: (a) => <AutomationRow automation={a} onSelect={onSelect} />,
    renderCard: (a) => <AutomationTile automation={a} onSelect={onSelect} />,
    defaultLayout: 'list',
    emptyLabel: 'No automations match these filters.',
    bg: 'surface-lower',
  }), [onSelect]);

  return <DataListView items={automations} config={config} />;
}
