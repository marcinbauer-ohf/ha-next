'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HA's sidebar rail and app header.
 *
 * 64px is the *docked* (collapsed) sidebar; an expanded one is 256px. Cropping
 * the narrower of the two on purpose: overshoot destroys page content (the first
 * column of cards gets sliced off), while undershoot only leaves a strip of
 * sidebar showing. Losing content is the worse failure, so this errs small —
 * raise it to 256 if the instance's sidebar is expanded.
 */
const HA_SIDEBAR_PX = 64;
const HA_HEADER_PX = 56;
/** Below this width HA hides the sidebar itself, so there's nothing to crop. */
const HA_WIDE_LAYOUT_PX = 870;
/**
 * Narrow HA moves a page's tab strip (Integrations / Devices / Entities / Helpers)
 * into a bar pinned to the bottom of its own viewport. Same trick as the header:
 * make the frame taller than its box so the bar falls outside the clip. Erring
 * generous — the page inside still scrolls, so over-cropping hides nothing you
 * can't reach, while under-cropping leaves a strip of HA's chrome on screen.
 */
const HA_BOTTOM_TABS_PX = 72;

/**
 * A page from the connected instance, embedded with HA's own navigation cropped
 * away. Shared by the dock's detail pane and the app/dashboard routes.
 *
 * There's no supported way to ask HA for a chrome-less page — kiosk mode is a
 * HACS add-on, and we can't inject CSS across origins. So the frame is made
 * larger than its box and offset, pushing the sidebar and header outside the
 * clip. The crop is geometry, not configuration: it assumes HA's default
 * sidebar width, so a docked (64px) sidebar would need HA_SIDEBAR_PX changed.
 */
export function HaPageFrame({
  src,
  title,
  className = '',
}: {
  src: string;
  title: string;
  /** Box styling — the dock wants a bordered card, a page surface wants none. */
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setBoxWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only shift for a sidebar HA will actually draw — at narrow widths it hides
  // its own, and cropping anyway would eat the page content. The same breakpoint
  // decides where the tab strip goes: in the header when wide (already cropped),
  // in a bottom bar when narrow.
  const wide = boxWidth + HA_SIDEBAR_PX >= HA_WIDE_LAYOUT_PX;
  const sidebar = wide ? HA_SIDEBAR_PX : 0;
  const bottomTabs = wide ? 0 : HA_BOTTOM_TABS_PX;

  return (
    <div ref={boxRef} className={`relative h-full overflow-hidden ${className}`}>
      <iframe
        // Remount on navigation instead of reusing the frame's history.
        key={src}
        src={src}
        title={title}
        referrerPolicy="no-referrer"
        className="absolute border-0"
        style={{
          left: -sidebar,
          top: -HA_HEADER_PX,
          width: `calc(100% + ${sidebar}px)`,
          height: `calc(100% + ${HA_HEADER_PX + bottomTabs}px)`,
        }}
      />
    </div>
  );
}
