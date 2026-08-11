'use client';

import { useMemo, useState } from 'react';
import { mdiRobot, mdiClose, mdiArrowLeft } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { SummaryCard } from '../cards/SummaryCard';
import { ModalSheet } from '../layout/ModalSheet';
import { AutomationActivityChart } from '../sections/AutomationActivityChart';
import { AutomationDetailPanel } from '../cards/AutomationDetailPanel';
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
  // When set, the modal crossfades from the activity chart to a single
  // automation's detail (view for everyone; admins also get an edit link).
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeToday = useMemo(() => countActiveToday(automations), [automations]);
  const enabled = useMemo(() => automations.filter((a) => a.enabled).length, [automations]);
  const running = automations.some((a) => a.running);
  const detail = detailId ? automations.find((a) => a.id === detailId) ?? null : null;

  const close = () => { setOpen(false); setDetailId(null); };

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

      <ModalSheet open={open} onClose={close} maxWidth={760} transitionKey={detailId ?? 'activity'}>
        {detail ? (
          <div className="flex flex-col min-h-0">
            {/* Back to the activity overview; the detail body is the shared panel. */}
            <div className="flex items-center gap-ha-2 px-ha-4 pt-ha-4 -mb-ha-2">
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="inline-flex items-center gap-1.5 rounded-ha-lg px-ha-2 py-1 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
              >
                <Icon path={mdiArrowLeft} size={16} />
                Activity
              </button>
            </div>
            <AutomationDetailPanel automation={detail} onClose={close} />
          </div>
        ) : (
          <div className="p-ha-4 lg:p-ha-5 space-y-ha-4">
            <header className="flex items-start gap-ha-3">
              <button
                type="button"
                onClick={close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ha-lg text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
                aria-label="Close"
              >
                <Icon path={mdiClose} size={20} />
              </button>
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
            </header>

            <AutomationActivityChart onOpenAutomation={setDetailId} />
          </div>
        )}
      </ModalSheet>
    </>
  );
}
