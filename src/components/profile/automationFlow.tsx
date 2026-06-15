'use client';

import { Icon } from '../ui/Icon';
import type { AutomationConfig } from '@/lib/homeassistant';
import {
  mdiClockOutline,
  mdiCog,
  mdiDevices,
  mdiFlash,
  mdiHelpCircleOutline,
  mdiMapMarker,
  mdiNumeric,
  mdiPaletteOutline,
  mdiSwapHorizontal,
  mdiTimerSandEmpty,
  mdiWeatherSunny,
} from '@mdi/js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared automation-flow model + read-only renderer.
//
// The interactive editor (AutomationEditor) and the read-only more-info panel
// (AutomationDetailPanel) both speak this node model. The editor mutates it;
// the panel renders `AutomationFlowView` from either real config (configToNodes)
// or — in demo mode only — the mock template (buildMockFlow). The two sources
// are never mixed on a single surface.
// ─────────────────────────────────────────────────────────────────────────────

export type NodeKind = 'trigger' | 'condition' | 'action';

export interface AutomationNode {
  id: string;
  kind: NodeKind;
  type: string;
  enabled: boolean;
  data: Record<string, string>;
  /** Set by configToNodes when a real node's type isn't in the editor CATALOG. */
  labelOverride?: string;
  summaryOverride?: string;
}

export interface NodeField {
  key: string;
  label: string;
  input: 'text' | 'select' | 'time';
  options?: string[];
  placeholder?: string;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  description: string;
  icon: string;
  fields: NodeField[];
  defaults: Record<string, string>;
  /** One-line row title derived from the node's current data. */
  summary: (data: Record<string, string>) => string;
}

export const orFallback = (value: string | undefined, fallback: string) =>
  value && value.trim() ? value : fallback;

export const TRIGGER_TYPES: NodeTypeDef[] = [
  {
    type: 'state',
    label: 'Entity state',
    description: 'When an entity changes state',
    icon: mdiSwapHorizontal,
    fields: [
      { key: 'entity', label: 'Entity', input: 'text', placeholder: 'light.living_room' },
      { key: 'from', label: 'From state', input: 'text', placeholder: 'Any' },
      { key: 'to', label: 'To state', input: 'text', placeholder: 'Any' },
      { key: 'for', label: 'For (duration)', input: 'text', placeholder: '00:00:00' },
    ],
    defaults: { entity: 'binary_sensor.hallway_motion', from: '', to: 'on', for: '' },
    summary: (d) => `${orFallback(d.entity, 'An entity')} changes${d.to ? ` to ${d.to}` : ' state'}`,
  },
  {
    type: 'time',
    label: 'Time',
    description: 'At a specific time of day',
    icon: mdiClockOutline,
    fields: [{ key: 'at', label: 'At', input: 'time' }],
    defaults: { at: '07:00' },
    summary: (d) => `At ${orFallback(d.at, 'a set time')}`,
  },
  {
    type: 'sun',
    label: 'Sun',
    description: 'At sunrise or sunset, with an offset',
    icon: mdiWeatherSunny,
    fields: [
      { key: 'event', label: 'Event', input: 'select', options: ['Sunrise', 'Sunset'] },
      { key: 'offset', label: 'Offset', input: 'text', placeholder: '-00:30:00' },
    ],
    defaults: { event: 'Sunset', offset: '' },
    summary: (d) => `${orFallback(d.event, 'Sunset')}${d.offset ? ` (${d.offset})` : ''}`,
  },
  {
    type: 'device',
    label: 'Device',
    description: 'When a device does something',
    icon: mdiDevices,
    fields: [
      { key: 'device', label: 'Device', input: 'text', placeholder: 'Front Door Sensor' },
      { key: 'trigger', label: 'Trigger', input: 'text', placeholder: 'Door opened' },
    ],
    defaults: { device: 'Front Door Sensor', trigger: 'Door opened' },
    summary: (d) => `${orFallback(d.device, 'A device')}: ${orFallback(d.trigger, 'does something')}`,
  },
  {
    type: 'zone',
    label: 'Zone',
    description: 'When a person enters or leaves a zone',
    icon: mdiMapMarker,
    fields: [
      { key: 'person', label: 'Person', input: 'text', placeholder: 'person.alex' },
      { key: 'zone', label: 'Zone', input: 'text', placeholder: 'zone.home' },
      { key: 'event', label: 'Event', input: 'select', options: ['Enter', 'Leave'] },
    ],
    defaults: { person: 'person.alex', zone: 'zone.home', event: 'Leave' },
    summary: (d) => `${orFallback(d.person, 'Someone')} ${d.event === 'Enter' ? 'enters' : 'leaves'} ${orFallback(d.zone, 'a zone')}`,
  },
];

