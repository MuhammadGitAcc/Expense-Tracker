import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Card } from '@/components/ui/Card';
import { IncomeActions } from '@/features/income/IncomeActions';
import { categoryName } from '@/utils/categoryName';
import { formatDate } from '@/utils/formatDate';

/** One income record on a phone (an <li>: put it inside a <ul>). Tapping the card opens the editor. */
export function IncomeCard({ income, onEdit, onDelete }) {
  const { t, i18n } = useTranslation();

  // The category is the title when there is no source, so it is not repeated underneath.
  const details = [
    income.source ? categoryName(t, income.category.name) : null,
    formatDate(income.date, i18n.language),
    income.account.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card as="li" padded={false} className="flex items-center gap-2 p-3">
      <button
        type="button"
        onClick={() => onEdit(income)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start"
      >
        <CategoryIcon icon={income.category.icon} color={income.category.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-content">
            {income.source || categoryName(t, income.category.name)}
          </span>
          <span className="block truncate text-xs text-content-muted">{details}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold">
          <CurrencyDisplay value={income.amount} currency={income.account.currency} tone="income" />
        </span>
      </button>
      <IncomeActions income={income} onEdit={onEdit} onDelete={onDelete} />
    </Card>
  );
}
