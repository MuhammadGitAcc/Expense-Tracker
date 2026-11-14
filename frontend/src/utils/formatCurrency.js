import { intlLocale } from '@/utils/constants';

const formatters = new Map();

// Currencies whose symbol is chosen by us instead of by the browser. The browser would show
// "SYP" in Arabic too, and (like the ISO standard of the browser data) would drop the decimals.
// The API always works with 2 decimals, so these currencies are shown with 2 as well.
const SYMBOL_OVERRIDES = {
  SYP: { en: 'SYP', ar: 'ل.س' },
};

/** The symbol we chose for this currency in this language, or null (then the browser decides). */
export function currencySymbolOverride(currency, locale = 'en') {
  const symbols = SYMBOL_OVERRIDES[currency];
  return symbols ? (symbols[locale] ?? symbols.en) : null;
}

function getFormatter(locale, currency, options = {}) {
  const key = `${locale}|${currency}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    const twoDecimals =
      SYMBOL_OVERRIDES[currency] && !options.notation
        ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        : {};
    formatter = new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency,
      ...twoDecimals,
      ...options,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

// Formats with the browser, then swaps the currency part for our own symbol when we have one.
function formatWithSymbol(formatter, amount, currency, locale) {
  const symbol = currencySymbolOverride(currency, locale);
  if (!symbol) return formatter.format(amount);
  return formatter
    .formatToParts(amount)
    .map((part) => (part.type === 'currency' ? symbol : part.value))
    .join('');
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
    return formatWithSymbol(getFormatter(locale, currency), amount, currency, locale);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Short form for chart axes: "$12.5K". */
export function formatCompactCurrency(value, currency = 'USD', locale = 'en') {
  const amount = toNumber(value);
  if (Number.isNaN(amount)) return '—';
  try {
    const formatter = getFormatter(locale, currency, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    return formatWithSymbol(formatter, amount, currency, locale);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function currencySymbol(currency = 'USD', locale = 'en') {
  const override = currencySymbolOverride(currency, locale);
  if (override) return override;
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
