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
