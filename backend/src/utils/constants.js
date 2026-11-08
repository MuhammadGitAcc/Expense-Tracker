'use strict';

// These lists mirror the CHECK constraints in database/migrations. Change both together.
const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });
const THEMES = Object.freeze(['light', 'dark', 'system']);
const LANGUAGES = Object.freeze(['en', 'ar']);
const ACCOUNT_TYPES = Object.freeze(['cash', 'bank', 'card', 'savings']);
const CATEGORY_TYPES = Object.freeze(['income', 'expense']);
const PAYMENT_METHODS = Object.freeze(['cash', 'card', 'bank_transfer', 'mobile_wallet', 'other']);
const FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);
const NOTIFICATION_TYPES = Object.freeze([
  'budget_warning',
  'budget_exceeded',
  'recurring_created',
  'weekly_summary',
  'system',
]);

const PAGINATION = Object.freeze({ DEFAULT_LIMIT: 20, MAX_LIMIT: 100 });

// Sign-up email verification (Phase 3B).
const EMAIL_VERIFICATION = Object.freeze({
  CODE_LENGTH: 6,
  EXPIRES_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
});

module.exports = {
  ROLES,
  THEMES,
  LANGUAGES,
  ACCOUNT_TYPES,
  CATEGORY_TYPES,
  PAYMENT_METHODS,
  FREQUENCIES,
  NOTIFICATION_TYPES,
  PAGINATION,
  EMAIL_VERIFICATION,
};
