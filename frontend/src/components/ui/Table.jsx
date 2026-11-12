import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/ui/Skeleton';

const ALIGN = { start: 'text-start', end: 'text-end', center: 'text-center' };

/**
 * <Table
 *   caption={t('expenses.title')}
 *   columns={[
 *     { key: 'date', header: t('expenses.date'), sortable: true, cell: (row) => formatDate(row.date, language) },
 *     { key: 'amount', header: t('expenses.amount'), align: 'end', sortable: true,
 *       cell: (row) => <span className="amount">{formatCurrency(row.amount, row.account.currency)}</span> },
 *     { key: 'actions', header: <span className="sr-only">{t('common.actions')}</span>, align: 'end',
 *       interactive: true, cell: (row) => <Dropdown ... /> },
 *   ]}
 *   rows={expenses}
 *   loading={isLoading}
 *   sortBy={sortBy} sortOrder={sortOrder} onSort={(key, order) => ...}
 *   onRowClick={(row) => navigate(...)}
 *   empty={<EmptyState ... />}
 * />
 *
 * Column: { key, header, cell?(row), align?: start|end|center, sortable?, sortKey?, interactive?,
 *           className?, headerClassName? }
 *  - sortKey is the value sent to the API (defaults to key); onSort(sortKey, nextOrder).
 *  - interactive: clicks and keys inside the cell never trigger onRowClick (buttons, menus).
 * Wide tables scroll sideways inside their own box. On phones use a card list instead (Phase 9).
 */
export function Table({
  columns,
  rows,
  rowKey = 'id',
  caption,
  sortBy,
  sortOrder = 'desc',
  onSort,
  onRowClick,
  loading = false,
  loadingRows = 5,
  empty = null,
  className,
}) {
  if (!loading && rows.length === 0 && empty) {
    return <div className={cn('rounded-xl border border-line bg-surface', className)}>{empty}</div>;
  }

  const getKey = typeof rowKey === 'function' ? rowKey : (row) => row[rowKey];

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-line bg-surface shadow-card',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm" aria-busy={loading || undefined}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <thead className="bg-surface-muted">
          <tr>
            {columns.map((column) => {
              const sortKey = column.sortKey ?? column.key;
              const sortable = Boolean(column.sortable && onSort);
              const active = sortable && sortBy === sortKey;
              const nextOrder = active && sortOrder === 'desc' ? 'asc' : 'desc';
              const SortIcon = active
                ? sortOrder === 'asc'
                  ? ArrowUp
                  : ArrowDown
                : ChevronsUpDown;

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : sortable
                        ? 'none'
                        : undefined
                  }
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-content-muted',
                    ALIGN[column.align] ?? ALIGN.start,
                    column.headerClassName,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(sortKey, nextOrder)}
                      className={cn(
                        'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-content',
                        active && 'text-content',
                      )}
                    >
                      {column.header}
                      <SortIcon
                        className={cn('h-3.5 w-3.5', !active && 'opacity-50')}
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {loading
            ? Array.from({ length: loadingRows }, (_, index) => (
                <tr key={`loading-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <Skeleton className={cn('h-4 w-3/4', column.align === 'end' && 'ms-auto')} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={getKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (
                            event.target === event.currentTarget &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-surface-muted',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      onClick={column.interactive ? (event) => event.stopPropagation() : undefined}
                      onKeyDown={
                        column.interactive ? (event) => event.stopPropagation() : undefined
                      }
                      className={cn(
                        'px-4 py-3 text-content',
                        ALIGN[column.align] ?? ALIGN.start,
                        column.className,
                      )}
                    >
                      {column.cell ? column.cell(row) : (row[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
