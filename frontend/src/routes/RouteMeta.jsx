import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { APP_NAME } from '@/utils/constants';

// The browser tab title of every page (translation key) and whether search engines may list it.
// Only the login and register pages are public and useful in search results.
const ROUTES = [
  { path: PATHS.root, titleKey: null },
  { path: PATHS.login, titleKey: 'auth.login', indexable: true },
  { path: PATHS.register, titleKey: 'auth.registerTitle', indexable: true },
  { path: PATHS.verifyEmail, titleKey: 'auth.verifyTitle' },
  { path: PATHS.forgotPassword, titleKey: 'auth.forgotTitle' },
  { path: PATHS.resetPassword, titleKey: 'auth.resetTitle' },
  { path: PATHS.dashboard, titleKey: 'nav.dashboard' },
  { path: PATHS.expenses, titleKey: 'nav.expenses' },
  { path: PATHS.expenseDetails, titleKey: 'nav.expenses' },
  { path: PATHS.income, titleKey: 'nav.income' },
  { path: PATHS.accounts, titleKey: 'nav.accounts' },
  { path: PATHS.categories, titleKey: 'nav.categories' },
  { path: PATHS.budgets, titleKey: 'nav.budgets' },
  { path: PATHS.recurring, titleKey: 'nav.recurring' },
  { path: PATHS.reports, titleKey: 'nav.reports' },
  { path: PATHS.notifications, titleKey: 'nav.notifications' },
  { path: PATHS.settings, titleKey: 'nav.settings' },
  { path: PATHS.serverError, titleKey: 'errors.serverTitle' },
  { path: PATHS.demo, titleKey: null },
];

function setRobots(indexable) {
  let tag = document.querySelector('meta[name="robots"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'robots');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', indexable ? 'index, follow' : 'noindex, nofollow');
}

/**
 * Sets the tab title ("Dashboard · Expense Tracker") and the robots meta tag on every page change
 * and on every language change. Render it once, inside the router (App.jsx).
 */
export function RouteMeta() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const route = ROUTES.find((item) => matchPath({ path: item.path, end: true }, pathname));
  const name = route ? route.titleKey && t(route.titleKey) : t('errors.notFoundTitle');
  const title = name ? `${name} · ${APP_NAME}` : APP_NAME;
  const indexable = Boolean(route?.indexable);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    setRobots(indexable);
  }, [indexable]);

  return null;
}
