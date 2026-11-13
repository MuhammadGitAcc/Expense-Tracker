import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAccounts } from '@/features/accounts/useAccounts';
import { useCategories } from '@/features/categories/useCategories';
import { ExpenseCard } from '@/features/expenses/ExpenseCard';
import { EXPENSE_FORM_ID, ExpenseForm } from '@/features/expenses/ExpenseForm';
import {
  EMPTY_FILTERS,
  ExpenseFilters,
  countActiveFilters,
} from '@/features/expenses/ExpenseFilters';
import { ExpenseTable } from '@/features/expenses/ExpenseTable';
import { ReceiptViewer } from '@/features/expenses/ReceiptViewer';
import { useDeleteExpense, useExpenses } from '@/features/expenses/useExpenses';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { toast } from '@/hooks/useToast';
import { PATHS } from '@/routes/paths';
import { DEFAULT_PAGE_SIZE, MEDIA } from '@/utils/constants';
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

function CardListSkeleton() {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Card as="li" key={index} padded={false} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-16" />
        </Card>
      ))}
    </ul>
  );
}

export default function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MEDIA.mobile);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ sortBy: 'date', sortOrder: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  // null = closed, {} = create, { expense } = edit
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [receiptFor, setReceiptFor] = useState(null);

  const params = useMemo(() => {
    const result = { page, limit, ...sort };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) result[key] = value;
    });
    return result;
  }, [filters, sort, page, limit]);

  const expensesQuery = useExpenses(params);
  const accountsQuery = useAccounts();
  // Old expenses may sit in an archived account, so the filter and the total need all accounts.
  const allAccountsQuery = useAccounts({ includeArchived: true });
  const categoriesQuery = useCategories({ type: 'expense' });
  const remove = useDeleteExpense();

  const expenses = expensesQuery.data?.expenses;
  const meta = expensesQuery.data?.meta;
  const activeAccounts = accountsQuery.data?.accounts;
  const allAccounts = allAccountsQuery.data?.accounts;
  const hasFilters = countActiveFilters(filters) > 0 || filters.search !== '';

  // The API adds the amounts up without converting currencies, so the total is only shown when
  // its currency is clear: a chosen account, or a user who has accounts in one currency only.
  const totalCurrency = useMemo(() => {
    if (!allAccounts || allAccounts.length === 0) return null;
    const chosen = allAccounts.find((account) => account.id === filters.accountId);
    if (chosen) return chosen.currency;
    const currencies = new Set(allAccounts.map((account) => account.currency));
    return currencies.size === 1 ? [...currencies][0] : null;
  }, [allAccounts, filters.accountId]);

  const openEditor = (value) => {
    setSaving(false);
    setEditor(value);
  };
  const closeEditor = () => setEditor(null);

  // The floating "Add" button of the phone layout navigates here with state { openAdd: true }.
  useEffect(() => {
    if (location.state?.openAdd) {
      setSaving(false);
      setEditor({});
      // Clear the flag, so a reload or the back button does not open the form again.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  // Any change of a filter goes back to page 1. Nothing happens when nothing really changed.
  const updateFilters = (partial) => {
    const changed = Object.entries(partial).some(([key, value]) => filters[key] !== value);
    if (!changed) return;

    // The API answers 400 when "from" is after "to": move the other date along instead.
    const next = { ...partial };
    if (next.from && (next.to ?? filters.to) && next.from > (next.to ?? filters.to)) {
      next.to = next.from;
    } else if (next.to && (next.from ?? filters.from) && next.to < (next.from ?? filters.from)) {
      next.from = next.to;
    }

    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const changeSort = (sortBy, sortOrder) => {
    setSort({ sortBy, sortOrder });
    setPage(1);
  };

  const confirmDelete = () => {
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(t('expenses.deleted'));
        setToDelete(null);
        // The last row of a page was deleted: go to the page before it.
        if (page > 1 && expenses?.length === 1) setPage(page - 1);
      },
      onError: (error) => {
        setToDelete(null);
        toast.error(
          isNetworkError(error) ? t('errors.network') : getErrorMessage(error, t('errors.generic')),
        );
      },
    });
  };

  const formLoading = accountsQuery.isLoading || categoriesQuery.isLoading;
  const formFailed = accountsQuery.isError || categoriesQuery.isError;
  const needsAccount = Boolean(editor) && !editor.expense && activeAccounts?.length === 0;
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
          title={t('expenses.needAccountTitle')}
          description={t('expenses.needAccountText')}
          action={
            <Link to={PATHS.accounts} className={buttonStyles()}>
              {t('expenses.goAccounts')}
            </Link>
          }
        />
      );
    }
    return (
      <ExpenseForm
        // A new key resets the form each time the modal opens for a different expense.
        key={editor.expense?.id ?? 'new'}
        expense={editor.expense}
        accounts={activeAccounts}
        categories={categoriesQuery.data}
        onPendingChange={setSaving}
        onSaved={closeEditor}
        onViewReceipt={setReceiptFor}
      />
    );
  };

  const renderList = () => {
    if (expensesQuery.isError) return <LoadError onRetry={() => expensesQuery.refetch()} />;

    const loading = expensesQuery.isLoading;
    if (!loading && expenses?.length === 0) {
      return (
        <Card padded={false}>
          <EmptyState
            icon={Receipt}
            title={t(hasFilters ? 'expenses.noResultsTitle' : 'expenses.emptyTitle')}
            description={t(hasFilters ? 'expenses.noResultsText' : 'expenses.emptyText')}
            action={
              hasFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  {t('expenses.clearFilters')}
                </Button>
              ) : (
                <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
                  {t('expenses.add')}
                </Button>
              )
            }
          />
        </Card>
      );
    }

    if (isMobile) {
      if (loading) return <CardListSkeleton />;
      return (
        <ul className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onEdit={(value) => openEditor({ expense: value })}
              onDelete={setToDelete}
              onViewReceipt={setReceiptFor}
            />
          ))}
        </ul>
      );
    }

    return (
      <ExpenseTable
        expenses={expenses}
        loading={loading}
        sortBy={sort.sortBy}
        sortOrder={sort.sortOrder}
        onSort={changeSort}
        onEdit={(value) => openEditor({ expense: value })}
        onDelete={setToDelete}
        onViewReceipt={setReceiptFor}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t('expenses.title')}
        description={t('expenses.subtitle')}
        actions={
          <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
            {t('expenses.add')}
          </Button>
        }
      />

      <ExpenseFilters
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        categories={categoriesQuery.data}
        accounts={allAccounts}
        sortValue={`${sort.sortBy}:${sort.sortOrder}`}
        onSortChange={(value) => {
          const [sortBy, sortOrder] = value.split(':');
          changeSort(sortBy, sortOrder);
        }}
      />

      {meta && totalCurrency && meta.total > 0 ? (
        <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm text-content-muted">
          {t('expenses.total')}
          <CurrencyDisplay
            value={meta.totalAmount}
            currency={totalCurrency}
            tone="expense"
            className="text-base font-semibold"
          />
        </p>
      ) : null}

      <div
        aria-busy={expensesQuery.isPlaceholderData || undefined}
        className={expensesQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
      >
        {renderList()}
      </div>

      {meta && meta.total > 0 ? (
        <Pagination
          className="mt-4"
          page={page}
          limit={limit}
          total={meta.total}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      ) : null}

      <Modal
        open={Boolean(editor)}
        onClose={saving ? undefined : closeEditor}
        size="lg"
        title={editor?.expense ? t('expenses.edit') : t('expenses.add')}
        footer={
          <>
            <Button variant="outline" disabled={saving} onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={EXPENSE_FORM_ID} loading={saving} disabled={!formReady}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editor ? renderEditorBody() : null}
      </Modal>

      <Modal
        open={Boolean(receiptFor)}
        onClose={() => setReceiptFor(null)}
        size="lg"
        title={t('expenses.receiptTitle')}
      >
        {receiptFor ? <ReceiptViewer expenseId={receiptFor.id} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('expenses.deleteTitle')}
        description={
          toDelete
            ? t('expenses.deleteText', {
                amount: formatCurrency(toDelete.amount, toDelete.account.currency, i18n.language),
                account: toDelete.account.name,
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
