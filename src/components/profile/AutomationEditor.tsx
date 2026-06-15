'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { ToggleSwitch, ConfirmDialog } from '../ui';
import { formatLastTriggered, type AutomationSummary } from '@/hooks/useAutomations';
import {
  mdiAlertCircleOutline,
  mdiCancel,
  mdiCheck,
  mdiCheckCircle,
  mdiClockOutline,
  mdiClose,
  mdiCloseCircle,
  mdiCodeBraces,
  mdiContentDuplicate,
  mdiHistory,
  mdiMinus,
  mdiPencilOutline,
  mdiPlay,
  mdiPlus,
  mdiRedo,
  mdiRobot,
  mdiTrashCanOutline,
  mdiUndo,
} from '@mdi/js';
import {
  type NodeKind,
  type NodeTypeDef,
  type AutomationNode,
  CATALOG,
  defOf,
  orFallback,
  KIND_LABEL,
  SECTIONS,
  buildMockFlow,
} from './automationFlow';

// ─────────────────────────────────────────────────────────────────────────────
// Automation editor — HA-style single content column with When / And if /
// Then do sections. Selecting a node opens a config sidebar on the right
// (inline at lg+, a slide-over drawer below). The flow model and node catalog
// live in ./automationFlow (shared with the read-only more-info panel); the
// editor's contents here are mock-only — the real flow is shown in the panel.
// ─────────────────────────────────────────────────────────────────────────────


// ── Editor building blocks ───────────────────────────────────────────────────

