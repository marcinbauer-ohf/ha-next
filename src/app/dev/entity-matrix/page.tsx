'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { mdiHelpRhombusOutline } from '@mdi/js';
import { DeviceCardV2, type DeviceCardV2Entity } from '@/components/cards/DeviceCardV2';
import { DeviceCardEditPanel } from '@/components/cards/DeviceCardEditPanel';
import { EntityDetailBody, EntityDetailPanel, HERO_LAYOUTS, type HeroLayout, type PanelEntity } from '@/components/cards/EntityDetailPanel';
import { SegmentedControl } from '@/components/ui';
import { injectMockEntities, useHomeAssistant, useHomeAssistantEntities } from '@/hooks/useHomeAssistant';
import { PRESSABLE, TOGGLEABLE, deviceThumbnail, domainIcon, entityDomain, entityLabel, isOn, primaryCornerBadge, stateExtras, stateLabel } from '@/lib/homeassistant/entityHelpers';
import { BENCHMARK_DEVICE, benchmarkEntities, createBenchmarkEntries, type BenchmarkKind } from '@/lib/homeassistant/benchmarkDevice';
import type { DeviceCardConfig } from '@/hooks/useDeviceCardConfig';
import type { HassDevice } from '@/hooks';
import type { HassEntity } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Entity matrix — the Benchmark Rig device rendered through the real card and
// the real more-info panel, next to what each entity is supposed to show.
//
// Two views:
//   focus   — one entity at a time in the full dialog (card + panel + notes)
//   rows    — one example per row: its card on the left, its dialog on the
//             right, so the two surfaces sit on the same eye-line
//
// The rig's entities are staged in the mock entity store for the lifetime of
// this page only (and stripped on unmount), so nothing leaks into a live
// dashboard and its services resolve locally instead of hitting real HA.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_STYLE: Record<BenchmarkKind, string> = {
  read: 'bg-surface-mid text-text-secondary',
  control: 'bg-green-500/15 text-green-500',
  set: 'bg-ha-blue/15 text-ha-blue',
};

const KIND_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read-only' },
  { value: 'control', label: 'Control' },
  { value: 'set', label: 'Set' },
];

// Card/panel composition — the axis that isn't about entities at all: product
// render vs icon, camera hero, row density, chrome, card mode.
type Chrome =
  | 'thumbnail' | 'feed' | 'favorite' | 'smallRows' | 'noCharts'
  | 'editMode' | 'selected' | 'lastOpened' | 'ghost' | 'narrow';

const CHROME_TOGGLES: Array<{ key: Chrome; label: string; hint: string }> = [
  { key: 'thumbnail', label: 'Product render', hint: 'two-column hero with the device PNG' },
  { key: 'feed', label: 'Camera hero', hint: 'full-bleed feed image behind the card' },
  { key: 'favorite', label: 'Favourite', hint: 'star in the dialog header' },
  { key: 'smallRows', label: 'Small rows', hint: "secondary rows at size 'sm' (no icon)" },
  { key: 'noCharts', label: 'No row charts', hint: 'secondary rows without sparklines' },
  { key: 'editMode', label: 'Edit mode', hint: 'card ring + pencil affordance' },
  { key: 'selected', label: 'Selected', hint: 'card marked as open' },
  { key: 'lastOpened', label: 'Last opened', hint: 'softer post-close marker' },
  { key: 'ghost', label: 'Deleted entity', hint: 'row pointing at an id with no state' },
  { key: 'narrow', label: 'Phone width', hint: '390px column — mobile dialog layout' },
];

/** A card row whose entity no longer exists in the store. */
const GHOST_ENTITY: PanelEntity = {
  entityId: 'sensor.benchmark_deleted',
  icon: mdiHelpRhombusOutline,
  name: 'Deleted entity',
  state: 'Unavailable',
};

