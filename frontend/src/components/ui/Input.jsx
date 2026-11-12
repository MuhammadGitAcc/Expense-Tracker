import { useId } from 'react';
import { cn } from '@/utils/cn';
import { FormField, fieldClasses, describedBy } from '@/components/ui/FormField';

/**
 * <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
 * startIcon: decorative icon at the start. endAdornment: something clickable at the end
 * (a show-password button, for example).
 */
export function Input({
  ref,
  id,
  label,
  hint,
  error,
  required,
  startIcon,
  endAdornment,
  type = 'text',
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
      <div className="relative">
        {startIcon ? (
          <span
            className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-content-muted"
            aria-hidden="true"
          >
            {startIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={Boolean(error) || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy(inputId, { error, hint })}
          className={cn(
            fieldClasses(Boolean(error)),
            'h-10',
            startIcon && 'ps-10',
            endAdornment && 'pe-10',
            inputClassName,
          )}
          {...props}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 end-0 flex items-center pe-1">{endAdornment}</div>
        ) : null}
      </div>
    </FormField>
  );
}

/** Same as Input, for longer text (notes). */
export function Textarea({
  ref,
  id,
  label,
  hint,
  error,
  required,
  rows = 3,
  className,
  inputClassName,
  ...props
}) {
  const autoId = useId();
  const areaId = id ?? autoId;

  return (
    <FormField
      id={areaId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(areaId, { error, hint })}
        className={cn(fieldClasses(Boolean(error)), 'resize-y py-2', inputClassName)}
        {...props}
      />
    </FormField>
  );
}
