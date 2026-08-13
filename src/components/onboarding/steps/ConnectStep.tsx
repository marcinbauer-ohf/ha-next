'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui';
import { useHomeAssistant } from '@/hooks';
import { haptic } from '@/lib/haptics';
import { mdiCheck, mdiChevronDown } from '@mdi/js';
import { friendlyConnectionError } from '@/lib/friendlyConnectionError';
import { normalizeHaUrl } from '@/lib/normalizeHaUrl';
import { MAX_FLOORS, type StepProps } from '../types';
import { EASE_OUT, FIELD_CLASS, PrimaryPill, QuietButton, StepActions, StepSubtitle, StepTitle } from '../ui';

interface ConnectStepProps extends StepProps {
  /** "Use the demo instead" — the sample home is already loaded. */
  onDemo: () => void;
}

export function ConnectStep({ update, next, onDemo }: ConnectStepProps) {
  const { saveCredentials, getAreaRegistry, getFloorRegistry, connecting, connected, demoMode, error } =
    useHomeAssistant();
  const reduce = useReducedMotion();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebratedRef = useRef(false);

  // Success is derived, not stored: a live real connection shows the green
  // state even when revisiting this step via Back — never an empty re-armed form.
  const succeeded = connected && !demoMode;

  // Desktop only — autofocusing on mobile shoves the keyboard over the intro copy.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) urlRef.current?.focus();
  }, []);

  // Celebrate once, then move on — only for a connection made HERE (attempted);
  // revisiting via Back shows the green state without re-advancing. The timer
  // lives in a ref and is only cleared on unmount so a re-render can't cancel
  // the scheduled advance. While the check pulses we also peek at the area and
  // floor registries, so the flow can skip the rooms question for homes that
  // already have their rooms set up, and show their real floor count.
  useEffect(() => {
    if (!succeeded || !attempted || celebratedRef.current) return;
    celebratedRef.current = true;
    haptic('success');
    getAreaRegistry()
      .then((areas) => update({ existingAreaCount: areas.length }))
      .catch(() => update({ existingAreaCount: null }));
    getFloorRegistry()
      .then((floors) =>
        update({
          existingFloorCount: floors.length,
          ...(floors.length > 0 ? { floorCount: Math.min(floors.length, MAX_FLOORS) } : {}),
        }),
      )
      .catch(() => update({ existingFloorCount: null }));
    advanceTimer.current = setTimeout(next, 1100);
  }, [succeeded, attempted, next, getAreaRegistry, getFloorRegistry, update]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  // Also called straight from the portalled CTA, which lives outside the form.
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (connecting || succeeded || !url.trim() || !token.trim()) return;
    setAttempted(true);
    // The hook reports progress through `connecting` / `connected` / `error`.
    saveCredentials(normalizeHaUrl(url), token.trim()).catch(() => {});
  };

  const showError = attempted && !connecting && !succeeded && Boolean(error);

  return (
    <div className="flex flex-col items-center text-center gap-ha-6 w-full">
      <div className="space-y-ha-3">
        <StepTitle>Let&apos;s find your home</StepTitle>
        <StepSubtitle>
          Two things link this screen to your Home Assistant. Both stay on this device.
        </StepSubtitle>
      </div>

      <div className="w-full max-w-[520px] mx-auto">
        <form onSubmit={submit} noValidate className="w-full space-y-ha-4 text-left">
          <div className="space-y-1.5">
            <label htmlFor="onb-url" className="block text-sm font-medium text-text-secondary px-ha-4">
              Web address
            </label>
            <input
              id="onb-url"
              ref={urlRef}
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="homeassistant.local"
              disabled={connecting || succeeded}
              className={FIELD_CLASS}
              autoComplete="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-[13px] text-text-tertiary px-ha-4">
              The address you type in your browser to open Home Assistant — with or
              without the <span className="font-mono">:8123</span> on the end.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="onb-token" className="block text-sm font-medium text-text-secondary px-ha-4">
              Access key
            </label>
            <input
              id="onb-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your key here"
              disabled={connecting || succeeded}
              className={FIELD_CLASS}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="flex items-center gap-ha-1 text-[13px] font-medium text-ha-blue hover:underline px-ha-4"
              aria-expanded={helpOpen}
            >
              Where do I find my access key?
              <Icon
                path={mdiChevronDown}
                size={15}
                className={`transition-transform ${helpOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {helpOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <ol className="mt-ha-1 rounded-ha-2xl bg-surface-low/70 border border-surface-lower p-ha-4 space-y-ha-2 text-[13px] leading-relaxed text-text-secondary list-decimal list-inside">
                    <li>Open Home Assistant in your browser.</li>
                    <li>Click your name in the bottom-left corner.</li>
                    <li>Open the <span className="font-medium text-text-primary">Security</span> tab.</li>
                    <li>
                      At the bottom, choose{' '}
                      <span className="font-medium text-text-primary">Create token</span> — that&apos;s
                      Home Assistant&apos;s name for this key. Copy it here.
                    </li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showError && (
              <motion.p
                initial={{ opacity: 0, y: reduce ? 0 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="rounded-ha-2xl bg-amber-500/10 border border-amber-500/25 px-ha-4 py-ha-3 text-sm text-text-primary leading-relaxed"
                role="alert"
              >
                {friendlyConnectionError(error)}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Secondary first: the stack is bottom-anchored, so the primary
              action ends up in the bottom-nav band. */}
          <StepActions>
            {succeeded ? (
              <>
                <motion.div
                  role="status"
                  initial={{ scale: reduce ? 1 : 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  className="inline-flex items-center gap-ha-2 h-14 min-h-[56px] px-8 rounded-ha-pill bg-green-600 text-white text-base font-semibold"
                >
                  <Icon path={mdiCheck} size={20} />
                  You&apos;re connected
                </motion.div>
                {!attempted && <QuietButton onClick={next}>Continue</QuietButton>}
              </>
            ) : (
              <>
                <QuietButton onClick={onDemo} disabled={connecting}>
                  Use the demo home instead
                </QuietButton>
                <PrimaryPill
                  onClick={() => submit()}
                  disabled={!url.trim() || !token.trim()}
                  busy={connecting}
                  withArrow={!connecting}
                >
                  {connecting ? 'Connecting…' : 'Connect'}
                </PrimaryPill>
              </>
            )}
          </StepActions>
        </form>
      </div>
    </div>
  );
}
