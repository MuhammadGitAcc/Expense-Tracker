'use strict';

/**
 * Amounts are stored in the currency of their account and are never converted, so every
 * total in the dashboard and the reports is for ONE currency. The caller can choose it
 * with ?currency=EUR; otherwise the currency of the user's profile is used.
 */
function resolveCurrency(user, requested) {
  return (requested || user.currency || 'USD').toUpperCase();
}

module.exports = { resolveCurrency };
