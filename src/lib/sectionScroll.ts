// Shared geometry for "where does a section header sit at the top of the
// scroll area". Both the scroll-index rail (which scrolls a section to this
// line) and the reversed-breadcrumb detector (which reports the section that
// has reached this line to the app bar) MUST use the same value, or a jump
// lands the header in one place while the crumb reads a different section.
//
// The line is the top of the *fully readable* content:
// - below the scroller's own top padding (which clears the app bar overlay),
// - below any sticky sub-header (--dashboard-sticky-top),
// - desktop: below the h-12 top scroll-fade,
// - mobile: below the frosted bar's backdrop gradient — that gradient is
//   h-[125%] of the bar (see AppShell's MobileTopBar backdrop), so content at
//   the bar's bottom edge still sits under a strong wash.

const TOP_FADE_CLEAR = 48;        // desktop top scroll-fade is h-12 (3rem)
const MOBILE_BAR_GRADIENT = 1.25; // MobileTopBar backdrop height vs the bar

export function sectionReadingLine(scroller: HTMLElement): number {
  const paddingTop = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
  const stickyTop =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--dashboard-sticky-top'),
    ) || 0;
  const base = scroller.getBoundingClientRect().top + paddingTop + stickyTop;
  if (window.matchMedia('(min-width: 1024px)').matches) return base + TOP_FADE_CLEAR;
  const bar = document.querySelector<HTMLElement>('[data-component="MobileTopBar"]');
  if (!bar) return base;
  const barRect = bar.getBoundingClientRect();
  return Math.max(base, barRect.top + barRect.height * MOBILE_BAR_GRADIENT);
}
