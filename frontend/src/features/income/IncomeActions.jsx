import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';

/** The "three dots" menu of one income record (table row and phone card): Edit, Delete. */
export function IncomeActions({ income, onEdit, onDelete }) {
  const { t } = useTranslation();

  return (
    <Dropdown
      label={t('income.actionsFor', { name: income.source || income.category.name })}
      items={[
        {
          key: 'edit',
          label: t('common.edit'),
          icon: <Pencil className="h-4 w-4" />,
          onSelect: () => onEdit(income),
        },
        { separator: true },
        {
          key: 'delete',
          label: t('common.delete'),
          icon: <Trash2 className="h-4 w-4" />,
          variant: 'danger',
          onSelect: () => onDelete(income),
        },
      ]}
    />
  );
}
