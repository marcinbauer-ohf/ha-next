'use client';

// Abstract placeholder tile for the dashboard selector. Echoes the app's
// mobile layout — a greeting row above a two-column card masonry — using pure
// shapes instead of a live snapshot. The variant is derived from the path so
// tiles differ from one another but stay stable between opens.

interface DashboardPreviewThumbProps {
  urlPath: string;
}

// One-time sweep of the snapshot blobs cached by the removed live-preview
// pipeline — they were large PNG data URLs and would otherwise linger forever.
if (typeof window !== 'undefined') {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ha-dash-preview:')) localStorage.removeItem(key);
    }
  } catch {
    // Private mode / storage access errors — nothing to clean.
  }
}

const LAYOUTS: Array<{ left: number[]; right: number[] }> = [
  { left: [40, 26, 34], right: [26, 40, 30] },
  { left: [26, 40, 30], right: [40, 26, 34] },
  { left: [34, 26, 40], right: [30, 34, 26] },
  { left: [30, 40, 26], right: [34, 30, 40] },
];

function hashPath(path: string): number {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function CardBlock({ height, accent }: { height: number; accent: boolean }) {
  return (
    <div
      style={{ height }}
      className={`shrink-0 rounded-ha-lg p-1.5 flex flex-col justify-between ${
        accent ? 'bg-ha-blue/15' : 'bg-surface-default'
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${accent ? 'bg-ha-blue/50' : 'bg-surface-lower'}`} />
      <div className={`h-1 w-3/5 rounded-full ${accent ? 'bg-ha-blue/40' : 'bg-surface-lower'}`} />
    </div>
  );
}

export function DashboardPreviewThumb({ urlPath }: DashboardPreviewThumbProps) {
  const seed = hashPath(urlPath);
  const layout = LAYOUTS[seed % LAYOUTS.length];
  const accentIndex = seed % (layout.left.length + layout.right.length);

  return (
    <div className="absolute inset-0 p-ha-2 flex flex-col gap-1.5 overflow-hidden" aria-hidden>
      {/* Greeting row */}
      <div className="flex items-center px-0.5">
        <div className="h-1.5 w-2/5 rounded-full bg-surface-default" />
        <div className="ml-auto w-3 h-3 rounded-full bg-surface-default" />
      </div>
      {/* Two-column card masonry */}
      <div className="flex-1 flex gap-1.5 min-h-0">
        {[layout.left, layout.right].map((col, ci) => (
          <div key={ci} className="flex-1 flex flex-col gap-1.5 min-w-0">
            {col.map((height, i) => {
              const cardIndex = ci === 0 ? i : layout.left.length + i;
              return <CardBlock key={i} height={height} accent={cardIndex === accentIndex} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
