import { cn } from '@/utils/cn';

/**
 * The title row at the top of every page: the H1, an optional description and the main actions.
 * <PageHeader title={t('expenses.title')} description={t('expenses.subtitle')}
 *   actions={<Button iconStart={<Plus className="h-4 w-4" />}>{t('expenses.add')}</Button>} />
 * Phone: the actions go under the title. Larger screens: next to it, at the end.
 */
export function PageHeader({ title, description, actions, className }) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-content">{title}</h1>
        {description ? <p className="mt-1 text-sm text-content-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
