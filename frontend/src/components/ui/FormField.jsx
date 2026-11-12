import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

/** Classes shared by Input, Textarea, Select and DatePicker. */
export const fieldClasses = (invalid) =>
  cn(
    'block w-full rounded-lg border bg-surface px-3 text-sm text-content transition-colors placeholder:text-content-muted disabled:cursor-not-allowed disabled:opacity-60',
    invalid ? 'border-danger' : 'border-line',
  );

/** Value for aria-describedby of the control inside a FormField with the same id. */
export const describedBy = (id, { error, hint }) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

/** Label, hint and error message around one form control. `error` is a translation key or plain text. */
export function FormField({ id, label, hint, error, required, className, children }) {
  const { t } = useTranslation();
  const message = error ? t(error, { defaultValue: String(error) }) : null;

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-content">
          {label}
          {required ? (
            <span className="ms-0.5 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {message ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
