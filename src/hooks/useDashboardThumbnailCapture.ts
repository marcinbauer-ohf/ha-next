'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { domToPng } from 'modern-screenshot';
import { useEditMode } from '@/contexts';
import { getDashboardThumbnail, setDashboardThumbnail } from '@/lib/dashboardThumbnails';

// Only sidebar-reachable routes get snapshots — those are the only places the
// hover preview ever reads back.
function isPreviewablePath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/panel/')
  );
}

// The RouteTransition wrapper tags each mounted route; grab the *active* copy's
// scroll container so a crossfade's exiting route is never captured.
function findActiveContent(pathname: string): HTMLElement | null {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>('[data-route-pathname]'),
  );
  const active = containers.find((c) => c.dataset.routePathname === pathname);
  const scope = active ?? document;
  return scope.querySelector<HTMLElement>('[data-scrollable="dashboard"]');
}

// Snapshots render onto a solid backing; find the nearest painted background so
// transparent content areas don't come out black.
function resolveBackground(node: HTMLElement): string {
  let el: HTMLElement | null = node;
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) return bg;
    el = el.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor || '#000';
}

// Live camera feeds / maps / iframes either taint the canvas or add no value at
// thumbnail scale — skip them and let their placeholder box show instead.
function snapshotFilter(node: Node): boolean {
  if (!(node instanceof Element)) return true;
  if (node.hasAttribute('data-no-snapshot')) return false;
  const tag = node.tagName.toLowerCase();
  return tag !== 'video' && tag !== 'iframe' && tag !== 'canvas';
}

async function capturePath(pathname: string): Promise<void> {
  const node = findActiveContent(pathname);
  if (!node || node.clientHeight < 40) return;

  try {
    const dataUrl = await domToPng(node, {
      // ~0.4× keeps the PNG tiny while staying legible in a ~200px tooltip.
      scale: 0.4,
      backgroundColor: resolveBackground(node),
      filter: snapshotFilter,
      style: { margin: '0' },
    });
    if (dataUrl && dataUrl.length > 128) {
      setDashboardThumbnail(pathname, dataUrl, Date.now());
    }
  } catch {
    /* tainted canvas / detached node — skip, preview just stays absent */
  }
}

const scheduleIdle = (cb: () => void, timeout: number): (() => void) => {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, timeout);
  return () => window.clearTimeout(id);
};

/**
 * Drives sidebar-preview snapshots. Mounted once in AppShell.
 *
 * Two triggers, both best-effort and idle-deferred so they never compete with
 * interaction:
 *  - leaving edit mode → recapture the current view (it was just changed)
 *  - first visit to a view with no stored snapshot → capture it once
 */
export function useDashboardThumbnailCapture() {
  const pathname = usePathname();
  const { isEditing } = useEditMode();
  const wasEditing = useRef(false);
  // Paths captured this session's lazy pass — avoids recapturing on every nav.
  const lazyDone = useRef<Set<string>>(new Set());

  // Edit-exit: the view was just edited, so refresh its snapshot once the edit
  // chrome has torn down and the viewport clamp reset (a couple frames).
  useEffect(() => {
    const leftEdit = wasEditing.current && !isEditing;
    wasEditing.current = isEditing;
    if (!leftEdit || !isPreviewablePath(pathname)) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        lazyDone.current.add(pathname);
        void capturePath(pathname);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isEditing, pathname]);

  // First-visit lazy capture: only when nothing is stored yet and we're not
  // mid-edit. Deferred to idle + a settle delay so live cards have painted.
  useEffect(() => {
    if (isEditing || !isPreviewablePath(pathname)) return;
    if (lazyDone.current.has(pathname)) return;
    if (getDashboardThumbnail(pathname)) {
      lazyDone.current.add(pathname);
      return;
    }
    const cancel = scheduleIdle(() => {
      if (lazyDone.current.has(pathname)) return;
      lazyDone.current.add(pathname);
      void capturePath(pathname);
    }, 1800);
    return cancel;
  }, [pathname, isEditing]);
}
