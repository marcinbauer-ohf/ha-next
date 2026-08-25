'use client';

import { useMemo, useState } from 'react';
import { mdiRobot } from '@mdi/js';
import { SummaryCard } from '../cards/SummaryCard';
import { DialogCard, DialogFrame, DialogHero } from '../cards/dialogKit';
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

      <ModalSheet open={open} onClose={close} maxWidth={760} transitionKey={detailId ?? 'activity'} contained>
        {detail ? (
          // Back to the activity view rides the header's own arrow — a second
          // bar above a header that already has a leading glyph read as two.
          <AutomationDetailPanel automation={detail} onClose={close} onBack={() => setDetailId(null)} />
        ) : (
          // The same frame as every other summary chip: no header, the reading
          // first, then what's behind it. The chart carries its own runs table,
          // so it stays one column rather than taking the chart lane.
          <DialogFrame onClose={close}>
            <DialogCard>
              <DialogHero
                icon={mdiRobot}
                iconClass="text-violet-500"
                highlight={running ? 'bg-violet-500/15' : undefined}
                value={String(activeToday)}
                unit="ran today"
                meta={`${enabled} of ${automations.length} enabled`}
              />
            </DialogCard>
            <AutomationActivityChart onOpenAutomation={setDetailId} />
          </DialogFrame>
        )}
      </ModalSheet>
    </>
  );
}
