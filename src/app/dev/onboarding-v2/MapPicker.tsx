'use client';

/**
 * Light leaflet canvas for the onboarding-v2 location step. Same picking model
 * as the app's onboarding LocationMap: a fixed centre pin over a pannable map —
 * the map centre IS the answer. Loaded with ssr:false (leaflet reads `window`
 * at import time).
 */

import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { IconMapPin } from '@tabler/icons-react';

// OSM standard tiles — key-less; CARTO's free basemaps now watermark
// "API KEY REQUIRED".
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Pans when the step hands down a new centre (e.g. "use my location"). */
function Recenter({ center }: { center: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], 16);
  }, [map, center]);
  return null;
}

function ReportCentre({ onChange }: { onChange: (loc: LatLng) => void }) {
  const map = useMap();
  useMapEvent('moveend', () => {
    const { lat, lng } = map.getCenter();
    onChange({ lat, lng });
  });
  return null;
}

export default function MapPicker({
  center,
  onChange,
}: {
  /** Centre to fly to when it changes — panning never updates this. */
  center: LatLng | null;
  onChange: (loc: LatLng) => void;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-[24px]">
      <MapContainer
        // No location yet: whole-world view so the first move is picking a
        // continent, not an arbitrary city pretending to be home.
        center={center ? [center.lat, center.lng] : [20, 0]}
        zoom={center ? 16 : 2}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={TILE_URL} />
        <Recenter center={center} />
        <ReportCentre onChange={onChange} />
      </MapContainer>
      {/* Fixed centre pin. z-500 beats leaflet's panes (z 400); pointer-events
          off so it never eats a pan that starts on it. Lifted half its height
          so the TIP marks the centre. */}
      <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
        <span className="-translate-y-1/2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
          <IconMapPin size={40} color="#009ac7" fill="#ffffff" stroke={1.5} />
        </span>
      </div>
    </div>
  );
}
