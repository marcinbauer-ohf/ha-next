'use client';

import { useEffect, useMemo, useState } from 'react';
import { mdiCheck, mdiClose, mdiHistory, mdiPlay, mdiRobot } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { ToggleSwitch, ListSection, HALoader } from '../ui';
import { Sparkline } from '../ui/Sparkline';
import {
  useHomeAssistant,
  useEntities,
  useAutomationActions,
  formatLastTriggered,
  type AutomationSummary,
} from '@/hooks';
import { domainIcon, entityLabel, stateLabel } from '@/lib/homeassistant/entityHelpers';
import type { LogbookEntry } from '@/lib/homeassistant';
import {
  AutomationFlowView,
  buildMockFlow,
  configToNodes,
  relatedEntityIds,
  type AutomationNode,
} from '../profile/automationFlow';

// ─────────────────────────────────────────────────────────────────────────────
// Automation more-info — opened from the dashboard section and activity feed.
// Surfaces what was previously invisible: enabled state, run mode, whether it's
// running right now, the real When/And-if/Then flow, recent runs, and the
// entities it touches. Real data on a live connection; the existing mock flow
// only when in demo mode (never mixed — see the no-mix rule).
// ─────────────────────────────────────────────────────────────────────────────

const MODE_LABEL: Record<string, string> = {
  single: 'Single',
  restart: 'Restart',
  queued: 'Queued',
  parallel: 'Parallel',
};

/** Relative "x ago" for a logbook event (seconds since epoch). */
function formatWhen(seconds: number): string {
  return formatLastTriggered(new Date(seconds * 1000).toISOString()).replace(/^Triggered /, '');
}

/** Bucket logbook events into per-day counts over `days`, oldest → newest. */
function dailyCounts(events: LogbookEntry[], days = 7): number[] {
  const dayMs = 86_400_000;
  const todayStart = Math.floor(Date.now() / dayMs);
  const counts = new Array(days).fill(0);
  for (const e of events) {
    const day = Math.floor((e.when * 1000) / dayMs);
    const idx = days - 1 - (todayStart - day);
    if (idx >= 0 && idx < days) counts[idx] += 1;
  }
  return counts;
}

function StatusPills({ automation }: { automation: AutomationSummary }) {
  const mode = automation.mode ? MODE_LABEL[automation.mode] ?? automation.mode : null;
  return (
    <div className="flex flex-wrap items-center gap-ha-2">
      {automation.running && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-ha-2 py-0.5 text-[12px] font-semibold text-green-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Running
        </span>
      )}
      <span className={`rounded-full px-ha-2 py-0.5 text-[12px] font-semibold ${
        automation.enabled ? 'bg-fill-primary-quiet text-ha-blue' : 'bg-surface-mid text-text-tertiary'
      }`}>
        {automation.enabled ? 'Enabled' : 'Disabled'}
      </span>
      {mode && (
        <span className="rounded-full bg-surface-mid px-ha-2 py-0.5 text-[12px] font-medium text-text-secondary">
          {mode} mode
        </span>
      )}
    </div>
  );
}

/** Run-history list + per-day frequency sparkline, from logbook (real) data. */
function RunHistory({ events, loading }: { events: LogbookEntry[]; loading: boolean }) {
  const counts = useMemo(() => dailyCounts(events), [events]);
  const hasChart = counts.filter((c) => c > 0).length >= 3;

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <HALoader size="sm" />
      </div>
    );
  }
  if (events.length === 0) {
    return <p className="px-ha-4 py-ha-3 text-sm text-text-tertiary">No recent runs in the last 7 days.</p>;
  }

  // Newest first for the list; cap so the panel doesn't grow unbounded.
  const rows = [...events].sort((a, b) => b.when - a.when).slice(0, 12);

  return (
    <div className="space-y-ha-3">
      {hasChart && (
        <div className="px-ha-4">
          <p className="mb-1 text-[12px] font-medium uppercase tracking-wider text-text-tertiary">Runs / day · 7d</p>
          <div className="h-12 w-full opacity-80">
            <Sparkline points={counts} on gradientId="automation-runs" fillHeight />
          </div>
        </div>
      )}
      <ListSection>
        {rows.map((e, i) => (
          <div key={`${e.when}-${i}`} className="flex items-center gap-ha-3 px-ha-4 py-ha-2">
            <Icon path={mdiHistory} size={16} className="shrink-0 text-text-tertiary" />
            <span className="flex-1 truncate text-sm text-text-primary">{e.message || 'Triggered'}</span>
            <span className="shrink-0 text-[13px] text-text-secondary">{formatWhen(e.when)}</span>
          </div>
        ))}
      </ListSection>
    </div>
  );
}

/** Entities referenced by the automation's config, with their current state. */
function RelatedEntities({ ids }: { ids: string[] }) {
  const entities = useEntities(ids);
  const resolved = ids
    .map((id, i) => ({ id, entity: entities[i] }))
    .filter((r) => r.entity);
  if (resolved.length === 0) return null;
  return (
    <ListSection title={`Related entities (${resolved.length})`}>
      {resolved.map(({ id, entity }) => (
        <div key={id} className="flex items-center gap-ha-3 px-ha-4 py-ha-2">
          <Icon path={domainIcon(entity!)} size={18} className="shrink-0 text-text-secondary" />
          <span className="flex-1 truncate text-sm text-text-primary">{entityLabel(entity!, '')}</span>
          <span className="shrink-0 text-[13px] capitalize text-text-secondary">{stateLabel(entity!)}</span>
        </div>
      ))}
    </ListSection>
  );
}

