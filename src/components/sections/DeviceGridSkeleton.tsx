'use client';

import { useMasonryCols } from '@/hooks';

/**
 * Loading masonry shared by every device-grid page (dashboard, room, category,
 * type) so the load experience is one pattern app-wide — pulsing card slabs in
 * the same column layout the real cards use, instead of a lone spinner.
 */
export function DeviceGridSkeleton({ heights = [140, 88, 88, 88, 140, 88] }: { heights?: number[] }) {
  const cols = useMasonryCols();
  const colArrays: number[][] = Array.from({ length: cols }, () => []);
  heights.forEach((h, i) => colArrays[i % cols].push(h));
  return (
    <div className="flex gap-ha-4 items-start">
      {colArrays.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-ha-4">
          {col.map((h, j) => (
            <div key={j} className="rounded-ha-2xl bg-surface-low animate-pulse" style={{ height: h }} />
          ))}
        </div>
      ))}
    </div>
  );
}
