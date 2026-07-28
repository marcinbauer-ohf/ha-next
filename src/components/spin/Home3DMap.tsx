'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AreaWithCounts } from '@/hooks/useAreasFloors';
import type { HassDevice } from '@/hooks/useDevices';
import type { SpinCategory } from './spinCategories';

interface RoomBox {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutResult {
  rooms: RoomBox[];
  W: number;
  H: number;
}

const GAP = 16;

/** Greedy row packer over a virtual canvas — rooms sized by how much lives in them. */
function packRooms(areas: AreaWithCounts[], rowWidth: number): LayoutResult {
  const rooms: RoomBox[] = [];
  const sized = areas.map((a) => ({
    id: a.area_id,
    name: a.name,
    w: Math.min(300, 150 + Math.sqrt(Math.max(a.entityCount, 1)) * 26),
    h: Math.min(200, 116 + Math.sqrt(Math.max(a.deviceCount, 1)) * 16),
  }));

  let y = 0;
  let row: typeof sized = [];
  let rowW = 0;
  const flush = () => {
    if (row.length === 0) return;
    const rowH = Math.max(...row.map((r) => r.h));
    const totalW = row.reduce((s, r) => s + r.w, 0) + GAP * (row.length - 1);
    let x = (rowWidth - totalW) / 2;
    for (const r of row) {
      // Vertically center shorter rooms in the row so edges stay organic.
      rooms.push({ id: r.id, name: r.name, x, y: y + (rowH - r.h) / 2, w: r.w, h: r.h });
      x += r.w + GAP;
    }
    y += rowH + GAP;
    row = [];
    rowW = 0;
  };

  for (const r of sized) {
    if (rowW > 0 && rowW + GAP + r.w > rowWidth) flush();
    row.push(r);
    rowW += (rowW > 0 ? GAP : 0) + r.w;
  }
  flush();

  return { rooms, W: rowWidth, H: Math.max(y - GAP, 1) };
}

interface RoomStats {
  total: number;
  active: number;
}

interface Home3DMapProps {
  areas: AreaWithCounts[];
  devices: HassDevice[];
  view: '3d' | '2d';
  focusCategory: SpinCategory | null;
  selectedArea: string | null;
  onSelectArea: (id: string | null) => void;
}

export function Home3DMap({ areas, devices, view, focusCategory, selectedArea, onSelectArea }: Home3DMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowWidth = size.w > 0 && size.w < 640 ? 620 : 1000;
  const layout = useMemo(() => packRooms(areas, rowWidth), [areas, rowWidth]);

  // Per-room live stats. Without a focused category we track lights (the glow
  // that makes the home feel alive); with one, that category's entities.
  const stats = useMemo(() => {
    const byArea = new Map<string, RoomStats>();
    for (const device of devices) {
      if (!device.areaId || device.isService) continue;
      const entry = byArea.get(device.areaId) ?? { total: 0, active: 0 };
      for (const entity of device.entities) {
        const matches = focusCategory
          ? focusCategory.matches(entity)
          : entity.entity_id.startsWith('light.');
        if (!matches) continue;
        entry.total += 1;
        const active = focusCategory ? focusCategory.isActive(entity) : entity.state === 'on';
        if (active) entry.active += 1;
      }
      byArea.set(device.areaId, entry);
    }
    return byArea;
  }, [devices, focusCategory]);

  const deviceDots = useMemo(() => {
    if (!selectedArea) return [];
    return devices.filter((d) => d.areaId === selectedArea && !d.isService).slice(0, 12);
  }, [devices, selectedArea]);

  const fit = size.w > 0 ? Math.min((size.w * 0.94) / layout.W, (size.h * 0.9) / layout.H) : 0.5;

  // Camera: zoom + pan so the picked room lands dead-center.
  const selected = selectedArea ? layout.rooms.find((r) => r.id === selectedArea) : null;
  const tiltDeg = view === '3d' ? (selected ? 32 : 54) : 0;
  const zoom = selected ? Math.min(Math.max((layout.W * 0.52) / selected.w, 1.5), 2.6) : 1;
  const cx = layout.W / 2;
  const cy = layout.H / 2;
  const panX = selected ? (cx - (selected.x + selected.w / 2)) * zoom : 0;
  const panY = selected
    ? (cy - (selected.y + selected.h / 2)) * zoom * Math.cos((tiltDeg * Math.PI) / 180)
    : 0;

  const accent = focusCategory?.accent ?? '#18bcf2';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ perspective: 1600 }}
      onClick={() => selectedArea && onSelectArea(null)}
    >
      {areas.length === 0 && (
        <p className="text-sm text-white/40">No rooms set up yet</p>
      )}
      <div style={{ transform: `scale(${fit})` }}>
        <motion.div
          className="relative"
          style={{ width: layout.W, height: layout.H, transformStyle: 'preserve-3d' }}
          animate={{ rotateX: tiltDeg, scale: zoom, x: panX, y: panY }}
          transition={{ type: 'spring', stiffness: 160, damping: 26, mass: 0.9 }}
        >
          {layout.rooms.map((room, i) => {
            const stat = stats.get(room.id);
            const isSelected = selectedArea === room.id;
            const dimmed =
              (focusCategory && (!stat || stat.total === 0)) ||
              (selectedArea !== null && !isSelected);
            const lit = (stat?.active ?? 0) > 0;

            return (
              <motion.div
                key={room.id}
                className="absolute cursor-pointer"
                style={{
                  left: room.x,
                  top: room.y,
                  width: room.w,
                  height: room.h,
                  transformStyle: 'preserve-3d',
                }}
                initial={{ opacity: 0, z: -60 }}
                animate={{ opacity: dimmed ? 0.28 : 1, z: 0 }}
                transition={{ duration: 0.5, delay: i * 0.035, ease: [0.32, 0.72, 0, 1] }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectArea(isSelected ? null : room.id);
                }}
              >
                {/* Ground shadow sells the float. */}
                <div
                  className="absolute inset-0 rounded-[22px]"
                  style={{
                    transform: 'translateZ(0px)',
                    background: 'rgba(2, 8, 24, 0.55)',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                  }}
                />
                {/* Slab top face. */}
                <motion.div
                  className="absolute inset-0 flex flex-col justify-between rounded-[22px] border p-4"
                  style={{ transform: view === '3d' ? 'translateZ(26px)' : 'translateZ(0px)' }}
                  animate={{
                    borderColor: lit ? `${accent}66` : 'rgba(255,255,255,0.14)',
                    background: lit
                      ? `linear-gradient(160deg, ${accent}2e 0%, rgba(255,255,255,0.06) 60%)`
                      : 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
                    boxShadow: lit ? `0 0 42px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.18)` : 'inset 0 1px 0 rgba(255,255,255,0.12)',
                  }}
                  transition={{ duration: 0.45 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[17px] font-medium leading-tight text-white/90">{room.name}</span>
                    {stat && stat.total > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums"
                        style={{
                          background: lit ? `${accent}33` : 'rgba(255,255,255,0.1)',
                          color: lit ? accent : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {focusCategory ? `${stat.active}/${stat.total}` : stat.active > 0 ? `${stat.active} on` : stat.total}
                      </span>
                    )}
                  </div>

                  {/* Device dots appear when the room is focused. */}
                  {isSelected && (
                    <div className="relative flex-1">
                      {deviceDots.map((d, di) => {
                        const dotActive = d.entities.some((e) =>
                          focusCategory ? focusCategory.isActive(e) : e.state === 'on' && e.entity_id.startsWith('light.'),
                        );
                        return (
                          <motion.div
                            key={d.id}
                            className="absolute flex items-center gap-1.5"
                            style={{
                              left: `${10 + ((di * 37) % 65)}%`,
                              top: `${12 + ((di * 53) % 62)}%`,
                            }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.25 + di * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                background: dotActive ? accent : 'rgba(255,255,255,0.45)',
                                boxShadow: dotActive ? `0 0 12px ${accent}` : 'none',
                              }}
                            />
                            <span className="max-w-[90px] truncate text-[10px] font-medium text-white/70">{d.name}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
