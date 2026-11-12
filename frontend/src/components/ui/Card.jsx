import { cn } from '@/utils/cn';

/** A white (dark: slate) panel. padded={false} when the content brings its own spacing (tables). */
export function Card({ as: Tag = 'div', padded = true, className, ...props }) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-line bg-surface shadow-card',
        padded && 'p-4 sm:p-6',
        className,
      )}
      {...props}
    />
  );
}

/** Title, optional description and an optional action (a button) at the end. */
export function CardHeader({ title, description, action, headingAs: Heading = 'h2', className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {title ? (
          <Heading className="truncate text-base font-semibold text-content">{title}</Heading>
        ) : null}
        {description ? <p className="mt-0.5 text-sm text-content-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
