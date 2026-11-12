import { useId } from 'react';
import { cn } from '@/utils/cn';
import { FormField, fieldClasses, describedBy } from '@/components/ui/FormField';

/**
 * A native date field (the best picker on phones). The value is always "YYYY-MM-DD",
 * exactly what the API sends and expects.
 * <DatePicker label="Date" max={todayISO()} error={errors.date?.message} {...register('date')} />
 * min / max are "YYYY-MM-DD" strings. The browser shows the date in the user's own format.
 */
export function DatePicker({
  ref,
  id,
  label,
  hint,
  error,
  required,
  min,
  max,
  className,
  inputClassName,
  ...props
}) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <FormField
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        ref={ref}
        id={inputId}
        type="date"
        min={min}
        max={max}
        aria-invalid={Boolean(error) || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(inputId, { error, hint })}
        className={cn(fieldClasses(Boolean(error)), 'h-10 min-w-0', inputClassName)}
        {...props}
      />
    </FormField>
  );
}
