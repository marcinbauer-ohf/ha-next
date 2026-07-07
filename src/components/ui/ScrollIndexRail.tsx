'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { mdiGestureSwipeLeft, mdiGestureSwipeRight } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { setNavAutoHideFrozen } from '@/lib/navAutoHideBus';
import { sectionReadingLine } from '@/lib/sectionScroll';
import { useToast } from '@/contexts';

// ── Tuning ──────────────────────────────────────────────────────────────────
const IDLE_HIDE_MS = 1400;      // fade the rail out this long after the last scroll
const MIN_SECTIONS = 2;         // pointless to index a single section
const SWIPE_OPEN_PX = 28;       // leftward travel during a scrub that opens the section
const SWIPE_REANCHOR_PX = 8;    // vertical wobble past this resets the swipe origin
const BUBBLE_TOUCH_SHIFT_PX = 22; // nudge the preview bubble right on touch so the thumb doesn't cover it
const HINT_SEEN_KEY = 'ha:rail-swipe-hint-seen'; // one-time first-interaction toast

export interface ScrollIndexSection {
  key: string;
  title: string;
  /** Optional MDI icon path representing the section (area / type / category). */
  icon?: string;
  /** When set, the rail draws this MDI icon in place of the plain dot, so the
   *  section stands out on the rail itself (e.g. a star for Favorites). */
  markerIcon?: string;
  /** When set, swiping left while scrubbing this section navigates there. */
  href?: string;
}

interface ScrollIndexRailProps {
  /** The dashboard scroll container that holds the [data-section-key] anchors. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Sections in render order — one tick per entry. */
  sections: ScrollIndexSection[];
  /** Disable while editing or in 3D view. */
  enabled: boolean;
}

/**
 * Apple-Contacts / Google-Photos style scroll index. A thin rail of ticks
 * pinned to the right edge of the dashboard. It fades in while scrolling and
 * fades out when idle. Touch-and-drag (or click) scrubs through sections; a
 * floating bubble previews the section name under the finger.
 */
