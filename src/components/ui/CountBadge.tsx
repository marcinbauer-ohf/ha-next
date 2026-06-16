import { clsx } from 'clsx';

/**
 * Small pill showing a count next to a section label — the affordance used in
 * the Home Center section headers. Renders nothing for a zero/empty count.
 *
 * Defaults to a neutral tone; pass `className` to override (e.g. a status tone
 * like `bg-yellow-500/15 text-yellow-600`).
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={clsx(
        'text-[13px] font-semibold px-ha-2 py-0.5 rounded-full tabular-nums',
        className ?? 'text-text-tertiary bg-surface-mid',
      )}
    >
      {count}
    </span>
  );
}
