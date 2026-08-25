'use client';

import { useEffect, useState } from 'react';
import { mdiAlertCircleOutline, mdiCheckCircle, mdiOpenInNew } from '@mdi/js';
import { Icon, Button, HALoader, ToggleSwitch } from '../ui';
import { ModalSheet } from '../layout/ModalSheet';
import { SheetHeader, SHEET_PAD } from '../cards/dialogKit';
import { getFlowStep, submitFlowStep, type FlowField, type FlowStep } from '@/lib/homeassistant';
import { setDiscoveryVerdict, type Discovery } from '@/lib/deviceDiscovery';

// ─────────────────────────────────────────────────────────────────────────────
// Setting up a discovered device, for real. A discovery is a config flow already
// parked on a step, so this reads where it stopped and pushes it along until the
// entry exists or Home Assistant says why it can't.
//
// Most finds on a real home are parked on a confirm — nothing to fill in, just
// "is this yours?" — so that is the case this is shaped around: one sentence and
// one button. The form only appears for the ones that genuinely need something
// only the owner knows.
// ─────────────────────────────────────────────────────────────────────────────

/** Field names worth saying properly; everything else is de-snaked. */
const FIELD_LABEL: Record<string, string> = {
  host: 'Address on your network',
  port: 'Port',
  username: 'Username',
  password: 'Password',
  email: 'Email',
  api_key: 'API key',
  access_token: 'Access token',
  pin: 'PIN',
  code: 'Pairing code',
  use_addon: 'Let Home Assistant run this for you',
};

function labelFor(field: FlowField): string {
  return FIELD_LABEL[field.name] ?? field.name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Fields whose value should never be echoed on screen. */
const SECRET = /password|token|secret|api_key|npsso|pin$/i;
const isSecret = (field: FlowField) => field.format === 'password' || SECRET.test(field.name);

/** HA's abort reasons, said the way you'd say them out loud. */
const ABORT_REASON: Record<string, string> = {
  already_configured: 'This one is already part of your home.',
  already_in_progress: 'You are already setting this one up somewhere else.',
  cannot_connect: 'Your home could not reach it. Check it is powered on and on the network.',
  invalid_auth: 'Those sign-in details were not accepted.',
  no_devices_found: 'Nothing answered at that address.',
  single_instance_allowed: 'This one can only be set up once, and it already is.',
  not_supported: 'Home Assistant cannot work with this particular one.',
  unknown: 'Something went wrong. Nothing was changed.',
};

/** HA's field-level error keys, same treatment. */
const ERROR_TEXT: Record<string, string> = {
  cannot_connect: 'Could not reach it.',
  invalid_auth: 'Not accepted — check and try again.',
  invalid_host: 'That does not look like an address.',
  unknown: 'That did not work.',
};
const errorText = (key: string) => ERROR_TEXT[key] ?? key.replace(/_/g, ' ');

function selectOptions(field: FlowField): Array<{ value: string; label: string }> {
  return (field.options ?? []).map((option) =>
    Array.isArray(option)
      ? { value: option[0], label: option[1] }
      : { value: String(option), label: String(option) },
  );
}

const inputClass =
  'w-full rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3 text-sm font-medium text-text-primary outline-none transition-colors focus:bg-surface-default';

/** One field HA asked for. Unknown types fall back to text, never to a dead end. */
function FlowFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FlowField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const label = labelFor(field);

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-ha-3 rounded-ha-2xl bg-surface-low px-ha-4 py-ha-3">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <ToggleSwitch on={Boolean(value)} onToggle={() => onChange(!value)} size="sm" label={label} />
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-ha-1">
      <label className="px-ha-1 text-[13px] text-text-tertiary" htmlFor={`flow-${field.name}`}>
        {label}
        {field.optional && <span className="text-text-disabled"> · optional</span>}
      </label>
      {field.type === 'select' ? (
        <select
          id={`flow-${field.name}`}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {selectOptions(field).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input
          id={`flow-${field.name}`}
          // A secret goes in masked, and never gets remembered by the browser
          // for a form that exists for one device on one night.
          type={isSecret(field) ? 'password' : field.type === 'integer' || field.type === 'float' ? 'number' : 'text'}
          autoComplete={isSecret(field) ? 'new-password' : 'off'}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.type === 'integer' || field.type === 'float'
            ? (e.target.value === '' ? '' : Number(e.target.value))
            : e.target.value)}
          className={inputClass}
        />
      )}
      {error && <p className="px-ha-1 text-[13px] text-red-500">{errorText(error)}</p>}
    </div>
  );
}

/** Whatever HA sent as defaults, as the form's starting values. */
function initialValues(fields: FlowField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) if (field.default != null) values[field.name] = field.default;
  return values;
}