export const CONDITION_TYPES: NodeTypeDef[] = [
  {
    type: 'state',
    label: 'Entity state',
    description: 'An entity is in a given state',
    icon: mdiSwapHorizontal,
    fields: [
      { key: 'entity', label: 'Entity', input: 'text', placeholder: 'person.alex' },
      { key: 'state', label: 'State', input: 'text', placeholder: 'home' },
    ],
    defaults: { entity: 'person.alex', state: 'home' },
    summary: (d) => `${orFallback(d.entity, 'An entity')} is ${orFallback(d.state, 'a state')}`,
  },
  {
    type: 'numeric_state',
    label: 'Numeric state',
    description: 'A value is above or below a threshold',
    icon: mdiNumeric,
    fields: [
      { key: 'entity', label: 'Entity', input: 'text', placeholder: 'sensor.outdoor_temperature' },
      { key: 'above', label: 'Above', input: 'text', placeholder: '' },
      { key: 'below', label: 'Below', input: 'text', placeholder: '' },
    ],
    defaults: { entity: 'sensor.outdoor_temperature', above: '', below: '3' },
    summary: (d) => {
      const entity = orFallback(d.entity, 'A value');
      if (d.above && d.below) return `${entity} between ${d.above} and ${d.below}`;
      if (d.above) return `${entity} above ${d.above}`;
      if (d.below) return `${entity} below ${d.below}`;
      return `${entity} crosses a threshold`;
    },
  },
  {
    type: 'time',
    label: 'Time',
    description: 'Only during a time window',
    icon: mdiClockOutline,
    fields: [
      { key: 'after', label: 'After', input: 'time' },
      { key: 'before', label: 'Before', input: 'time' },
    ],
    defaults: { after: '08:00', before: '23:00' },
    summary: (d) => `Between ${orFallback(d.after, '…')} and ${orFallback(d.before, '…')}`,
  },
  {
    type: 'sun',
    label: 'Sun',
    description: 'Before or after sunrise/sunset',
    icon: mdiWeatherSunny,
    fields: [
      { key: 'when', label: 'When', input: 'select', options: ['Before sunrise', 'After sunrise', 'Before sunset', 'After sunset'] },
    ],
    defaults: { when: 'After sunset' },
    summary: (d) => orFallback(d.when, 'Sun position'),
  },
];

export const ACTION_TYPES: NodeTypeDef[] = [
  {
    type: 'service',
    label: 'Perform action',
    description: 'Call an action on an entity',
    icon: mdiFlash,
    fields: [
      { key: 'service', label: 'Action', input: 'text', placeholder: 'light.turn_on' },
      { key: 'target', label: 'Target', input: 'text', placeholder: 'light.hallway' },
    ],
    defaults: { service: 'light.turn_on', target: 'light.hallway' },
    summary: (d) => `${orFallback(d.service, 'An action')} → ${orFallback(d.target, 'a target')}`,
  },
  {
    type: 'device',
    label: 'Device',
    description: 'Make a device do something',
    icon: mdiDevices,
    fields: [
      { key: 'device', label: 'Device', input: 'text', placeholder: 'Living Room TV' },
      { key: 'action', label: 'Action', input: 'text', placeholder: 'Turn off' },
    ],
    defaults: { device: 'Living Room TV', action: 'Turn off' },
    summary: (d) => `${orFallback(d.device, 'A device')}: ${orFallback(d.action, 'do something')}`,
  },
  {
    type: 'delay',
    label: 'Wait',
    description: 'Pause before the next action',
    icon: mdiTimerSandEmpty,
    fields: [{ key: 'duration', label: 'Duration', input: 'text', placeholder: '00:05:00' }],
    defaults: { duration: '00:05:00' },
    summary: (d) => `Wait ${orFallback(d.duration, 'a moment')}`,
  },
  {
    type: 'scene',
    label: 'Activate scene',
    description: 'Apply a saved scene',
    icon: mdiPaletteOutline,
    fields: [{ key: 'scene', label: 'Scene', input: 'text', placeholder: 'scene.movie_night' }],
    defaults: { scene: 'scene.movie_night' },
    summary: (d) => `Activate ${orFallback(d.scene, 'a scene')}`,
  },
];

export const CATALOG: Record<NodeKind, NodeTypeDef[]> = {
  trigger: TRIGGER_TYPES,
  condition: CONDITION_TYPES,
  action: ACTION_TYPES,
};

/** The catalog def for a node's type, or undefined when the type is unknown. */
export function findDef(kind: NodeKind, type: string): NodeTypeDef | undefined {
  return CATALOG[kind].find((d) => d.type === type);
}

/** Catalog def, falling back to the first entry — used by the editor's forms. */
export function defOf(node: AutomationNode): NodeTypeDef {
  return findDef(node.kind, node.type) ?? CATALOG[node.kind][0];
}

