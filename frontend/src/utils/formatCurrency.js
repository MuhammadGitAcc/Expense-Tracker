import { intlLocale } from '@/utils/constants';

const formatters = new Map();

function getFormatter(locale, currency, options = {}) {
  const key = `${locale}|${currency}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency,
      ...options,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

/** The API sends money as strings such as "12.50". Shows "$12.50", or "—" when there is no value. */
export function formatCurrency(value, currency = 'USD', locale = 'en') {
  const amount = toNumber(value);
  if (Number.isNaN(amount)) return '—';
  try {
    return getFormatter(locale, currency).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Short form for chart axes: "$12.5K". */
export function formatCompactCurrency(value, currency = 'USD', locale = 'en') {
  const amount = toNumber(value);
  if (Number.isNaN(amount)) return '—';
  try {
    return getFormatter(locale, currency, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function currencySymbol(currency = 'USD', locale = 'en') {
  try {
    const parts = getFormatter(locale, currency, { currencyDisplay: 'narrowSymbol' }).formatToParts(
      0,
    );
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatNumber(value, locale = 'en', options = {}) {
  const amount = toNumber(value);
  if (Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat(intlLocale(locale), options).format(amount);
}

/** The API sends percentages as numbers such as 12.5 (or null). Shows "12.5%". */
export function formatPercent(value, locale = 'en') {
  const amount = toNumber(value);
  if (Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(amount / 100);
}
