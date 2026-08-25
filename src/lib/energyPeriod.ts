// Calendar arithmetic for the energy dashboard's period navigator (day / week /
// month / year, stepped with the toolbar's arrows). Kept as plain Date maths on
// local time so a "day" is the user's day, not a UTC one — the same window the
// statistics API buckets by.

export type EnergyPeriod = 'day' | 'week' | 'month' | 'year';

export const ENERGY_PERIODS: { value: EnergyPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

/** First instant of the period `date` falls in. Weeks start Monday. */
export function startOfPeriod(date: Date, period: EnergyPeriod): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === 'month') d.setDate(1);
  if (period === 'year') d.setMonth(0, 1);
  return d;
}

/** Last instant of the period — exclusive end minus a millisecond. */
export function endOfPeriod(date: Date, period: EnergyPeriod): Date {
  const s = startOfPeriod(date, period);
  const e = shiftPeriod(s, period, 1);
  return new Date(e.getTime() - 1);
}

/** Step one whole period forward (+1) or back (-1). */
export function shiftPeriod(date: Date, period: EnergyPeriod, direction: 1 | -1): Date {
  const d = new Date(date);
  if (period === 'day') d.setDate(d.getDate() + direction);
  if (period === 'week') d.setDate(d.getDate() + 7 * direction);
  if (period === 'month') d.setMonth(d.getMonth() + direction);
  if (period === 'year') d.setFullYear(d.getFullYear() + direction);
  return d;
}

/** True when `date` sits in the period we're living through right now. */
export function isCurrentPeriod(date: Date, period: EnergyPeriod, now = new Date()): boolean {
  return startOfPeriod(date, period).getTime() === startOfPeriod(now, period).getTime();
}

/**
 * What the toolbar shows between the arrows. Days get the friendly
 * today/yesterday shorthand; weeks get a formatted range; months and years just
 * name themselves.
 */
export function formatPeriod(date: Date, period: EnergyPeriod, now = new Date()): string {
  const start = startOfPeriod(date, period);
  if (period === 'day') {
    const days = Math.round((start.getTime() - startOfPeriod(now, 'day').getTime()) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === -1) return 'Yesterday';
    if (days === 1) return 'Tomorrow';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(start);
  }
  if (period === 'week') {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).formatRange(start, end);
  }
  if (period === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(start);
  }
  return new Intl.DateTimeFormat(undefined, { year: 'numeric' }).format(start);
}

/** `yyyy-mm-dd` in local time, for the native <input type="date"> value. */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
