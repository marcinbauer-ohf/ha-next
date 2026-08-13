'use client';

/**
 * The leaflet canvas behind the onboarding location step. Split out of
 * LocationStep and loaded with `ssr: false` — leaflet touches `window` at
 * import time, so it can't be part of the server-rendered module graph.
 *
 * Picking model is a fixed centre pin (a DOM overlay, not a leaflet marker):
 * the user pans/zooms and the map centre *is* the answer. Same tiles and marker
 * styling as the people map (.ha-map-home in globals.css).
 */

import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { mdiHome } from '@mdi/js';
import { Icon } from '@/components/ui';
import type { OnbLocation } from '../types';

// CartoDB dark basemap — free, key-less. The flow is forced dark throughout.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/** Pans when the step hands down a new centre (prefill, "use my location"). */
function Recenter({ center, zoom }: { center: OnbLocation | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], zoom);
  }, [map, center, zoom]);
  return null;
}

function ReportCentre({ onChange }: { onChange: (loc: OnbLocation) => void }) {
  const map = useMap();
  useMapEvent('moveend', () => {
    const { lat, lng } = map.getCenter();
    onChange({ lat, lng });
  });
  return null;
}

interface LocationMapProps {
  /** Centre to fly to when it changes — not updated by panning. */
  center: OnbLocation | null;
  onChange: (loc: OnbLocation) => void;
}

export default function LocationMap({ center, onChange }: LocationMapProps) {
  return (
    <div className="relative h-[240px] md:h-[300px] rounded-ha-3xl overflow-hidden border border-surface-lower">
      <MapContainer
        className="ha-map-canvas"
        // No known location yet: a whole-world view, so panning to a continent
        // is the first move rather than an arbitrary city being "your home".
        center={center ? [center.lat, center.lng] : [20, 0]}
        zoom={center ? 16 : 2}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={TILE_URL} />
        <Recenter center={center} zoom={16} />
        <ReportCentre onChange={onChange} />
      </MapContainer>

      {/* Fixed centre pin — the thing being placed. pointer-events-none so it
          never eats a pan gesture that starts on top of it. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="ha-map-home">
          <Icon path={mdiHome} size={20} />
        </div>
      </div>
    </div>
  );
}