export function AutomationDetailPanel({
  automation,
  onClose,
}: {
  automation: AutomationSummary;
  onClose: () => void;
}) {
  const { connected, demoMode, getAutomationConfig, getLogbook } = useHomeAssistant();
  const { triggerAutomation, setAutomationEnabled } = useAutomationActions();

  const [enabled, setEnabled] = useState(automation.enabled);
  const [ran, setRan] = useState(false);
  const [flow, setFlow] = useState<AutomationNode[] | null>(null);
  const [related, setRelated] = useState<string[]>([]);
  const [flowLoading, setFlowLoading] = useState(true);
  const [events, setEvents] = useState<LogbookEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Keep the toggle in sync if the live entity state changes underneath us.
  useEffect(() => setEnabled(automation.enabled), [automation.enabled]);

  // Flow: real config on a live connection; mock only in demo. Never mixed.
  useEffect(() => {
    let cancelled = false;
    setFlowLoading(true);
    setFlow(null);
    setRelated([]);

    if (demoMode && !connected) {
      setFlow(buildMockFlow(automation.id));
      setFlowLoading(false);
      return;
    }
    if (!automation.numericId) {
      setFlow([]);
      setFlowLoading(false);
      return;
    }
    getAutomationConfig(automation.numericId).then((config) => {
      if (cancelled) return;
      setFlow(config ? configToNodes(config) : []);
      setRelated(config ? relatedEntityIds(config) : []);
      setFlowLoading(false);
    });
    return () => { cancelled = true; };
  }, [automation.id, automation.numericId, connected, demoMode, getAutomationConfig]);

  // Run history from the logbook (live only). Demo synthesises from lastTriggered.
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setEvents([]);

    if (demoMode && !connected) {
      const base = automation.lastTriggered ? new Date(automation.lastTriggered).getTime() : Date.now();
      const demo: LogbookEntry[] = automation.lastTriggered
        ? [0, 1, 2, 4, 6].map((d) => ({
            when: (base - d * 19 * 3_600_000) / 1000,
            message: 'has been triggered',
          }))
        : [];
      setEvents(demo);
      setHistoryLoading(false);
      return;
    }
    getLogbook(automation.id).then((rows) => {
      if (cancelled) return;
      setEvents(rows);
      setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [automation.id, automation.lastTriggered, connected, demoMode, getLogbook]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next); // optimistic; live state will confirm
    setAutomationEnabled(automation.id, next);
  };

  const handleRun = () => {
    setRan(true);
    triggerAutomation(automation.id);
  };
  useEffect(() => {
    if (!ran) return;
    const t = setTimeout(() => setRan(false), 1500);
    return () => clearTimeout(t);
  }, [ran]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-ha-3 px-ha-4 pt-ha-4 pb-ha-3 shrink-0">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ha-2xl bg-violet-500/15 text-violet-500">
          <Icon path={mdiRobot} size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight text-text-primary">{automation.name}</p>
          <p className="mt-0.5 text-[13px] text-text-secondary">{formatLastTriggered(automation.lastTriggered)}</p>
        </div>
        <ToggleSwitch on={enabled} onToggle={handleToggle} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-ha-1 shrink-0 rounded-ha-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
        >
          <Icon path={mdiClose} size={22} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-ha-3 px-ha-4 pb-ha-3 shrink-0">
        <StatusPills automation={{ ...automation, enabled }} />
        <button
          type="button"
          onClick={handleRun}
          className="inline-flex shrink-0 items-center gap-ha-2 rounded-ha-pill bg-ha-blue px-ha-4 py-ha-2 text-sm font-semibold text-white transition-colors hover:bg-ha-blue/90 active:scale-95"
        >
          <Icon path={ran ? mdiCheck : mdiPlay} size={16} />
          {ran ? 'Triggered' : 'Run now'}
        </button>
      </div>

      <div className="h-px bg-surface-lower mx-ha-4 shrink-0" />

      {/* Body — top fade for rows scrolling under the divider (scroll-mask pattern). */}
      <div className="pointer-events-none h-4 -mb-4 bg-gradient-to-b from-surface-default to-transparent shrink-0 z-10" />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-ha-5 px-ha-3 py-ha-4">
        {/* Flow */}
        <div>
          {flowLoading ? (
            <div className="flex h-24 items-center justify-center"><HALoader size="sm" /></div>
          ) : flow && flow.length > 0 ? (
            <AutomationFlowView nodes={flow} />
          ) : (
            <p className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-4 text-center text-sm text-text-tertiary">
              Flow unavailable — this automation has no editable config.
            </p>
          )}
        </div>

        {/* Run history */}
        <div>
          <h3 className="mb-ha-2 px-ha-1 text-sm font-semibold text-text-primary">Recent runs</h3>
          <RunHistory events={events} loading={historyLoading} />
        </div>

        {/* Related entities */}
        {related.length > 0 && <RelatedEntities ids={related} />}
      </div>
    </div>
  );
}
