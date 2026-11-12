import { cn } from '@/utils/cn';
import { Spinner } from '@/components/ui/Spinner';

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const VARIANTS = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-surface-muted text-content hover:bg-line',
  outline: 'border border-line bg-surface text-content hover:bg-surface-muted',
  ghost: 'text-content hover:bg-surface-muted',
  danger: 'bg-danger text-canvas hover:bg-danger/90',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

/** The classes of a button, for things that are not a <button> (a router Link, for example). */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
} = {}) {
  return cn(
    BASE,
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth && 'w-full',
    className,
  );
}

/**
 * <Button>Save</Button>
 * <Button variant="danger" loading={isPending}>Delete</Button>
 * <Button as={Link} to="/expenses">Open</Button>
 * An icon-only button needs aria-label.
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  iconStart,
  iconEnd,
  className,
  children,
  ...props
}) {
  const isNativeButton = Component === 'button';
  const blocked = disabled || loading;

  return (
    <Component
      {...(isNativeButton
        ? { type: 'button', disabled: blocked }
        : { 'aria-disabled': blocked || undefined })}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Spinner size="sm" decorative /> : iconStart}
      {children}
      {loading ? null : iconEnd}
    </Component>
  );
}
