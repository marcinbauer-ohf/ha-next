'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// The brand catalogue behind "+ → Integration / Device" — every device and
// service Home Assistant works with, as listed on home-assistant.io/integrations
// (the same page people browse, curated shelf and all). A running instance can
// only tell us what is already set up, so the catalogue is a snapshot committed
// to public/integration-catalog.json; refresh it with
// `node scripts/fetch-integration-catalog.mjs`.
//
// It is half a megabyte, so it stays a fetched static file rather than an import:
// nothing lands in the bundle, and nothing is fetched until a store opens.
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogBrand {
  /** Doc-page slug — the stable id (Shelly and Shelly Z-Wave share a domain). */
  slug: string;
  /** Brand domain: the brands-CDN logo key, and what a set-up integration reports. */
  domain: string;
  name: string;
  tagline: string;
  /** The one group it browses under. */
  group: string;
  /** Home Assistant's own categories, for search and the detail pane. */
  categories: string[];
  featured: boolean;
  /** Works with Home Assistant partner. */
  partner: boolean;
  /** Home Assistant version it arrived in. */
  since: string | null;
  iotClass: string | null;
  quality: string | null;
  type: string;
  url: string;
}

interface Catalog {
  generated: string;
  groups: string[];
  items: CatalogBrand[];
}

const EMPTY: Catalog = { generated: '', groups: [], items: [] };

let store: Catalog = EMPTY;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const getSnapshot = () => store;
const getServerSnapshot = () => EMPTY;

function load(): Promise<void> {
  if (inFlight) return inFlight;
  if (store !== EMPTY) return Promise.resolve();
  inFlight = fetch('/integration-catalog.json')
    .then((res) => (res.ok ? res.json() : EMPTY))
    .then((catalog: Catalog) => {
      store = catalog;
      listeners.forEach((l) => l());
    })
    // A missing snapshot leaves an empty store, which the store overlay shows as
    // "nothing matches" — no throw, no error state to design for.
    .catch(() => {})
    .finally(() => { inFlight = null; });
  return inFlight;
}

/**
 * The brand catalogue. Fetched on first `active` mount (i.e. when the store
 * opens) and then shared, so reopening it is instant.
 */
export function useIntegrationCatalog(active: boolean): {
  items: CatalogBrand[];
  groups: string[];
  loading: boolean;
} {
  const catalog = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (active) void load();
  }, [active]);

  return {
    items: catalog.items,
    groups: catalog.groups,
    loading: active && catalog === EMPTY,
  };
}

// ── Prototype-local additions ───────────────────────────────────────────────
// Adding a brand here means "yes, I would add this" — it does not start a config
// flow. Real setup asks for a host, a token, a pairing code, one dialog per
// brand; this prototype is about browsing and choosing.
// ponytail: swap for the config_flow WS calls (flow/start → step) when the
// prototype is meant to actually set integrations up.

const added = new Set<string>();
let addedVersion = 0;
const addedListeners = new Set<() => void>();

function subscribeAdded(listener: () => void): () => void {
  addedListeners.add(listener);
  return () => { addedListeners.delete(listener); };
}
const getAddedVersion = () => addedVersion;
const getServerAddedVersion = () => 0;

/** Brand domains added this session, and the way to add one. */
export function useAddedBrands(): { added: Set<string>; addBrand: (domain: string) => void } {
  const version = useSyncExternalStore(subscribeAdded, getAddedVersion, getServerAddedVersion);

  const addBrand = useCallback((domain: string) => {
    if (added.has(domain)) return;
    added.add(domain);
    addedVersion += 1;
    addedListeners.forEach((l) => l());
  }, []);

  // A new Set each version so consumers memoising on it actually re-derive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snapshot = useMemo(() => new Set(added), [version]);

  return { added: snapshot, addBrand };
}