export function ScrollIndexRail({ scrollRef, sections, enabled }: ScrollIndexRailProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const railRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  // Desktop: hovering a dot shows the same preview bubble used while
  // scrubbing, aligned to that dot.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Swipe-to-open: inward travel since the swipe origin (leftward when the rail
  // hugs the right edge, rightward when it hugs the left). The origin re-anchors
  // on vertical movement, so only a deliberate sideways pull after the finger
  // settles on a section counts — never slow drift while scrubbing.
  const [swipeDx, setSwipeDx] = useState(0);
  const swipeAnchor = useRef<{ x: number; y: number } | null>(null);
  const swipeOpened = useRef(false);
  // Touch only: which screen edge the rail hugs. Follows the side the user last
  // touched to scroll, so the rail lands under that thumb. Desktop stays right.
  const [side, setSide] = useState<'left' | 'right'>('right');
  const onRight = side === 'right';

  const count = sections.length;
  const show = enabled && count >= MIN_SECTIONS;

  // Desktop (fine pointer + hover) reveals on proximity hover instead of on
  // scroll, so it never flashes on an unrelated scroll/mouse move.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setIsHoverDevice(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Briefly reveal the rail, then arm the idle timer to fade it out.
  const flash = useCallback(() => {
    setVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
  }, []);

  // Scroll the section header to the shared reading line — the top of the
  // fully readable content, below the app bar and its gradient. Landing it
  // exactly there is what makes the app-bar crumb roll to this same section
  // (see useSectionCrumb), with the section's cards visible underneath.
  const jumpTo = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollRef.current;
    const section = sections[index];
    if (!scroller || !section) return;
    // The first section means "the top": scroll fully home so everything above
    // its anchor (summary chips, their padding) is visible too.
    if (index === 0) {
      scroller.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    const el = scroller.querySelector<HTMLElement>(`[data-section-key="${CSS.escape(section.key)}"]`);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - sectionReadingLine(scroller);
    scroller.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' });
  }, [scrollRef, sections]);

  // Track the current section as the user scrolls normally, and keep the rail
  // visible while scrolling.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !show) return;

    // Anchors are cached and only re-queried when detached (lazy-mounted cards
    // can swap DOM nodes); measurement is coalesced to one rAF per frame so a
    // burst of scroll events costs a single layout pass.
    const anchors = new Map<string, HTMLElement>();
    const anchorFor = (key: string) => {
      const cached = anchors.get(key);
      if (cached?.isConnected) return cached;
      const el = scroller.querySelector<HTMLElement>(`[data-section-key="${CSS.escape(key)}"]`);
      if (el) anchors.set(key, el);
      return el;
    };

    let frame: number | null = null;
    const measure = () => {
      frame = null;
      // Same reading line the app-bar crumb uses, so the active dot and the
      // crumb always name the same section.
      const line = sectionReadingLine(scroller) + 1;
      let current = 0;
      for (let i = 0; i < sections.length; i++) {
        const el = anchorFor(sections[i].key);
        if (!el) continue;
        // Sections are in render order — the first anchor below the threshold
        // means every later one is too.
        if (el.getBoundingClientRect().top > line) break;
        current = i;
      }
      setActiveIndex(current);
    };

    const onScroll = () => {
      // Scrolling only tracks the active section — it never reveals the rail.
      // The rail surfaces on a distinct interaction only: hover on desktop,
      // touch-and-drag on the rail itself on mobile.
      if (frame === null) frame = requestAnimationFrame(measure);
    };

    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [scrollRef, sections, show]);

  // Touch only: whenever a finger lands in the scroll area, move the rail to
  // that half of the screen so it ends up under the thumb the user scrolls with.
  // The rail is faint and unrevealed at rest, so the side flip is unobtrusive;
  // scrubbing happens on the rail itself, so it never fires mid-scrub.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !show || isHoverDevice) return;
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      setSide(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    };
    scroller.addEventListener('pointerdown', onTouch, { passive: true });
    return () => scroller.removeEventListener('pointerdown', onTouch);
  }, [scrollRef, show, isHoverDevice]);

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setNavAutoHideFrozen(false);
    delete scrollRef.current?.dataset.railScrub;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup reads the latest ref
  }, []);

  // Map a client Y position over the rail to a section index and jump there.
  // Jump only when the index actually changes — pointermove fires far more
  // often than the finger crosses ticks, and each jump forces a layout pass.
  const lastJumpIndex = useRef<number | null>(null);
  const scrubToY = useCallback((clientY: number) => {
    const rail = railRef.current;
    if (!rail) return null;
    const rect = rail.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const index = Math.max(0, Math.min(count - 1, Math.floor(ratio * count)));
    setActiveIndex(index);
    if (index !== lastJumpIndex.current) {
      lastJumpIndex.current = index;
      jumpTo(index, false);
    }
    setVisible(true);
    return index;
  }, [count, jumpTo]);

  // Commit the swipe: leave the scrub cleanly, then navigate into the section.
  const openSection = useCallback((href: string) => {
    swipeOpened.current = true;
    setScrubbing(false);
    setSwipeDx(0);
    setNavAutoHideFrozen(false);
    delete scrollRef.current?.dataset.railScrub;
    setVisible(false);
    router.push(href);
  }, [router, scrollRef]);

  // First time the user grabs the rail, explain the swipe-to-open gesture —
  // once, ever (persisted). Only worth it when a section can actually be opened.
  const maybeShowHint = useCallback(() => {
    if (!sections.some(s => s.href)) return;
    try {
      if (localStorage.getItem(HINT_SEEN_KEY)) return;
      localStorage.setItem(HINT_SEEN_KEY, '1');
    } catch { /* storage unavailable — just show it this once */ }
    const dir = onRight ? 'left' : 'right';
    showToast({
      icon: onRight ? mdiGestureSwipeLeft : mdiGestureSwipeRight,
      caption: 'Section rail',
      title: `Swipe ${dir} to open a section`,
      subtitle: `Drag up or down to pick a section, then swipe ${dir} on it to jump straight in.`,
      duration: 6000,
    });
  }, [sections, showToast, onRight]);

  // Capture calls throw for already-released pointers (and synthetic ones in
  // tests); losing capture is harmless, so swallow it.
  const captureSafe = (e: React.PointerEvent, grab: boolean) => {
    const el = e.currentTarget as HTMLElement;
    try {
      if (grab) el.setPointerCapture(e.pointerId);
      else el.releasePointerCapture(e.pointerId);
    } catch { /* inactive pointer */ }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    captureSafe(e, true);
    setScrubbing(true);
    setHoverIndex(null);
    swipeAnchor.current = { x: e.clientX, y: e.clientY };
    swipeOpened.current = false;
    lastJumpIndex.current = null;
    setSwipeDx(0);
    maybeShowHint();
    // Scrubbing jumps the scroller programmatically; hold the mobile nav at its
    // current state so those jumps don't toggle its scroll-driven auto-hide,
    // and mark the scroller so scroll-velocity affordances (fast-scroll gist
    // labels) don't read the jumps as flicking and flash over the cards.
    setNavAutoHideFrozen(true);
    if (scrollRef.current) scrollRef.current.dataset.railScrub = '1';
    scrubToY(e.clientY);
  };
  // Inward pull off the edge-tucked rail, measured from the swipe anchor —
  // leftward when the rail hugs the right edge, rightward when it hugs the left.
  const swipeDxOf = (clientX: number) => {
    const anchor = swipeAnchor.current;
    if (!anchor) return 0;
    return Math.max(0, onRight ? anchor.x - clientX : clientX - anchor.x);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!scrubbing || swipeOpened.current) return;
    const anchor = swipeAnchor.current;
    if (anchor && Math.abs(e.clientY - anchor.y) > SWIPE_REANCHOR_PX) {
      anchor.x = e.clientX;
      anchor.y = e.clientY;
    }
    const dx = swipeDxOf(e.clientX);
    setSwipeDx(dx);
    const index = scrubToY(e.clientY);
    const href = index !== null ? sections[index]?.href : undefined;
    if (href && dx >= SWIPE_OPEN_PX) {
      captureSafe(e, false);
      openSection(href);
    }
  };
  const endScrub = (e: React.PointerEvent) => {
    if (!scrubbing) return;
    captureSafe(e, false);
    setScrubbing(false);
    setNavAutoHideFrozen(false);
    delete scrollRef.current?.dataset.railScrub;
    // The release point can sit past the last move event (coalescing), so the
    // lift itself may complete the swipe.
    const href = sections[activeIndex]?.href;
    if (!swipeOpened.current && href && swipeDxOf(e.clientX) >= SWIPE_OPEN_PX) {
      openSection(href);
      return;
    }
    setSwipeDx(0);
    flash();
  };

  if (!show) return null;

  const railShown = visible || scrubbing;
  // The bubble follows the scrub position, or the hovered dot on desktop.
  const bubbleIndex = scrubbing ? activeIndex : hoverIndex ?? activeIndex;
  const bubbleShown = scrubbing || hoverIndex !== null;

  return (
    <div
      className={clsx(
        // Container ignores pointers (so the bubble never blocks cards); the
        // rail itself stays grabbable even when faded, so a touch on the edge
        // can always start a scrub.
        'pointer-events-none absolute top-1/2 -translate-y-1/2 z-40 flex items-center',
        onRight ? 'right-0' : 'left-0',
        // Mobile bleeds the rail 12px off its edge (cut off / tucked into the
        // edge) instead of floating with a gap; desktop keeps a small inset.
        // The rail's edge-side padding is +12px (see below) so the dots stay
        // centered in the *visible* width despite the clip.
        onRight
          ? 'translate-x-[12px] pr-0 lg:translate-x-0 lg:pr-ha-1'
          : '-translate-x-[12px] pl-0 lg:translate-x-0 lg:pl-ha-1',
        'transition-opacity duration-300',
        // Touch devices keep a faint always-on rail; hover desktops stay very
        // faintly visible at rest and reveal fully when the pointer nears the rail.
        railShown ? 'opacity-100' : isHoverDevice ? 'opacity-20' : 'opacity-30',
      )}
    >
      {/* Preview bubble — sits on the inner side of the rail, aligned to the
          scrubbed or hovered tick. */}
      <div
        className={clsx(
          'absolute flex items-center gap-ha-2 whitespace-nowrap rounded-ha-xl px-ha-3 py-1.5',
          onRight ? 'right-full mr-ha-2' : 'left-full ml-ha-2',
          'bg-surface-default text-text-primary text-sm font-semibold shadow-lg',
          ' transition-opacity duration-150',
          bubbleShown ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: count > 1 ? `${(bubbleIndex / (count - 1)) * 100}%` : '50%',
          // On touch the bubble sits shifted toward its edge so the dragging
          // thumb doesn't cover it, then trails the inward swipe-to-open pull
          // for physical feedback; blue tint marks commit. Signs flip with side.
          transform: `translateY(-50%) translateX(${
            (!isHoverDevice && scrubbing ? (onRight ? 1 : -1) * BUBBLE_TOUCH_SHIFT_PX : 0)
            + (scrubbing ? (onRight ? -1 : 1) * Math.round(Math.min(swipeDx, SWIPE_OPEN_PX) * 0.6) : 0)
          }px)`,
          color: swipeDx >= SWIPE_OPEN_PX && sections[bubbleIndex]?.href ? 'var(--color-ha-blue)' : undefined,
        }}
      >
        {sections[bubbleIndex]?.icon && (
          <Icon path={sections[bubbleIndex]!.icon!} size={16} className="text-ha-blue shrink-0" />
        )}
        {sections[bubbleIndex]?.title}
      </div>

      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onMouseEnter={isHoverDevice ? () => {
          if (idleTimer.current) clearTimeout(idleTimer.current);
          setVisible(true);
        } : undefined}
        onMouseLeave={isHoverDevice ? () => setVisible(false) : undefined}
        role="slider"
        aria-label="Jump to section"
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={activeIndex}
        aria-valuetext={sections[activeIndex]?.title}
        className={clsx(
          // Minimized at rest (slim, bare dots); expands to the same rounded-rect
          // surface as the dashboard filter bar when revealed (hover / scrub).
          'pointer-events-auto flex flex-col items-center cursor-pointer touch-none select-none',
          // Tucked into the screen edge on mobile: square off the edge-side
          // corners so it reads as attached to the edge, and dial the rounding
          // back overall. Desktop floats with an inset, so it stays rounded.
          'transition-[background-color,box-shadow,border-color,padding,gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          onRight ? 'rounded-l-ha-xl rounded-r-none lg:rounded-ha-2xl' : 'rounded-r-ha-xl rounded-l-none lg:rounded-ha-2xl',
          // Horizontal padding is directional so the +12px edge-side bias
          // (centering the dots against the mobile edge-bleed) survives the
          // desktop reset. The bias sits on whichever edge the rail hugs.
          railShown
            ? clsx('gap-1.5 md:gap-2 lg:gap-2 py-ha-2 lg:pl-2 lg:pr-2 bg-surface-default/95 border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)]',
                onRight ? 'pl-ha-3 pr-ha-6' : 'pr-ha-3 pl-ha-6')
            : clsx('gap-1 md:gap-1.5 lg:gap-1.5 py-ha-1 lg:pl-ha-1 lg:pr-ha-1 border border-transparent',
                onRight ? 'pl-ha-2 pr-ha-5' : 'pr-ha-2 pl-ha-5'),
        )}
      >
        {sections.map((s, i) => {
          const active = i === activeIndex;
          return (
            <span
              key={s.key}
              // Padding + negative margin enlarges the hover target without
              // changing the rail layout.
              className="p-1 -m-1 flex items-center justify-center"
              onMouseEnter={isHoverDevice ? () => setHoverIndex(i) : undefined}
              onMouseLeave={isHoverDevice ? () => setHoverIndex(null) : undefined}
            >
              {s.markerIcon ? (
                <Icon
                  path={s.markerIcon}
                  // Slightly larger than a dot so the marker reads as an icon;
                  // colour still tracks active state like every other tick.
                  // Shrinks while the rail is minimized at rest.
                  className={clsx(
                    'transition-[width,height,color] duration-200',
                    railShown
                      ? 'w-2.5 h-2.5 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4'
                      : 'w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3',
                    active ? 'text-ha-blue' : 'text-text-tertiary/50',
                  )}
                />
              ) : (
                <span
                  className={clsx(
                    // Uniform size for every dot — only the colour marks the active
                    // section, never a size change. Slimmer when minimized.
                    'rounded-full transition-[width,height,background-color] duration-200',
                    railShown
                      ? 'w-1.5 h-1.5 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3'
                      : 'w-1 h-1 md:w-1.5 md:h-1.5 lg:w-2 lg:h-2',
                    active ? 'bg-ha-blue' : 'bg-text-tertiary/50',
                  )}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
