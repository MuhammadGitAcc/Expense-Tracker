import { Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Card } from '@/components/ui/Card';
import { ExpenseActions } from '@/features/expenses/ExpenseActions';
import { categoryName } from '@/utils/categoryName';
import { formatDate } from '@/utils/formatDate';

/** One expense on a phone (an <li>: put it inside a <ul>). Tapping the card opens the editor. */
export function ExpenseCard({ expense, onEdit, onDelete, onViewReceipt }) {
  const { t, i18n } = useTranslation();

  // The category is the title when there is no note, so it is not repeated underneath.
  const details = [
    expense.note ? categoryName(t, expense.category.name) : null,
    formatDate(expense.date, i18n.language),
    expense.account.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card as="li" padded={false} className="flex items-center gap-2 p-3">
      <button
        type="button"
        onClick={() => onEdit(expense)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start"
      >
        <CategoryIcon icon={expense.category.icon} color={expense.category.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-content">
            {expense.note || categoryName(t, expense.category.name)}
          </span>
          <span className="flex items-center gap-1 text-xs text-content-muted">
            <span className="truncate">{details}</span>
            {expense.receiptUrl ? (
              <>
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">{t('expenses.hasReceipt')}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold">
          <CurrencyDisplay
            value={expense.amount}
            currency={expense.account.currency}
            tone="expense"
          />
        </span>
      </button>
      <ExpenseActions
        expense={expense}
        onEdit={onEdit}
        onDelete={onDelete}
        onViewReceipt={onViewReceipt}
      />
    </Card>
  );
}
