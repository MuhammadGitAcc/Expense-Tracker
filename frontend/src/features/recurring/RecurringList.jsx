import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { categoryName } from '@/utils/categoryName';
import { formatDate } from '@/utils/formatDate';

/** The cards while the first load runs. */
export function RecurringListSkeleton() {
  return (
    <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card as="li" key={index} className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-full" />
        </Card>
      ))}
    </ul>
  );
}

function RecurringCard({ item, accountArchived, busy, onEdit, onToggle, onDelete }) {
  const { t, i18n } = useTranslation();
  const name = item.note || categoryName(t, item.category.name);
  const isExpense = item.type === 'expense';

  return (
    <Card as="li" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <CategoryIcon icon={item.category.icon} color={item.category.color} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-content">
            {categoryName(t, item.category.name)}
          </h3>
          <p className="truncate text-xs text-content-muted">
            {item.note ? `${item.note} · ` : ''}
            {item.account.name}
          </p>
        </div>
        <Badge variant={item.isActive ? 'success' : 'warning'}>
          {t(item.isActive ? 'recurring.active' : 'recurring.paused')}
        </Badge>
        <Dropdown
          label={t('recurring.actionsFor', { name })}
          items={[
            {
              key: 'edit',
              label: t('common.edit'),
              icon: <Pencil className="h-4 w-4" />,
              onSelect: () => onEdit(item),
            },
            {
              key: 'toggle',
              label: t(item.isActive ? 'recurring.pause' : 'recurring.resume'),
              icon: item.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />,
              disabled: busy,
              onSelect: () => onToggle(item),
            },
            { separator: true },
            {
              key: 'delete',
              label: t('common.delete'),
              icon: <Trash2 className="h-4 w-4" />,
              variant: 'danger',
              onSelect: () => onDelete(item),
            },
          ]}
        />
      </div>

      <div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <CurrencyDisplay
            value={item.amount}
            currency={item.account.currency}
            tone={isExpense ? 'expense' : 'income'}
            showSign
            className="text-2xl font-semibold"
          />
          <span className="text-sm text-content-muted">
            {t(`recurring.frequency.${item.frequency}`)}
          </span>
        </p>
        <p className="mt-1 text-xs text-content-muted">{t(`recurring.types.${item.type}`)}</p>
      </div>

      <dl className="space-y-1 text-xs text-content-muted">
        <div className="flex justify-between gap-2">
          <dt>{t('recurring.nextRun')}</dt>
          <dd className="font-medium text-content">
            {item.isActive
              ? formatDate(item.nextRunDate, i18n.language)
              : t('recurring.notScheduled')}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>{t('recurring.endDate')}</dt>
          <dd className="font-medium text-content">
            {item.endDate ? formatDate(item.endDate, i18n.language) : t('recurring.noEnd')}
          </dd>
        </div>
      </dl>

      {!item.isActive && accountArchived ? (
        <p role="note" className="rounded-lg bg-warning-soft p-2.5 text-xs text-warning">
          {t('recurring.archivedAccountHint', { account: item.account.name })}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * The templates as a grid of cards.
 * archivedAccountIds: ids of archived accounts (to show the hint on a paused template).
 * busyId: the template whose pause or resume request is running.
 */
export function RecurringList({ items, archivedAccountIds, busyId, onEdit, onToggle, onDelete }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <RecurringCard
          key={item.id}
          item={item}
          accountArchived={archivedAccountIds.has(item.account.id)}
          busy={busyId === item.id}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
