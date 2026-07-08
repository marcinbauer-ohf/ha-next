'use client';

/**
 * First-run onboarding — a full-screen, screensaver-inspired flow that covers
 * the booting shell and ends by fading into the live dashboard.
 *
 * Design language: the screensaver's ambient ring shader + Poppins hero type,
 * dialog-style rounded surfaces, one question per screen, everything skippable.
 * State is LOCAL-ONLY (localStorage) — nothing is written to Home Assistant.
 *
 * Mounted by AppShell inside an <AnimatePresence> keyed on the onboarding gate
 * (src/lib/onboarding.ts), so calling completeOnboarding() plays this
 * component's exit fade and reveals the dashboard already running underneath.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui';
import { RingShaderBackground, useRingOrigin } from '@/components/ui/RingShaderBackground';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHomeAssistant } from '@/hooks';
import { completeOnboarding } from '@/lib/onboarding';
import { haptic } from '@/lib/haptics';
import { mdiArrowLeft } from '@mdi/js';
import { INITIAL_STATE, type OnboardingPatch, type OnboardingState } from './types';
import { setHomeName } from '@/lib/homeName';
import { EASE_OUT } from './ui';
import { HelloStep } from './steps/HelloStep';
import { PathStep } from './steps/PathStep';
import { ConnectStep } from './steps/ConnectStep';
import { NameStep } from './steps/NameStep';
import { RoomsStep } from './steps/RoomsStep';
import { FinaleStep } from './steps/FinaleStep';

const LS_LAYOUT = 'ha_onboarding_layout_v1';
const SS_DRAFT = 'ha_onboarding_draft_v1';

type StepId = 'hello' | 'path' | 'connect' | 'name' | 'rooms' | 'finale';

/** Steps that can be walked past without input (top-right "Skip"). */
const SKIPPABLE: StepId[] = ['name', 'rooms'];

const STEP_IDS: StepId[] = ['hello', 'path', 'connect', 'name', 'rooms', 'finale'];

/** In-progress answers survive a reload / accidental refresh (session only). */
function readDraft(): { state: OnboardingState; stepId: StepId } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SS_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<OnboardingState>; stepId?: string };
    if (!parsed.state || !STEP_IDS.includes(parsed.stepId as StepId)) return null;
    return {
      state: { ...INITIAL_STATE, ...parsed.state },
      stepId: parsed.stepId as StepId,
    };
  } catch {
    return null;
  }
}

interface OnboardingFlowProps {
  /** Dev preview (/dev/onboarding): replay without touching the real gate. */
  onDone?: () => void;
  /** Restore a mid-flow draft after reloads (off in the dev preview). */
  resume?: boolean;
}

