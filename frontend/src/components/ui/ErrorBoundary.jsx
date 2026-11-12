import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

function DefaultFallback({ error, reset }) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger"
        aria-hidden="true"
      >
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-content">{t('errors.somethingWrong')}</h2>
      <p className="mt-1 max-w-sm text-sm text-content-muted">{t('errors.somethingWrongText')}</p>
      {import.meta.env.DEV && error?.message ? (
        <pre className="mt-4 max-w-full overflow-x-auto rounded-lg bg-surface-muted p-3 text-start text-xs text-content">
          {error.message}
        </pre>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>{t('common.tryAgain')}</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </Button>
      </div>
    </div>
  );
}

const changed = (a = [], b = []) =>
  a.length !== b.length || a.some((item, index) => !Object.is(item, b[index]));

/**
 * Catches errors while rendering its children, so one broken screen does not blank the app.
 * <ErrorBoundary resetKeys={[location.pathname]}><Outlet /></ErrorBoundary>
 *
 * resetKeys: the boundary clears the error by itself when one of these values changes
 * (the route, for example). fallback: a node or ({ error, reset }) => node.
 * onError(error, info): for logging. Errors in event handlers and requests are NOT caught here.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && changed(previousProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback({ error, reset: this.reset });
    if (fallback) return fallback;
    return <DefaultFallback error={error} reset={this.reset} />;
  }
}
