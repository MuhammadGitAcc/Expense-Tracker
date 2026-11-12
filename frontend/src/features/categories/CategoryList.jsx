import { Lock, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

function CategoryRow({ category, onEdit, onDelete }) {
  const { t } = useTranslation();

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon icon={category.icon} color={category.color} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-content">
        {category.name}
      </span>

      {category.isDefault ? (
        <Badge variant="neutral">
          <Lock className="h-3 w-3" aria-hidden="true" />
          {t('categories.default')}
        </Badge>
      ) : (
        <Dropdown
          label={t('categories.actionsFor', { name: category.name })}
          items={[
            {
              key: 'edit',
              label: t('common.edit'),
              icon: <Pencil className="h-4 w-4" />,
              onSelect: () => onEdit(category),
            },
            { separator: true },
            {
              key: 'delete',
              label: t('common.delete'),
              icon: <Trash2 className="h-4 w-4" />,
              variant: 'danger',
              onSelect: () => onDelete(category),
            },
          ]}
        />
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-line">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The categories of one type: your own first, then the shared defaults (read only).
 * categories: array, or undefined while loading. Errors are shown by the page.
 */
export function CategoryList({ categories, isLoading, onAdd, onEdit, onDelete }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card padded={false}>
        <ListSkeleton />
      </Card>
    );
  }

  const custom = (categories ?? []).filter((category) => !category.isDefault);
  const defaults = (categories ?? []).filter((category) => category.isDefault);

  return (
    <div className="space-y-6">
      <section aria-labelledby="custom-categories">
        <h2 id="custom-categories" className="mb-2 text-sm font-semibold text-content">
          {t('categories.yours')}
        </h2>
        <Card padded={false}>
          {custom.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={t('categories.emptyTitle')}
              description={t('categories.emptyText')}
              action={
                <Button iconStart={<Plus className="h-4 w-4" />} onClick={onAdd}>
                  {t('categories.add')}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {custom.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>

      {defaults.length > 0 ? (
        <section aria-labelledby="default-categories">
          <h2 id="default-categories" className="mb-2 text-sm font-semibold text-content">
            {t('categories.defaults')}
          </h2>
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {defaults.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
