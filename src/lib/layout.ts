/**
 * Shared page content shell — keeps the max-width and desktop gutters identical
 * across the home dashboard, sub-dashboards, panels, rooms, and settings so the
 * content's left/right edges line up on every route. Before this, settings used
 * a symmetric `lg:px-ha-8` gutter (and a narrower 1240px cap on detail pages),
 * so its content sat ~24px wider and left-shifted relative to the dashboards.
 *
 * Split into two parts because the home dashboard suppresses the gutters in its
 * below-lg viewport preview (the frame shows mobile edge padding instead).
 */

/** Max width + horizontal centering. Always applied. */
export const CONTENT_MAX = 'max-w-[1536px] mx-auto w-full';

/**
 * Desktop gutters: asymmetric — left clears the scroll-index rail, right is the
 * standard edge gap. Below lg the content uses its own edge padding, so these
 * only kick in at lg.
 */
export const CONTENT_GUTTER = 'lg:pl-14 lg:pr-ha-8';

/** Full shell: max width + gutters. The common case. */
export const CONTENT_SHELL = `${CONTENT_MAX} ${CONTENT_GUTTER}`;

/**
 * The mobile gutter, on the page's own scroll container. One token because it
 * was drifting per route (12px on rooms / types / categories / energy, 16px on
 * sub-dashboards and panels), so the content's left edge moved as you
 * navigated. `px-edge` is the app's edge padding, the same one the shell's top
 * bar and mobile nav sit on — so a page's content lines up with its chrome.
 * Desktop drops it: CONTENT_SHELL supplies the gutters there.
 */
export const CONTENT_EDGE = 'px-edge lg:px-0';
