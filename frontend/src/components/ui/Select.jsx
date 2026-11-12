import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FormField, fieldClasses, describedBy } from '@/components/ui/FormField';

/**
 * A native <select> (best on phones). Give it `options` ([{ value, label, disabled? }])
 * or your own <option> children. `placeholder` adds a first, unselectable empty option.
 */
export function Select({
  ref,
  id,
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  className,
  selectClassName,
  children,
  ...props
}) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <FormField
      id={selectId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error) || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy(selectId, { error, hint })}
          className={cn(
            fieldClasses(Boolean(error)),
            'h-10 appearance-none pe-10',
            selectClassName,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
        />
      </div>
    </FormField>
  );
}
