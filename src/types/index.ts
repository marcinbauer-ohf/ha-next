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
}

export interface SummaryCardProps {
  icon: string;
  title: string;
  state: string;
  color?: 'primary' | 'danger' | 'success' | 'yellow' | 'default';
  compact?: boolean;
  variant?: 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
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