export default function EntityMatrixPage() {
  const [entries] = useState(createBenchmarkEntries);
  const [selectedId, setSelectedId] = useState(entries[0].entity.entity_id);
  const [view, setView] = useState<'focus' | 'gallery'>('focus');
  const [kind, setKind] = useState<BenchmarkKind | 'all'>('all');
  // Gallery only: 'none' is what the dialog's controls view uses (no history at
  // all, so no fetch), 'full' is its History tab.
  const [historyView, setHistoryView] = useState<'full' | 'none'>('none');
  const [chrome, setChrome] = useState<Set<Chrome>>(new Set(['thumbnail', 'favorite']));
  const [panelMode, setPanelMode] = useState<'entity' | 'edit'>('entity');
  // Hero arrangement under review — see HERO_LAYOUTS in EntityDetailPanel.
  const [heroLayout, setHeroLayout] = useState<HeroLayout>('band');
  const [cardConfig, setCardConfig] = useState<DeviceCardConfig>({ slots: [] });
  const { toggleEntity } = useHomeAssistant();
  const store = useHomeAssistantEntities();

  const on = (key: Chrome) => chrome.has(key);
  const toggleChrome = (key: Chrome) => setChrome(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  useEffect(() => injectMockEntities(benchmarkEntities(entries)), [entries]);

  // The store notifies on injection, so its own contents say when we're staged
  // (no setState-in-effect needed).
  const staged = selectedId in store;

  // Live copy from the store once staged, so toggles and sliders move.
  const live = (e: HassEntity): HassEntity => store[e.entity_id] ?? e;

  const toPanelEntity = (raw: HassEntity): PanelEntity => {
    const e = live(raw);
    const domain = entityDomain(e);
    const toggleable = TOGGLEABLE.has(domain);
    const pressable = PRESSABLE.has(domain);
    const picture = e.attributes.entity_picture as string | undefined;
    const extras = stateExtras(e);
    return {
      entityId: e.entity_id,
      icon: domainIcon(e),
      name: entityLabel(e, BENCHMARK_DEVICE.name),
      state: stateLabel(e),
      details: extras.details,
      dotColor: extras.accentRgb ? `rgb(${extras.accentRgb.join(' ')})` : undefined,
      active: isOn(e),
      unit: (e.attributes.unit_of_measurement as string | undefined) ?? undefined,
      entityPicture: picture,
      // entity_category is a registry field in real HA; the rig carries it as an
      // attribute so the dialog's diagnostics grouping is visible here.
      category: e.attributes.entity_category as string | undefined,
      toggleable,
      pressable,
      onToggle: toggleable || pressable ? () => toggleEntity(e.entity_id, e.state) : undefined,
    };
  };

  const panelEntities = entries.map(entry => toPanelEntity(entry.entity));
  const shown = kind === 'all' ? entries : entries.filter(e => e.kind === kind);
  const selectedIndex = Math.max(0, entries.findIndex(e => e.entity.entity_id === selectedId));
  const primaryEntity = live(entries[selectedIndex].entity);
  const corner = primaryCornerBadge(primaryEntity);
  const primary = panelEntities[selectedIndex];
  // A realistic card: the picked entity in the hero, the next few as rows.
  const secondary: DeviceCardV2Entity[] = panelEntities
    .slice(selectedIndex + 1, selectedIndex + 5)
    .concat(on('ghost') ? [GHOST_ENTITY] : [])
    .map(e => ({
      ...e,
      size: on('smallRows') ? ('sm' as const) : undefined,
      chart: on('noCharts') ? false : undefined,
      onClick: () => setSelectedId(e.entityId),
    }));

  // Product render: the auto pick when the helper has one, else a stand-in — the
  // point is to exercise the two-column hero, not to be right about the model.
  const thumbnail = on('thumbnail') ? (deviceThumbnail(primaryEntity) ?? '/devices/hub.png') : null;
  const feedEntity = entries.find(e => e.entity.entity_id === 'camera.benchmark_camera')?.entity;
  const feedImage = on('feed') ? (feedEntity?.attributes.entity_picture as string | undefined) : undefined;

  // A device shaped like the real thing, for the card edit panel behind the pencil.
  const device: HassDevice = {
    id: BENCHMARK_DEVICE.id,
    name: BENCHMARK_DEVICE.name,
    manufacturer: BENCHMARK_DEVICE.manufacturer,
    model: BENCHMARK_DEVICE.model,
    entities: entries.map(e => live(e.entity)),
    primaryEntity,
    categories: Object.fromEntries(
      entries
        .filter(e => e.entity.attributes.entity_category)
        .map(e => [e.entity.entity_id, String(e.entity.attributes.entity_category)]),
    ),
  };

  return (
    <div className="min-h-screen bg-surface-lower p-ha-6">
      <header className="mb-ha-5">
        <h1 className="text-2xl font-bold text-text-primary">Entity matrix — {BENCHMARK_DEVICE.name}</h1>
        <p className="text-sm text-text-secondary mt-1 max-w-3xl">
          One synthetic device covering every display permutation: read-only values, on/off
          controls, and entities with something to set. <strong>Focus</strong> puts one entity in
          the full dialog; <strong>rows</strong> pairs every entity&rsquo;s card with its dialog, one example per row. Entities are
          staged locally for this page only — nothing is sent to Home Assistant.
        </p>
        <div className="mt-ha-3 flex flex-wrap items-center gap-ha-3">
          <SegmentedControl
            segments={[{ value: 'focus', label: 'Focus' }, { value: 'gallery', label: 'Rows' }]}
            value={view}
            onChange={v => setView(v as typeof view)}
          />
          <SegmentedControl
            segments={KIND_FILTERS}
            value={kind}
            onChange={v => setKind(v as typeof kind)}
          />
          {view === 'gallery' && (
            <SegmentedControl
              segments={[
                { value: 'full', label: 'History' },
                { value: 'none', label: 'No history' },
              ]}
              value={historyView}
              onChange={v => setHistoryView(v as typeof historyView)}
            />
          )}
          {/* Hero arrangement — the block carrying the reading and the control.
              Four candidates while the design is being settled. */}
          <SegmentedControl
            segments={HERO_LAYOUTS.map(l => ({ value: l.value, label: l.label }))}
            value={heroLayout}
            onChange={v => setHeroLayout(v as HeroLayout)}
          />
          <span className="text-xs text-text-tertiary">{shown.length} of {entries.length} entities</span>
        </div>
        {/* Composition axis — card/panel chrome rather than entity data. */}
        {view === 'focus' && (
          <div className="mt-ha-3 flex flex-wrap items-center gap-ha-2">
            {CHROME_TOGGLES.map(t => (
              <button
                key={t.key}
                type="button"
                title={t.hint}
                aria-pressed={on(t.key)}
                onClick={() => toggleChrome(t.key)}
                className={clsx(
                  'rounded-full px-ha-3 py-1 text-xs font-medium transition-colors',
                  on(t.key)
                    ? 'bg-surface-default text-text-primary ha-selected'
                    : 'bg-surface-default text-text-secondary hover:bg-surface-low',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {!staged ? (
        <p className="text-sm text-text-tertiary">Staging entities…</p>
      ) : view === 'gallery' ? (
        /* One example per row: what the entity looks like on a dashboard (left)
           and what opening it gives you (right), with the expectation above. A
           grid of tiles made the two surfaces hard to compare — the row keeps
           them on one eye-line. */
        <div className="flex flex-col gap-ha-5">
          {shown.map(entry => {
            const e = live(entry.entity);
            const pe = toPanelEntity(entry.entity);
            const badge = primaryCornerBadge(e);
            return (
              <div key={e.entity_id} className="overflow-hidden rounded-ha-2xl bg-surface-default">
                <div className="flex flex-wrap items-baseline gap-x-ha-3 gap-y-1 border-b border-surface-lower px-ha-4 py-ha-3">
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', KIND_STYLE[entry.kind])}>
                    {entry.kind}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{pe.name}</span>
                  <span className="font-mono text-[10px] text-text-disabled">{e.entity_id}</span>
                  <p className="w-full text-xs text-text-tertiary">{entry.note}</p>
                </div>
                <div className="flex flex-col gap-ha-4 p-ha-4 lg:flex-row lg:items-start">
                  <div className="w-[280px] shrink-0">
                    <p className="mb-ha-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Card</p>
                    <DeviceCardV2
                      primary={{
                        ...pe,
                        lastChanged: e.last_changed,
                        corner: badge?.text,
                        cornerLabel: badge?.label,
                        onClick: () => { setSelectedId(e.entity_id); setView('focus'); },
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 lg:border-l lg:border-surface-lower lg:pl-ha-4">
                    <p className="mb-ha-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">More info</p>
                    <EntityDetailBody entity={pe} historyView={historyView} heroLayout={heroLayout} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-ha-6">
          <div className="w-[280px] shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-ha-2">Card</p>
            <DeviceCardV2
              primary={{
                ...primary,
                name: BENCHMARK_DEVICE.name,
                lastChanged: primaryEntity.last_changed,
                thumbnail,
                corner: corner?.text,
                cornerLabel: corner?.label,
                onClick: () => undefined,
              }}
              secondary={secondary}
              areaName={BENCHMARK_DEVICE.areaName}
              feedImage={feedImage}
              editMode={on('editMode')}
              selected={on('selected')}
              lastOpened={on('lastOpened')}
            />
          </div>

          <div className={clsx('shrink-0', on('narrow') ? 'w-[390px]' : 'w-[640px]')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-ha-2">
              More info {panelMode === 'edit' && '· card edit'}
            </p>
            {/* Exactly the dialog's own frame — the rig has to be the size the
                app renders, or the panel floats in dead space and the previewed
                proportions are a lie. Keep in step with EntityDetailPanel. */}
            <div className="h-[min(85vh,780px)] overflow-hidden rounded-ha-2xl bg-surface-lower">
              {panelMode === 'edit' ? (
                <DeviceCardEditPanel
                  device={device}
                  config={cardConfig}
                  onSave={setCardConfig}
                  onBack={() => setPanelMode('entity')}
                  onClose={() => setPanelMode('entity')}
                />
              ) : (
                <EntityDetailPanel
                  initialEntityId={selectedId}
                  entities={panelEntities}
                  deviceName={BENCHMARK_DEVICE.name}
                  deviceMeta={{
                    deviceId: BENCHMARK_DEVICE.id,
                    manufacturer: BENCHMARK_DEVICE.manufacturer,
                    model: BENCHMARK_DEVICE.model,
                    areaName: BENCHMARK_DEVICE.areaName,
                    thumbnail,
                  }}
                  heroLayout={heroLayout}
                  isFavorite={on('favorite')}
                  onToggleFavorite={() => toggleChrome('favorite')}
                  onEditCard={() => setPanelMode('edit')}
                  thumbnailPicker={{
                    value: cardConfig.thumbnail,
                    auto: deviceThumbnail(primaryEntity),
                    iconPath: primary.icon,
                    onChange: t => setCardConfig(c => ({ ...c, thumbnail: t })),
                  }}
                  onClose={() => undefined}
                />
              )}
            </div>
          </div>

          <div className="min-w-[360px] flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-ha-2">
              Expected ({shown.length} entities)
            </p>
            <div className="rounded-ha-2xl bg-surface-default overflow-hidden">
              {shown.map((entry, i) => {
                const e = live(entry.entity);
                const selected = e.entity_id === selectedId;
                return (
                  <button
                    key={e.entity_id}
                    type="button"
                    onClick={() => setSelectedId(e.entity_id)}
                    className={clsx(
                      'w-full text-left px-ha-4 py-ha-3 transition-colors',
                      i > 0 && 'border-t border-surface-lower',
                      selected ? 'ha-selected' : 'hover:bg-surface-low',
                    )}
                  >
                    <div className="flex items-center gap-ha-2">
                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', KIND_STYLE[entry.kind])}>
                        {entry.kind}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium text-text-primary">
                        {entityLabel(e, BENCHMARK_DEVICE.name)}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-secondary">{stateLabel(e)}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary">{entry.note}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-text-disabled">{e.entity_id}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
