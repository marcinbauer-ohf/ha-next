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
import { floorNames, INITIAL_STATE, type OnboardingPatch, type OnboardingState } from './types';
import { setHomeName } from '@/lib/homeName';
import { EASE_OUT, StepActionsHostContext } from './ui';
import { AccessibilityMenu } from './AccessibilityMenu';
import { HelloStep } from './steps/HelloStep';
import { PathStep } from './steps/PathStep';
import { ConnectStep } from './steps/ConnectStep';
import { NameStep } from './steps/NameStep';
import { LocationStep } from './steps/LocationStep';
import { FloorsStep } from './steps/FloorsStep';
import { RoomsStep } from './steps/RoomsStep';
import { AnalyticsStep } from './steps/AnalyticsStep';
import { FinaleStep } from './steps/FinaleStep';

const LS_LAYOUT = 'ha_onboarding_layout_v1';
const SS_DRAFT = 'ha_onboarding_draft_v2';

/** Rooms get one step per storey — `rooms:0` is the ground floor. */
type RoomsStepId = `rooms:${number}`;
type StepId =
  | 'hello'
  | 'path'
  | 'connect'
  | 'name'
  | 'location'
  | 'floors'
  | RoomsStepId
  | 'analytics'
  | 'finale';

const FIXED_STEP_IDS = ['hello', 'path', 'connect', 'name', 'location', 'floors', 'analytics', 'finale'] as const;

function isStepId(value: unknown): value is StepId {
  return (
    typeof value === 'string' &&
    (FIXED_STEP_IDS.includes(value as (typeof FIXED_STEP_IDS)[number]) || /^rooms:\d+$/.test(value))
  );
}

const roomsFloor = (stepId: StepId): number | null =>
  stepId.startsWith('rooms:') ? Number(stepId.slice('rooms:'.length)) : null;

