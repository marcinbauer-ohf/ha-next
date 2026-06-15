'use client';

import { useState } from 'react';
import { mdiFlash, mdiClose } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { SummaryCard } from '../cards/SummaryCard';
import { ModalSheet } from '../layout/ModalSheet';
import { PowerAttributionChart } from '../sections/PowerAttributionChart';
import { useEnergyMetrics } from '@/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Energy glance — a member of the Glance family (see SummaryCardProps docs).
// Looks like the other summary chips (lights, people…) but is interactive: it
// shows live whole-home draw and opens the full power-attribution detail in a
// modal, in place, rather than navigating to the energy page. Self-hides when
// the instance exposes no power sensor.
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
  const { meter, watts, kwhToday } = useEnergyMetrics();
  const [open, setOpen] = useState(false);

  if (!meter) return null;

  const power = fmtPower(watts);

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

      <ModalSheet open={open} onClose={() => setOpen(false)} maxWidth={760}>
        <div className="p-ha-4 lg:p-ha-5 space-y-ha-4">
          <header className="flex items-start justify-between gap-ha-3">
            <div className="flex items-center gap-ha-3 min-w-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-ha-xl bg-amber-500/15 text-amber-500 shrink-0">
                <Icon path={mdiFlash} size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-primary leading-tight">Energy</h2>
                <p className="text-[13px] text-text-secondary leading-tight">
                  <span className="tabular-nums">{power}</span> now
                  {kwhToday != null && <span className="tabular-nums"> · {kwhToday.toFixed(1)} kWh today</span>}
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

          <PowerAttributionChart />
        </div>
      </ModalSheet>
    </>
  );
}
