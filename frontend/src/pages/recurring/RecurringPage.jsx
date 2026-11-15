import { useMemo, useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAccounts } from '@/features/accounts/useAccounts';
import { useCategories } from '@/features/categories/useCategories';
import { RECURRING_FORM_ID, RecurringForm } from '@/features/recurring/RecurringForm';
import { RecurringList, RecurringListSkeleton } from '@/features/recurring/RecurringList';
import {
  useDeleteRecurring,
  usePauseRecurring,
  useRecurringList,
  useResumeRecurring,
} from '@/features/recurring/useRecurring';
import { toast } from '@/hooks/useToast';
import { PATHS } from '@/routes/paths';
import { categoryName } from '@/utils/categoryName';
import { formatCurrency } from '@/utils/formatCurrency';

function LoadError({ onRetry }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('errors.somethingWrong')}
      description={t('errors.loadFailed')}
      action={<Button onClick={onRetry}>{t('common.tryAgain')}</Button>}
    />
  );
}

export default function RecurringPage() {
  const { t, i18n } = useTranslation();

  const [type, setType] = useState('');
  const [status, setStatus] = useState(''); // '' | 'active' | 'paused'
  // null = closed, {} = create, { recurring } = edit
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const params = useMemo(() => {
    const result = {};
    if (type) result.type = type;
    if (status) result.isActive = status === 'active';
    return result;
  }, [type, status]);
  const hasFilters = Boolean(type || status);

  const listQuery = useRecurringList(params);
  const accountsQuery = useAccounts();
  // Templates can point at archived accounts, so the hint needs all accounts.
  const allAccountsQuery = useAccounts({ includeArchived: true });
  const categoriesQuery = useCategories();
  const remove = useDeleteRecurring();
  const pause = usePauseRecurring();
  const resume = useResumeRecurring();

  const items = listQuery.data?.items;
  const activeAccounts = accountsQuery.data?.accounts;
  const archivedAccountIds = useMemo(
    () =>
      new Set(
        (allAccountsQuery.data?.accounts ?? [])
          .filter((account) => account.isArchived)
          .map((account) => account.id),
      ),
    [allAccountsQuery.data],
  );

  const openEditor = (value) => {
    setSaving(false);
    setEditor(value);
  };
  const closeEditor = () => setEditor(null);

  const showError = (error) =>
    toast.error(
      isNetworkError(error) ? t('errors.network') : getErrorMessage(error, t('errors.generic')),
    );

  const toggleActive = (item) => {
    setBusyId(item.id);
    const mutation = item.isActive ? pause : resume;
    mutation.mutate(item.id, {
      onSuccess: () =>
        toast.success(t(item.isActive ? 'recurring.pausedToast' : 'recurring.resumedToast')),
      onError: showError, // for example: resuming a schedule that has already ended (400)
      onSettled: () => setBusyId(null),
    });
  };

  const confirmDelete = () => {
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(t('recurring.deleted'));
        setToDelete(null);
      },
      onError: (error) => {
        setToDelete(null);
        showError(error);
      },
    });
  };

  const formLoading = accountsQuery.isLoading || categoriesQuery.isLoading;
  const formFailed = accountsQuery.isError || categoriesQuery.isError;
  const needsAccount = Boolean(editor) && !editor.recurring && activeAccounts?.length === 0;
  const formReady = Boolean(editor) && !formLoading && !formFailed && !needsAccount;

  const renderEditorBody = () => {
    if (formLoading) return <LoadingScreen fullScreen={false} className="min-h-[30vh]" />;
    if (formFailed) {
      return (
        <LoadError
          onRetry={() => {
            accountsQuery.refetch();
            categoriesQuery.refetch();
          }}
        />
      );
    }
    if (needsAccount) {
      return (
        <EmptyState
          title={t('recurring.needAccountTitle')}
          description={t('recurring.needAccountText')}
          action={
            <Link to={PATHS.accounts} className={buttonStyles()}>
              {t('recurring.goAccounts')}
            </Link>
          }
        />
      );
    }
    return (
      <RecurringForm
        // A new key resets the form each time the modal opens for a different template.
        key={editor.recurring?.id ?? 'new'}
        recurring={editor.recurring}
        accounts={activeAccounts}
        categories={categoriesQuery.data}
        onPendingChange={setSaving}
        onSaved={closeEditor}
      />
    );
  };

  const renderList = () => {
    if (listQuery.isError) return <LoadError onRetry={() => listQuery.refetch()} />;
    if (listQuery.isLoading) return <RecurringListSkeleton />;

    if (items.length === 0) {
      return (
        <Card padded={false}>
          <EmptyState
            icon={Repeat}
            title={t(hasFilters ? 'recurring.noResultsTitle' : 'recurring.emptyTitle')}
            description={t(hasFilters ? 'recurring.noResultsText' : 'recurring.emptyText')}
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setType('');
                    setStatus('');
                  }}
                >
                  {t('recurring.clearFilters')}
                </Button>
              ) : (
                <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
                  {t('recurring.add')}
                </Button>
              )
            }
          />
        </Card>
      );
    }

    return (
      <RecurringList
        items={items}
        archivedAccountIds={archivedAccountIds}
        busyId={busyId}
        onEdit={(value) => openEditor({ recurring: value })}
        onToggle={toggleActive}
        onDelete={setToDelete}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t('recurring.title')}
        description={t('recurring.subtitle')}
        actions={
          <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
            {t('recurring.add')}
          </Button>
        }
      />

      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <Select
          label={t('recurring.type')}
          value={type}
          onChange={(event) => setType(event.target.value)}
          options={[
            { value: '', label: t('recurring.allTypes') },
            { value: 'expense', label: t('recurring.types.expense') },
            { value: 'income', label: t('recurring.types.income') },
          ]}
        />
        <Select
          label={t('recurring.statusLabel')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: '', label: t('recurring.allStatuses') },
            { value: 'active', label: t('recurring.active') },
            { value: 'paused', label: t('recurring.paused') },
          ]}
        />
      </div>

      <div
        aria-busy={listQuery.isPlaceholderData || undefined}
        className={listQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
      >
        {renderList()}
      </div>

      <Modal
        open={Boolean(editor)}
        onClose={saving ? undefined : closeEditor}
        size="lg"
        title={editor?.recurring ? t('recurring.edit') : t('recurring.add')}
        footer={
          <>
            <Button variant="outline" disabled={saving} onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={RECURRING_FORM_ID} loading={saving} disabled={!formReady}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editor ? renderEditorBody() : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('recurring.deleteTitle')}
        description={
          toDelete
            ? t('recurring.deleteText', {
                name: toDelete.note || categoryName(t, toDelete.category.name),
                amount: formatCurrency(toDelete.amount, toDelete.account.currency, i18n.language),
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