/** In-progress answers survive a reload / accidental refresh (session only). */
function readDraft(): { state: OnboardingState; stepId: StepId } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SS_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<OnboardingState>; stepId?: string };
    if (!parsed.state || !isStepId(parsed.stepId)) return null;
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
  const {
    enableDemoMode,
    demoMode,
    connected,
    createArea,
    createFloor,
    updateCoreConfig,
    setAnalyticsPreferences,
  } = useHomeAssistant();
  const reduce = useReducedMotion();
  const ringOrigin = useRingOrigin();
  const [draft] = useState(() => (resume ? readDraft() : null));
  const [state, setState] = useState<OnboardingState>(draft?.state ?? INITIAL_STATE);
  const [stepId, setStepId] = useState<StepId>(draft?.stepId ?? 'hello');
  const [dir, setDir] = useState(1);
  // The footer slot every step's CTA portals into — see StepActions.
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);

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
      'location',
      'floors',
      // One rooms step per storey — a tab strip was too easy to miss.
      ...(skipRooms ? [] : floorNames(state.floorCount).map((_, i): StepId => `rooms:${i}`)),
      // Sharing is the last thing asked, once the home itself is set up.
      'analytics',
      'finale',
    ],
    [state.path, state.floorCount, skipRooms],
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

  /** Stash the collected layout so the dashboard (HomeHero etc.) can greet properly.
      Always called from event handlers, so `state` is the latest committed value. */
  const persistChoices = () => {
    const s = state;
    setHomeName(s.homeName);
    try {
      localStorage.setItem(
        LS_LAYOUT,
        JSON.stringify({
          floors: floorNames(s.floorCount).map((name, level) => ({ name, level })),
          areas: s.rooms.map((r) => ({ id: r.id, name: r.name, icon: r.icon, floorId: r.floor })),
          deviceAreas: {},
          location: s.location,
        }),
      );
    } catch {
      /* private mode / quota — the flow still completes */
    }
    // A freshly connected home: create what was picked for real, best-effort in
    // the background while the finale plays. Single-storey homes get no floors —
    // HA treats "no floors" as the normal case and one would just be noise.
    if (s.path === 'connect' && connected && !demoMode) {
      // Location + sharing are Home Assistant's own settings — write them where
      // its Settings screens read from, so this flow isn't a parallel truth.
      if (s.location) {
        void updateCoreConfig({ latitude: s.location.lat, longitude: s.location.lng }).catch(() => {});
      }
      void setAnalyticsPreferences(s.analytics).catch(() => {});
      void (async () => {
        // level index → the created floor's HA id, so rooms land on their storey.
        const floorIds: Array<string | null> = floorNames(s.floorCount).map(() => null);
        if (s.existingFloorCount === 0 && s.floorCount > 1) {
          await Promise.all(
            floorNames(s.floorCount).map(async (name, level) => {
              try {
                floorIds[level] = (await createFloor({ name, level })).floor_id;
              } catch {
                /* one floor failing shouldn't strand the rooms */
              }
            }),
          );
        }
        if (s.existingAreaCount === 0) {
          await Promise.all(
            s.rooms.map((room) =>
              createArea({
                name: room.name,
                icon: room.haIcon ?? null,
                floor_id: floorIds[room.floor] ?? null,
              }).catch(() => {}),
            ),
          );
        }
      })();
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
  const roomsStepFloor = roomsFloor(stepId);
  const middleIndex = middleSteps.indexOf(stepId);
  const showChrome = middleIndex !== -1;

  // Fast asymmetric cut: exits accelerate away (0.2s ease-in), entrances
  // decelerate in (0.35s ease-out) — responsive calm, not a slideshow.
  // Sideways, matching the progress dots: forward comes in from the right and
  // leaves to the left, back does the reverse.
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 40 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } },
    exit: (d: number) => ({
      opacity: 0,
      x: reduce ? 0 : d * -26,
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
      <RingShaderBackground mode="warp" resolvedMode="dark" center={ringOrigin.center} reach={ringOrigin.reach} opaque />
      {/* Black scrim over the shader. Top-weighted, not flat: the warp field is
          brightest along the top edge, which read as a haze band across the top
          of the screen. Damping just that end keeps the shader visible lower
          down without a flat 55% killing it everywhere. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/22" aria-hidden />

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

        {/* No skip affordance: setting the home up is the point of this flow,
            and an escape hatch in the corner tells people it's optional. The
            corner holds the accessibility controls instead — available from the
            very first screen, before any of the questions. */}
        <div className="justify-self-end">
          <AccessibilityMenu />
        </div>
      </div>

      {/* ── Step body — centered, scrolls only when it must ─────────────── */}
      {/* overflow-x-hidden: the sideways step transition would otherwise turn
          this scroller's implied overflow-x:auto into a flashing scrollbar. */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="min-h-full flex flex-col">
          {/* Centred in whatever height is left between the chrome and the CTA
              row — both of which are real rows, so no padding guesswork and no
              way for a tall step to end up underneath the buttons. */}
          <div className="m-auto w-full max-w-[520px] lg:max-w-[660px] px-ha-6 py-ha-8">
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
                <StepActionsHostContext.Provider value={actionsHost}>
                {stepId === 'hello' && <HelloStep state={state} update={update} next={next} back={back} />}
                {stepId === 'path' && (
                  <PathStep state={state} update={update} next={next} back={back} onConnect={chooseConnect} onDemo={chooseDemo} />
                )}
                {stepId === 'connect' && (
                  <ConnectStep state={state} update={update} next={next} back={back} onDemo={chooseDemo} />
                )}
                {stepId === 'name' && <NameStep state={state} update={update} next={next} back={back} />}
                {stepId === 'location' && <LocationStep state={state} update={update} next={next} back={back} />}
                {stepId === 'floors' && <FloorsStep state={state} update={update} next={next} back={back} />}
                {roomsStepFloor !== null && (
                  <RoomsStep state={state} update={update} next={next} back={back} floor={roomsStepFloor} />
                )}
                {stepId === 'analytics' && <AnalyticsStep state={state} update={update} next={next} back={back} />}
                {stepId === 'finale' && <FinaleStep onFinish={finish} />}
                </StepActionsHostContext.Provider>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* CTA slot — every step's Continue button portals in here (StepActions),
          so it holds one position regardless of how tall the step is.
          A real row in the column, NOT an overlay: the step body above is
          flex-1, so it can only ever use the height this row leaves it, and a
          tall step scrolls instead of sliding under the buttons.
          Mobile: the row is just button + edge padding, i.e. the exact band the
          app's bottom nav occupies, so ending the flow fades these buttons out
          onto the nav. Desktop: min-height reserves everything below the old
          anchor (18rem under centre, clamped for short windows) and the buttons
          sit at the row's top edge — same position as before, now with the space
          actually reserved. Stacks grow down from that edge. */}
      <div
        ref={setActionsHost}
        className="pointer-events-none relative z-20 flex-shrink-0 flex flex-col items-center gap-ha-2 px-ha-6 pb-[calc(var(--ha-edge-padding)+var(--ha-space-2))] lg:pb-0 lg:min-h-[max(calc(var(--ha-space-8)+3.5rem),calc(50%_-_18rem_+_3.5rem))]"
      />
    </motion.div>
  );
}
