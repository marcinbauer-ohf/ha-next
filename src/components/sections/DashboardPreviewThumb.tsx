'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getCachedPreview, requestPreview, subscribePreview } from '@/lib/dashboardPreview';

interface DashboardPreviewThumbProps {
  urlPath: string;
  /** Only fires snapshot requests while the panel is actually open. */
  active: boolean;
}

// The grey-bar skeleton that previously stood in for every dashboard. Shown
// until a real snapshot is cached.
function Skeleton() {
  return (
    <div className="p-ha-2 space-y-ha-1">
      <div className="h-2 bg-surface-low rounded-full w-full" />
      <div className="h-2 bg-surface-low rounded-full w-3/4" />
      <div className="h-3 bg-surface-low rounded-ha-lg w-full mt-ha-2" />
      <div className="h-3 bg-surface-low rounded-ha-lg w-full" />
    </div>
  );
}

export function DashboardPreviewThumb({ urlPath, active }: DashboardPreviewThumbProps) {
  // Re-read the cache whenever this path's snapshot is (re)generated.
  const dataUrl = useSyncExternalStore(
    (cb) => subscribePreview(urlPath, cb),
    () => getCachedPreview(urlPath)?.dataUrl ?? null,
    () => null,
  );
  const [loaded, setLoaded] = useState(false);

  // Kick off a snapshot when the panel opens (no-op if a fresh one is cached).
  useEffect(() => {
    if (active) requestPreview(urlPath);
  }, [active, urlPath]);

  return (
    <>
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image can't optimize it
        <img
          src={dataUrl}
          alt=""
          aria-hidden
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {(!dataUrl || !loaded) && <Skeleton />}
    </>
  );
}
