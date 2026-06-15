'use client';

import { useMemo, useState } from 'react';
import { mdiRobot, mdiClose } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { SummaryCard } from '../cards/SummaryCard';
import { ModalSheet } from '../layout/ModalSheet';
import { AutomationActivityChart } from '../sections/AutomationActivityChart';
import { useAutomations, type AutomationSummary } from '@/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Automations glance — a member of the Glance family (see EnergyGlance). Looks
// like the other summary chips but opens the automation-activity detail (bar
// chart + per-hour runs table) in a modal, in place. Self-hides when the
// instance has no automations.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** How many automations fired in the last 24h (by last_triggered). Module-level
 *  so the Date.now() read stays out of the component render path. */
function countActiveToday(autos: AutomationSummary[]): number {
  const since = Date.now() - DAY_MS;
  return autos.filter((a) => a.lastTriggered && new Date(a.lastTriggered).getTime() >= since).length;
}

interface AutomationsGlanceProps {
  compact?: boolean;
  variant?: 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  translucent?: boolean;
}

export function AutomationsGlance({ compact, variant, size, translucent }: AutomationsGlanceProps) {
  const { automations } = useAutomations();
  const [open, setOpen] = useState(false);

  const activeToday = useMemo(() => countActiveToday(automations), [automations]);
  const enabled = useMemo(() => automations.filter((a) => a.enabled).length, [automations]);
  const running = automations.some((a) => a.running);

  if (automations.length === 0) return null;

  return (
    <>
      <SummaryCard
        id="automations"
        icon={mdiRobot}
        title="Automations"
        state={`${activeToday} ran`}
        color="violet"
        compact={compact}
        variant={variant}
        size={size}
        translucent={translucent}
        // Keep the tap local — over the screensaver, clicks bubble to dismiss.
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      />

      <ModalSheet open={open} onClose={() => setOpen(false)} maxWidth={760}>
        <div className="p-ha-4 lg:p-ha-5 space-y-ha-4">
          <header className="flex items-start justify-between gap-ha-3">
            <div className="flex items-center gap-ha-3 min-w-0">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-ha-xl bg-violet-500/15 text-violet-500 shrink-0">
                {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-ha-xl bg-violet-500/30" />}
                <Icon path={mdiRobot} size={20} className="relative" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-primary leading-tight">Automations</h2>
                <p className="text-[13px] text-text-secondary leading-tight">
                  <span className="tabular-nums">{enabled}</span> enabled
                  <span className="tabular-nums"> · {activeToday} active today</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ha-lg text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
              aria-label="Close"
            >
              <Icon path={mdiClose} size={20} />
            </button>
          </header>

          <AutomationActivityChart />
        </div>
      </ModalSheet>
    </>
  );
}