/** "Add trigger/condition/action" button with a popover menu of node types. */
function AddNodeButton({
  label,
  types,
  onAdd,
}: {
  label: string;
  types: NodeTypeDef[];
  onAdd: (def: NodeTypeDef) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-ha-2 rounded-ha-xl border border-dashed border-surface-lower bg-surface-default px-ha-3 py-ha-2 text-sm font-semibold text-ha-blue transition-colors hover:bg-fill-primary-quiet"
      >
        <Icon path={mdiPlus} size={16} />
        {label}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-ha-1 w-[260px] rounded-ha-2xl border border-surface-lower bg-surface-default p-ha-1 shadow-[0_18px_42px_-20px_rgba(15,23,42,0.4)]">
            {types.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => { onAdd(def); setOpen(false); }}
                className="flex w-full items-center gap-ha-3 rounded-ha-xl px-ha-3 py-ha-2 text-left transition-colors hover:bg-surface-low"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-ha-lg bg-surface-mid text-text-secondary">
                  <Icon path={def.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">{def.label}</span>
                  <span className="block text-xs text-text-secondary truncate">{def.description}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NodeRow({
  node,
  selected,
  onSelect,
}: {
  node: AutomationNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const def = defOf(node);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full flex items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors ${
        selected ? 'bg-fill-primary-normal' : 'hover:bg-surface-mid/50 active:bg-surface-mid'
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl ${
          selected ? 'bg-ha-blue/15 text-ha-blue' : 'bg-surface-mid text-text-secondary'
        }`}
      >
        <Icon path={def.icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-ha-2 min-w-0">
          <span className={`block truncate text-[13px] font-semibold leading-tight ${selected ? 'text-ha-blue' : 'text-text-primary'}`}>
            {def.summary(node.data)}
          </span>
          {!node.enabled && (
            <span className="rounded-full bg-surface-mid px-ha-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Disabled
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-text-secondary">{def.label}</span>
      </span>
    </button>
  );
}

/** Right-hand config form for the selected node. */
function NodeConfigPanel({
  node,
  onChange,
  onDelete,
  onClose,
}: {
  node: AutomationNode;
  onChange: (next: AutomationNode) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const def = defOf(node);
  const setField = (key: string, value: string) =>
    onChange({ ...node, data: { ...node.data, [key]: value } });

  const inputClass =
    'w-full rounded-ha-xl border border-surface-lower bg-surface-low px-ha-3 py-ha-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-ha-blue/50';

  return (
    <div className="rounded-ha-3xl border border-surface-lower bg-surface-default shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)] overflow-hidden">
      <div className="flex items-center gap-ha-3 border-b border-surface-low/60 px-ha-4 py-ha-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-fill-primary-normal text-ha-blue">
          <Icon path={def.icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-text-primary truncate">{def.label}</p>
          <p className="text-xs text-text-secondary mt-0.5">{KIND_LABEL[node.kind]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close configuration"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-ha-lg text-text-secondary transition-colors hover:bg-surface-low hover:text-text-primary"
        >
          <Icon path={mdiClose} size={18} />
        </button>
      </div>

      <div className="space-y-ha-4 px-ha-4 py-ha-4">
        {def.fields.map((field) => (
          <label key={field.key} className="block space-y-ha-1">
            <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
              {field.label}
            </span>
            {field.input === 'select' ? (
              <select
                value={node.data[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                className={inputClass}
              >
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.input === 'time' ? 'time' : 'text'}
                value={node.data[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(e) => setField(field.key, e.target.value)}
                className={inputClass}
              />
            )}
          </label>
        ))}

        <div className="flex items-center justify-between gap-ha-3 rounded-ha-xl bg-surface-low px-ha-3 py-ha-2">
          <div>
            <p className="text-sm font-semibold text-text-primary">Enabled</p>
            <p className="text-xs text-text-secondary">Disabled steps are skipped when the automation runs.</p>
          </div>
          <ToggleSwitch on={node.enabled} onToggle={() => onChange({ ...node, enabled: !node.enabled })} />
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-ha-2 rounded-ha-xl border border-red-500/20 bg-red-500/10 px-ha-3 py-ha-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/15"
        >
          <Icon path={mdiTrashCanOutline} size={16} />
          Delete {KIND_LABEL[node.kind].toLowerCase()}
        </button>
      </div>
    </div>
  );
}

// ── YAML preview ─────────────────────────────────────────────────────────────
// Pseudo-YAML rendered from the mock nodes for the toolbar's code view. Purely
// presentational — mirrors what HA's "Edit in YAML" mode would show.

function nodesToYaml(name: string, nodes: AutomationNode[]): string {
  const yamlValue = (v: string) => (v.toLowerCase().includes(' ') ? `"${v}"` : v);
  const fieldLines = (data: Record<string, string>, omit: string[] = []) =>
    Object.entries(data)
      .filter(([k, v]) => !omit.includes(k) && v && v.trim())
      .map(([k, v]) => `    ${k}: ${yamlValue(v)}`);

  const itemLines = (n: AutomationNode): string[] => {
    // Actions key on what they do; triggers/conditions key on their type.
    if (n.kind === 'action') {
      if (n.type === 'service') return [`  - action: ${n.data.service || 'unknown'}`, ...fieldLines(n.data, ['service'])];
      if (n.type === 'delay') return [`  - delay: ${n.data.duration || '00:00:00'}`];
      if (n.type === 'scene') return [`  - scene: ${n.data.scene || 'unknown'}`];
      return [`  - device: ${yamlValue(n.data.device || 'unknown')}`, ...fieldLines(n.data, ['device'])];
    }
    return [`  - ${n.kind}: ${n.type}`, ...fieldLines(n.data)];
  };

  const block = (kind: NodeKind, key: string) => {
    const items = nodes.filter((n) => n.kind === kind);
    if (items.length === 0) return `${key}: []`;
    return `${key}:\n${items
      .map((n) => [...itemLines(n), ...(n.enabled ? [] : ['    enabled: false'])].join('\n'))
      .join('\n')}`;
  };

  return [
    `alias: ${name}`,
    block('trigger', 'triggers'),
    block('condition', 'conditions'),
    block('action', 'actions'),
    'mode: single',
  ].join('\n');
}

// ── Run traces (mock) ────────────────────────────────────────────────────────
// HA records a "trace" each time an automation runs: which trigger fired, how
// every condition evaluated, which actions executed (with timing), and whether
// the run finished, stopped on a failed condition, or errored. HA's trace UI is
// a dense graph + raw-variable inspector aimed at developers. We synthesize the
// same information from the mock flow and present it as a plain-language story
// of the run: an outcome banner that says what happened and why, plus a single
// top-to-bottom timeline. Deterministic per automation id so it's stable.

type RunOutcome = 'success' | 'stopped' | 'error';
type StepStatus = 'ok' | 'failed' | 'error' | 'skipped';

interface TraceStep {
  node: AutomationNode;
  status: StepStatus;
  /** Plain-language account of what happened at this step. */
  detail: string;
  durationMs?: number;
  error?: string;
}

interface AutomationTrace {
  runId: string;
  startedAt: number;
  durationMs: number;
  outcome: RunOutcome;
  triggerNarration: string;
  steps: TraceStep[];
}

/** Small seeded RNG so a given automation always tells the same trace story. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function parseDurationMs(value?: string): number {
  if (!value) return 0;
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
  return (h * 3600 + m * 60 + (s ?? 0)) * 1000;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s ? `${m} min ${s} s` : `${m} min`;
}

function relativeTime(ms: number): string {
  const delta = Date.now() - ms;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

function triggerNarration(node: AutomationNode): string {
  switch (node.type) {
    case 'state': return `${orFallback(node.data.entity, 'An entity')} changed${node.data.to ? ` to ${node.data.to}` : ''}`;
    case 'time': return `Clock reached ${orFallback(node.data.at, 'the set time')}`;
    case 'sun': return `${orFallback(node.data.event, 'Sunset')} occurred`;
    case 'device': return `${orFallback(node.data.device, 'A device')}: ${orFallback(node.data.trigger, 'event')}`;
    case 'zone': return `${orFallback(node.data.person, 'Someone')} ${node.data.event === 'Enter' ? 'entered' : 'left'} ${orFallback(node.data.zone, 'a zone')}`;
    default: return 'Trigger fired';
  }
}

function conditionNarration(node: AutomationNode, passed: boolean, rng: () => number): string {
  switch (node.type) {
    case 'state': {
      const want = orFallback(node.data.state, 'the expected state');
      return passed
        ? `${orFallback(node.data.entity, 'It')} was ${want}`
        : `${orFallback(node.data.entity, 'It')} wasn't ${want}`;
    }
    case 'numeric_state': {
      const below = node.data.below?.trim();
      const above = node.data.above?.trim();
      const bound = below ? Number(below) : above ? Number(above) : 10;
      const observed = passed
        ? (below ? bound - (0.5 + rng() * (bound * 0.4 || 1)) : bound + (0.5 + rng() * 3))
        : (below ? bound + (1 + rng() * 5) : bound - (1 + rng() * 5));
      const value = Math.round(observed * 10) / 10;
      const rule = below && above ? `between ${above} and ${below}` : below ? `below ${below}` : `above ${above}`;
      return `${orFallback(node.data.entity, 'Value')} was ${value} — ${passed ? 'within' : 'outside'} ${rule}`;
    }
    case 'time': {
      const after = orFallback(node.data.after, '00:00');
      const before = orFallback(node.data.before, '23:59');
      const at = passed ? after.replace(/:\d\d$/, ':41') : '02:18';
      return `Ran at ${at}, ${passed ? 'inside' : 'outside'} ${after}–${before}`;
    }
    case 'sun': {
      const when = (node.data.when || '').toLowerCase();
      const isSunset = when.includes('sunset');
      if (passed) return isSunset ? 'Sun was below the horizon' : 'Sun was up';
      return isSunset ? 'Sun was still up' : 'Sun was already down';
    }
    default: return passed ? 'Condition met' : 'Condition not met';
  }
}

function actionNarration(node: AutomationNode): string {
  switch (node.type) {
    case 'service': return `Ran ${orFallback(node.data.service, 'an action')} on ${orFallback(node.data.target, 'the target')}`;
    case 'device': return `${orFallback(node.data.device, 'A device')}: ${orFallback(node.data.action, 'did something')}`;
    case 'delay': return `Waited ${orFallback(node.data.duration, 'a moment')}`;
    case 'scene': return `Activated ${orFallback(node.data.scene, 'a scene')}`;
    default: return 'Performed action';
  }
}

function actionErrorMessage(node: AutomationNode): string {
  const target = node.data.target || node.data.device || node.data.scene || 'the target';
  return `${target} was unavailable`;
}

/** Build one run from the flow, deriving the real outcome from what happened. */
function buildTrace(nodes: AutomationNode[], intended: RunOutcome, startedAt: number, runId: string, rng: () => number): AutomationTrace {
  const triggers = nodes.filter((n) => n.kind === 'trigger' && n.enabled);
  const conditions = nodes.filter((n) => n.kind === 'condition' && n.enabled);
  const actions = nodes.filter((n) => n.kind === 'action' && n.enabled);

  const steps: TraceStep[] = [];
  let durationMs = 30 + Math.floor(rng() * 50);
  let stopped = false;
  let outcome: RunOutcome = 'success';

  const triggerNode = triggers.length ? triggers[Math.floor(rng() * triggers.length)] : null;
  const triggerText = triggerNode ? triggerNarration(triggerNode) : 'Run manually';
  if (triggerNode) steps.push({ node: triggerNode, status: 'ok', detail: triggerText });

  const failCondIdx = intended === 'stopped' && conditions.length ? Math.floor(rng() * conditions.length) : -1;
  conditions.forEach((node, i) => {
    if (stopped) { steps.push({ node, status: 'skipped', detail: 'Not checked' }); return; }
    const passed = i !== failCondIdx;
    steps.push({ node, status: passed ? 'ok' : 'failed', detail: conditionNarration(node, passed, rng) });
    if (!passed) { stopped = true; outcome = 'stopped'; }
  });

  const errActionIdx = intended === 'error' && !stopped && actions.length ? Math.floor(rng() * actions.length) : -1;
  actions.forEach((node, i) => {
    if (stopped) { steps.push({ node, status: 'skipped', detail: "Didn't run" }); return; }
    if (i === errActionIdx) {
      steps.push({ node, status: 'error', detail: actionNarration(node), error: actionErrorMessage(node) });
      stopped = true;
      outcome = 'error';
      return;
    }
    const stepMs = node.type === 'delay' ? parseDurationMs(node.data.duration) : 40 + Math.floor(rng() * 380);
    durationMs += stepMs;
    steps.push({ node, status: 'ok', detail: actionNarration(node), durationMs: stepMs });
  });

  return { runId, startedAt, durationMs, outcome, triggerNarration: triggerText, steps };
}

/** A handful of recent runs, most-recent first. */
function buildTraces(automation: AutomationSummary, nodes: AutomationNode[]): AutomationTrace[] {
  if (nodes.length === 0) return [];
  const rng = makeRng(hashString(automation.id) + 7);
  const base = automation.lastTriggered ? new Date(automation.lastTriggered).getTime() : Date.now() - 6 * 3600 * 1000;
  const traces: AutomationTrace[] = [];
  let when = base;
  for (let i = 0; i < 5; i += 1) {
    const r = rng();
    const intended: RunOutcome = r < 0.5 ? 'success' : r < 0.8 ? 'stopped' : 'error';
    traces.push(buildTrace(nodes, intended, when, `run-${i}`, rng));
    when -= (25 + Math.floor(rng() * 600)) * 60 * 1000; // step 25 min–10 h earlier
  }
  return traces;
}

// ── Trace view pieces ─────────────────────────────────────────────────────────

const OUTCOME_META: Record<RunOutcome, { icon: string; headline: string; text: string; ring: string; chip: string; banner: string }> = {
  success: {
    icon: mdiCheckCircle,
    headline: 'Ran successfully',
    text: 'text-green-500',
    ring: 'bg-green-500/15 text-green-500',
    chip: 'bg-green-500',
    banner: 'border-green-500/20 bg-green-500/[0.06]',
  },
  stopped: {
    icon: mdiAlertCircleOutline,
    headline: 'Stopped early',
    text: 'text-amber-500',
    ring: 'bg-amber-500/15 text-amber-500',
    chip: 'bg-amber-500',
    banner: 'border-amber-500/20 bg-amber-500/[0.06]',
  },
  error: {
    icon: mdiCloseCircle,
    headline: 'Hit an error',
    text: 'text-red-500',
    ring: 'bg-red-500/15 text-red-500',
    chip: 'bg-red-500',
    banner: 'border-red-500/20 bg-red-500/[0.06]',
  },
};

const STEP_META: Record<StepStatus, { icon: string; ring: string }> = {
  ok: { icon: mdiCheck, ring: 'bg-green-500/15 text-green-500' },
  failed: { icon: mdiCancel, ring: 'bg-amber-500/15 text-amber-500' },
  error: { icon: mdiClose, ring: 'bg-red-500/15 text-red-500' },
  skipped: { icon: mdiMinus, ring: 'bg-surface-mid text-text-disabled' },
};

const KIND_WORD: Record<NodeKind, string> = { trigger: 'Trigger', condition: 'Check', action: 'Action' };

/** Build the one-sentence "why" line under the outcome headline. */
function outcomeExplanation(trace: AutomationTrace): string {
  const conds = trace.steps.filter((s) => s.node.kind === 'condition');
  const acts = trace.steps.filter((s) => s.node.kind === 'action');
  if (trace.outcome === 'stopped') {
    const failed = trace.steps.find((s) => s.status === 'failed');
    const skippedActs = acts.filter((s) => s.status === 'skipped').length;
    const tail = skippedActs > 0 ? ` ${skippedActs} ${skippedActs === 1 ? 'action' : 'actions'} didn't run.` : ' No actions ran.';
    return `Started because ${trace.triggerNarration.toLowerCase()}, then stopped — ${failed ? failed.detail.toLowerCase() : 'a check failed'}.${tail}`;
  }
  if (trace.outcome === 'error') {
    const errored = trace.steps.find((s) => s.status === 'error');
    return `Started because ${trace.triggerNarration.toLowerCase()}, but failed — ${errored?.detail.toLowerCase() ?? 'an action errored'}: ${errored?.error ?? 'unknown error'}.`;
  }
  const ranActs = acts.length;
  const passedConds = conds.length;
  const condText = passedConds > 0 ? `All ${passedConds} ${passedConds === 1 ? 'check' : 'checks'} passed and ` : '';
  const actText = ranActs > 0 ? `${ranActs} ${ranActs === 1 ? 'action' : 'actions'} completed` : 'there were no actions to run';
  return `Started because ${trace.triggerNarration.toLowerCase()}. ${condText}${actText}.`;
}

function OutcomeBanner({ trace }: { trace: AutomationTrace }) {
  const meta = OUTCOME_META[trace.outcome];
  return (
    <section className={`rounded-ha-3xl border p-ha-5 ${meta.banner}`}>
      <div className="flex items-start gap-ha-4">
        <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-ha-2xl ${meta.ring}`}>
          <Icon path={meta.icon} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`text-lg font-semibold ${meta.text}`}>{meta.headline}</h3>
          <p className="mt-ha-1 text-sm text-text-secondary">{outcomeExplanation(trace)}</p>
          <div className="mt-ha-3 flex flex-wrap items-center gap-x-ha-2 gap-y-1 text-[13px] text-text-tertiary">
            <span className="inline-flex items-center gap-ha-1"><Icon path={mdiClockOutline} size={14} />{relativeTime(trace.startedAt)}</span>
            <span aria-hidden>·</span>
            <span>Took {formatDuration(trace.durationMs)}</span>
            <span aria-hidden>·</span>
            <span>{trace.steps.length} {trace.steps.length === 1 ? 'step' : 'steps'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TraceTimelineRow({ step, first, last }: { step: TraceStep; first: boolean; last: boolean }) {
  const meta = STEP_META[step.status];
  const muted = step.status === 'skipped';
  return (
    <div className="relative flex gap-ha-3 px-ha-4 py-ha-3">
      {/* Connector rail */}
      <div className="relative flex flex-col items-center">
        {!first && <span className="absolute -top-3 h-3 w-px bg-surface-lower" />}
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${meta.ring}`}>
          <Icon path={meta.icon} size={16} />
        </span>
        {!last && <span className="w-px flex-1 bg-surface-lower mt-1" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex items-start justify-between gap-ha-2">
          <p className={`text-sm font-semibold leading-snug ${muted ? 'text-text-disabled' : 'text-text-primary'}`}>
            {step.detail}
          </p>
          {step.durationMs !== undefined && step.status === 'ok' && (
            <span className="flex-shrink-0 rounded-full bg-surface-low px-ha-2 py-0.5 text-[12px] font-medium text-text-tertiary tabular-nums">
              {formatDuration(step.durationMs)}
            </span>
          )}
          {step.status === 'failed' && (
            <span className="flex-shrink-0 rounded-full bg-amber-500/15 px-ha-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-amber-500">
              Not met
            </span>
          )}
          {step.status === 'skipped' && (
            <span className="flex-shrink-0 rounded-full bg-surface-mid px-ha-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-text-disabled">
              Skipped
            </span>
          )}
        </div>
        <p className={`mt-0.5 text-[13px] ${muted ? 'text-text-disabled' : 'text-text-tertiary'}`}>
          {KIND_WORD[step.node.kind]} · {defOf(step.node).label}
        </p>
        {step.error && (
          <p className="mt-ha-1 inline-flex items-center gap-ha-1 rounded-ha-lg bg-red-500/10 px-ha-2 py-1 text-[13px] font-medium text-red-500">
            <Icon path={mdiAlertCircleOutline} size={14} />
            {step.error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Horizontal picker of recent runs (status dot + relative time). */
function RunPicker({ traces, activeId, onSelect }: { traces: AutomationTrace[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-ha-2">
      {traces.map((trace, i) => {
        const active = trace.runId === activeId;
        const meta = OUTCOME_META[trace.outcome];
        return (
          <button
            key={trace.runId}
            type="button"
            onClick={() => onSelect(trace.runId)}
            className={`inline-flex items-center gap-ha-2 rounded-ha-xl border px-ha-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'border-ha-blue/40 bg-fill-primary-normal text-ha-blue'
                : 'border-surface-lower bg-surface-default text-text-secondary hover:bg-surface-low'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${meta.chip}`} />
            {i === 0 ? 'Latest' : relativeTime(trace.startedAt)}
          </button>
        );
      })}
    </div>
  );
}

function TracesView({ automation, nodes }: { automation: AutomationSummary; nodes: AutomationNode[] }) {
  const traces = useMemo(() => buildTraces(automation, nodes), [automation, nodes]);
  const [activeId, setActiveId] = useState<string>(traces[0]?.runId ?? '');
  const trace = traces.find((t) => t.runId === activeId) ?? traces[0] ?? null;

  if (!trace) {
    return (
      <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-8 text-center">
        <div className="mx-auto mb-ha-3 flex h-12 w-12 items-center justify-center rounded-ha-2xl bg-surface-mid text-text-tertiary">
          <Icon path={mdiHistory} size={24} />
        </div>
        <p className="text-sm font-semibold text-text-primary">No runs yet</p>
        <p className="mt-ha-1 text-[13px] text-text-secondary">Once this automation runs, its history shows up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-ha-4">
      <RunPicker traces={traces} activeId={trace.runId} onSelect={setActiveId} />
      <OutcomeBanner trace={trace} />
      <div className="space-y-ha-2">
        <h3 className="px-ha-1 text-sm font-semibold text-text-primary">What happened</h3>
        <div className="overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
          {trace.steps.map((step, i) => (
            <TraceTimelineRow
              key={`${step.node.id}-${i}`}
              step={step}
              first={i === 0}
              last={i === trace.steps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Editor toolbar ───────────────────────────────────────────────────────────
// Floating pill matching the dashboard EditingToolbar: a left Edit/Traces mode
// toggle, then mode-specific tools (edit: undo/redo, run, duplicate, YAML,
// delete) and a primary Done that exits the editor. Portaled to the body so the
// pane transition's transform can't clip it.

type EditorMode = 'edit' | 'traces';

const TOOLBAR_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };
const SEGMENT_SPRING = { type: 'spring' as const, stiffness: 500, damping: 36, mass: 0.7 };

/** Edit / Traces segmented control with a sliding indicator. */
function ModeToggle({ id, mode, onChange }: { id: string; mode: EditorMode; onChange: (m: EditorMode) => void }) {
  const segments: Array<{ key: EditorMode; icon: string; label: string }> = [
    { key: 'edit', icon: mdiPencilOutline, label: 'Edit' },
    { key: 'traces', icon: mdiHistory, label: 'Traces' },
  ];
  return (
    <div className="flex items-center rounded-ha-xl bg-surface-low p-0.5">
      {segments.map((seg) => {
        const active = mode === seg.key;
        return (
          <button
            key={seg.key}
            type="button"
            onClick={() => onChange(seg.key)}
            aria-pressed={active}
            className="relative flex h-9 items-center gap-ha-1 rounded-ha-lg px-ha-3 text-sm font-semibold"
          >
            {active && (
              <motion.span
                layoutId={`${id}-mode-indicator`}
                className="absolute inset-0 rounded-ha-lg bg-surface-default shadow-sm"
                transition={SEGMENT_SPRING}
              />
            )}
            <Icon path={seg.icon} size={16} className={`relative z-10 ${active ? 'text-ha-blue' : 'text-text-secondary'}`} />
            <span className={`relative z-10 ${active ? 'text-ha-blue' : 'text-text-secondary'}`}>{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToolbarIconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  tone = 'default',
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`w-11 h-11 rounded-ha-xl flex items-center justify-center transition-colors ${
        disabled
          ? 'text-text-disabled opacity-40 cursor-default'
          : active
            ? 'bg-fill-primary-normal text-ha-blue'
            : tone === 'danger'
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-text-secondary hover:bg-surface-mid'
      }`}
    >
      <Icon path={icon} size={20} />
    </button>
  );
}

function AutomationEditorToolbar({
  mode,
  onChangeMode,
  yamlView,
  onToggleYaml,
  onDelete,
  onDone,
}: {
  mode: EditorMode;
  onChangeMode: (m: EditorMode) => void;
  yamlView: boolean;
  onToggleYaml: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  // Transient ✓ feedback after the mock "Run actions".
  const [ran, setRan] = useState(false);
  useEffect(() => {
    if (!ran) return;
    const timer = setTimeout(() => setRan(false), 1500);
    return () => clearTimeout(timer);
  }, [ran]);

  if (typeof document === 'undefined') return null;
  const editing = mode === 'edit';

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={TOOLBAR_SPRING}
      className="fixed z-[60] pointer-events-none inset-x-0 bottom-0 lg:left-[76px] lg:bottom-20 lg:right-0"
      style={{ paddingBottom: `calc(var(--ha-space-3) + env(safe-area-inset-bottom, 0px))` }}
    >
      {/* Mobile: full-width pill matching MobileNav style */}
      <div className="lg:hidden px-edge pointer-events-auto">
        <div className="relative rounded-ha-3xl bg-gradient-to-b from-surface-default/90 via-surface-low/80 to-surface-lower/70 p-px shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4),0_18px_32px_-26px_rgba(0,0,0,0.55)]">
          <div className="relative rounded-[23px] bg-surface-default/95 backdrop-blur-md px-edge py-ha-3">
            <div className="flex items-center gap-ha-2">
              <ModeToggle id="m" mode={mode} onChange={onChangeMode} />
              <div className="flex-1" />
              {editing && (
                <>
                  <ToolbarIconButton icon={mdiCodeBraces} label="Edit in YAML" onClick={onToggleYaml} active={yamlView} />
                  <ToolbarIconButton icon={mdiTrashCanOutline} label="Delete automation" onClick={onDelete} tone="danger" />
                </>
              )}
              <button
                type="button"
                onClick={onDone}
                className="h-11 px-6 rounded-ha-pill bg-ha-blue text-white font-semibold text-sm active:scale-95 transition-transform"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: centered floating pill */}
      <div className="hidden lg:flex justify-center pointer-events-auto">
        <div className="px-ha-2 py-ha-2 rounded-ha-3xl bg-surface-default/95 backdrop-blur-md shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)] border border-surface-low/50 flex items-center gap-ha-1">
          <ModeToggle id="d" mode={mode} onChange={onChangeMode} />

          {editing && (
            <>
              <div className="w-px h-6 bg-border-default mx-ha-1" />

              <ToolbarIconButton icon={mdiUndo} label="Undo" disabled />
              <ToolbarIconButton icon={mdiRedo} label="Redo" disabled />

              <div className="w-px h-6 bg-border-default mx-ha-1" />

              <ToolbarIconButton icon={ran ? mdiCheck : mdiPlay} label="Run actions" onClick={() => setRan(true)} active={ran} />
              <ToolbarIconButton icon={mdiContentDuplicate} label="Duplicate" />
              <ToolbarIconButton icon={mdiCodeBraces} label="Edit in YAML" onClick={onToggleYaml} active={yamlView} />

              <div className="w-px h-6 bg-border-default mx-ha-1" />

              <ToolbarIconButton icon={mdiTrashCanOutline} label="Delete automation" onClick={onDelete} tone="danger" />
            </>
          )}

          <button
            type="button"
            onClick={onDone}
            className="h-11 px-6 rounded-ha-pill bg-ha-blue text-white font-semibold text-sm hover:bg-ha-blue/90 active:scale-95 transition-all ml-ha-1"
          >
            Done
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

export function AutomationEditor({
  automation,
  onExit,
}: {
  automation: AutomationSummary;
  /** Leave the editor (toolbar Done / delete). Also enables the toolbar. */
  onExit?: () => void;
}) {
  // Mock flow, kept in local state so add/edit/delete feel real within the session.
  const [nodes, setNodes] = useState<AutomationNode[]>(() => buildMockFlow(automation.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(automation.enabled);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [yamlView, setYamlView] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nextNodeId = useRef(nodes.length);

  const tracesMode = mode === 'traces';

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const addNode = (kind: NodeKind, def: NodeTypeDef) => {
    const id = `${kind}-${nextNodeId.current++}`;
    setNodes((prev) => [...prev, { id, kind, type: def.type, enabled: true, data: { ...def.defaults } }]);
    setSelectedId(id);
  };

  const updateNode = (next: AutomationNode) =>
    setNodes((prev) => prev.map((n) => (n.id === next.id ? next : n)));

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const configPanel = selected && (
    <NodeConfigPanel
      node={selected}
      onChange={updateNode}
      onDelete={() => deleteNode(selected.id)}
      onClose={() => setSelectedId(null)}
    />
  );

  return (
    // Bottom padding keeps the last section reachable above the floating toolbar.
    <div className={`flex items-start justify-center gap-ha-5 ${onExit ? 'pb-32' : ''}`}>
      {/* Content column: summary header + the three flow sections. Capped so
          rows stay readable when the settings nav slides away. */}
      <div className="min-w-0 flex-1 max-w-2xl space-y-ha-6">
        <section className="rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)]">
          <div className="flex items-center gap-ha-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-ha-2xl bg-violet-500/15 text-violet-500">
              <Icon path={mdiRobot} size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-text-primary truncate">{automation.name}</h2>
              <p className="mt-0.5 text-sm text-text-secondary">{formatLastTriggered(automation.lastTriggered)}</p>
            </div>
            <ToggleSwitch on={enabled} onToggle={() => setEnabled((v) => !v)} />
          </div>
        </section>

        {tracesMode ? (
          <TracesView automation={automation} nodes={nodes} />
        ) : yamlView ? (
          <div className="overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-ha-2 border-b border-surface-low/60 px-ha-4 py-ha-2">
              <Icon path={mdiCodeBraces} size={15} className="text-text-tertiary" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">YAML</span>
            </div>
            <pre className="overflow-x-auto px-ha-4 py-ha-4 font-mono text-[13px] leading-relaxed text-text-secondary">
              {nodesToYaml(automation.name, nodes)}
            </pre>
          </div>
        ) : SECTIONS.map((section) => {
          const sectionNodes = nodes.filter((n) => n.kind === section.kind);
          return (
            <div key={section.kind} className="space-y-ha-2">
              <div className="px-ha-1">
                <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
                <p className="text-[13px] text-text-secondary">{section.hint}</p>
              </div>
              {sectionNodes.length === 0 ? (
                section.emptyLabel && (
                  <div className="rounded-ha-2xl border border-surface-lower bg-surface-default px-ha-4 py-ha-4 text-center text-sm text-text-tertiary">
                    {section.emptyLabel}
                  </div>
                )
              ) : (
                <div className="overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">
                  {sectionNodes.map((node) => (
                    <div key={node.id} className="border-b border-surface-low/40 last:border-0">
                      <NodeRow
                        node={node}
                        selected={node.id === selectedId}
                        onSelect={() => setSelectedId(node.id === selectedId ? null : node.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <AddNodeButton
                label={section.addLabel}
                types={CATALOG[section.kind]}
                onAdd={(def) => addNode(section.kind, def)}
              />
            </div>
          );
        })}
      </div>

      {/* Config sidebar — inline at lg+, sticky just below the pinned title. */}
      {selected && (
        <aside
          className="sticky hidden w-[340px] flex-shrink-0 lg:block"
          style={{ top: 'calc(var(--settings-header-h, 0px) + 4px)' }}
        >
          {configPanel}
        </aside>
      )}

      {/* Below lg the same panel becomes a right slide-over drawer. Portaled to
          the body — the pane-transition wrapper above is transformed during its
          animation, which would otherwise clip this fixed overlay to the page. */}
      {selected && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            aria-label="Close configuration"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedId(null)}
          />
          <div className="ha-pane-in absolute inset-y-0 right-0 w-[min(380px,92vw)] overflow-y-auto bg-surface-lower p-ha-3">
            {configPanel}
          </div>
        </div>,
        document.body,
      )}

      {/* Floating editor toolbar (only when the host wires up an exit). */}
      {onExit && (
        <AutomationEditorToolbar
          mode={mode}
          onChangeMode={(next) => {
            setMode(next);
            // Editing-only surfaces don't carry over into Traces.
            setSelectedId(null);
            if (next === 'traces') setYamlView(false);
          }}
          yamlView={yamlView}
          onToggleYaml={() => {
            setYamlView((v) => !v);
            setSelectedId(null);
          }}
          onDelete={() => setConfirmDelete(true)}
          onDone={onExit}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete automation?"
        message={`"${automation.name}" will be removed. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          onExit?.();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
