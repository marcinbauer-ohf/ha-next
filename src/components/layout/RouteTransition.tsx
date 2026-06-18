'use client';

import { useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// Freeze the App Router context for the *exiting* route. App Router updates the
// children slot synchronously on navigation, so without this the outgoing tree
// would re-render the new route's content mid-fade and the crossfade collapses
// to a hard cut. Snapshotting the context on first render keeps the old page
// painting itself until its exit animation finishes.
function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  // Snapshot the first-render context and never update it (useState initializer
  // runs once) — this is what "freezes" the exiting route.
  const [frozen] = useState(context);
  if (!frozen) return <>{children}</>;
  return <LayoutRouterContext.Provider value={frozen}>{children}</LayoutRouterContext.Provider>;
}

/**
 * Crossfade between routes. Settings and the dashboards are visually distinct
 * full-screen surfaces (a lighter rounded panel vs. a darker full-bleed grid),
 * so a hard route swap reads as a flash — most visible on desktop. Overlapping
 * a short opacity fade of the old and new trees blends the two instead.
 *
 * Lives here (rendered by the persistent AppShell) rather than in `template.tsx`
 * because a template remounts on every navigation, which would destroy the
 * AnimatePresence before it could ever run an exit animation.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    // `popLayout` pulls the exiting tree out of flow (position: absolute) so the
    // incoming one takes its place without a jump while both are mounted.
    // `initial={false}` suppresses the fade on first load — only navigations animate.
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        className="h-full w-full"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