export function OnboardingFlow({ onDone, resume = true }: OnboardingFlowProps) {
  const { enableDemoMode, demoMode, connected, createArea } = useHomeAssistant();
  const reduce = useReducedMotion();
  const ringOrigin = useRingOrigin();
  const [draft] = useState(() => (resume ? readDraft() : null));
  const [state, setState] = useState<OnboardingState>(draft?.state ?? INITIAL_STATE);
  const [stepId, setStepId] = useState<StepId>(draft?.stepId ?? 'hello');
  const [dir, setDir] = useState(1);

  // Keep the draft current; it is cleared when the flow finishes.
  useEffect(() => {
    if (!resume) return;
    try {
      sessionStorage.setItem(SS_DRAFT, JSON.stringify({ state, stepId }));
    } catch {
      /* private mode — resume just won't work */
    }
  }, [state, stepId, resume]);
  const rootRef = useRef<HTMLDivElement>(null);

  // Full dialog contract: contain Tab, take initial focus, keep the shell
  // (mounted underneath) out of the tab order via `inert` in AppShell.
  useFocusTrap(true, rootRef);
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const update = (patch: OnboardingPatch) =>
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

  // Homes that already have rooms set up in Home Assistant skip the rooms
  // question entirely — asking again would mean re-doing work they've done.
  const skipRooms = state.path === 'connect' && (state.existingAreaCount ?? 0) > 0;
  const sequence = useMemo<StepId[]>(
    () => [
      'hello',
      'path',
      ...(state.path === 'connect' ? (['connect'] as StepId[]) : []),
      'name',
      ...(skipRooms ? [] : (['rooms'] as StepId[])),
      'finale',
    ],
    [state.path, skipRooms],
  );
  const index = sequence.indexOf(stepId);

  const go = (target: StepId, direction: 1 | -1) => {
    setDir(direction);
    setStepId(target);
    haptic('tap');
  };
  const next = () => {
    // stepId can fall out of the sequence if path flips underneath it — recover
    // to the path step instead of warping to hello.
    if (index === -1) return go('path', -1);
    if (index < sequence.length - 1) {
      const target = sequence[index + 1];
      if (target === 'finale') persistChoices();
      go(target, 1);
    }
  };
  const back = () => {
    if (index === -1) return go('path', -1);
    if (index > 0) go(sequence[index - 1], -1);
  };
  const skip = () => next();

  /** Stash the collected layout so the dashboard (HomeHero etc.) can greet properly.
      Always called from event handlers, so `state` is the latest committed value. */
  const persistChoices = () => {
    const s = state;
    setHomeName(s.homeName);
    try {
      localStorage.setItem(
        LS_LAYOUT,
        JSON.stringify({
          unitSystem: s.unitSystem,
          floors: [],
          areas: s.rooms.map((r) => ({ id: r.id, name: r.name, icon: r.icon, floorId: null })),
          deviceAreas: {},
        }),
      );
    } catch {
      /* private mode / quota — the flow still completes */
    }
    // A freshly connected home with no rooms yet: create the picked rooms as
    // real areas, best-effort in the background while the finale plays.
    if (s.path === 'connect' && connected && !demoMode && s.existingAreaCount === 0) {
      s.rooms.forEach((room) => {
        createArea({ name: room.name, icon: room.haIcon ?? null }).catch(() => {});
      });
    }
  };

  const finish = () => {
    try {
      sessionStorage.removeItem(SS_DRAFT);
    } catch {
      /* ignore */
    }
    if (onDone) onDone();
    else completeOnboarding();
  };

  /** Hello-screen escape hatch: straight to the demo dashboard, no questions. */
  const skipAll = () => {
    if (!connected && !demoMode) enableDemoMode();
    persistChoices();
    finish();
  };

  /** Demo chosen (from path or connect step): make sure the sample home is live. */
  const chooseDemo = () => {
    if (!demoMode) enableDemoMode();
    update({ path: 'demo' });
    go('name', 1);
  };

  const chooseConnect = () => {
    update({ path: 'connect' });
    go('connect', 1);
  };

  // Middle steps get chrome (back, dots, skip); hello and finale stay bare.
  const middleSteps: StepId[] = sequence.filter((s) => s !== 'hello' && s !== 'finale');
  const middleIndex = middleSteps.indexOf(stepId);
  const showChrome = middleIndex !== -1;

  // Fast asymmetric cut: exits accelerate away (0.2s ease-in), entrances
  // decelerate in (0.35s ease-out) — responsive calm, not a slideshow.
  const variants = {
    enter: (d: number) => ({ opacity: 0, y: reduce ? 0 : d * 22 }),
    center: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
    exit: (d: number) => ({
      opacity: 0,
      y: reduce ? 0 : d * -14,
      transition: { duration: 0.2, ease: 'easeIn' as const },
    }),
  };

  // After a step settles, make sure focus lives inside it: keep any input that
  // autofocused itself, otherwise move to the step heading so screen readers
  // announce the new question (AnimatePresence dropped focus to <body>).
  const settleFocus = () => {
    const root = rootRef.current;
    if (!root || stepId === 'hello') return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.contains(active) && active !== root) return;
    const heading = root.querySelector<HTMLElement>('h1[tabindex="-1"]');
    heading?.focus();
  };

  // Escape steps back (never closes — first-run has explicit skip affordances).
  const onRootKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showChrome) {
      e.stopPropagation();
      back();
    }
  };

  return (
    <motion.div
      ref={rootRef}
      data-component="OnboardingFlow"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome setup"
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
      // Force the dark palette for the whole flow (screensaver-style dark
      // backdrop + white text) regardless of the app's current mode — the
      // [data-mode="dark"] CSS vars cascade to every descendant token.
      data-mode="dark"
      className="fixed inset-0 z-[130] bg-surface-default text-text-primary select-none flex flex-col focus:outline-none"
      initial={false}
      exit={{ opacity: 0, scale: reduce ? 1 : 1.03 }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
    >
      {/* The screensaver's ambient shader — immersive full-bleed, forced dark so
          it fills instead of blending over a light surface. */}
      <RingShaderBackground mode="northernLights" resolvedMode="dark" center={ringOrigin.center} reach={ringOrigin.reach} opaque />
      {/* Flat 15% black backdrop over the shader — knocks every mode down
          uniformly so the white text/chips read on top (matches screensaver). */}
      <div className="absolute inset-0 bg-black/15" aria-hidden />

      {/* ── Top chrome: back · progress dots · skip ─────────────────────── */}
      <div className="relative z-10 flex-shrink-0 h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-ha-4 grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="justify-self-start">
          <AnimatePresence>
            {showChrome && (
              <motion.button
                key="back"
                type="button"
                onClick={back}
                aria-label="Back"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-low/70 transition-colors"
              >
                <Icon path={mdiArrowLeft} size={22} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showChrome && (
            <motion.div
              key="dots"
              role="status"
              className="flex items-center gap-ha-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="sr-only">{`Step ${middleIndex + 1} of ${middleSteps.length}`}</span>
              {middleSteps.map((s, i) => (
                <motion.span
                  key={s}
                  layout
                  aria-hidden
                  className={`h-1.5 rounded-ha-pill ${
                    i === middleIndex ? 'bg-text-primary' : i < middleIndex ? 'bg-text-primary/55' : 'bg-text-primary/30'
                  }`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, width: i === middleIndex ? 22 : 6 }}
                  transition={{ duration: reduce ? 0 : 0.35, ease: EASE_OUT }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="justify-self-end">
          <AnimatePresence>
            {SKIPPABLE.includes(stepId) && (
              <motion.button
                key="skip"
                type="button"
                onClick={skip}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-10 px-ha-4 rounded-ha-pill text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-low/70 transition-colors"
              >
                Skip
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Step body — centered, scrolls only when it must ─────────────── */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col">
          {/* Bottom padding includes the top-chrome height so content optically
              centers in the full viewport instead of sitting ~4% low. */}
          <div className="m-auto w-full max-w-[520px] lg:max-w-[660px] px-ha-6 pt-ha-8 pb-[calc(max(env(safe-area-inset-bottom),var(--ha-space-8))+3.5rem)]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={stepId}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                onAnimationComplete={(definition) => {
                  if (definition === 'center') settleFocus();
                }}
              >
                {stepId === 'hello' && (
                  <HelloStep state={state} update={update} next={next} back={back} onSkipAll={skipAll} />
                )}
                {stepId === 'path' && (
                  <PathStep state={state} update={update} next={next} back={back} onConnect={chooseConnect} onDemo={chooseDemo} />
                )}
                {stepId === 'connect' && (
                  <ConnectStep state={state} update={update} next={next} back={back} onDemo={chooseDemo} />
                )}
                {stepId === 'name' && <NameStep state={state} update={update} next={next} back={back} />}
                {stepId === 'rooms' && <RoomsStep state={state} update={update} next={next} back={back} />}
                {stepId === 'finale' && <FinaleStep state={state} onFinish={finish} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
