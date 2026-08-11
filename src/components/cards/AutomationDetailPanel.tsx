'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { mdiCheck, mdiClose, mdiHistory, mdiPlay, mdiRobot, mdiPencil } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { ToggleSwitch, ListSection, HALoader, SectionLabel, SegmentedControl } from '../ui';
import { Sparkline } from '../ui/Sparkline';
import { useScrollFades } from '@/hooks/useScrollFades';
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

/** Qualifying line under the band's state: run mode, then when it last ran. */
function metaLine(automation: AutomationSummary): string {
  const mode = automation.mode ? MODE_LABEL[automation.mode] ?? automation.mode : null;
  return [mode && `${mode} mode`, formatLastTriggered(automation.lastTriggered)]
    .filter(Boolean)
    .join(' \u30fb ');
}

/**
 * The past, on its own surface — the automation's counterpart of the device
 * dialog's History/Log panel: same header row, same fixed slot, so flipping
 * between the shape of the week and the individual runs moves nothing.
 */
function RunHistory({ events, loading }: { events: LogbookEntry[]; loading: boolean }) {
  const [tab, setTab] = useState<'chart' | 'log'>('chart');
  const counts = useMemo(() => dailyCounts(events), [events]);
  const hasChart = counts.filter((c) => c > 0).length >= 3;
  // Newest first for the list; cap so the panel doesn't grow unbounded.
  const rows = useMemo(() => [...events].sort((a, b) => b.when - a.when).slice(0, 12), [events]);

  return (
    <div className="flex w-full flex-col gap-ha-1 rounded-ha-2xl bg-surface-low p-ha-2">
      <div className="flex w-full items-center gap-ha-2">
        <SegmentedControl
          segments={[{ value: 'chart', label: 'Runs' }, { value: 'log', label: 'Log' }]}
          value={tab}
          onChange={(v) => setTab(v as 'chart' | 'log')}
          className="text-xs"
        />
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">7 days</span>
      </div>
      <div className="flex h-[124px] w-full flex-col overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center"><HALoader size="sm" /></div>
        ) : events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            Hasn&apos;t run in the last 7 days
          </div>
        ) : tab === 'chart' ? (
          <div className="flex h-full w-full flex-col justify-center gap-1">
            {hasChart ? (
              <div className="h-16 w-full opacity-80">
                <Sparkline points={counts} on gradientId="automation-runs" fillHeight />
              </div>
            ) : (
              <p className="text-center text-2xl font-bold font-mono text-text-primary">
                {events.length}
                <span className="ml-2 font-sans text-sm font-medium text-text-secondary">runs</span>
              </p>
            )}
            <p className="text-center text-[11px] font-medium text-text-tertiary">Runs per day</p>
          </div>
        ) : (
          <div className="min-h-0 w-full flex-1 overflow-y-auto scrollbar-hide">
            <ListSection>
              {rows.map((e, i) => (
                <div key={`${e.when}-${i}`} className="flex items-center gap-ha-3 px-ha-4 py-ha-2">
                  <Icon path={mdiHistory} size={16} className="shrink-0 text-text-tertiary" />
                  <span className="flex-1 truncate text-sm text-text-primary">{e.message || 'Triggered'}</span>
                  <span className="shrink-0 font-mono text-xs text-text-tertiary">{formatWhen(e.when)}</span>
                </div>
              ))}
            </ListSection>
          </div>
        )}
      </div>
    </div>
  );
}

/** Rows for the entities the automation's config references, with live state. */
function RelatedRows({ ids }: { ids: string[] }) {
  const entities = useEntities(ids);
  return (
    <>
      {ids.map((id, i) => {
        const entity = entities[i];
        if (!entity) return null;
        return (
          <div key={id} className="flex items-center gap-ha-3 px-ha-4 py-ha-2">
            <Icon path={domainIcon(entity)} size={16} className="shrink-0 text-text-tertiary" />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{entityLabel(entity, '')}</span>
            <span className="shrink-0 font-mono text-sm font-medium capitalize text-text-secondary">{stateLabel(entity)}</span>
          </div>
        );
      })}
    </>
  );
}

