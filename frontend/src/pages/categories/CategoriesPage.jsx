import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { CATEGORY_FORM_ID, CategoryForm } from '@/features/categories/CategoryForm';
import { CategoryList } from '@/features/categories/CategoryList';
import { useCategories, useDeleteCategory } from '@/features/categories/useCategories';
import { toast } from '@/hooks/useToast';

// Expenses first: that is what people manage most.
const TYPES = ['expense', 'income'];

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [type, setType] = useState('expense');
  // null = closed, {} = create, { category } = edit
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const { data: categories, isLoading, isError, refetch } = useCategories({ type });
  const remove = useDeleteCategory();

  const openEditor = (value) => {
    setSaving(false);
    setEditor(value);
  };
  const closeEditor = () => setEditor(null);

  const confirmDelete = () => {
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(t('categories.deleted'));
        setToDelete(null);
      },
      onError: (error) => {
        setToDelete(null);
        // For example: "This category is used by 3 transaction(s). Move or delete them first".
        toast.error(
          isNetworkError(error) ? t('errors.network') : getErrorMessage(error, t('errors.generic')),
        );
      },
    });
  };

  return (
    <>
      <PageHeader
        title={t('categories.title')}
        description={t('categories.subtitle')}
        actions={
          <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
            {t('categories.add')}
          </Button>
        }
      />

      <Tabs
        idPrefix="categories"
        ariaLabel={t('categories.title')}
        value={type}
        onChange={setType}
        tabs={TYPES.map((value) => ({ id: value, label: t(`categories.types.${value}`) }))}
      />

      <TabPanel idPrefix="categories" id={type} value={type}>
        {isError ? (
          <EmptyState
            title={t('errors.somethingWrong')}
            description={t('errors.loadFailed')}
            action={<Button onClick={() => refetch()}>{t('common.tryAgain')}</Button>}
          />
        ) : (
          <CategoryList
            categories={categories}
            isLoading={isLoading}
            onAdd={() => openEditor({})}
            onEdit={(category) => openEditor({ category })}
            onDelete={setToDelete}
          />
        )}
      </TabPanel>

      <Modal
        open={Boolean(editor)}
        onClose={saving ? undefined : closeEditor}
        title={editor?.category ? t('categories.edit') : t('categories.add')}
        footer={
          <>
            <Button variant="outline" disabled={saving} onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={CATEGORY_FORM_ID} loading={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editor ? (
          <CategoryForm
            // A new key resets the form each time the modal opens for a different category.
            key={editor.category?.id ?? `new-${type}`}
            category={editor.category}
            defaultType={type}
            onPendingChange={setSaving}
            onSaved={(saved) => {
              closeEditor();
              // Show the tab of the saved category (the type can be chosen in the form).
              if (saved?.type) setType(saved.type);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('categories.deleteTitle')}
        description={t('categories.deleteText', { name: toDelete?.name })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
