import { Pencil, Trash2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { BudgetProgress } from '@/features/budgets/BudgetProgress';
import { categoryName } from '@/utils/categoryName';

const STATUS_BADGES = { ok: 'success', warning: 'warning', exceeded: 'danger' };

/**
 * One budget as a card (an <li>: put it inside a <ul>).
 * currency: the profile currency (budgets have no currency of their own; no conversion is done).
 */
export function BudgetCard({ budget, currency, onEdit, onDelete }) {
  const { t } = useTranslation();
  const name = budget.category ? categoryName(t, budget.category.name) : t('budgets.overall');
  const exceeded = budget.status === 'exceeded';
  // "remaining" is negative when over the limit: show it without the sign, with "Over by".
  const remaining = String(budget.remaining).replace(/^-/, '');

  return (
    <Card as="li" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {budget.category ? (
          <CategoryIcon icon={budget.category.icon} color={budget.category.color} />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-content">{name}</h3>
          <p className="text-xs text-content-muted">
            {t('budgets.alertAt', { percent: budget.alertThreshold })}
          </p>
        </div>
        <Badge variant={STATUS_BADGES[budget.status] ?? 'neutral'}>
          {t(`budgets.status.${budget.status}`)}
        </Badge>
        <Dropdown
          label={t('budgets.actionsFor', { name })}
          items={[
            {
              key: 'edit',
              label: t('common.edit'),
              icon: <Pencil className="h-4 w-4" />,
              onSelect: () => onEdit(budget),
            },
            { separator: true },
            {
              key: 'delete',
              label: t('common.delete'),
              icon: <Trash2 className="h-4 w-4" />,
              variant: 'danger',
              onSelect: () => onDelete(budget),
            },
          ]}
        />
      </div>

      <div>
        <p className="mb-2 flex flex-wrap items-baseline gap-x-1 text-sm text-content-muted">
          <CurrencyDisplay
            value={budget.spent}
            currency={currency}
            tone={exceeded ? 'expense' : 'neutral'}
            className="text-lg font-semibold text-content"
          />
          <span>{t('budgets.ofLimit')}</span>
          <CurrencyDisplay value={budget.amount} currency={currency} />
        </p>
        <BudgetProgress
          percentUsed={budget.percentUsed}
          status={budget.status}
          label={t('budgets.progressFor', { name })}
        />
        <p className="mt-2 text-xs text-content-muted">
          {exceeded ? t('budgets.overBy') : t('budgets.remaining')}{' '}
          <CurrencyDisplay
            value={remaining}
            currency={currency}
            tone={exceeded ? 'expense' : 'neutral'}
            className="font-medium"
          />
        </p>
      </div>
    </Card>
  );
}
