'use client';

import { useState } from 'react';
import { mdiFlash } from '@mdi/js';
import { SummaryCard } from '../cards/SummaryCard';
import { ModalSheet } from '../layout/ModalSheet';
import { EnergyDetailPanel } from '../cards/EnergyDetailPanel';
import { useEnergyMetrics, useEntities } from '@/hooks';
import { isEnergyConfigured, sumKwh, sumWatts, useEnergyConfig } from '@/lib/energyConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Energy glance — a member of the Glance family (see SummaryCardProps docs).
// Looks like the other summary chips (lights, people…) but is interactive: it
// shows the live draw of the sensors the user picked and opens the energy dialog
// in place, rather than navigating to the energy page. Until those sensors are
// picked it reads "Set up" and opens the dialog's setup step — it never shows a
// guessed figure, because a guess in a house full of smart plugs is whatever
// appliance happens to be running. Self-hides when the home measures no power.
// ─────────────────────────────────────────────────────────────────────────────

function fmtPower(w: number | null): string {
  if (w == null) return '—';
  return w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`;
}

interface EnergyGlanceProps {
  compact?: boolean;
  variant?: 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  translucent?: boolean;
}

export function EnergyGlance({ compact, variant, size, translucent }: EnergyGlanceProps) {
  const config = useEnergyConfig();
  const configured = isEnergyConfigured(config);
  const powerEntities = useEntities(config.power);
  const todayEntities = useEntities(config.today);
  // Only used to decide whether this home measures energy at all — a house
  // with just a daily kWh meter and no live-power sensor still counts.
  const { powerSensors, energyToday } = useEnergyMetrics();
  const [open, setOpen] = useState(false);

  if (!configured && powerSensors.length === 0 && !energyToday) return null;

  const watts = sumWatts(powerEntities);
  const kwhToday = sumKwh(todayEntities);
  // Live draw when there's a power sensor, today's total when the user only
  // picked a daily meter, and the invitation to set it up before either.
  const power = !configured
    ? 'Set up'
    : watts !== null
      ? fmtPower(watts)
      : kwhToday !== null
        ? `${kwhToday.toFixed(1)} kWh`
        : '—';

  return (
    <>
      <SummaryCard
        id="energy"
        icon={mdiFlash}
        title="Energy"
        state={power}
        color="success"
        compact={compact}
        variant={variant}
        size={size}
        translucent={translucent}
        // Keep the tap local — over the screensaver, clicks bubble to dismiss.
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      />

      {/* Same frame as the device and automation dialogs. */}
      <ModalSheet open={open} onClose={() => setOpen(false)} maxWidth={640} contained>
        <EnergyDetailPanel onClose={() => setOpen(false)} />
      </ModalSheet>
    </>
  );
}
