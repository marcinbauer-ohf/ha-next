'use client';

import { Icon, SegmentedControl } from '@/components/ui';
import { mdiHomeOutline, mdiThermometer } from '@mdi/js';
import { INPUT_CLASS } from '../fieldStyles';
import type { StepProps } from '../types';

export function NameStep({ state, update }: StepProps) {
  return (
    <div className="flex flex-col gap-ha-6">
      <div className="space-y-ha-2">
        <h1 className="text-xl font-semibold tracking-tight">Name your home</h1>
        <p className="text-sm text-text-secondary">
          This shows as the title of your dashboard.
        </p>
      </div>

      <label className="block space-y-ha-2">
        <span className="flex items-center gap-ha-2 text-sm font-medium text-text-secondary">
          <Icon path={mdiHomeOutline} size={18} />
          Home name
        </span>
        <input
          type="text"
          value={state.homeName}
          onChange={e => update({ homeName: e.target.value })}
          placeholder="Home"
          className={INPUT_CLASS}
          aria-label="Home name"
          autoFocus
        />
      </label>

      <div className="space-y-ha-2">
        <span className="flex items-center gap-ha-2 text-sm font-medium text-text-secondary">
          <Icon path={mdiThermometer} size={18} />
          Unit system
        </span>
        <SegmentedControl
          className="w-full"
          value={state.unitSystem}
          onChange={v => update({ unitSystem: v })}
          segments={[
            { value: 'metric', label: 'Metric · °C' },
            { value: 'imperial', label: 'Imperial · °F' },
          ]}
        />
      </div>
    </div>
  );
}
