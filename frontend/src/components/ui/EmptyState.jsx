import { Inbox } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Shown when a list has nothing to show.
 * <EmptyState title="No expenses yet" description="Add your first one." action={<Button>Add expense</Button>} />
 * icon: a lucide component (default: Inbox).
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-text"
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" />
      </span>
      {title ? <h3 className="mt-4 text-base font-semibold text-content">{title}</h3> : null}
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-content-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
