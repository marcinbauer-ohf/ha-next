'use client';

import { Icon } from '../ui/Icon';
import { mdiDragHorizontalVariant } from '@mdi/js';

// ─────────────────────────────────────────────────────────────────────────────
// Tray of not-yet-placed devices for the active floor. Drag an item onto the
// map to drop a chip. The tray only tracks the pointer (capture stays on the
// item so moves keep firing); the host (AreasEditor) renders the drag ghost and
// resolves the drop against the canvas via its drop converter.
// ─────────────────────────────────────────────────────────────────────────────

export interface TrayDevice {
  id: string;
  name: string;
  icon: string;
  areaName: string;
}

export function DeviceTray({
  devices,
  onDragStart,
  onDragMove,
  onDrop,
}: {
  devices: TrayDevice[];
  onDragStart: (deviceId: string) => void;
  onDragMove: (clientX: number, clientY: number) => void;
  onDrop: (clientX: number, clientY: number) => void;
}) {
  return (
    <div className="space-y-ha-3 px-ha-4 py-ha-4">
      <p className="text-sm text-text-secondary">
        Drag a device onto its room to place it on the map.
      </p>
      {devices.length === 0 ? (
        <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-6 text-center text-sm text-text-tertiary">
          Every device on this floor is placed. Switch floors to place more.
        </div>
      ) : (
        <div className="space-y-ha-1">
          {devices.map((d) => (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                onDragStart(d.id);
                onDragMove(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => onDragMove(e.clientX, e.clientY)}
              onPointerUp={(e) => onDrop(e.clientX, e.clientY)}
              onPointerCancel={(e) => onDrop(e.clientX, e.clientY)}
              className="flex w-full cursor-grab touch-none items-center gap-ha-3 rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-3 py-ha-2 text-left transition-colors hover:bg-surface-low active:cursor-grabbing"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-ha-lg bg-surface-mid text-text-secondary">
                <Icon path={d.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">{d.name}</span>
                <span className="block truncate text-xs text-text-tertiary">{d.areaName}</span>
              </span>
              <Icon path={mdiDragHorizontalVariant} size={16} className="flex-shrink-0 text-text-disabled" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
