'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';

// ── Tuning ──────────────────────────────────────────────────────────────────
const IDLE_HIDE_MS = 1400;      // fade the rail out this long after the last scroll
const MIN_SECTIONS = 2;         // pointless to index a single section
const ACTIVE_OFFSET = 24;       // px below the sticky header counts as "current"

export interface ScrollIndexSection {
  key: string;
  title: string;
  /** Optional MDI icon path representing the section (area / type / category). */
  icon?: string;
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
  const railRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  // Desktop: hovering a dot shows the same preview bubble used while
  // scrubbing, aligned to that dot.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

  // Scroll the given section anchor to just under the sticky header.
  const jumpTo = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollRef.current;
    const section = sections[index];
    if (!scroller || !section) return;
    const el = scroller.querySelector<HTMLElement>(`[data-section-key="${CSS.escape(section.key)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }, [scrollRef, sections]);

  // Track the current section as the user scrolls normally, and keep the rail
  // visible while scrolling.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !show) return;

    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top + ACTIVE_OFFSET;
      let current = 0;
      for (let i = 0; i < sections.length; i++) {
        const el = scroller.querySelector<HTMLElement>(`[data-section-key="${CSS.escape(sections[i].key)}"]`);
        if (el && el.getBoundingClientRect().top <= top) current = i;
      }
      setActiveIndex(current);
      // On hover-capable desktops the rail reveals on hover, not on scroll.
      if (!isHoverDevice) flash();
    };

    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollRef, sections, show, flash, isHoverDevice]);

  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  // Map a client Y position over the rail to a section index and jump there.
  const scrubToY = useCallback((clientY: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const index = Math.max(0, Math.min(count - 1, Math.floor(ratio * count)));
    setActiveIndex(index);
    jumpTo(index, false);
    setVisible(true);
  }, [count, jumpTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setScrubbing(true);
    setHoverIndex(null);
    scrubToY(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!scrubbing) return;
    scrubToY(e.clientY);
  };
  const endScrub = (e: React.PointerEvent) => {
    if (!scrubbing) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setScrubbing(false);
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
        // rail itself stays grabbable even when faded, so a touch on the right
        // edge can always start a scrub.
        'pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center pr-ha-1',
        'transition-opacity duration-300',
        // Touch devices keep a faint always-on rail; hover desktops stay very
        // faintly visible at rest and reveal fully when the pointer nears the rail.
        railShown ? 'opacity-100' : isHoverDevice ? 'opacity-20' : 'opacity-30',
      )}
    >
      {/* Preview bubble — sits left of the rail, aligned to the scrubbed or
          hovered tick. */}
      <div
        className={clsx(
          'absolute right-full mr-ha-2 flex items-center gap-ha-2 whitespace-nowrap rounded-ha-xl px-ha-3 py-1.5',
          'bg-surface-default text-text-primary text-sm font-semibold shadow-lg',
          'backdrop-blur-md transition-opacity duration-150',
          bubbleShown ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: count > 1 ? `${(bubbleIndex / (count - 1)) * 100}%` : '50%',
          transform: 'translateY(-50%)',
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
        className="pointer-events-auto flex flex-col items-center gap-1 md:gap-1.5 lg:gap-2 py-ha-2 px-ha-1 md:px-ha-2 lg:px-2 cursor-pointer touch-none select-none"
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
              <span
                className={clsx(
                  // Uniform size for every dot — only the colour marks the active
                  // section, never a size change.
                  'rounded-full transition-colors duration-150',
                  'w-1.5 h-1.5 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3',
                  active ? 'bg-ha-blue' : 'bg-text-tertiary/50',
                )}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
