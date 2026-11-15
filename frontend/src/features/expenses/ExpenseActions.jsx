import { Paperclip, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';
import { categoryName } from '@/utils/categoryName';

/** The "three dots" menu of one expense (table row and phone card): Edit, View receipt, Delete. */
export function ExpenseActions({ expense, onEdit, onDelete, onViewReceipt }) {
  const { t } = useTranslation();

  const items = [
    {
      key: 'edit',
      label: t('common.edit'),
      icon: <Pencil className="h-4 w-4" />,
      onSelect: () => onEdit(expense),
    },
  ];
  if (expense.receiptUrl) {
    items.push({
      key: 'receipt',
      label: t('expenses.receiptView'),
      icon: <Paperclip className="h-4 w-4" />,
      onSelect: () => onViewReceipt(expense),
    });
  }
  items.push(
    { separator: true },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'danger',
      onSelect: () => onDelete(expense),
    },
  );

  return (
    <Dropdown
      label={t('expenses.actionsFor', {
        name: expense.note || categoryName(t, expense.category.name),
      })}
      items={items}
    />
  );
}
