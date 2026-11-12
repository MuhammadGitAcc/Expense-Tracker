import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/app/store';
import { queryClient } from '@/app/queryClient';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastViewport } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';

// useTheme puts (or removes) the "dark" class on <html>. It must run once, at the top of the app.
function ThemeSync() {
  useTheme();
  return null;
}

/**
 * Everything the app needs around the routes: an outer error boundary (last safety net),
 * Redux, TanStack Query, the theme and the toast area.
 * The router goes INSIDE this (App.jsx), so route errors have their own boundary.
 */
export function AppProviders({ children }) {
  return (
    <ErrorBoundary>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeSync />
          {children}
          <ToastViewport />
        </QueryClientProvider>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
