export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    unit_of_measurement?: string;
    temperature?: number;
    current_temperature?: number;
    humidity?: number;
    brightness?: number;
    media_title?: string;
    media_artist?: string;
    [key: string]: unknown;
  };
  last_changed: string;
  last_updated: string;
}

export interface HassEntities {
  [entity_id: string]: HassEntity;
}

export interface EntityCardProps {
  icon: string;
  title: string;
  state: string;
  color?: 'primary' | 'danger' | 'success' | 'yellow' | 'default';
  size?: 'sm' | 'lg';
  onClick?: () => void;
  onIncrement?: (e: React.MouseEvent) => void;
  onDecrement?: (e: React.MouseEvent) => void;
  count?: number;
}

/**
 * Glances — the family of small, live "at a glance" summary widgets shown in
 * the dashboard summary row, the desktop Summary panel, and the screensaver.
 * Some are display-only (lights, climate, weather); richer ones (people,
 * energy) are interactive and open detail in place. This id is the shared
 * vocabulary so new glances can be added in one obvious place.
 */
export type GlanceId = 'people' | 'lights' | 'climate' | 'security' | 'weather' | 'energy' | 'automations';

export interface SummaryCardProps {
  icon: string;
  title: string;
  state: string;
  color?: 'primary' | 'danger' | 'success' | 'yellow' | 'violet' | 'default';
  compact?: boolean;
  variant?: 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  /** Transparent fill + backdrop blur — used over the screensaver's animated background. */
  translucent?: boolean;
  /** Glance identity — names the widget within the summary family. */
  id?: GlanceId;
  /** When set, the glance becomes interactive (renders as a button) — e.g. to open detail. */
  onClick?: (e: React.MouseEvent) => void;
}

export interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  temperature?: number;
  entities: string[];
}

export interface DashboardConfig {
  title: string;
  rooms: Room[];
  favorites: string[];
}
