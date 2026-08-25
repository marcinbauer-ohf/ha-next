'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Tracks whether a view is showing its own bottom button toolbar (e.g. the
// automation editor). While one is active the mobile bottom nav fades out so the
// toolbar takes its place instead of stacking on top of it. Ref-counted so
// nested/overlapping toolbars don't clobber each other.
//
// A toolbar separately says whether it wants the shell's chrome pushed back
// (sidebars dimmed and the settings rail folded away) for the duration. Editors
// that take over the whole surface do; ones you navigate around while using —
// areas & floors — don't, and opt out with `dimChrome: false`.
interface MobileToolbarContextValue {
  toolbarActive: boolean;
  /** True while a toolbar that wants the shell chrome pushed back is up. */
  toolbarDimsChrome: boolean;
  acquireToolbar: (options?: { dimChrome?: boolean }) => () => void;
}

const MobileToolbarContext = createContext<MobileToolbarContextValue>({
  toolbarActive: false,
  toolbarDimsChrome: false,
  acquireToolbar: () => () => {},
});

export function MobileToolbarProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [dimCount, setDimCount] = useState(0);

  const acquireToolbar = useCallback((options?: { dimChrome?: boolean }) => {
    const dims = options?.dimChrome !== false;
    setCount((c) => c + 1);
    if (dims) setDimCount((c) => c + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      setCount((c) => Math.max(0, c - 1));
      if (dims) setDimCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const value = useMemo(
    () => ({ toolbarActive: count > 0, toolbarDimsChrome: dimCount > 0, acquireToolbar }),
    [count, dimCount, acquireToolbar],
  );

  return <MobileToolbarContext.Provider value={value}>{children}</MobileToolbarContext.Provider>;
}

export function useMobileToolbar() {
  return useContext(MobileToolbarContext);
}
