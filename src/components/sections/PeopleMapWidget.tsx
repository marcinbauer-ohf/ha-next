'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mdiHome, mdiMapMarkerAccount } from '@mdi/js';

import { useHomeAssistant, useHomeAssistantSelector, useTheme } from '@/hooks';
import { selectPeopleMap, arePeopleMapEqual, type PersonSummary, type HomeLocation } from '@/lib/homeassistant/selectors';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';

// CartoDB basemaps — free, key-less. Light/dark variants follow the color mode.
const TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_URL_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

/** Resolve the active color mode to a concrete light/dark boolean. */
function useIsDarkMode(): boolean {
  const { mode } = useTheme();
  const [isDark, setIsDark] = useState(mode !== 'light');
  useEffect(() => {
    if (mode !== 'system') {
      setIsDark(mode === 'dark');
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [mode]);
  return isDark;
}

function hasCoords<T extends PersonSummary>(p: T): p is T & { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

/** Build a Leaflet divIcon for a person avatar (picture or initials). */
function personIcon(person: PersonSummary, picture?: string): L.DivIcon {
  const inner = picture
    ? `<img src="${picture}" alt="" />`
    : `<span>${person.initials}</span>`;
  const away = person.state !== 'home';
  return L.divIcon({
    className: 'ha-map-marker',
    html: `<div class="ha-map-avatar${away ? ' is-away' : ''}">${inner}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function homeIcon(): L.DivIcon {
  // mdiHome glyph rendered inline so the home marker matches the icon set.
  return L.divIcon({
    className: 'ha-map-marker',
    html: `<div class="ha-map-home"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="${mdiHome}"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/** Fit the viewport to every marker once they're known. */
function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16, animate: false });
  }, [map, points]);
  return null;
}

export default function PeopleMapWidget() {
  const { haUrl } = useHomeAssistant();
  const isDark = useIsDarkMode();
  const { home, people, anyoneAway } = useHomeAssistantSelector(selectPeopleMap, arePeopleMapEqual);

  const resolved = useMemo(
    () =>
      people.map((person) => ({
        ...person,
        picture: person.picture ? `${haUrl}${person.picture}` : undefined,
      })),
    [people, haUrl],
  );

  const peopleHome = resolved.filter((p) => p.state === 'home');
  const peopleWithCoords = resolved.filter(hasCoords);

  const points = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = peopleWithCoords.map((p) => [p.lat, p.lng]);
    if (home) pts.push([home.lat, home.lng]);
    return pts;
  }, [peopleWithCoords, home]);

  // Map is only meaningful when (a) someone is away and (b) we have coordinates
  // to plot. Otherwise collapse to the people summary.
  const canShowMap = anyoneAway && points.length > 0;

  if (!canShowMap) {
    return <PeopleSummaryCard peopleHome={peopleHome} total={resolved.length} home={home} />;
  }

  return (
    <div className="relative h-48 lg:h-56 rounded-ha-xl overflow-hidden border border-surface-lower bg-surface-default">
      <MapContainer
        className="ha-map-canvas"
        center={home ? [home.lat, home.lng] : points[0]}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging
        doubleClickZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer key={isDark ? 'dark' : 'light'} url={isDark ? TILE_URL_DARK : TILE_URL_LIGHT} />
        {home && <Marker position={[home.lat, home.lng]} icon={homeIcon()} />}
        {peopleWithCoords.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={personIcon(p, p.picture)} />
        ))}
        <FitToMarkers points={points} />
      </MapContainer>

      {/* Status pill — count away */}
      <div className="absolute top-ha-3 left-ha-3 z-[500] flex items-center gap-ha-2 rounded-ha-pill bg-surface-default/85 border border-white/10 px-ha-3 py-ha-1.5 pointer-events-none">
        <Icon path={mdiMapMarkerAccount} size={16} className="text-ha-blue" />
        <span className="text-sm font-medium text-text-primary">
          {resolved.length - peopleHome.length} away · {peopleHome.length} home
        </span>
      </div>
    </div>
  );
}

function PeopleSummaryCard({
  peopleHome,
  total,
  home,
}: {
  peopleHome: PersonSummary[];
  total: number;
  home: HomeLocation | null;
}) {
  if (total === 0) return null;
  const everyoneHome = peopleHome.length === total;

  return (
    <div className="flex items-center gap-ha-4 p-ha-4 rounded-ha-xl bg-surface-default border border-surface-lower">
      <div className="flex-shrink-0 w-11 h-11 rounded-full bg-ha-blue/15 flex items-center justify-center text-ha-blue">
        <Icon path={mdiHome} size={24} />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-base font-semibold text-text-primary">
          {everyoneHome ? 'Everyone home' : `${peopleHome.length} of ${total} home`}
        </span>
        <span className="text-xs text-text-secondary">
          {home ? 'All accounted for' : 'No location data'}
        </span>
      </div>
      <div className="flex -space-x-2 flex-shrink-0">
        {peopleHome.slice(0, 5).map((person) => (
          <Avatar
            key={person.id}
            src={person.picture}
            initials={person.initials}
            size="sm"
            className="ring-2 ring-surface-default bg-surface-mid"
          />
        ))}
      </div>
    </div>
  );
}
