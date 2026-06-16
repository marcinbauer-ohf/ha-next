'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Tracks whether a view is showing its own bottom button toolbar (e.g. the
// automation editor). While one is active the mobile bottom nav fades out so the
// toolbar takes its place instead of stacking on top of it. Ref-counted so
// nested/overlapping toolbars don't clobber each other.
interface MobileToolbarContextValue {
  toolbarActive: boolean;
  acquireToolbar: () => () => void;
}

const MobileToolbarContext = createContext<MobileToolbarContextValue>({
  toolbarActive: false,
  acquireToolbar: () => () => {},
});

export function MobileToolbarProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const acquireToolbar = useCallback(() => {
    setCount((c) => c + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      setCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const value = useMemo(
    () => ({ toolbarActive: count > 0, acquireToolbar }),
    [count, acquireToolbar],
  );

  return <MobileToolbarContext.Provider value={value}>{children}</MobileToolbarContext.Provider>;
}

export function useMobileToolbar() {
  return useContext(MobileToolbarContext);
}
