'use client';

/**
 * EXPERIMENT — minimalistic first-run setup wizard (desktop + mobile).
 *
 * Lives behind /dev/onboarding so AppShell chrome is bypassed (AppShell:
 * `if (pathname.startsWith('/dev/')) return <>{children}</>`). Full-screen,
 * one step per screen, progress dots + Back/Skip/Next — modelled on Home
 * Assistant's initial config flow, plus an extra floors & areas step.
 *
 * Everything is LOCAL-ONLY: the collected layout is stashed in localStorage and
 * the wizard finishes by opening the default dashboard at `/`. Nothing is
 * written to the HA registries.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui';
import { mdiArrowLeft, mdiArrowRight, mdiCheck } from '@mdi/js';
import { INITIAL_STATE, type OnboardingState, type StepProps } from './types';
import { WelcomeStep } from './steps/WelcomeStep';
import { ConnectStep } from './steps/ConnectStep';
import { NameStep } from './steps/NameStep';
import { AreasStep } from './steps/AreasStep';
import { DevicesStep } from './steps/DevicesStep';

const LS_HOME_NAME = 'ha_home_name';
const LS_LAYOUT = 'ha_onboarding_layout_v1';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface StepDef {
  id: string;
  /** Label under the progress dots. */
  title: string;
  /** Step lets the user move on without input. */
  skippable?: boolean;
  /** Primary button label (defaults to "Continue"). */
  cta?: string;
  Component: (props: StepProps) => React.ReactNode;
}

const STEPS: StepDef[] = [
  { id: 'welcome', title: 'Welcome', cta: 'Get started', Component: WelcomeStep },
  { id: 'connect', title: 'Connect', skippable: true, Component: ConnectStep },
  { id: 'name', title: 'Your home', Component: NameStep },
  { id: 'areas', title: 'Floors & areas', skippable: true, Component: AreasStep },
  { id: 'devices', title: 'Devices', skippable: true, Component: DevicesStep },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const update = (patch: Partial<OnboardingState>) =>
    setState(s => ({ ...s, ...patch }));

  const finish = () => {
    try {
      localStorage.setItem(LS_HOME_NAME, state.homeName.trim() || 'Home');
      localStorage.setItem(
        LS_LAYOUT,
        JSON.stringify({
          unitSystem: state.unitSystem,
          floors: state.floors,
          areas: state.areas,
          deviceAreas: state.deviceAreas,
        }),
      );
    } catch {
      /* private mode / quota — non-fatal for the experiment */
    }
    router.push('/');
  };

  const next = () => {
    if (isLast) return finish();
    setDir(1);
    setIndex(i => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => {
    setDir(-1);
    setIndex(i => Math.max(i - 1, 0));
  };
  const skip = next;

  return (
    <div className="h-[100svh] w-full flex flex-col bg-surface-default text-text-primary select-none">
      {/* ── Progress dots ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 pt-[max(env(safe-area-inset-top),var(--ha-space-5))] px-ha-5">
        <div className="mx-auto w-full max-w-[440px] flex items-center gap-ha-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className="h-1 flex-1 rounded-ha-pill bg-surface-mid overflow-hidden"
            >
              <motion.div
                className="h-full bg-ha-blue rounded-ha-pill"
                initial={false}
                animate={{ width: i < index ? '100%' : i === index ? '50%' : '0%' }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              />
            </div>
          ))}
        </div>
        <p className="mx-auto w-full max-w-[440px] mt-ha-2 text-xs font-medium text-text-tertiary">
          Step {index + 1} of {STEPS.length} · {step.title}
        </p>
      </div>

      {/* ── Step body ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-[440px] px-ha-5 py-ha-6">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <step.Component
                state={state}
                update={update}
                next={next}
                back={back}
                skip={skip}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Footer nav ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-surface-lower bg-surface-default pb-[max(env(safe-area-inset-bottom),var(--ha-space-4))] pt-ha-4 px-ha-5">
        <div className="mx-auto w-full max-w-[440px] flex items-center gap-ha-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-ha-1 py-3 px-4 rounded-ha-xl text-text-secondary font-medium hover:bg-surface-low transition-colors"
            >
              <Icon path={mdiArrowLeft} size={18} />
              Back
            </button>
          ) : (
            <span />
          )}

          <div className="flex-1" />

          {step.skippable && (
            <button
              type="button"
              onClick={skip}
              className="py-3 px-4 rounded-ha-xl text-text-secondary font-medium hover:bg-surface-low transition-colors"
            >
              Skip
            </button>
          )}

          <button
            type="button"
            onClick={next}
            className="flex items-center justify-center gap-ha-2 py-3 px-5 rounded-ha-xl bg-ha-blue text-white font-medium hover:bg-ha-blue/90 transition-colors"
          >
            {isLast ? 'Open dashboard' : (step.cta ?? 'Continue')}
            <Icon path={isLast ? mdiCheck : mdiArrowRight} size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
