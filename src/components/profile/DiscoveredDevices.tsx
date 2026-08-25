'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { mdiChevronDown, mdiClose, mdiEyeOffOutline } from '@mdi/js';
import { Icon, SectionLabel, Button, IconButton, IntegrationLogo } from '../ui';
import { useHomeAssistant } from '@/hooks';
import { useIntegrationCatalog } from '@/hooks/useIntegrationCatalog';
import {
  subscribeDiscoveryFlows,
  getConfigEntries,
  deleteConfigEntry,
  ignoreFlow,
  type DiscoveryFlow,
} from '@/lib/homeassistant';
import { DiscoverySetupSheet } from './DiscoverySetup';
import { DeviceCardV2 } from '../cards/DeviceCardV2';
import { SectionHeader } from '../sections/SectionHeader';
import {
  demoDiscoveries,
  discoveryFromFlow,
  getServerVerdictVersion,
  getVerdictVersion,
  setDiscoveryVerdict,
  subscribeVerdicts,
  type Discovery,
} from '@/lib/deviceDiscovery';

// ─────────────────────────────────────────────────────────────────────────────
// The two sections Home Assistant's integrations page has and the store didn't:
// what the home found and is waiting on, and what you told it wasn't yours.
//
// They belong at the two ends of the store on purpose. A device the home already
// found is the shortest path to done, so it sits above everything you could
// browse for; a device you dismissed is a correction you make rarely, so it sits
// under the grid, folded away, with the count as the only thing you have to read.
// ─────────────────────────────────────────────────────────────────────────────

// A real home has more waiting than fits above the browse grid — 25 here on the
// instance this was built against, ten of them the same brand. So the shelf shows
// a handful and offers the rest, rather than pushing everything you came to
// browse a screen and a half down.
const SHELF_PREVIEW = 6;

/**
 * What the home found. Real discovery flows from the connected instance, and the
 * demo stand-ins only when there is no instance to ask — a connected home shows
 * what it actually found, including nothing.
 *
 * The emptied demo finds nothing either: it stands for a box that was just
 * plugged in, and stand-in hardware in it would be the one thing that isn't
 * empty. Every discovery surface derives from here, so this is the only gate.
 */
function useDiscoveries(): Discovery[] {
  const { connected, demoEmpty } = useHomeAssistant();
  const [flows, setFlows] = useState<DiscoveryFlow[]>([]);
  // Names for the bare finds: a `cast` or `roborock` flow arrives with no
  // placeholders at all, and the catalogue is already loaded by the open store.
  const { items: catalog } = useIntegrationCatalog(connected);
  const version = useSyncExternalStore(subscribeVerdicts, getVerdictVersion, getServerVerdictVersion);

  useEffect(() => {
    // Nothing to clear on disconnect: the derivation below ignores `flows`
    // whenever we aren't connected, so a stale list can't leak into the shelf.
    if (!connected) return;
    let live = true;
    let stop: (() => void) | undefined;
    void subscribeDiscoveryFlows((next) => { if (live) setFlows(next); }).then((unsub) => {
      if (live) stop = unsub;
      else unsub();
    });
    return () => { live = false; stop?.(); };
  }, [connected]);

  const brandNames = useMemo(() => {
    const byDomain = new Map<string, string>();
    for (const brand of catalog) if (!byDomain.has(brand.domain)) byDomain.set(brand.domain, brand.name);
    return byDomain;
  }, [catalog]);

  return useMemo(() => {
    // The verdicts live outside React; bumping `version` is what re-derives them.
    void version;
    if (connected) return flows.map((f) => discoveryFromFlow(f, brandNames.get(f.handler)));
    return demoEmpty ? [] : demoDiscoveries();
  }, [connected, demoEmpty, flows, brandNames, version]);
}

/**
 * The thing's face: its brand's real logo for a real find, the product render for
 * a demo one. Either way the transport rides the corner, as it does in the toast
 * that announced it.
 */
