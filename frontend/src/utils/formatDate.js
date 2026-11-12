import { intlLocale } from '@/utils/constants';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

/** "2026-11-12" to a Date at UTC midnight, or null when it is not a real calendar day. */
export function parseISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date : null;
}

export const isValidISODate = (value) => parseISODate(value) !== null;

/** A Date to "YYYY-MM-DD" using the user's own calendar day. */
export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

const DEFAULT_DATE = { day: 'numeric', month: 'short', year: 'numeric' };

/** A calendar date from the API ("2026-11-12") to "Nov 12, 2026". Never shifted by a time zone. */
export function formatDate(value, locale = 'en', options = DEFAULT_DATE) {
  const date = parseISODate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'UTC', ...options }).format(date);
}

/** A timestamp from the API (created_at) in the user's own time zone. */
export function formatDateTime(value, locale = 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Month is 1-12. Shows "November 2026". */
export function formatMonthYear(year, month, locale = 'en') {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "5 minutes ago", "yesterday". After a week it falls back to the full date and time. */
export function formatRelativeTime(value, locale = 'en', now = Date.now()) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.round((then - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });

  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDateTime(value, locale);
}

/** First and last day of a month (month is 1-12). */
export function monthRange(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export const yearRange = (year) => ({ from: `${year}-01-01`, to: `${year}-12-31` });
