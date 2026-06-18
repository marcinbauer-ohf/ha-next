// A tiny pub/sub bus that lets transient interactions hold the mobile nav at
// its current shown/hidden state. The scroll-index rail uses it while scrubbing:
// scrubbing jumps the dashboard scroller programmatically, and without this the
// nav's scroll-driven auto-hide would read those jumps as hide/show gestures.
// Module-level so the rail (inside route content) and MobileNav (in AppShell)
// don't need to share a React tree.

type Listener = (frozen: boolean) => void;

const listeners = new Set<Listener>();
let frozen = false;

export function setNavAutoHideFrozen(next: boolean): void {
  if (frozen === next) return;
  frozen = next;
  listeners.forEach((l) => l(frozen));
}

// Live read for synchronous guards (a scroll event can fire before React has
// processed the subscription's state update).
export function isNavAutoHideFrozen(): boolean {
  return frozen;
}

export function subscribeNavAutoHideFrozen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
