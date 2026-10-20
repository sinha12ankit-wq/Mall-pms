const TZ = 'Asia/Kolkata';

export const formatDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: TZ,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : '—';

/** Dates without a time (YYYY-MM-DD) are shown as calendar dates. */
export const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
    : '—';

export const formatInr = (value: string | number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(Number(value));

export const formatNumber = (n: number) => new Intl.NumberFormat('en-IN').format(n);

/** snake_case enum value to a readable label. */
export const label = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** "3h 20m" between two times, or since a time until now. */
export function duration(fromIso: string, toIso?: string | null) {
  const ms = new Date(toIso ?? Date.now()).getTime() - new Date(fromIso).getTime();
  const mins = Math.round(Math.abs(ms) / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const text = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${m}m` : `${m}m`;
  return ms < 0 ? `-${text}` : text;
}
