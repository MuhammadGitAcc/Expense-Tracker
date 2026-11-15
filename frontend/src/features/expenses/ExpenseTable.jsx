import { Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { ExpenseActions } from '@/features/expenses/ExpenseActions';
import { categoryName } from '@/utils/categoryName';
import { formatDate } from '@/utils/formatDate';

const MAX_TAGS_SHOWN = 3;

/**
 * Expenses as a table (tablet and desktop; phones use ExpenseCard).
 * Sortable columns send the same names as the API: onSort('date' | 'amount', 'asc' | 'desc').
 * A click on a row opens the editor.
 */
export function ExpenseTable({
  expenses,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  onViewReceipt,
}) {
  const { t, i18n } = useTranslation();

  const columns = [
    {
      key: 'date',
      header: t('expenses.date'),
      sortable: true,
      className: 'whitespace-nowrap text-content-muted',
      cell: (expense) => <span className="amount">{formatDate(expense.date, i18n.language)}</span>,
    },
    {
      key: 'category',
      header: t('expenses.category'),
      cell: (expense) => (
        <div className="flex items-center gap-2">
          <CategoryIcon icon={expense.category.icon} color={expense.category.color} size="sm" />
          <span className="truncate font-medium text-content">
            {categoryName(t, expense.category.name)}
          </span>
        </div>
      ),
    },
    {
      key: 'details',
      header: t('expenses.note'),
      cell: (expense) => (
        <div className="flex max-w-xs flex-wrap items-center gap-1.5">
          {expense.note ? (
            <span className="truncate text-content">{expense.note}</span>
          ) : (
            <span className="text-content-muted">—</span>
          )}
          {expense.tags.slice(0, MAX_TAGS_SHOWN).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          {expense.tags.length > MAX_TAGS_SHOWN ? (
            <Badge>+{expense.tags.length - MAX_TAGS_SHOWN}</Badge>
          ) : null}
          {expense.recurringId ? <Badge variant="primary">{t('expenses.recurring')}</Badge> : null}
          {expense.receiptUrl ? (
            <>
              <Paperclip className="h-4 w-4 text-content-muted" aria-hidden="true" />
              <span className="sr-only">{t('expenses.hasReceipt')}</span>
            </>
          ) : null}
        </div>
      ),
    },
    {
      key: 'account',
      header: t('expenses.account'),
      className: 'text-content-muted',
      cell: (expense) => expense.account.name,
    },
    {
      key: 'amount',
      header: t('expenses.amount'),
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap font-semibold',
      cell: (expense) => (
        <CurrencyDisplay
          value={expense.amount}
          currency={expense.account.currency}
          tone="expense"
        />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('expenses.actions')}</span>,
      align: 'end',
      interactive: true,
      cell: (expense) => (
        <ExpenseActions
          expense={expense}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewReceipt={onViewReceipt}
        />
      ),
    },
  ];

  return (
    <Table
      caption={t('expenses.title')}
      columns={columns}
      rows={expenses ?? []}
      loading={loading}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onEdit}
    />
  );
}
