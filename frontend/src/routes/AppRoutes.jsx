import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicRoute } from '@/routes/PublicRoute';
import { PATHS } from '@/routes/paths';

// Shown for a screen whose file is still empty (built in a later phase).
function PagePlaceholder() {
  const { pathname } = useLocation();
  return (
    <div className="p-8 text-center text-sm text-content-muted">
      <p className="font-medium text-content">{pathname}</p>
      <p className="mt-1">This screen is built in a later phase.</p>
    </div>
  );
}

// A layout that is still empty just shows the page inside it.
const PassThroughLayout = () => <Outlet />;

// Pages and layouts are loaded when first visited (smaller first download).
// They must use "export default". A file without one falls back to the placeholder.
const lazyPage = (loader) =>
  lazy(() => loader().then((module) => ({ default: module.default ?? PagePlaceholder })));
const lazyLayout = (loader) =>
  lazy(() => loader().then((module) => ({ default: module.default ?? PassThroughLayout })));

const AuthLayout = lazyLayout(() => import('@/layouts/AuthLayout'));
const MainLayout = lazyLayout(() => import('@/layouts/MainLayout'));

const Login = lazyPage(() => import('@/pages/auth/Login'));
const Register = lazyPage(() => import('@/pages/auth/Register'));
const VerifyEmail = lazyPage(() => import('@/pages/auth/VerifyEmail'));
const ForgotPassword = lazyPage(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazyPage(() => import('@/pages/auth/ResetPassword'));

const DashboardPage = lazyPage(() => import('@/pages/dashboard/DashboardPage'));
const ExpensesPage = lazyPage(() => import('@/pages/expenses/ExpensesPage'));
const IncomePage = lazyPage(() => import('@/pages/income/IncomePage'));
const AccountsPage = lazyPage(() => import('@/pages/accounts/AccountsPage'));
const CategoriesPage = lazyPage(() => import('@/pages/categories/CategoriesPage'));
const BudgetsPage = lazyPage(() => import('@/pages/budgets/BudgetsPage'));
const RecurringPage = lazyPage(() => import('@/pages/recurring/RecurringPage'));
const ReportsPage = lazyPage(() => import('@/pages/reports/ReportsPage'));
const NotificationsPage = lazyPage(() => import('@/pages/notifications/NotificationsPage'));
const SettingsPage = lazyPage(() => import('@/pages/settings/SettingsPage'));

const NotFoundPage = lazyPage(() => import('@/pages/errors/NotFoundPage'));
const ServerErrorPage = lazyPage(() => import('@/pages/errors/ServerErrorPage'));

// Development only: the component showcase. A production build removes this line and the route.
const DemoPage = import.meta.env.DEV ? lazyPage(() => import('@/pages/dev/DemoPage')) : null;

export function AppRoutes() {
  const { pathname } = useLocation();

  return (
    // A crash in one screen shows the error box; moving to another page clears it.
    <ErrorBoundary resetKeys={[pathname]}>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Visitors only: a logged-in person is sent to the dashboard */}
          <Route element={<PublicRoute />}>
            <Route element={<AuthLayout />}>
              <Route path={PATHS.login} element={<Login />} />
              <Route path={PATHS.register} element={<Register />} />
              <Route path={PATHS.verifyEmail} element={<VerifyEmail />} />
              <Route path={PATHS.forgotPassword} element={<ForgotPassword />} />
            </Route>
          </Route>

          {/* Open to everyone: the emailed reset link must always work */}
          <Route element={<AuthLayout />}>
            <Route path={PATHS.resetPassword} element={<ResetPassword />} />
          </Route>

          {/* Logged-in people only */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<Navigate to={PATHS.dashboard} replace />} />
              <Route path={PATHS.dashboard} element={<DashboardPage />} />
              <Route path={PATHS.expenses} element={<ExpensesPage />} />
              <Route path={PATHS.income} element={<IncomePage />} />
              <Route path={PATHS.accounts} element={<AccountsPage />} />
              <Route path={PATHS.categories} element={<CategoriesPage />} />
              <Route path={PATHS.budgets} element={<BudgetsPage />} />
              <Route path={PATHS.recurring} element={<RecurringPage />} />
              <Route path={PATHS.reports} element={<ReportsPage />} />
              <Route path={PATHS.notifications} element={<NotificationsPage />} />
              <Route path={PATHS.settings} element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path={PATHS.serverError} element={<ServerErrorPage />} />
          {DemoPage ? <Route path={PATHS.demo} element={<DemoPage />} /> : null}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
