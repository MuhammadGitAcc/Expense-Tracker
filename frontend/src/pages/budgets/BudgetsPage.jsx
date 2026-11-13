import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PiggyBank, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { BudgetCard } from '@/features/budgets/BudgetCard';
import { BUDGET_FORM_ID, BudgetForm } from '@/features/budgets/BudgetForm';
import { useBudgets, useDeleteBudget } from '@/features/budgets/useBudgets';
import { useCategories } from '@/features/categories/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatMonthYear } from '@/utils/formatDate';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

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

function GridSkeleton() {
  return (
    <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card as="li" key={index} className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </Card>
      ))}
    </ul>
  );
}

export default function BudgetsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  // Budgets have no currency of their own and nothing is converted: the profile currency is used.
  const currency = (user?.currency ?? 'USD').toUpperCase();

  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  // null = closed, {} = create, { budget } = edit
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const budgetsQuery = useBudgets(period);
  const categoriesQuery = useCategories({ type: 'expense' });
  const remove = useDeleteBudget();

  const budgets = budgetsQuery.data?.budgets;
  const hasOverall = Boolean(budgets?.some((budget) => !budget.category));
  const takenCategoryIds = useMemo(
    () => (budgets ?? []).flatMap((budget) => (budget.category ? [budget.category.id] : [])),
    [budgets],
  );

  const monthLabel = formatMonthYear(period.year, period.month, i18n.language);
  const now = new Date();
  const isCurrentMonth = period.month === now.getMonth() + 1 && period.year === now.getFullYear();

  const shiftMonth = (delta) =>
    setPeriod(({ month, year }) => {
      const index = year * 12 + (month - 1) + delta;
      const nextYear = Math.floor(index / 12);
      if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) return { month, year };
      return { month: (index % 12) + 1, year: nextYear };
    });
  const goToToday = () => setPeriod({ month: now.getMonth() + 1, year: now.getFullYear() });

  const openEditor = (value) => {
    setSaving(false);
    setEditor(value);
  };
  const closeEditor = () => setEditor(null);

  const confirmDelete = () => {
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(t('budgets.deleted'));
        setToDelete(null);
      },
      onError: (error) => {
        setToDelete(null);
        toast.error(
          isNetworkError(error) ? t('errors.network') : getErrorMessage(error, t('errors.generic')),
        );
      },
    });
  };

  const formLoading = categoriesQuery.isLoading;
  const formFailed = categoriesQuery.isError;
  const formReady = Boolean(editor) && !formLoading && !formFailed;

  const renderEditorBody = () => {
    if (formLoading) return <LoadingScreen fullScreen={false} className="min-h-[30vh]" />;
    if (formFailed) return <LoadError onRetry={() => categoriesQuery.refetch()} />;
    return (
      <BudgetForm
        // A new key resets the form each time the modal opens for a different budget.
        key={editor.budget?.id ?? 'new'}
        budget={editor.budget}
        month={period.month}
        year={period.year}
        categories={categoriesQuery.data}
        takenCategoryIds={takenCategoryIds}
        hasOverall={hasOverall}
        currency={currency}
        onPendingChange={setSaving}
        onSaved={closeEditor}
      />
    );
  };

  const renderList = () => {
    if (budgetsQuery.isError) return <LoadError onRetry={() => budgetsQuery.refetch()} />;
    if (budgetsQuery.isLoading) return <GridSkeleton />;

    if (budgets.length === 0) {
      return (
        <Card padded={false}>
          <EmptyState
            icon={PiggyBank}
            title={t('budgets.emptyTitle', { month: monthLabel })}
            description={t('budgets.emptyText')}
            action={
              <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
                {t('budgets.add')}
              </Button>
            }
          />
        </Card>
      );
    }

    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            currency={currency}
            onEdit={(value) => openEditor({ budget: value })}
            onDelete={setToDelete}
          />
        ))}
      </ul>
    );
  };

  return (
    <>
      <PageHeader
        title={t('budgets.title')}
        description={t('budgets.subtitle')}
        actions={
          <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
            {t('budgets.add')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={t('budgets.previousMonth')}
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <h2
          aria-live="polite"
          className="min-w-36 text-center text-base font-semibold text-content"
        >
          {monthLabel}
        </h2>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('budgets.nextMonth')}
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        {isCurrentMonth ? null : (
          <Button variant="ghost" size="sm" onClick={goToToday}>
            {t('budgets.thisMonth')}
          </Button>
        )}
      </div>

      <div
        aria-busy={budgetsQuery.isPlaceholderData || undefined}
        className={budgetsQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
      >
        {renderList()}
      </div>

      <Modal
        open={Boolean(editor)}
        onClose={saving ? undefined : closeEditor}
        title={editor?.budget ? t('budgets.edit') : t('budgets.add')}
        footer={
          <>
            <Button variant="outline" disabled={saving} onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={BUDGET_FORM_ID} loading={saving} disabled={!formReady}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editor ? renderEditorBody() : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('budgets.deleteTitle')}
        description={
          toDelete
            ? t('budgets.deleteText', {
                name: toDelete.category ? toDelete.category.name : t('budgets.overall'),
                amount: formatCurrency(toDelete.amount, currency, i18n.language),
                month: monthLabel,
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
