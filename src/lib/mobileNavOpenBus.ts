// A tiny pub/sub bus broadcasting whether the mobile bottom-nav sheet is open.
// When it opens it draws a full-screen scrim, but surfaces that float above the
// scrim (the corner toast at z-65, the dashboard filter FAB at z-66) would
// otherwise stay lit on top of the dimmed UI. They subscribe here to fade out
// while the sheet is open and back in when it closes. Module-level so MobileNav
// (in AppShell) and those surfaces (in route content) don't share a React tree.

import { useEffect, useState } from 'react';

type Listener = (open: boolean) => void;

const listeners = new Set<Listener>();
let open = false;

export function setMobileNavOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l(open));
}

export function isMobileNavOpen(): boolean {
  return open;
}

export function subscribeMobileNavOpen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React binding: re-renders the caller when the mobile nav sheet opens/closes. */
export function useMobileNavOpen(): boolean {
  const [isOpen, setIsOpen] = useState<boolean>(() => isMobileNavOpen());
  useEffect(() => subscribeMobileNavOpen(setIsOpen), []);
  return isOpen;
}