export function DiscoverySetupSheet({
  device,
  onClose,
}: {
  device: Discovery;
  onClose: () => void;
}) {
  const [step, setStep] = useState<FlowStep | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void getFlowStep(device.id).then((next) => {
      if (!live) return;
      // No step means the flow is gone — answered elsewhere, or expired.
      setStep(next ?? { type: 'abort', flow_id: device.id, handler: '', reason: 'already_in_progress' });
      if (next?.data_schema) setValues(initialValues(next.data_schema));
    });
    return () => { live = false; };
  }, [device.id]);

  const send = async (input: Record<string, unknown>) => {
    setBusy(true);
    const next = await submitFlowStep(device.id, input);
    setBusy(false);
    setStep(next);
    if (next.type === 'form' && next.data_schema) setValues(initialValues(next.data_schema));
    if (next.type === 'create_entry') setDiscoveryVerdict(device.id, 'setUp');
  };

  // Backing out just backs out. Home Assistant leaves a closed discovery parked
  // where it was, so it is still on the shelf next time — walking away from a
  // half-finished setup is not the same as saying the device isn't yours, and
  // that second thing already has its own button.
  const cancel = onClose;

  const fields = step?.type === 'form' ? step.data_schema ?? [] : [];
  const missing = fields.some((f) => f.required && (values[f.name] === undefined || values[f.name] === ''));

  return (
    <ModalSheet open onClose={cancel} maxWidth={480} label={`Set up ${device.title}`}>
      {/* Not DialogFrame: that fixes one height for every dialog, which is right
          for the ones you read (a device, a summary) and wrong for a step you
          answer — most of these are one sentence and one button, and the house
          height parks 300px of empty surface under it. Same header, content
          height. */}
      <div className="flex flex-col">
        <SheetHeader eyebrow="Add to your home" title={device.title} onClose={cancel} />
        <div className={`flex flex-col gap-ha-4 pb-ha-5 ${SHEET_PAD}`}>
          {!step ? (
            <div className="flex justify-center py-ha-6"><HALoader /></div>
          ) : step.type === 'create_entry' ? (
            <>
              <div className="flex items-start gap-ha-3 rounded-ha-2xl bg-green-500/10 p-ha-4">
                <Icon path={mdiCheckCircle} size={22} className="flex-shrink-0 text-green-500" />
                <p className="text-sm leading-relaxed text-text-primary">
                  <span className="font-semibold">{step.title || device.title}</span> is part of your home now.
                </p>
              </div>
              <Button variant="primary" block onClick={onClose}>Done</Button>
            </>
          ) : step.type === 'abort' ? (
            <>
              <div className="flex items-start gap-ha-3 rounded-ha-2xl bg-surface-low p-ha-4">
                <Icon path={mdiAlertCircleOutline} size={22} className="flex-shrink-0 text-amber-500" />
                <p className="text-sm leading-relaxed text-text-secondary">
                  {ABORT_REASON[step.reason ?? 'unknown'] ?? ABORT_REASON.unknown}
                </p>
              </div>
              <Button block onClick={onClose}>Close</Button>
            </>
          ) : step.type === 'menu' ? (
            <>
              <p className="text-sm text-text-secondary">How would you like to set this one up?</p>
              {(Array.isArray(step.menu_options)
                ? step.menu_options.map((id) => ({ id, label: labelFor({ type: 'string', name: id }) }))
                : Object.entries(step.menu_options ?? {}).map(([id, label]) => ({ id, label }))
              ).map((option) => (
                <Button
                  key={option.id}
                  block
                  disabled={busy}
                  onClick={() => void send({ next_step_id: option.id })}
                >
                  {option.label}
                </Button>
              ))}
            </>
          ) : step.type !== 'form' ? (
            // External auth and long-running steps need Home Assistant's own
            // screen — this prototype hands them over rather than half-building
            // an OAuth window.
            <>
              <p className="text-sm leading-relaxed text-text-secondary">
                This one needs to be finished in Home Assistant itself.
              </p>
              <Button icon={mdiOpenInNew} block onClick={onClose}>Close</Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-text-secondary">
                {device.subtitle ? `${device.subtitle} · ` : ''}{device.foundBy}.
                {fields.length === 0 ? ' Add it to your home?' : ' It needs a little more to get going.'}
              </p>

              {step.errors?.base && (
                <p className="rounded-ha-2xl bg-red-500/10 px-ha-4 py-ha-3 text-[13px] text-red-500">
                  {errorText(step.errors.base)}
                </p>
              )}

              {fields.map((field) => (
                <FlowFieldInput
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  error={step.errors?.[field.name]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
                />
              ))}

              <div className="flex items-center gap-ha-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={busy || missing}
                  onClick={() => void send(values)}
                >
                  {busy ? 'Working…' : fields.length === 0 ? 'Add to my home' : 'Continue'}
                </Button>
                <Button variant="ghost" onClick={cancel}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalSheet>
  );
}