export const KIND_LABEL: Record<NodeKind, string> = {
  trigger: 'Trigger',
  condition: 'Condition',
  action: 'Action',
};

const KIND_ICON: Record<NodeKind, string> = {
  trigger: mdiSwapHorizontal,
  condition: mdiHelpCircleOutline,
  action: mdiCog,
};

export const SECTIONS: Array<{ kind: NodeKind; title: string; hint: string; addLabel: string; emptyLabel?: string }> = [
  { kind: 'trigger', title: 'When', hint: 'Triggers that start this automation.', addLabel: 'Add trigger' },
  {
    kind: 'condition',
    title: 'And if',
    hint: 'Conditions that must hold for the actions to run.',
    addLabel: 'Add condition',
    emptyLabel: 'No conditions — actions run on every trigger.',
  },
  { kind: 'action', title: 'Then do', hint: 'Actions performed when the automation runs.', addLabel: 'Add action' },
];

// ── Mock flow templates (demo mode only) ─────────────────────────────────────

type MockNodeSeed = [NodeKind, string, Record<string, string>];

const MOCK_TEMPLATES: MockNodeSeed[][] = [
  [
    ['trigger', 'time', { at: '07:00' }],
    ['trigger', 'sun', { event: 'Sunrise', offset: '' }],
    ['condition', 'state', { entity: 'person.alex', state: 'home' }],
    ['action', 'scene', { scene: 'scene.good_morning' }],
    ['action', 'service', { service: 'media_player.play_media', target: 'media_player.kitchen' }],
  ],
  [
    ['trigger', 'state', { entity: 'binary_sensor.hallway_motion', from: '', to: 'on', for: '' }],
    ['condition', 'sun', { when: 'After sunset' }],
    ['action', 'service', { service: 'light.turn_on', target: 'light.hallway' }],
    ['action', 'delay', { duration: '00:03:00' }],
    ['action', 'service', { service: 'light.turn_off', target: 'light.hallway' }],
  ],
  [
    ['trigger', 'zone', { person: 'person.alex', zone: 'zone.home', event: 'Leave' }],
    ['condition', 'state', { entity: 'lock.front_door', state: 'unlocked' }],
    ['condition', 'time', { after: '08:00', before: '23:00' }],
    ['action', 'service', { service: 'lock.lock', target: 'lock.front_door' }],
    ['action', 'device', { device: 'Living Room TV', action: 'Turn off' }],
  ],
];

export function buildMockFlow(automationId: string): AutomationNode[] {
  let hash = 0;
  for (let i = 0; i < automationId.length; i += 1) hash = (hash * 31 + automationId.charCodeAt(i)) | 0;
  const template = MOCK_TEMPLATES[Math.abs(hash) % MOCK_TEMPLATES.length];
  return template.map(([kind, type, data], index) => ({
    id: `${kind}-${index}`,
    kind,
    type,
    enabled: true,
    data: { ...data },
  }));
}

// ── Real config → nodes ──────────────────────────────────────────────────────
// Maps an automation's stored config into the node model. Types that aren't in
// the editor CATALOG still render (generic icon + a derived summary) so the
// panel never silently drops a step.

function humanize(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  return [];
}

