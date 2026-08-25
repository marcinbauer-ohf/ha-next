'use client';

import { useMemo } from 'react';
import { mdiHomeVariant, mdiTune } from '@mdi/js';
import { Icon } from '../ui/Icon';
import { SelectChip } from '../ui/SelectChip';
import { useHomeAssistantEntities } from '@/hooks';
import {
  modeEntityChoices,
  setHomeModeEntityId,
  useHomeMode,
  useHomeModeEntityId,
} from '@/lib/homeMode';

const NONE = '__none__';

/**
 * Home Center settings block for choosing which helper drives "Home Mode".
 * The picked entity's current option is shown as a display-only chip across the
 * dashboard, lock screen and Home Center. Switching modes stays the job of the
 * user's own automations — this only chooses what to display. Admin-only.
 */
export function HomeModeSettings() {
  const entities = useHomeAssistantEntities();
  const entityId = useHomeModeEntityId();
  const homeMode = useHomeMode();

  const choices = useMemo(() => modeEntityChoices(entities), [entities]);
  const options = useMemo(
    () => [{ id: NONE, label: 'Not set' }, ...choices.map((c) => ({ id: c.entityId, label: c.label }))],
    [choices],
  );
  const selectedLabel =
    choices.find((c) => c.entityId === entityId)?.label ?? (entityId || 'Not set');

  return (
    <div className="space-y-ha-3 rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-4">
      <div className="flex items-start gap-ha-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-500">
          <Icon path={mdiHomeVariant} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary">Home mode</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Pick a dropdown helper (like Home / Away / Night). Its current setting shows on the
            dashboard, lock screen and Home Center. Change how each mode behaves with your automations.
          </p>
        </div>
      </div>

      {choices.length > 0 ? (
        <div className="flex flex-wrap items-center gap-ha-2">
          <SelectChip
            icon={mdiTune}
            prefix="Helper"
            valueLabel={entityId ? selectedLabel : 'Not set'}
            options={options}
            selectedId={entityId || NONE}
            onSelect={(id) => setHomeModeEntityId(id === NONE ? '' : id)}
          />
          {homeMode && (
            <span className="rounded-full bg-surface-low px-ha-3 py-1.5 text-xs font-medium text-text-secondary">
              Currently: <span className="font-semibold text-text-primary">{homeMode.current}</span>
            </span>
          )}
        </div>
      ) : (
        <p className="rounded-ha-2xl bg-surface-low px-ha-3 py-2.5 text-xs text-text-secondary">
          No dropdown helpers found. Create one in Home Assistant (Settings → Devices &amp; Services →
          Helpers → Dropdown) to use it here.
        </p>
      )}
    </div>
  );
}
