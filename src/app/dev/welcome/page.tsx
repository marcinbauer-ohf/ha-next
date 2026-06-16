'use client';

/**
 * EXPERIMENT — first-run "Welcome" entrance for the dashboard (desktop + mobile).
 *
 * Lives under /dev/ so the AppShell chrome is bypassed (see AppShell:
 * `if (pathname.startsWith('/dev/')) return <>{children}</>`). That lets us
 * choreograph the real shell assembling itself without touching AppShell.
 *
 * Unlike the first mock, this reuses the REAL components one-to-one:
 *   • real <Sidebar>, real <StatusBar>, real <MobileNav>
 *   • the real homepage content (the default <DashboardPage> from src/app/page)
 *   • the same grid as AppShell (rows-[auto_1fr_auto] cols-[auto_1fr])
 * Only the TopBar is re-created inline — the real TopBar can't expose a
 * `layoutId` for the title morph without editing the shared component, and the
 * brief said "don't change much". The re-creation mirrors TopBar 1:1.
 *
 * Timeline: blank → "Welcome, {name}" with avatar + home name centered → the
 * home name flies up and becomes the page title (shared-layout morph) while the
 * sidebar slides in → search → add button → the real dashboard contents reveal
 * → the bottom bar (StatusBar on desktop / MobileNav on mobile) rises.
 *
 * Home name: defaults to "Home"; a custom onboarding name is read from the
 * `ha_home_name` localStorage key when present.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion';
import { Sidebar, StatusBar, MobileNav } from '@/components/layout';
import DashboardPage from '@/app/page';
import { Avatar } from '@/components/ui/Avatar';
import { HALogo } from '@/components/ui/HALogo';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import { selectPrimaryPerson, arePrimaryPeopleEqual } from '@/lib/homeassistant/selectors';
import { resolveEntityPictureUrl } from '@/lib/utils';
import { mdiMagnify, mdiPlus, mdiPencil } from '@mdi/js';

// ── Choreography ─────────────────────────────────────────────────────────────
const PHASES = {
  blank: 0,
  welcome: 1,   // "Welcome, {name}" + avatar + home name, centered
  morph: 2,     // home name flies to title slot; sidebar slides in; topbar appears
  search: 3,    // centered search trigger fades in
  add: 4,       // edit + add buttons pop in
  content: 5,   // real dashboard contents reveal
  bottom: 6,    // status bar / mobile nav rise — picture complete
} as const;

// Cumulative wall-clock (ms from start) at which each phase begins.
const SCHEDULE: [number, number][] = [
  [PHASES.welcome, 350],
  [PHASES.morph, 1700],
  [PHASES.search, 2300],
  [PHASES.add, 2650],
  [PHASES.content, 3050],
  [PHASES.bottom, 3900],
];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_POP = [0.34, 1.56, 0.64, 1] as const;

export default function WelcomeExperimentPage() {
  const [phase, setPhase] = useState<number>(PHASES.blank);
  const [runId, setRunId] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { haUrl } = useHomeAssistant();
  const person = useHomeAssistantSelector(selectPrimaryPerson, arePrimaryPeopleEqual);
  const firstName = person?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Welcome, ${firstName}` : 'Welcome home';
  const avatarSrc = resolveEntityPictureUrl(haUrl, person?.picture);
  const avatarInitials = person?.initials;

  const [homeName] = useState(() => {
    if (typeof window === 'undefined') return 'Home';
    return localStorage.getItem('ha_home_name') || 'Home';
  });

  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase(PHASES.blank);
    SCHEDULE.forEach(([p, at]) => {
      timers.current.push(setTimeout(() => setPhase(p), at));
    });
  }, []);

  useEffect(() => {
    run();
    return () => timers.current.forEach(clearTimeout);
  }, [run, runId]);

  const at = (p: number) => phase >= p;
  const morphed = at(PHASES.morph);

  return (
    <LayoutGroup>
      {/* Same shell grid as AppShell (minus preloader/split-view). */}
      <div
        key={runId}
        className="h-[100svh] lg:h-screen flex flex-col lg:grid lg:grid-rows-[auto_1fr_auto] lg:grid-cols-[auto_1fr] lg:pt-edge lg:pl-edge bg-surface-default overflow-hidden select-none"
      >
        {/* ── Sidebar (desktop) — real component, slides in on morph ────────── */}
        <motion.div
          className="hidden lg:block lg:row-span-2 relative z-10"
          initial={false}
          animate={{ x: morphed ? 0 : -80, opacity: morphed ? 1 : 0 }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          <Sidebar />
        </motion.div>

        {/* ── TopBar (re-created 1:1 to host the title morph) ───────────────── */}
        <div className="h-16 bg-transparent px-edge lg:pr-edge overflow-hidden flex-shrink-0 relative z-10">
          <header className="h-full py-ha-2">
            <div className="relative h-full flex items-center justify-between w-full lg:max-w-[1536px] lg:mx-auto lg:px-ha-8">
              {/* Left: logo (mobile) + morphing title */}
              <div className="flex items-center gap-ha-3">
                {morphed && <HALogo size={24} className="lg:hidden" />}
                {morphed && (
                  <motion.h1
                    layoutId="home-title"
                    className="text-lg lg:text-2xl font-semibold text-text-primary capitalize"
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                  >
                    {homeName}
                  </motion.h1>
                )}
              </div>

              {/* Center: search trigger (desktop) */}
              <AnimatePresence>
                {at(PHASES.search) && (
                  <motion.div
                    className="hidden lg:flex absolute left-1/2 top-1/2 z-10 items-center gap-ha-3 w-full max-w-[420px] h-10 px-ha-4 rounded-ha-2xl border border-surface-lower bg-surface-low text-text-secondary"
                    initial={{ opacity: 0, scale: 0.94, x: '-50%', y: 'calc(-50% + 6px)' }}
                    animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  >
                    <Icon path={mdiMagnify} size={20} className="flex-shrink-0" />
                    <span className="flex-1 text-sm text-text-tertiary text-left truncate">
                      Search Home Assistant…
                    </span>
                    <kbd className="flex-shrink-0 flex items-center text-[13px] text-text-tertiary bg-surface-lower px-ha-1.5 py-0.5 rounded-ha-md font-medium">
                      ⌘K
                    </kbd>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Right: edit + add */}
              <div className="flex items-center gap-ha-2">
                <AnimatePresence>
                  {at(PHASES.add) && (
                    <>
                      <motion.button
                        className="hidden lg:block p-ha-3 rounded-ha-xl text-text-secondary hover:bg-surface-low"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, ease: EASE_POP }}
                      >
                        <Icon path={mdiPencil} size={24} />
                      </motion.button>
                      <motion.button
                        className="p-ha-3 rounded-ha-xl bg-ha-blue text-white"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.06, ease: EASE_POP }}
                      >
                        <Icon path={mdiPlus} size={24} />
                      </motion.button>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
        </div>

        {/* ── Content — the REAL homepage, revealed on the content phase ────── */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-0">
          <motion.div
            className="h-full relative"
            initial={false}
            animate={{ opacity: at(PHASES.content) ? 1 : 0, scale: at(PHASES.content) ? 1 : 0.96 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            style={{ transformOrigin: '50% 0%' }}
          >
            <DashboardPage />
          </motion.div>
        </div>

        {/* ── Status bar (desktop) — real component, rises last ─────────────── */}
        <motion.div
          className="hidden lg:block col-span-full"
          initial={false}
          animate={{ opacity: at(PHASES.bottom) ? 1 : 0, y: at(PHASES.bottom) ? 0 : 24 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <StatusBar connectionStatus={null} />
        </motion.div>

        {/* ── Mobile nav — real component, fades in last (no transform: it's
            position:fixed and a transformed ancestor would re-anchor it). ──── */}
        <AnimatePresence>
          {at(PHASES.bottom) && (
            <motion.div
              className="lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <MobileNav connectionStatus={null} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Centered "Welcome" intro ──────────────────────────────────────
            No AnimatePresence on the morphing word: when `morphed` flips this
            unmounts and the title's `layoutId="home-title"` mounts in the same
            tick, so framer morphs it from center to the title slot. */}
        {!morphed && at(PHASES.welcome) && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-ha-4 px-ha-6 text-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <Avatar src={avatarSrc} initials={avatarInitials} size="xl" />
            </motion.div>
            <motion.span
              className="text-lg lg:text-xl text-text-secondary"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}
            >
              {greeting}
            </motion.span>
            <motion.h1
              layoutId="home-title"
              className="text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary capitalize"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: EASE_OUT }}
            >
              {homeName}
            </motion.h1>
          </div>
        )}

        {/* Replay control — experiment affordance only */}
        <button
          onClick={() => setRunId(n => n + 1)}
          className="fixed bottom-edge right-edge z-[60] h-9 px-ha-4 rounded-ha-xl bg-surface-low text-text-secondary text-xs font-medium hover:bg-surface-mid transition-colors"
        >
          Replay
        </button>
      </div>
    </LayoutGroup>
  );
}