/** Shallow-stringify config fields so they're displayable in the node model. */
function flattenFields(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
    else if (typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

/** Pull a target's entity/device/area into a single readable string. */
function targetLabel(raw: Record<string, unknown>): string {
  const tgt = (raw.target as Record<string, unknown> | undefined) ?? raw;
  const pick = (v: unknown): string | null => {
    if (!v) return null;
    return Array.isArray(v) ? v.join(', ') : String(v);
  };
  return (
    pick(tgt.entity_id) ?? pick(raw.entity_id) ?? pick(tgt.device_id) ?? pick(tgt.area_id) ?? 'a target'
  );
}

function nodeFromTrigger(raw: Record<string, unknown>, id: string): AutomationNode {
  const type = String(raw.trigger ?? raw.platform ?? 'unknown');
  const data = flattenFields(raw);
  const known = findDef('trigger', type);
  if (known) return { id, kind: 'trigger', type, enabled: true, data };
  return {
    id,
    kind: 'trigger',
    type,
    enabled: true,
    data,
    labelOverride: humanize(type),
    summaryOverride: data.entity_id ?? data.entity ?? humanize(type),
  };
}

function nodeFromCondition(raw: Record<string, unknown>, id: string): AutomationNode {
  const type = String(raw.condition ?? 'unknown');
  const data = flattenFields(raw);
  const known = findDef('condition', type);
  if (known) return { id, kind: 'condition', type, enabled: true, data };
  return {
    id,
    kind: 'condition',
    type,
    enabled: true,
    data,
    labelOverride: humanize(type),
    summaryOverride: data.entity_id ?? data.entity ?? humanize(type),
  };
}

function nodeFromAction(raw: Record<string, unknown>, id: string): AutomationNode {
  const service = raw.action ?? raw.service;
  const data = flattenFields(raw);
  if (service) {
    return {
      id,
      kind: 'action',
      type: 'service',
      enabled: true,
      data: { service: String(service), target: targetLabel(raw) },
    };
  }
  if (raw.delay != null) return { id, kind: 'action', type: 'delay', enabled: true, data: { duration: String(raw.delay) } };
  if (raw.scene != null) return { id, kind: 'action', type: 'scene', enabled: true, data: { scene: String(raw.scene) } };
  if (raw.device_id != null) {
    return {
      id, kind: 'action', type: 'device', enabled: true,
      data: { device: String(raw.device_id), action: String(raw.type ?? 'do something') },
    };
  }
  // choose / if / repeat / wait_template / parallel / variables / stop …
  const type = ['choose', 'if', 'repeat', 'wait_template', 'wait_for_trigger', 'parallel', 'stop', 'variables', 'event'].find((k) => k in raw) ?? 'action';
  return {
    id, kind: 'action', type, enabled: true, data,
    labelOverride: humanize(type),
    summaryOverride: type === 'wait_template' ? 'Wait for a template' : humanize(type),
  };
}

export function configToNodes(config: AutomationConfig): AutomationNode[] {
  const triggers = asObjectArray(config.triggers ?? config.trigger);
  const conditions = asObjectArray(config.conditions ?? config.condition);
  const actions = asObjectArray(config.actions ?? config.action);
  return [
    ...triggers.map((t, i) => nodeFromTrigger(t, `trigger-${i}`)),
    ...conditions.map((c, i) => nodeFromCondition(c, `condition-${i}`)),
    ...actions.map((a, i) => nodeFromAction(a, `action-${i}`)),
  ];
}

/** Every `domain.entity_id` reference found anywhere in the config, deduped. */
export function relatedEntityIds(config: AutomationConfig): string[] {
  const json = JSON.stringify(config);
  const matches = json.match(/[a-z_]+\.[a-z0-9_]+/g) ?? [];
  const KNOWN_DOMAINS = new Set([
    'light', 'switch', 'climate', 'cover', 'fan', 'lock', 'media_player', 'sensor',
    'binary_sensor', 'person', 'device_tracker', 'scene', 'script', 'input_boolean',
    'input_number', 'input_select', 'vacuum', 'camera', 'alarm_control_panel', 'lawn_mower',
    'humidifier', 'siren', 'valve', 'number', 'select', 'button', 'group', 'zone',
    'sun', 'weather', 'notify', 'automation',
  ]);
  const seen = new Set<string>();
  for (const m of matches) {
    const domain = m.split('.')[0];
    if (KNOWN_DOMAINS.has(domain)) seen.add(m);
  }
  return [...seen];
}

// ── Read-only flow view ──────────────────────────────────────────────────────

function ReadOnlyNodeRow({ node }: { node: AutomationNode }) {
  const def = findDef(node.kind, node.type);
  const icon = def?.icon ?? KIND_ICON[node.kind];
  const label = node.labelOverride ?? def?.label ?? humanize(node.type);
  const summary = node.summaryOverride ?? def?.summary(node.data) ?? humanize(node.type);
  return (
    <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
        <Icon path={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-ha-2 min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight text-text-primary">
            {summary}
          </span>
          {!node.enabled && (
            <span className="rounded-full bg-surface-mid px-ha-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Disabled
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-text-secondary">{label}</span>
      </span>
    </div>
  );
}

/**
 * Read-only When / And-if / Then rendering of a node list. Shared by the
 * more-info panel; the editor renders its own interactive variant.
 */
export function AutomationFlowView({ nodes }: { nodes: AutomationNode[] }) {
  return (
    <div className="space-y-ha-5">
      {SECTIONS.map((section) => {
        const sectionNodes = nodes.filter((n) => n.kind === section.kind);
        if (sectionNodes.length === 0 && !section.emptyLabel) return null;
        return (
          <div key={section.kind} className="space-y-ha-2">
            <div className="px-ha-1">
              <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
              <p className="text-[13px] text-text-secondary">{section.hint}</p>
            </div>
            {sectionNodes.length === 0 ? (
              <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-4 text-center text-sm text-text-tertiary">
                {section.emptyLabel}
              </div>
            ) : (
              <div className="overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
                {sectionNodes.map((node) => (
                  <div key={node.id} className="border-b border-surface-low/40 last:border-0">
                    <ReadOnlyNodeRow node={node} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
