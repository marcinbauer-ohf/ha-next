'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface HeaderContextType {
  title: string;
  subtitle?: string;
  icon?: string;
  primaryAction?: { icon: string; onClick: () => void };
  setTitle: (title: string) => void;
  setSubtitle: (subtitle: string | undefined) => void;
  setIcon: (icon: string | undefined) => void;
  setPrimaryAction: (action: { icon: string; onClick: () => void } | undefined) => void;
  setHeader: (data: { title: string; subtitle?: string; icon?: string; primaryAction?: { icon: string; onClick: () => void } }) => void;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('Home');
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [primaryAction, setPrimaryAction] = useState<{ icon: string; onClick: () => void } | undefined>(undefined);

  const setHeader = useCallback((data: { title: string; subtitle?: string; icon?: string; primaryAction?: { icon: string; onClick: () => void } }) => {
    setTitle(data.title);
    setSubtitle(data.subtitle);
    setIcon(data.icon);
    setPrimaryAction(data.primaryAction);
  }, []);

  const value = useMemo(() => ({
    title,
    subtitle,
    icon,
    primaryAction,
    setTitle,
    setSubtitle,
    setIcon,
    setPrimaryAction,
    setHeader,
  }), [title, subtitle, icon, primaryAction, setHeader]);

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
