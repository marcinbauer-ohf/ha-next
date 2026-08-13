'use client';

import { mdiStop, mdiAlert, mdiArrowUp } from '@mdi/js';
import { clsx } from 'clsx';
import { Icon } from './Icon';
import type { AppStatus } from '@/contexts';

export const appStatusLabel = (status: AppStatus): string =>
  status.kind === 'installing'
    ? status.progress == null
      ? 'Installing'
      : `Installing · ${Math.round(status.progress)}%`
    : status.kind === 'stopped'
      ? 'Stopped'
      : status.kind === 'error'
        ? 'Not running'
        : status.kind === 'busy'
          ? 'Working…'
          : 'Update available';

/**
 * Status marker on an app icon's bottom edge — the same spot for every state so
 * the eye learns one place to look. Installing gets a filling bar and `busy` a
 * pulsing dot (the two states that are going somewhere); the rest get one glyph
 * in the same pill the shortcut badge uses, so the icon grid keeps a single
 * badge language.
 *
 * Every marker pops in, and the `key` is the state — so a state change remounts
 * the badge and the pop plays again instead of the glyph swapping in place.
 */
export function AppStatusBadge({
  status,
  ringClass = 'ring-surface-default',
}: {
  status: AppStatus;
  /** Match the ring to whatever the icon tile sits on. */
  ringClass?: string;
}) {
  const anchor = 'absolute -bottom-1 left-1/2 -translate-x-1/2 ha-badge-in';

  if (status.kind === 'installing') {
    return (
      <span
        key="installing"
        role="img"
        aria-label={appStatusLabel(status)}
        className={clsx(anchor, 'w-6 h-[5px] rounded-full overflow-hidden bg-surface-mid ring-1', ringClass)}
      >
        {status.progress == null ? (
          <span className="ha-indeterminate-bar block h-full rounded-full bg-ha-blue" />
        ) : (
          <span
            className="block h-full rounded-full bg-ha-blue transition-[width] duration-300 ease-linear"
            style={{ width: `${status.progress}%` }}
          />
        )}
      </span>
    );
  }

  if (status.kind === 'busy') {
    return (
      <span
        key="busy"
        role="img"
        aria-label={appStatusLabel(status)}
        className={clsx(anchor, 'w-4 h-4 rounded-full bg-surface-mid ring-1', ringClass)}
      >
        <span className="ha-badge-pulse block w-full h-full rounded-full bg-ha-blue/70" />
      </span>
    );
  }

  const { path, tone } =
    status.kind === 'stopped'
      ? { path: mdiStop, tone: 'bg-surface-mid text-text-secondary' }
      : status.kind === 'error'
        ? { path: mdiAlert, tone: 'bg-surface-mid text-red-600' }
        : { path: mdiArrowUp, tone: 'bg-ha-blue text-white' };

  return (
    <span
      key={status.kind}
      role="img"
      aria-label={appStatusLabel(status)}
      className={clsx(anchor, 'w-4 h-4 rounded-full flex items-center justify-center ring-1', tone, ringClass)}
    >
      <Icon path={path} size={11} exact />
    </span>
  );
}

/** Anything not up and running reads as inactive: dimmed and desaturated. */
export const appStatusDimmed = (status?: AppStatus) =>
  status?.kind === 'installing' ||
  status?.kind === 'stopped' ||
  status?.kind === 'error' ||
  status?.kind === 'busy';
