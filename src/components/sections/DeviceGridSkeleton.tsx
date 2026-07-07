'use client';

import { useEffect, useState } from 'react';

/**
 * Loading masonry shared by every device-grid page (dashboard, room, category,
 * type) so the load experience is one pattern app-wide — pulsing card slabs in
 * the same column layout the real cards use, instead of a lone spinner.
 */
export function DeviceGridSkeleton({ heights = [140, 88, 88, 88, 140, 88] }: { heights?: number[] }) {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const update = () => setCols(window.innerWidth >= 1024 ? 3 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
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
