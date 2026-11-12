import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AccountTypeIcon } from '@/components/common/AccountTypeIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { cn } from '@/utils/cn';

/**
 * One account as a card (an <li>: put it inside a <ul>).
 * busy: the archive request of this account is running (the menu item is disabled).
 */
export function AccountCard({ account, busy = false, onEdit, onToggleArchive, onDelete }) {
  const { t } = useTranslation();
  const negative = Number(account.balance) < 0;

  return (
    <Card as="li" className={cn('flex flex-col gap-4', account.isArchived && 'border-dashed')}>
      <div className="flex items-start gap-3">
        <AccountTypeIcon type={account.type} color={account.color} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-content">{account.name}</h3>
          <p className="text-xs text-content-muted">
            {t(`accounts.types.${account.type}`)} ·{' '}
            <span className="amount">{account.currency}</span>
          </p>
        </div>
        <Dropdown
          label={t('accounts.actionsFor', { name: account.name })}
          items={[
            {
              key: 'edit',
              label: t('common.edit'),
              icon: <Pencil className="h-4 w-4" />,
              onSelect: () => onEdit(account),
            },
            {
              key: 'archive',
              label: account.isArchived ? t('accounts.restore') : t('accounts.archive'),
              icon: account.isArchived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              ),
              disabled: busy,
              onSelect: () => onToggleArchive(account),
            },
            { separator: true },
            {
              key: 'delete',
              label: t('common.delete'),
              icon: <Trash2 className="h-4 w-4" />,
              variant: 'danger',
              onSelect: () => onDelete(account),
            },
          ]}
        />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-content-muted">{t('accounts.balance')}</p>
          <p className="mt-0.5 truncate text-2xl font-semibold text-content">
            <CurrencyDisplay
              value={account.balance}
              currency={account.currency}
              tone={negative ? 'expense' : 'neutral'}
            />
          </p>
        </div>
        {account.isArchived ? <Badge variant="warning">{t('accounts.archived')}</Badge> : null}
      </div>
    </Card>
  );
}
