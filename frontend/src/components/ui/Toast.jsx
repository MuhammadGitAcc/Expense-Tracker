import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { useToast } from '@/hooks/useToast';

const TYPES = {
  success: { icon: CheckCircle2, accent: 'text-success' },
  error: { icon: XCircle, accent: 'text-danger' },
  warning: { icon: AlertTriangle, accent: 'text-warning' },
  info: { icon: Info, accent: 'text-primary-text' },
};

function ToastItem({ toast, onDismiss }) {
  const { t } = useTranslation();
  const { icon: Icon, accent } = TYPES[toast.type] ?? TYPES.info;

  return (
    <div
      // Errors interrupt the screen reader, the others wait for a pause.
      role={toast.type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', accent)} aria-hidden="true" />

      <div className="min-w-0 flex-1 break-words text-sm">
        {toast.title ? <p className="font-medium text-content">{toast.title}</p> : null}
        <p className={toast.title ? 'mt-0.5 text-content-muted' : 'text-content'}>
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('common.close')}
        className="-me-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-surface-muted hover:text-content"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Mount ONCE, inside the providers (step 7.4). It only shows the toasts;
 * create them with toast.success(...) from '@/hooks/useToast' (works anywhere).
 * Phone: centered at the bottom. Larger screens: at the end side (right, or left in Arabic).
 */
export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] pb-safe">
      <div className="flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </div>
  );
}
