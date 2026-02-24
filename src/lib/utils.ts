import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatEntityState(state: string, unit?: string): string {
  if (state === 'unavailable') return 'Unavailable';
  if (state === 'unknown') return 'Unknown';

  const stateMap: Record<string, string> = {
    on: 'On',
    off: 'Off',
    home: 'Home',
    not_home: 'Away',
    open: 'Open',
    closed: 'Closed',
    locked: 'Locked',
    unlocked: 'Unlocked',
    playing: 'Playing',
    paused: 'Paused',
    idle: 'Idle',
    armed_home: 'Armed Home',
    armed_away: 'Armed Away',
    armed_night: 'Armed Night',
    disarmed: 'Disarmed',
    triggered: 'Triggered',
  };

  const formatted = stateMap[state] || state;
  return unit ? `${formatted} ${unit}` : formatted;
}

export function getEntityDomain(entityId: string): string {
  return entityId.split('.')[0];
}

export function isEntityOn(state: string): boolean {
  const onStates = ['on', 'open', 'unlocked', 'playing', 'home'];
  return onStates.includes(state.toLowerCase());
}

export function getTemperatureDisplay(temp: number | undefined, unit = '°C'): string {
  if (temp === undefined) return '';
  return `${Math.round(temp)}${unit}`;
}

export function resolveEntityPictureUrl(haUrl: string | undefined, picture: string | undefined | null): string | undefined {
  if (!picture) return undefined;

  const trimmed = picture.trim();
  if (!trimmed) return undefined;

  // Already absolute/protocol-relative (https:, http:, data:, blob:, //...)
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  if (!haUrl) {
    return trimmed;
  }

  const base = haUrl.replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}
