'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

/** One segment of the top-bar breadcrumb trail. A crumb without `onClick` is
 *  rendered as static (ambient) context rather than a link. */
export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface HeaderContextType {
  title: string;
  subtitle?: string;
  /** Desktop breadcrumb trail shown above the title; falls back to `subtitle`. */
  breadcrumbs?: BreadcrumbItem[];
  icon?: string;
  primaryAction?: { icon: string; onClick: () => void };
  onBack?: () => void;
  /** Suppress the desktop back arrow even when a subtitle/eyebrow is shown
   *  (e.g. the settings section root, which has no meaningful "back"). */
  hideBack?: boolean;
  /** A small secondary line shown BELOW the title (reversed breadcrumb). The
   *  dashboard feeds it the section the reader has scrolled into, so the
   *  scrolled-away section header re-appears under "Home" in the top bar. */
  sectionCrumb?: string;
  /** Direction the section crumb should roll: `true` rolls in from the top
   *  (scrolling down), `false` from the bottom (scrolling up). */
  sectionCrumbReverse?: boolean;
  setSectionCrumb: (crumb: string | undefined, reverse?: boolean) => void;
  setTitle: (title: string) => void;
  setSubtitle: (subtitle: string | undefined) => void;
  setIcon: (icon: string | undefined) => void;
  setPrimaryAction: (action: { icon: string; onClick: () => void } | undefined) => void;
  setOnBack: (fn: (() => void) | undefined) => void;
  setHeader: (data: { title: string; subtitle?: string; breadcrumbs?: BreadcrumbItem[]; icon?: string; primaryAction?: { icon: string; onClick: () => void }; onBack?: () => void; hideBack?: boolean }) => void;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('Home');
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[] | undefined>(undefined);
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [primaryAction, setPrimaryAction] = useState<{ icon: string; onClick: () => void } | undefined>(undefined);
  const [onBack, setOnBack] = useState<(() => void) | undefined>(undefined);
  const [hideBack, setHideBack] = useState<boolean | undefined>(undefined);
  const [sectionCrumb, setSectionCrumbState] = useState<string | undefined>(undefined);
  const [sectionCrumbReverse, setSectionCrumbReverse] = useState<boolean | undefined>(undefined);
  const setSectionCrumb = useCallback((crumb: string | undefined, reverse?: boolean) => {
    setSectionCrumbState(crumb);
    if (reverse !== undefined) setSectionCrumbReverse(reverse);
  }, []);

  const setHeader = useCallback((data: { title: string; subtitle?: string; breadcrumbs?: BreadcrumbItem[]; icon?: string; primaryAction?: { icon: string; onClick: () => void }; onBack?: () => void; hideBack?: boolean }) => {
    setTitle(data.title);
    setSubtitle(data.subtitle);
    setBreadcrumbs(data.breadcrumbs);
    setIcon(data.icon);
    setPrimaryAction(data.primaryAction);
    setOnBack(data.onBack ? () => data.onBack : undefined);
    setHideBack(data.hideBack);
    // A fresh header (page navigation) drops any dashboard section crumb; the
    // dashboard re-publishes it from its own scroll listener.
    setSectionCrumbState(undefined);
  }, []);

  const value = useMemo(() => ({
    title,
    subtitle,
    breadcrumbs,
    icon,
    primaryAction,
    onBack,
    hideBack,
    sectionCrumb,
    sectionCrumbReverse,
    setSectionCrumb,
    setTitle,
    setSubtitle,
    setIcon,
    setPrimaryAction,
    setOnBack,
    setHeader,
  }), [title, subtitle, breadcrumbs, icon, primaryAction, onBack, hideBack, sectionCrumb, sectionCrumbReverse, setSectionCrumb, setHeader]);

  return (
    <HeaderContext.Provider value={value}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
