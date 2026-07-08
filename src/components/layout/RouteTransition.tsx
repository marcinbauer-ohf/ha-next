'use client';

import { useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useImmersiveMode } from '@/hooks';

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
 *
 * The per-pathname `motion.div` also stands in for what used to be `template.tsx`'s
 * route wrapper: it carries `data-route-pathname` (scroll targeting looks up the
 * active route's container by this) and the immersive transform reset. A dedicated
 * `template.tsx` is avoided because Next renders the template into a keyless
 * `[templateStyles, templateScripts, template]` array inside `OuterLayoutRouter`,
 * which trips React's "unique key prop" warning on every render.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { immersiveMode } = useImmersiveMode();

  return (
    // `popLayout` pulls the exiting tree out of flow (position: absolute) so the
    // incoming one takes its place without a jump while both are mounted.
    // `initial={false}` suppresses the fade on first load — only navigations animate.
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        data-route-pathname={pathname}
        className="h-full w-full flex flex-col"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        style={immersiveMode ? { transform: 'none', filter: 'none' } : undefined}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
