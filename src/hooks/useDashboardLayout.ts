'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HassEntities } from '@/types';

export type CardColSpan = 1 | 2;
export type CardRowSpan = 1 | 2;

export interface CardConfig {
  id: string;
  type: 'entity' | 'room' | 'device';
  entityId?: string;
  roomId?: string;
  deviceId?: string;
  colSpan: CardColSpan;
  rowSpan: CardRowSpan;
  hidden?: boolean;
}

export interface SectionConfig {
  id: string;
  title: string;
  columns: 2 | 3 | 4;
  cards: CardConfig[];
}

export interface DashboardLayout {
  slug: string;
  sections: SectionConfig[];
}

const STORAGE_KEY = 'ha_dashboard_layouts';

function loadFromStorage(slug: string): DashboardLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, DashboardLayout>;
    return all[slug] ?? null;
  } catch {
    return null;
  }
}

function saveToStorage(layout: DashboardLayout) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, DashboardLayout>) : {};
    all[layout.slug] = layout;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable
  }
}

const DOMAIN_SECTION_LABELS: Record<string, string> = {
  light: 'Lights',
  switch: 'Switches',
  climate: 'Climate',
  media_player: 'Media',
  cover: 'Covers',
  fan: 'Fans',
  lock: 'Locks',
  sensor: 'Sensors',
  binary_sensor: 'Sensors',
  vacuum: 'Vacuums',
  button: 'Buttons',
  number: 'Numbers',
  select: 'Selects',
  input_boolean: 'Helpers',
  input_number: 'Helpers',
  input_select: 'Helpers',
};

const DOMAIN_COLUMNS: Record<string, 2 | 3 | 4> = {
  light: 4,
  switch: 4,
  sensor: 4,
  binary_sensor: 4,
  climate: 2,
  media_player: 2,
  cover: 4,
  fan: 4,
  lock: 4,
};

function generateDefaultLayout(slug: string, entities: HassEntities): DashboardLayout {
  const byDomain = new Map<string, string[]>();

  for (const entityId of Object.keys(entities)) {
    const domain = entityId.split('.')[0];
    if (!DOMAIN_SECTION_LABELS[domain]) continue;
    // Merge binary_sensor into sensor section
    const key = domain === 'binary_sensor' ? 'sensor' : domain;
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key)!.push(entityId);
  }

  const DOMAIN_ORDER = ['light', 'switch', 'climate', 'media_player', 'cover', 'fan', 'lock', 'sensor', 'vacuum'];

  const sections: SectionConfig[] = [...byDomain.entries()]
    .sort(([a], [b]) => {
      const ai = DOMAIN_ORDER.indexOf(a);
      const bi = DOMAIN_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map(([domain, entityIds]) => ({
      id: `section-${domain}`,
      title: DOMAIN_SECTION_LABELS[domain] ?? domain,
      columns: (DOMAIN_COLUMNS[domain] ?? 4) as 2 | 3 | 4,
      cards: entityIds.map((entityId) => ({
        id: `card-${entityId}`,
        type: 'entity' as const,
        entityId,
        colSpan: 1 as CardColSpan,
        rowSpan: 1 as CardRowSpan,
      })),
    }));

  return { slug, sections };
}

interface UseDashboardLayoutResult {
  layout: DashboardLayout | null;
  loading: boolean;
  saveLayout: (layout: DashboardLayout) => void;
  updateCard: (sectionId: string, cardId: string, patch: Partial<CardConfig>) => void;
  toggleCardHidden: (sectionId: string, cardId: string) => void;
  addCard: (sectionId: string, card: CardConfig) => void;
  reorderCards: (sectionId: string, cards: CardConfig[]) => void;
  initFromEntities: (entities: HassEntities) => void;
}

export function useDashboardLayout(slug: string): UseDashboardLayoutResult {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadFromStorage(slug);
    setLayout(saved);
    setLoading(false);
  }, [slug]);

  const saveLayout = useCallback((next: DashboardLayout) => {
    setLayout(next);
    saveToStorage(next);
  }, []);

  const initFromEntities = useCallback((entities: HassEntities) => {
    setLayout(prev => {
      if (prev) return prev;
      const generated = generateDefaultLayout(slug, entities);
      saveToStorage(generated);
      return generated;
    });
  }, [slug]);

  const updateCard = useCallback((sectionId: string, cardId: string, patch: Partial<CardConfig>) => {
    setLayout(prev => {
      if (!prev) return prev;
      const next: DashboardLayout = {
        ...prev,
        sections: prev.sections.map(s =>
          s.id !== sectionId ? s : {
            ...s,
            cards: s.cards.map(c => c.id !== cardId ? c : { ...c, ...patch }),
          }
        ),
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  const toggleCardHidden = useCallback((sectionId: string, cardId: string) => {
    setLayout(prev => {
      if (!prev) return prev;
      const next: DashboardLayout = {
        ...prev,
        sections: prev.sections.map(s =>
          s.id !== sectionId ? s : {
            ...s,
            cards: s.cards.map(c => c.id !== cardId ? c : { ...c, hidden: !c.hidden }),
          }
        ),
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  const addCard = useCallback((sectionId: string, card: CardConfig) => {
    setLayout(prev => {
      if (!prev) return prev;
      const next: DashboardLayout = {
        ...prev,
        sections: prev.sections.map(s =>
          s.id !== sectionId ? s : { ...s, cards: [...s.cards, card] }
        ),
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  const reorderCards = useCallback((sectionId: string, cards: CardConfig[]) => {
    setLayout(prev => {
      if (!prev) return prev;
      const next: DashboardLayout = {
        ...prev,
        sections: prev.sections.map(s =>
          s.id !== sectionId ? s : { ...s, cards }
        ),
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  return { layout, loading, saveLayout, updateCard, toggleCardHidden, addCard, reorderCards, initFromEntities };
}
