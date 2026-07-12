'use client';

import { mdiCheck } from '@mdi/js';
import type { ActivityFeedItem, ActivityFeedTone } from '@/lib/activities/feed';
import { Icon } from './Icon';

// The "Happening now" feed renders differently from the Home Center count
// cards: each row is a live tile with a tinted icon chip, a moving progress
// bar, a pulse while active, and a checkmark as it winds down. It's the live
// counterpart to the static status sections.

const TONE: Record<ActivityFeedTone, { chipBg: string; chipText: string; bar: string; pulse: string }> = {
  primary: { chipBg: 'bg-fill-primary-normal', chipText: 'text-ha-blue', bar: 'bg-ha-blue', pulse: 'bg-ha-blue' },
  success: { chipBg: 'bg-green-500/10', chipText: 'text-green-600', bar: 'bg-green-500', pulse: 'bg-green-500' },
  danger: { chipBg: 'bg-red-500/10', chipText: 'text-red-500', bar: 'bg-red-500', pulse: 'bg-red-500' },
};

function ActivityFeedRow({ item }: { item: ActivityFeedItem }) {
  const tone = TONE[item.tone];
  const active = item.phase === 'active' && !item.isStale;
  const ended = item.phase === 'ended';
  const hasBar = item.progress !== null;

  return (
    <div
      className={`flex items-center gap-ha-3 px-ha-4 py-ha-3 border-b border-surface-low/40 last:border-0 transition-opacity ${
        ended ? 'opacity-60' : ''
      }`}
    >
      <span className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone.chipBg} ${tone.chipText}`}>
        <Icon path={item.icon} size={18} />
        {/* Live pulse while active; a settled check as the activity ends. */}
        {active && (
          <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-default ${tone.pulse} animate-pulse`} />
        )}
        {ended && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-white ring-2 ring-surface-default">
            <Icon path={mdiCheck} size={9} />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-ha-2">
          <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
          {hasBar && (
            <span className="ml-auto flex-shrink-0 text-xs font-semibold tabular-nums text-text-secondary">
              {item.progress}%
            </span>
          )}
        </div>
        <p className={`mt-0.5 truncate text-xs ${item.isStale ? 'text-text-disabled' : 'text-text-secondary'}`}>
          {item.isStale ? `${item.subtitle} · not responding` : item.subtitle}
        </p>
        {hasBar && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-mid">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${tone.bar}`}
              style={{ width: `${Math.max(0, Math.min(100, item.progress ?? 0))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Row list for the "Happening now" feed. Callers supply the surrounding card. */
export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  return (
    <>
      {items.map((item) => (
        <ActivityFeedRow key={item.key} item={item} />
      ))}
    </>
  );
}