function DeviceFace({ device, size, glyph }: { device: Discovery; size: string; glyph: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative flex-shrink-0 ${size}`}>
      {device.domain ? (
        <IntegrationLogo
          domain={device.domain}
          fallbackIcon={device.protocolIcon}
          // No background of ours: IntegrationLogo paints its own white plate,
          // which every brand's logo is drawn against.
          tileClass="h-full w-full flex items-center justify-center overflow-hidden rounded-ha-xl"
          iconSize={glyph}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-ha-xl bg-surface-mid">
          {broken || !device.image ? (
            <Icon path={device.protocolIcon} size={glyph} className="text-text-tertiary" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={device.image} alt="" onError={() => setBroken(true)} className="h-full w-full object-contain p-1" />
          )}
        </div>
      )}
      <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-surface-low bg-surface-default shadow-sm">
        <Icon path={device.protocolIcon} size={11} className="text-ha-blue" exact />
      </span>
    </div>
  );
}

/**
 * A find, and the only two answers to it: set it up, or say it isn't yours.
 * "Not mine" is the quiet one — an ignore you can take back from the section at
 * the bottom of the same store, so it never needs a confirmation.
 */
function DiscoveryCard({
  device,
  live,
  onSetUp,
}: {
  device: Discovery;
  /** True when this is a real flow on a connected home, not a demo stand-in. */
  live: boolean;
  onSetUp?: (d: Discovery) => void;
}) {
  const [setup, setSetup] = useState(false);
  return (
    <div className="flex flex-col gap-ha-3 rounded-ha-2xl border border-ha-blue/20 bg-ha-blue/[0.06] p-ha-4">
      <div className="flex items-start gap-ha-3">
        <DeviceFace device={device} size="h-12 w-12" glyph={24} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">{device.title}</p>
          {device.subtitle && (
            <p className="mt-0.5 truncate text-[13px] text-text-tertiary">{device.subtitle}</p>
          )}
          <p className="mt-0.5 truncate text-[13px] text-text-tertiary">{device.foundBy}</p>
        </div>
      </div>
      <div className="flex items-center gap-ha-2">
        <Button
          size="sm"
          variant="primary"
          className="flex-1"
          onClick={() => {
            // A real find opens its actual config flow; a demo one has nothing
            // behind it, so it just goes in.
            if (live) setSetup(true);
            else setDiscoveryVerdict(device.id, 'setUp');
            onSetUp?.(device);
          }}
        >
          Set up
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={mdiClose}
          onClick={() => {
            // Home Assistant's own ignore, so it stops being rediscovered. The
            // local verdict goes down either way: it's what empties the card out
            // of the shelf, and what tells the ignored list to re-read.
            if (live) void ignoreFlow(device.id, device.title);
            setDiscoveryVerdict(device.id, 'ignored');
          }}
        >
          Not mine
        </Button>
      </div>
      {setup && <DiscoverySetupSheet device={device} onClose={() => setSetup(false)} />}
    </div>
  );
}

/** The store's top shelf: everything the home found and hasn't been answered on. */
export function DiscoveredShelf({ onSetUp }: { onSetUp?: (d: Discovery) => void }) {
  const { connected } = useHomeAssistant();
  const waiting = useDiscoveries().filter((d) => d.verdict === 'waiting');
  const [showAll, setShowAll] = useState(false);
  if (waiting.length === 0) return null;
  const shown = showAll ? waiting : waiting.slice(0, SHELF_PREVIEW);
  return (
    <div className="flex flex-col gap-ha-3">
      <div className="flex items-baseline justify-between gap-ha-3">
        <SectionLabel>Found in your home</SectionLabel>
        <span className="text-[13px] text-text-tertiary">
          {waiting.length === 1 ? '1 device is waiting' : `${waiting.length} devices are waiting`}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-ha-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((d) => (
          <DiscoveryCard key={d.id} device={d} live={connected} onSetUp={onSetUp} />
        ))}
      </div>
      {waiting.length > SHELF_PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="self-start text-[13px] font-medium text-ha-blue transition-opacity hover:opacity-80"
        >
          {showAll ? 'Show fewer' : `Show all ${waiting.length}`}
        </button>
      )}
    </div>
  );
}

/** A discovery that has been told "not mine" — real or, in demo mode, local. */
interface IgnoredThing {
  key: string;
  title: string;
  subtitle: string;
  domain?: string;
  image?: string;
  protocolIcon: string;
  /** Set for a real ignored entry: the config entry to delete to undo it. */
  entryId?: string;
}

/**
 * What Home Assistant has been told to stop asking about. Real ignores are config
 * entries with source `ignore`, so this re-reads them whenever a verdict moves —
 * which is exactly when one was just added or taken back.
 */
function useIgnored(): IgnoredThing[] {
  const { connected } = useHomeAssistant();
  const version = useSyncExternalStore(subscribeVerdicts, getVerdictVersion, getServerVerdictVersion);
  const [entries, setEntries] = useState<IgnoredThing[]>([]);
  const demo = useDiscoveries();

  useEffect(() => {
    if (!connected) return;
    let live = true;
    void getConfigEntries().then((all) => {
      if (!live) return;
      setEntries(
        all
          .filter((entry) => entry.source === 'ignore')
          .map((entry) => ({
            key: entry.entry_id,
            entryId: entry.entry_id,
            title: entry.title || entry.domain,
            subtitle: 'You said this one is not yours',
            domain: entry.domain,
            protocolIcon: mdiEyeOffOutline,
          })),
      );
    });
    return () => { live = false; };
  }, [connected, version]);

  if (connected) return entries;
  return demo
    .filter((d) => d.verdict === 'ignored')
    .map((d) => ({
      key: d.id,
      title: d.title,
      subtitle: d.subtitle || d.foundBy,
      image: d.image,
      protocolIcon: d.protocolIcon,
    }));
}

/**
 * The store's footer: what you said wasn't yours. Folded by default — the count
 * is the whole message until the day you need to take one back.
 */
export function IgnoredDiscoveries() {
  const ignored = useIgnored();
  const [open, setOpen] = useState(false);
  if (ignored.length === 0) return null;

  /** Taking one back: drop HA's ignore record so it gets rediscovered. */
  const unignore = async (thing: IgnoredThing) => {
    if (thing.entryId) await deleteConfigEntry(thing.entryId);
    setDiscoveryVerdict(thing.key, 'waiting');
  };

  return (
    <div className="rounded-ha-2xl border border-surface-lower bg-surface-default">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 text-left"
      >
        <Icon path={mdiEyeOffOutline} size={18} className="flex-shrink-0 text-text-tertiary" />
        <span className="min-w-0 flex-1 text-[13px] text-text-secondary">
          {ignored.length === 1
            ? '1 device you said isn’t yours'
            : `${ignored.length} devices you said aren’t yours`}
        </span>
        <Icon
          path={mdiChevronDown}
          size={18}
          className={`flex-shrink-0 text-text-disabled transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-surface-low/60">
          {ignored.map((thing) => (
            <div key={thing.key} className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
              <DeviceFace
                device={{
                  id: thing.key,
                  title: thing.title,
                  subtitle: thing.subtitle,
                  foundBy: '',
                  domain: thing.domain,
                  image: thing.image,
                  protocolIcon: thing.protocolIcon,
                  verdict: 'ignored',
                }}
                size="h-9 w-9"
                glyph={18}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">{thing.title}</p>
                <p className="truncate text-[13px] text-text-tertiary">{thing.subtitle}</p>
              </div>
              <Button size="sm" variant="neutral" onClick={() => void unignore(thing)}>
                It is mine
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The same two categories as rows in the lists that already exist, rather than
// as sections stacked above them. A thing the home found is a thing you have —
// it just hasn't been let in yet — so it belongs among the others, sorted and
// searched with them, wearing a tint and carrying the one button that resolves
// it. The "Show" chips are what make each category appear or go away, which is
// the control those pages already use for devices vs services.
// ─────────────────────────────────────────────────────────────────────────────

/** The group these rows collect under, whichever grouping is chosen. */
export const PENDING_GROUP = { key: '✚', title: 'Found in your home' };
export const IGNORED_GROUP = { key: '✖', title: 'Not yours' };

/** A row that isn't a device yet: a discovery waiting, or one you dismissed. */
export interface PendingRow {
  kind: 'found' | 'ignored';
  /** Flow id, or the ignored config entry's id. */
  id: string;
  title: string;
  subtitle: string;
  foundBy: string;
  domain?: string;
  image?: string;
  protocolIcon: string;
  /** `found` only — what the setup sheet needs. */
  discovery?: Discovery;
  /** `ignored` only — the entry to delete to take it back. */
  entryId?: string;
}

/** Both categories, in the order they should appear above the real devices. */
export function usePendingRows(): PendingRow[] {
  const waiting = useDiscoveries().filter((d) => d.verdict === 'waiting');
  const ignored = useIgnored();
  return useMemo(
    () => [
      ...waiting.map((d): PendingRow => ({
        kind: 'found',
        id: d.id,
        title: d.title,
        subtitle: d.subtitle,
        foundBy: d.foundBy,
        domain: d.domain,
        image: d.image,
        protocolIcon: d.protocolIcon,
        discovery: d,
      })),
      ...ignored.map((t): PendingRow => ({
        kind: 'ignored',
        id: t.key,
        title: t.title,
        subtitle: t.subtitle,
        foundBy: '',
        domain: t.domain,
        image: t.image,
        protocolIcon: t.protocolIcon,
        entryId: t.entryId,
      })),
    ],
    [waiting, ignored],
  );
}

/** The face, reusing the discovery renderer's logo/render/transport treatment. */
function pendingFace(row: PendingRow): Discovery {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    foundBy: row.foundBy,
    domain: row.domain,
    image: row.image,
    protocolIcon: row.protocolIcon,
    verdict: row.kind === 'found' ? 'waiting' : 'ignored',
  };
}

/**
 * The buttons that resolve a row, and the setup sheet one of them opens. Lives
 * with the row rather than lifted to the table: each row owns exactly one flow,
 * and there is nothing for the table to coordinate.
 */
export function PendingActions({ row, size = 'sm' }: { row: PendingRow; size?: 'sm' }) {
  const { connected } = useHomeAssistant();
  const [setup, setSetup] = useState(false);

  if (row.kind === 'ignored') {
    return (
      <Button
        size={size}
        variant="neutral"
        onClick={async (e) => {
          e.stopPropagation();
          if (row.entryId) await deleteConfigEntry(row.entryId);
          setDiscoveryVerdict(row.id, 'waiting');
        }}
      >
        It is mine
      </Button>
    );
  }

  return (
    <>
      <Button
        size={size}
        variant="primary"
        onClick={(e) => {
          e.stopPropagation();
          if (connected) setSetup(true);
          else setDiscoveryVerdict(row.id, 'setUp');
        }}
      >
        Set up
      </Button>
      <IconButton
        icon={mdiClose}
        label="Not mine"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          if (connected) void ignoreFlow(row.id, row.title);
          setDiscoveryVerdict(row.id, 'ignored');
        }}
      />
      {setup && row.discovery && (
        <DiscoverySetupSheet device={row.discovery} onClose={() => setSetup(false)} />
      )}
    </>
  );
}

/** Tints: a find is the accent, a dismissal is greyed back. */
const PENDING_TINT: Record<PendingRow['kind'], string> = {
  found: 'bg-ha-blue/[0.07] hover:bg-ha-blue/[0.12]',
  ignored: 'bg-surface-mid/30 opacity-70 hover:opacity-100',
};

/** renderRow for a pending row — the list layout. */
export function PendingListRow({ row }: { row: PendingRow }) {
  return (
    <div className={`flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 transition-colors ${PENDING_TINT[row.kind]}`}>
      <DeviceFace device={pendingFace(row)} size="h-9 w-9" glyph={18} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">{row.title}</p>
        <p className="mt-0.5 truncate text-[13px] text-text-secondary">
          {[row.subtitle, row.foundBy].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-ha-1">
        <PendingActions row={row} />
      </div>
    </div>
  );
}

/** renderCard for a pending row — the grid layout. */
export function PendingTile({ row }: { row: PendingRow }) {
  return (
    <div
      className={`flex h-full w-full flex-col rounded-ha-2xl border border-surface-lower p-ha-4 transition-colors ${PENDING_TINT[row.kind]}`}
    >
      <div className="flex items-start gap-ha-3">
        <DeviceFace device={pendingFace(row)} size="h-11 w-11" glyph={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">{row.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-text-tertiary">{row.subtitle || row.foundBy}</p>
        </div>
      </div>
      <div className="mt-ha-3 flex items-center gap-ha-2">
        <PendingActions row={row} />
      </div>
    </div>
  );
}

/**
 * The identity cell for a pending row in the table layout — and its buttons.
 *
 * The actions ride in here rather than in a column of their own: a table already
 * carries the identity column plus every value column plus the chevron, and one
 * more pushed the whole thing past the panel edge, clipping the very button the
 * row exists for. The other columns have nothing to say about a row like this
 * anyway, so the identity cell is where it all belongs.
 */
export function PendingNameCell({ row }: { row: PendingRow }) {
  return (
    <div className="flex items-center gap-ha-3">
      <DeviceFace device={pendingFace(row)} size="h-8 w-8" glyph={16} />
      <span className="min-w-0 flex flex-1 items-center gap-ha-2">
        <span className="truncate font-semibold text-text-primary">{row.title}</span>
        <span
          className={`flex-shrink-0 rounded-full px-ha-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            row.kind === 'found' ? 'bg-ha-blue/15 text-ha-blue' : 'bg-surface-mid text-text-tertiary'
          }`}
        >
          {row.kind === 'found' ? 'Found' : 'Not yours'}
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-ha-1">
        <PendingActions row={row} />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// On the dashboard: a real DeviceCardV2, because a card that only half-looks
// like the others is worse than either. Same shape, same image slot, same tap-
// opens-a-dialog behaviour — what differs is a tinted ring and the fact that the
// dialog it opens is the setup step rather than the device's history.
//
// The section sits last and holds only `found` rows. Something you already said
// isn't yours has no business on the wall of your home; that lives in the lists
// in settings, behind its chip.
// ─────────────────────────────────────────────────────────────────────────────

/** The brand's logo, in the card's own image slot. */
const brandPicture = (row: PendingRow) =>
  row.domain ? `https://brands.home-assistant.io/${row.domain}/icon.png` : undefined;

function PendingDeviceCard({ row }: { row: PendingRow }) {
  const { connected } = useHomeAssistant();
  const [setup, setSetup] = useState(false);
  return (
    <>
      {/* The logo sits back, because the device isn't part of the home yet.
          `--dct-thumb-alpha` is the card's own dial for exactly this (it is what
          the card tuner writes, and what the card multiplies its unavailable
          render by) — and it has to be the dial rather than a class, because the
          card sets the thumbnail's opacity inline, where no stylesheet can
          reach it. */}
      <div style={{ '--dct-thumb-alpha': 0.6 } as React.CSSProperties}>
      <DeviceCardV2
        // The ring is the whole difference: a card the same size and weight as
        // its neighbours, outlined in the accent so it reads as "not yet part of
        // this" rather than as a different kind of object. Same weight as the
        // amber ring the card already wears when a device is unavailable — that
        // is this card's established way of saying "something is off about this
        // one", and a 1px version of it simply didn't read.
        className="ring-2 ring-inset ring-ha-blue/70"
        primary={{
          entityId: row.id,
          icon: row.protocolIcon,
          // The brand's logo goes in the card's product-render slot, not its
          // `entityPicture` one: that is the media-artwork hero, which blows the
          // logo up full-bleed behind the text and makes both unreadable.
          thumbnail: row.image ?? brandPicture(row) ?? null,
          name: row.title,
          // One word, no details. The logo takes nearly half the card's width, so
          // what is left fits a state and nothing more — "ESPHome · Found on your
          // network" clipped to "ound on your n", which is worse than silence.
          // The brand is on the card as its logo, and the rest is in the sheet a
          // tap away.
          state: 'Found',
          onClick: () => {
            if (connected) setSetup(true);
            else setDiscoveryVerdict(row.id, 'setUp');
          },
        }}
      />
      </div>
      {setup && row.discovery && (
        <DiscoverySetupSheet device={row.discovery} onClose={() => setSetup(false)} />
      )}
    </>
  );
}

/**
 * The dashboard's own section for what the home found. Its own block rather than
 * a bucket inside the grouped sections: those carry drag-to-reorder slots and a
 * saved order per section, and neither means anything for cards that vanish the
 * moment you deal with them.
 */
export function PendingDeviceSection({ columns }: { columns: number }) {
  const found = usePendingRows().filter((r) => r.kind === 'found');
  if (found.length === 0) return null;
  const cols: PendingRow[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  found.forEach((row, i) => cols[i % cols.length].push(row));
  return (
    <div data-section-key="__found__" data-section-title="Found in your home">
      <SectionHeader title="Found in your home" />
      <div className="flex items-start gap-ha-4">
        {cols.map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-ha-4">
            {col.map((row) => (
              <PendingDeviceCard key={row.id} row={row} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
