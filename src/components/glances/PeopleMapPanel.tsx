'use client';

import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mdiHome } from '@mdi/js';

import { useHomeAssistant, useHomeAssistantSelector, useTheme } from '@/hooks';
import { selectPeopleMap, arePeopleMapEqual, type PersonSummary } from '@/lib/homeassistant/selectors';

// ─────────────────────────────────────────────────────────────────────────────
// Where everyone is, beside the list of who is where. The view opens on the
// home rather than fitting everybody in, because "is anyone out" is answered by
// the house being centred — but then somebody two towns over is off-screen and
// invisible, which is the one thing a presence map must never do. So whoever
// falls outside the viewport is pinned to the edge they left through, at the
// bearing they lie in; tapping one flies to them. Pan back and they slide off
// the edge and become a real marker again.
// ─────────────────────────────────────────────────────────────────────────────

// CartoDB basemaps — free, key-less. Same pair the onboarding location step uses.
const TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_URL_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

/** How far in the edge avatars sit from the map's border. */
const EDGE_INSET = 22;

type Located = PersonSummary & { lat: number; lng: number; picture?: string };

function hasCoords(p: PersonSummary): p is Located {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function subscribeToScheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Resolve the active colour mode to a concrete light/dark boolean. */
function useIsDarkMode(): boolean {
  const { mode } = useTheme();
  // The OS preference is an external store; reading it as one keeps the
  // "system" case honest without mirroring it into state.
  const systemDark = useSyncExternalStore(subscribeToScheme, prefersDark, () => true);
  return mode === 'system' ? systemDark : mode === 'dark';
}

function personIcon(person: Located): L.DivIcon {
  const inner = person.picture ? `<img src="${person.picture}" alt="" />` : `<span>${person.initials}</span>`;
  return L.divIcon({
    className: 'ha-map-marker',
    html: `<div class="ha-map-avatar${person.isHome ? '' : ' is-away'}">${inner}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function homeIcon(): L.DivIcon {
  return L.divIcon({
    className: 'ha-map-marker',
    html: `<div class="ha-map-home"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="${mdiHome}"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/**
 * The dialog animates in, so Leaflet measures the container mid-slide and lays
 * its tiles out against a size that is about to change — the classic half-drawn
 * grid. Watching the element and re-measuring costs nothing and covers the
 * animation, the two-column breakpoint, and the window alike.
 */
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    // The first frame after mount is the one the animation starts from.
    const raf = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [map]);
  return null;
}

/** Centre on the home the first time we know where it is, and only then. */
function OpenOnHome({ centre, zoom }: { centre: [number, number] | null; zoom: number }) {
  const map = useMap();
  const key = centre ? `${centre[0]},${centre[1]}` : '';
  useEffect(() => {
    if (centre) map.setView(centre, zoom, { animate: false });
    // Re-centring on every pan would fight the user; only a new home moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, zoom]);
  return null;
}

interface EdgeMark {
  person: Located;
  x: number;
  y: number;
  /** Rotation of the little pointer, in degrees — which way they actually are. */
  angle: number;
  /** Rounded distance from the map's centre, in km. */
  km: number;
}

/**
 * Everyone currently off-screen, clamped to the border. Recomputed on every
 * move/zoom, which is cheap: a handful of people and one projection each.
 */
function EdgeAvatars({ people }: { people: Located[] }) {
  const map = useMap();
  // Marks are a pure function of (viewport, people) — so they're derived, not
  // stored. Map events only need to say "the viewport moved, look again".
  const [viewport, moved] = useReducer((n: number) => n + 1, 0);
  useMapEvents({ move: moved, zoom: moved, resize: moved });

  const marks = useMemo<EdgeMark[]>(() => {
    const size = map.getSize();
    const centre = { x: size.x / 2, y: size.y / 2 };
    const bounds = map.getBounds();
    const next: EdgeMark[] = [];

    for (const person of people) {
      const here = L.latLng(person.lat, person.lng);
      if (bounds.contains(here)) continue;

      const p = map.latLngToContainerPoint(here);
      const dx = p.x - centre.x;
      const dy = p.y - centre.y;
      if (dx === 0 && dy === 0) continue;

      // Push the direction vector out until it meets the inset border, then
      // take the nearer of the two axis crossings — that's the edge it exits.
      const halfW = Math.max(1, centre.x - EDGE_INSET);
      const halfH = Math.max(1, centre.y - EDGE_INSET);
      const scale = Math.min(halfW / Math.abs(dx || 1e-6), halfH / Math.abs(dy || 1e-6));

      next.push({
        person,
        x: centre.x + dx * scale,
        y: centre.y + dy * scale,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        km: Math.round(map.getCenter().distanceTo(here) / 1000),
      });
    }
    return next;
    // `viewport` is the reactive handle on the map's own pan/zoom state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, people, viewport]);

  if (marks.length === 0) return null;

  return (
    <>
      {marks.map(({ person, x, y, angle, km }) => (
        <button
          key={person.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            map.flyTo([person.lat, person.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
          }}
          title={`${person.name} — about ${km} km away. Tap to look.`}
          aria-label={`Pan to ${person.name}, about ${km} kilometres away`}
          className="absolute z-[600] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          style={{ left: x, top: y }}
        >
          <span className="relative block">
            {/* The pointer sits behind the avatar, aimed the way they are. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-l-[7px] border-y-transparent border-l-ha-blue"
              style={{ transform: `rotate(${angle}deg) translateX(13px) translateY(-50%)`, transformOrigin: 'left center' }}
            />
            <span className="ha-map-avatar ha-map-avatar--edge is-away block">
              {person.picture
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={person.picture} alt="" />
                : <span>{person.initials}</span>}
            </span>
          </span>
        </button>
      ))}
    </>
  );
}

/**
 * The map half of the people dialog. Desktop shows it beside the list; on a
 * phone it stacks above it.
 */
export default function PeopleMapPanel() {
  const { haUrl } = useHomeAssistant();
  const isDark = useIsDarkMode();
  const { home, people } = useHomeAssistantSelector(selectPeopleMap, arePeopleMapEqual);

  const located = useMemo<Located[]>(
    () => people.filter(hasCoords).map((p) => ({
      ...p,
      picture: p.picture ? `${haUrl}${p.picture}` : undefined,
    })),
    [people, haUrl],
  );

  const centre = useMemo<[number, number] | null>(
    () => (home ? [home.lat, home.lng] : located[0] ? [located[0].lat, located[0].lng] : null),
    [home, located],
  );

  if (!centre) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-ha-2xl bg-surface-default px-ha-4 text-center">
        <p className="text-sm text-text-secondary">
          Nobody is sharing their location yet, so there is nothing to put on a map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[260px] overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default lg:h-[340px]">
      <MapContainer
        className="ha-map-canvas"
        center={centre}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer key={isDark ? 'dark' : 'light'} url={isDark ? TILE_URL_DARK : TILE_URL_LIGHT} />
        {home && <Marker position={[home.lat, home.lng]} icon={homeIcon()} />}
        {located.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={personIcon(p)} />
        ))}
        <KeepSized />
        <OpenOnHome centre={centre} zoom={15} />
        <EdgeAvatars people={located} />
      </MapContainer>
    </div>
  );
}
