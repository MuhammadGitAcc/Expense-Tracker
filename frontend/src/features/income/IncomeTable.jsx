import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { IncomeActions } from '@/features/income/IncomeActions';
import { categoryName } from '@/utils/categoryName';
import { formatDate } from '@/utils/formatDate';

/**
 * Income as a table (tablet and desktop; phones use IncomeCard).
 * Sortable columns send the same names as the API: onSort('date' | 'amount', 'asc' | 'desc').
 * A click on a row opens the editor.
 */
export function IncomeTable({ incomes, loading, sortBy, sortOrder, onSort, onEdit, onDelete }) {
  const { t, i18n } = useTranslation();

  const columns = [
    {
      key: 'date',
      header: t('income.date'),
      sortable: true,
      className: 'whitespace-nowrap text-content-muted',
      cell: (income) => <span className="amount">{formatDate(income.date, i18n.language)}</span>,
    },
    {
      key: 'category',
      header: t('income.category'),
      cell: (income) => (
        <div className="flex items-center gap-2">
          <CategoryIcon icon={income.category.icon} color={income.category.color} size="sm" />
          <span className="truncate font-medium text-content">
            {categoryName(t, income.category.name)}
          </span>
        </div>
      ),
    },
    {
      key: 'details',
      header: t('income.source'),
      cell: (income) => (
        <div className="flex max-w-xs flex-wrap items-center gap-1.5">
          {income.source ? (
            <span className="truncate text-content">{income.source}</span>
          ) : (
            <span className="text-content-muted">—</span>
          )}
          {income.note ? (
            <span className="truncate text-xs text-content-muted">{income.note}</span>
          ) : null}
          {income.recurringId ? <Badge variant="primary">{t('income.recurring')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'account',
      header: t('income.account'),
      className: 'text-content-muted',
      cell: (income) => income.account.name,
    },
    {
      key: 'amount',
      header: t('income.amount'),
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap font-semibold',
      cell: (income) => (
        <CurrencyDisplay value={income.amount} currency={income.account.currency} tone="income" />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('income.actions')}</span>,
      align: 'end',
      interactive: true,
      cell: (income) => <IncomeActions income={income} onEdit={onEdit} onDelete={onDelete} />,
    },
  ];

  return (
    <Table
      caption={t('income.title')}
      columns={columns}
      rows={incomes ?? []}
      loading={loading}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onEdit}
    />
  );
}
