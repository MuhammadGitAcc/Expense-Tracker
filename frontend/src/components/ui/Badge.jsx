import { cn } from '@/utils/cn';

const VARIANTS = {
  neutral: 'bg-surface-muted text-content',
  primary: 'bg-primary-soft text-primary-text',
  income: 'bg-income-soft text-income',
  expense: 'bg-expense-soft text-expense',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
};

/** A small label: <Badge variant="warning">Paused</Badge> */
export function Badge({ variant = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANTS[variant] ?? VARIANTS.neutral,
        className,
      )}
      {...props}
    />
  );
}
