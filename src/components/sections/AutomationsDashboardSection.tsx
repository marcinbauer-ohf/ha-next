'use client';

import { useEffect, useState } from 'react';
import { mdiCheck, mdiPlay, mdiRobot } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { ToggleSwitch } from '../ui';
import { ModalSheet } from '../layout/ModalSheet';
import { AutomationDetailPanel } from '../cards/AutomationDetailPanel';
import {
  useAutomations,
  useAutomationActions,
  formatLastTriggered,
  type AutomationSummary,
} from '@/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard automations — always-on section giving automations the same
// first-class presence as devices: enable at a glance, run on demand, and a
// live "running" pulse. Tapping a card opens the more-info panel.
// ─────────────────────────────────────────────────────────────────────────────

function RunningDot() {
  return (
    <span className="relative flex h-2.5 w-2.5" title="Running now">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/70" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
    </span>
  );
}

function LiveAutomationCard({
  automation,
  onOpen,
}: {
  automation: AutomationSummary;
  onOpen: () => void;
}) {
  const { triggerAutomation, setAutomationEnabled } = useAutomationActions();
  const [enabled, setEnabled] = useState(automation.enabled);
  const [ran, setRan] = useState(false);

  // Optimistic toggle; reconcile when the live entity state catches up.
  useEffect(() => setEnabled(automation.enabled), [automation.enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setAutomationEnabled(automation.id, next);
  };

  const run = () => {
    setRan(true);
    triggerAutomation(automation.id);
    setTimeout(() => setRan(false), 1500);
  };

  return (
    <div className="group flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] transition-colors hover:bg-surface-low">
      <button type="button" onClick={onOpen} className="flex items-start gap-ha-3 text-left">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-ha-xl bg-violet-500/15 text-violet-500">
          <Icon path={mdiRobot} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-ha-2 min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-text-primary">{automation.name}</p>
            {automation.running && <RunningDot />}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-text-secondary">
            {formatLastTriggered(automation.lastTriggered)}
          </p>
        </div>
      </button>

      <div className="mt-ha-3 flex items-center justify-between gap-ha-2">
        <button
          type="button"
          onClick={run}
          className="inline-flex items-center gap-1.5 rounded-ha-pill bg-surface-mid px-ha-3 py-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-lower hover:text-text-primary active:scale-95"
        >
          <Icon path={ran ? mdiCheck : mdiPlay} size={15} />
          {ran ? 'Triggered' : 'Run'}
        </button>
        <ToggleSwitch on={enabled} onToggle={toggle} />
      </div>
    </div>
  );
}

export function AutomationsDashboardSection() {
  const { automations } = useAutomations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = automations.find((a) => a.id === selectedId) ?? null;

  if (automations.length === 0) return null;

  return (
    <div
      data-section-key="__automations__"
      style={{ scrollMarginTop: 'calc(var(--dashboard-sticky-top, 0px) + var(--ha-space-2))' }}
    >
      <div className="py-ha-2 mb-ha-1">
        <span className="text-base font-semibold text-text-primary">Automations</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-ha-3 items-start">
        {automations.map((a) => (
          <LiveAutomationCard key={a.id} automation={a} onOpen={() => setSelectedId(a.id)} />
        ))}
      </div>

      <ModalSheet open={!!selected} onClose={() => setSelectedId(null)} maxWidth={640}>
        {selected && <AutomationDetailPanel automation={selected} onClose={() => setSelectedId(null)} />}
      </ModalSheet>
    </div>
  );
}
