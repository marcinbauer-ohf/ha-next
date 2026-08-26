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
import { IconHome } from '@tabler/icons-react';

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
  flag,
}: {
  /** Centre to fly to when it changes — panning never updates this. */
  center: LatLng | null;
  onChange: (loc: LatLng) => void;
  /** Country flag emoji raised from the house a beat after panning settles. */
  flag?: string | null;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* the photo develops: the map fades in from a blur over ~1.5s */}
      <div className="w-full h-full" style={{ animation: 'obv2-develop 1.5s ease both' }}>
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
      </div>
      {/* Fixed centre marker — the home badge from the dashboards. z-500 beats
          leaflet's panes (z 400); pointer-events off so it never eats a pan. */}
      <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
        <span
          className="relative flex size-[40px] rounded-full items-center justify-center border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          style={{ background: '#009ac7', animation: 'obv2-marker-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
        >
          <IconHome size={20} color="#ffffff" />
          {/* the house hoists the flag of whatever country it lands in. The
              horizontal centring lives in `transform` (not a translate utility)
              so the keyframes replace it instead of compounding with it. */}
          {flag && (
            <span
              key={flag}
              className="obv2-flag absolute -top-[30px] left-1/2 text-[24px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
              style={{ transform: 'translate(-50%, 0)' }}
            >
              {flag}
            </span>
          )}
        </span>
      </div>
      <style>{`
        @keyframes obv2-develop { 0% { opacity: 0; filter: blur(8px) saturate(0.5); } 100% { opacity: 1; filter: blur(0) saturate(1); } }
        @keyframes obv2-marker-in { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes obv2-flag-up { 0% { transform: translate(-50%, 18px) scale(0.2); opacity: 0; } 60% { transform: translate(-50%, -3px) scale(1.08); opacity: 1; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
        .obv2-flag { animation: obv2-flag-up 0.5s ease-out; }
      `}</style>
    </div>
  );
}
