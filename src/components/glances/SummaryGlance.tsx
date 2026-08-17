'use client';

import { useState } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { ModalSheet } from '../layout/ModalSheet';
import { BatteryDetail, ClimateDetail, LightsDetail, ModeDetail, PeopleDetail, SecurityDetail, WeatherDetail } from './summaryDetails';
import type { GlanceId, SummaryCardProps } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// The chip host for the display-only glances (lights, climate, security,
// weather, mode). They used to be dead SummaryCards; now every one opens its
// dialog in place, like Energy and Automations always did. One host so the four
// surfaces that render the summary row (dashboard, desktop panel, screensaver,
// Home Center) all get it from the same place.
// ─────────────────────────────────────────────────────────────────────────────

const PANELS: Partial<Record<GlanceId, (props: { onClose: () => void }) => React.ReactNode>> = {
  lights: LightsDetail,
  climate: ClimateDetail,
  security: SecurityDetail,
  weather: WeatherDetail,
  mode: ModeDetail,
  people: PeopleDetail,
  battery: BatteryDetail,
};

export interface SummaryGlanceItem {
  id?: GlanceId;
  icon: string;
  title: string;
  state: string;
  color?: SummaryCardProps['color'];
}

export function SummaryGlance({
  item,
  compact,
  variant,
  size,
  translucent,
}: {
  item: SummaryGlanceItem;
  compact?: boolean;
  variant?: SummaryCardProps['variant'];
  size?: SummaryCardProps['size'];
  translucent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Panel = item.id ? PANELS[item.id] : undefined;

  return (
    <>
      <SummaryCard
        id={item.id}
        icon={item.icon}
        title={item.title}
        state={item.state}
        color={item.color}
        compact={compact}
        variant={variant}
        size={size}
        translucent={translucent}
        // Keep the tap local — over the screensaver, clicks bubble to dismiss.
        onClick={Panel ? (e) => { e.stopPropagation(); setOpen(true); } : undefined}
      />
      {Panel && (
        <ModalSheet open={open} onClose={() => setOpen(false)} maxWidth={640}>
          {/* Mounted only while open, so nothing fetches history behind a closed sheet. */}
          {open && <Panel onClose={() => setOpen(false)} />}
        </ModalSheet>
      )}
    </>
  );
}
