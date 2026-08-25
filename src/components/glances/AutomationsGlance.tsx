'use client';

import { useMemo, useState } from 'react';
import { mdiRobot } from '@mdi/js';
import { SummaryCard } from '../cards/SummaryCard';
import { DialogCard, DialogFrame, DialogHero } from '../cards/dialogKit';
import { ModalSheet } from '../layout/ModalSheet';
import { AutomationActivityChart } from '../sections/AutomationActivityChart';
import { AutomationDetailPanel } from '../cards/AutomationDetailPanel';
import { AutomationStart, AutomationsIntro } from './AutomationStart';
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
  // A home with no automations opens on the explainer instead of an empty
  // chart, and this is the step after it.
  const [starting, setStarting] = useState(false);
  const empty = automations.length === 0;

  const activeToday = useMemo(() => countActiveToday(automations), [automations]);
  const enabled = useMemo(() => automations.filter((a) => a.enabled).length, [automations]);
  const running = automations.some((a) => a.running);
  const detail = detailId ? automations.find((a) => a.id === detailId) ?? null : null;

  const close = () => { setOpen(false); setDetailId(null); setStarting(false); };

  return (
    <>
      <SummaryCard
        id="automations"
        icon={mdiRobot}
        title="Automations"
        // A home with none still gets the chip — it's the way in to making one.
        state={empty ? 'Set up' : `${activeToday} ran`}
        color="violet"
        compact={compact}
        variant={variant}
        size={size}
        translucent={translucent}
        // Keep the tap local — over the screensaver, clicks bubble to dismiss.
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      />

      {/* Wider and taller than the reading dialogs: the activity chart is the
          point of this one, and a month of bars needs the room. */}
      <ModalSheet
        open={open}
        onClose={close}
        maxWidth={empty ? 760 : 1100}
        transitionKey={detailId ?? (starting ? 'start' : empty ? 'intro' : 'activity')}
        contained
      >
        {empty ? (
          starting
            ? <AutomationStart onClose={close} />
            : <AutomationsIntro onStart={() => setStarting(true)} />
        ) : detail ? (
          // Back to the activity view rides the header's own arrow — a second
          // bar above a header that already has a leading glyph read as two.
          <AutomationDetailPanel automation={detail} onClose={close} onBack={() => setDetailId(null)} />
        ) : (
          // The same frame as every other summary chip: no header, the reading
          // first, then what's behind it. The chart carries its own runs table,
          // so it stays one column rather than taking the chart lane.
          <DialogFrame onClose={close} size="large">
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
