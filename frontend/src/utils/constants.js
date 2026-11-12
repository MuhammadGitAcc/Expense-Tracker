export const APP_NAME = 'Expense Tracker';

export const THEMES = ['light', 'dark', 'system'];

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];
export const DEFAULT_LANGUAGE = 'en';

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'SAR',
  'AED',
  'EGP',
  'KWD',
  'QAR',
  'BHD',
  'OMR',
  'JOD',
  'TRY',
  'INR',
  'PKR',
  'CAD',
  'AUD',
  'CHF',
  'JPY',
  'CNY',
];

export const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'savings'];
export const CATEGORY_TYPES = ['income', 'expense'];
export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_wallet', 'other'];
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
export const NOTIFICATION_TYPES = [
  'budget_warning',
  'budget_exceeded',
  'recurring_created',
  'weekly_summary',
  'system',
];
export const PERIODS = ['this_month', 'last_month', 'this_year', 'last_year', 'custom'];

export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

export const MEDIA = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
  prefersDark: '(prefers-color-scheme: dark)',
};

export const STORAGE_KEYS = {
  theme: 'et.theme',
  language: 'et.language',
};

export const TOAST = { maxVisible: 5, durationMs: 4000, errorDurationMs: 6000 };

export const MAX_UPLOAD_MB = 5;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_RECEIPT_TYPES = [...ACCEPTED_IMAGE_TYPES, 'application/pdf'];

/** Gregorian calendar and Latin digits in every language, so amounts and dates match the API. */
export const intlLocale = (language) => `${language}-u-ca-gregory-nu-latn`;
