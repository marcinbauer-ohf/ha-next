'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  DEFAULT_DOG_EAR_CONFIG,
  type DogEarAction,
  type DogEarCorner,
} from '@/lib/dogEarActions';

const LS_KEY = 'ha-dog-ear-config';

type DogEarConfig = Record<DogEarCorner, DogEarAction>;

interface DogEarConfigContextType {
  config: DogEarConfig;
  setCorner: (corner: DogEarCorner, action: DogEarAction) => void;
}

const DogEarConfigContext = createContext<DogEarConfigContextType | null>(null);

function loadConfig(): DogEarConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_DOG_EAR_CONFIG };
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return { ...DEFAULT_DOG_EAR_CONFIG };
    // Merge over defaults so a partial/legacy blob still yields both corners.
    return { ...DEFAULT_DOG_EAR_CONFIG, ...(JSON.parse(stored) as Partial<DogEarConfig>) };
  } catch {
    return { ...DEFAULT_DOG_EAR_CONFIG };
  }
}

export function DogEarConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<DogEarConfig>(loadConfig);

  const setCorner = useCallback((corner: DogEarCorner, action: DogEarAction) => {
    setConfig((prev) => {
      const next = { ...prev, [corner]: action };
      if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <DogEarConfigContext.Provider value={{ config, setCorner }}>
      {children}
    </DogEarConfigContext.Provider>
  );
}

export function useDogEarConfig() {
  const ctx = useContext(DogEarConfigContext);
  if (!ctx) throw new Error('useDogEarConfig must be used within a DogEarConfigProvider');
  return ctx;
}