export function AutomationDetailPanel({
  automation,
  onClose,
}: {
  automation: AutomationSummary;
  onClose: () => void;
}) {
  const { connected, demoMode, getAutomationConfig, getLogbook, isAdmin, haUrl } = useHomeAssistant();
  const { triggerAutomation, setAutomationEnabled } = useAutomationActions();

  // Admins can jump straight to the automation editor in Home Assistant; guests
  // only get the read-only view above. No editor deep-link in demo (no instance).
  const editUrl = isAdmin && !demoMode && haUrl && automation.numericId
    ? `${haUrl.replace(/\/$/, '')}/config/automation/edit/${automation.numericId}`
    : null;

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

  const { attach: attachListFades, showTop: listTop, showBottom: listBottom } = useScrollFades<HTMLDivElement>();
  const bodyRef = useRef<HTMLDivElement>(null);

  const stateWord = !enabled ? 'Off' : automation.running ? 'Running' : 'On';

  return (
    // Same frame as the device dialog: one height for every automation, a
    // scrolling middle, and a fixed shelf of what it touches at the bottom.
    <div className="h-[min(78dvh,760px)] lg:h-[min(85vh,780px)] flex flex-col overflow-hidden">
      {/* Header — close on the left, eyebrow over a large name, actions right. */}
      <div className="flex items-start justify-between gap-2 px-ha-4 pt-ha-4 pb-ha-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="shrink-0 rounded-full p-2.5 text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
        >
          <Icon path={mdiClose} size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-sm leading-none text-text-tertiary">Automation</p>
          <p className="truncate text-2xl font-bold leading-tight text-text-primary">{automation.name}</p>
        </div>
        {editUrl && (
          <a
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Edit in Home Assistant"
            aria-label="Edit in Home Assistant"
            className="shrink-0 rounded-full p-2.5 text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
          >
            <Icon path={mdiPencil} size={24} />
          </a>
        )}
      </div>

      {/* Body — takes whatever the frame has left. */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 py-3">
        <div className="flex w-full flex-col gap-ha-2">
          {/* State and what you can do about it, as one card — the device
              dialog's hero band plus its grouped controls. */}
          <div className="flex w-full flex-col gap-ha-2 rounded-ha-2xl bg-surface-low p-ha-2">
            <div className={clsx(
              'flex w-full items-center gap-ha-3 rounded-ha-2xl px-ha-3 py-ha-2 transition-colors',
              automation.running && enabled ? 'bg-green-500/15' : 'bg-surface-default',
            )}>
              <Icon path={mdiRobot} size={28} className={clsx('shrink-0', enabled ? 'text-violet-500' : 'text-text-tertiary')} />
              {/* Value first, its qualifiers under it. */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-2xl font-bold font-mono text-text-primary">{stateWord}</span>
                <span className="truncate text-xs text-text-tertiary">{metaLine(automation)}</span>
              </div>
              <ToggleSwitch on={enabled} onToggle={handleToggle} />
            </div>
            {/* Run now — the automation's one setter, on the same white tile as
                a slider or a mode picker in the device dialog. */}
            <button
              type="button"
              onClick={handleRun}
              className="flex h-12 w-full items-center justify-center gap-ha-2 rounded-ha-xl bg-surface-default text-sm font-semibold text-text-primary transition-colors hover:bg-surface-mid active:scale-[0.99]"
            >
              <Icon path={ran ? mdiCheck : mdiPlay} size={18} className={ran ? 'text-green-500' : 'text-ha-blue'} />
              {ran ? 'Triggered' : 'Run now'}
            </button>
          </div>

          {/* The past — same panel, same fixed slot as a device's history. */}
          <RunHistory events={events} loading={historyLoading} />

          {/* What it actually does. */}
          <div className="w-full">
            <SectionLabel inset>What it does</SectionLabel>
            <div className="mt-ha-2">
              {flowLoading ? (
                <div className="flex h-24 items-center justify-center"><HALoader size="sm" /></div>
              ) : flow && flow.length > 0 ? (
                <AutomationFlowView nodes={flow} />
              ) : (
                <p className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-4 text-center text-sm text-text-tertiary">
                  No steps to show — this automation has no editable config.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Everything this automation touches — the counterpart of "On this
          device": fixed shelf, its own scrollport, card stays put. */}
      {related.length > 0 && (
        <div className="relative z-[1] shrink-0 bg-surface-lower px-ha-4 pb-ha-4 pt-ha-2">
          <SectionLabel inset>Devices it uses</SectionLabel>
          <div className="relative mt-ha-2">
            <ListSection
              bodyRef={attachListFades}
              bodyClassName={clsx('overflow-y-auto scrollbar-hide', related.length >= 3 && 'h-[148px]')}
            >
              <RelatedRows ids={related} />
            </ListSection>
            <div className={clsx('pointer-events-none absolute inset-x-0 top-0 z-10 h-6 rounded-t-ha-2xl bg-gradient-to-b from-surface-default to-transparent transition-opacity', listTop ? 'opacity-100' : 'opacity-0')} />
            <div className={clsx('pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 rounded-b-ha-2xl bg-gradient-to-t from-surface-default to-transparent transition-opacity', listBottom ? 'opacity-100' : 'opacity-0')} />
          </div>
        </div>
      )}
    </div>
  );
}
