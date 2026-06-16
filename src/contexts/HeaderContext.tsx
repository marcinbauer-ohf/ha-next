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

  const setHeader = useCallback((data: { title: string; subtitle?: string; breadcrumbs?: BreadcrumbItem[]; icon?: string; primaryAction?: { icon: string; onClick: () => void }; onBack?: () => void; hideBack?: boolean }) => {
    setTitle(data.title);
    setSubtitle(data.subtitle);
    setBreadcrumbs(data.breadcrumbs);
    setIcon(data.icon);
    setPrimaryAction(data.primaryAction);
    setOnBack(data.onBack ? () => data.onBack : undefined);
    setHideBack(data.hideBack);
  }, []);

  const value = useMemo(() => ({
    title,
    subtitle,
    breadcrumbs,
    icon,
    primaryAction,
    onBack,
    hideBack,
    setTitle,
    setSubtitle,
    setIcon,
    setPrimaryAction,
    setOnBack,
    setHeader,
  }), [title, subtitle, breadcrumbs, icon, primaryAction, onBack, hideBack, setHeader]);

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
