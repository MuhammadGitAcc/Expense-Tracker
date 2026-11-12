import { useMemo, useState } from 'react';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage, getErrorStatus, isNetworkError } from '@/api/axiosClient';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { ACCOUNT_FORM_ID, AccountForm } from '@/features/accounts/AccountForm';
import { AccountList, AccountTotals } from '@/features/accounts/AccountList';
import { TRANSFER_FORM_ID, TransferForm } from '@/features/accounts/TransferForm';
import { TransferList } from '@/features/accounts/TransferList';
import {
  useAccountTransfers,
  useAccounts,
  useArchiveAccount,
  useDeleteAccount,
} from '@/features/accounts/useAccounts';
import { toast } from '@/hooks/useToast';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

const TABS = ['accounts', 'transfers'];

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

export default function AccountsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('accounts');
  const [showArchived, setShowArchived] = useState(false);
  // null = closed, {} = create, { account } = edit
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const accountsQuery = useAccounts({ includeArchived: showArchived });
  // The history names archived accounts too, so it needs the list WITH archived accounts.
  const lookupQuery = useAccounts({ includeArchived: true, enabled: tab === 'transfers' });
  const transfersQuery = useAccountTransfers({ page, limit, enabled: tab === 'transfers' });
  const archive = useArchiveAccount();
  const remove = useDeleteAccount();

  const accounts = accountsQuery.data?.accounts;
  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((account) => !account.isArchived),
    [accounts],
  );
  const accountsById = useMemo(
    () => new Map((lookupQuery.data?.accounts ?? []).map((account) => [account.id, account])),
    [lookupQuery.data],
  );

  // A transfer needs two active accounts with the same currency.
  const canTransfer = useMemo(() => {
    const counts = {};
    activeAccounts.forEach((account) => {
      counts[account.currency] = (counts[account.currency] ?? 0) + 1;
    });
    return Object.values(counts).some((count) => count >= 2);
  }, [activeAccounts]);

  const openEditor = (value) => {
    setSaving(false);
    setEditor(value);
  };
  const closeEditor = () => setEditor(null);

  const openTransfer = () => {
    if (!canTransfer) {
      toast.info(t('accounts.transferNeedTwo'));
      return;
    }
    setTransferSaving(false);
    setTransferOpen(true);
  };
  const closeTransfer = () => setTransferOpen(false);

  const toggleArchive = (account) => {
    archive.mutate(
      { id: account.id, archive: !account.isArchived },
      {
        onSuccess: () =>
          toast.success(
            t(account.isArchived ? 'accounts.restoredToast' : 'accounts.archivedToast', {
              name: account.name,
            }),
          ),
        onError: (error) =>
          toast.error(
            isNetworkError(error)
              ? t('errors.network')
              : getErrorMessage(error, t('errors.generic')),
          ),
      },
    );
  };

  const confirmDelete = () => {
    const { id, name } = toDelete;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(t('accounts.deleted'));
        setToDelete(null);
      },
      onError: (error) => {
        setToDelete(null);
        if (isNetworkError(error)) {
          toast.error(t('errors.network'));
        } else if (getErrorStatus(error) === 409) {
          // The account has records: suggest the archive (the server text is English only).
          toast.error(t('accounts.deleteBlocked', { name }));
        } else {
          toast.error(getErrorMessage(error, t('errors.generic')));
        }
      },
    });
  };

  return (
    <>
      <PageHeader
        title={t('accounts.title')}
        description={t('accounts.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              iconStart={<ArrowLeftRight className="h-4 w-4" />}
              onClick={openTransfer}
            >
              {t('accounts.transfer')}
            </Button>
            <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => openEditor({})}>
              {t('accounts.add')}
            </Button>
          </>
        }
      />

      <Tabs
        idPrefix="accounts"
        ariaLabel={t('accounts.title')}
        value={tab}
        onChange={setTab}
        tabs={TABS.map((id) => ({
          id,
          label: t(id === 'accounts' ? 'accounts.tabAccounts' : 'accounts.tabTransfers'),
        }))}
      />

      <TabPanel idPrefix="accounts" id="accounts" value={tab}>
        {accountsQuery.isError ? (
          <LoadError onRetry={() => accountsQuery.refetch()} />
        ) : (
          <>
            <AccountTotals
              totals={accountsQuery.data?.totalsByCurrency}
              isLoading={accountsQuery.isLoading}
            />

            <div className="mb-4 flex justify-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-content">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="h-4 w-4 rounded border-line accent-primary"
                />
                {t('accounts.showArchived')}
              </label>
            </div>

            <AccountList
              accounts={accounts}
              isLoading={accountsQuery.isLoading}
              busyId={archive.isPending ? archive.variables?.id : null}
              onAdd={() => openEditor({})}
              onEdit={(account) => openEditor({ account })}
              onToggleArchive={toggleArchive}
              onDelete={setToDelete}
            />
          </>
        )}
      </TabPanel>

      <TabPanel idPrefix="accounts" id="transfers" value={tab}>
        {transfersQuery.isError || lookupQuery.isError ? (
          <LoadError
            onRetry={() => {
              transfersQuery.refetch();
              lookupQuery.refetch();
            }}
          />
        ) : (
          <TransferList
            transfers={transfersQuery.data?.transfers}
            meta={transfersQuery.data?.meta}
            accountsById={accountsById}
            isLoading={transfersQuery.isLoading || lookupQuery.isLoading}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </TabPanel>

      <Modal
        open={Boolean(editor)}
        onClose={saving ? undefined : closeEditor}
        title={editor?.account ? t('accounts.edit') : t('accounts.add')}
        footer={
          <>
            <Button variant="outline" disabled={saving} onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={ACCOUNT_FORM_ID} loading={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editor ? (
          <AccountForm
            // A new key resets the form each time the modal opens for a different account.
            key={editor.account?.id ?? 'new'}
            account={editor.account}
            onPendingChange={setSaving}
            onSaved={closeEditor}
          />
        ) : null}
      </Modal>

      <Modal
        open={transferOpen}
        onClose={transferSaving ? undefined : closeTransfer}
        title={t('accounts.newTransfer')}
        footer={
          <>
            <Button variant="outline" disabled={transferSaving} onClick={closeTransfer}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={TRANSFER_FORM_ID} loading={transferSaving}>
              {t('accounts.transfer')}
            </Button>
          </>
        }
      >
        {transferOpen ? (
          <TransferForm
            accounts={activeAccounts}
            onPendingChange={setTransferSaving}
            onSaved={closeTransfer}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('accounts.deleteTitle')}
        description={t('accounts.deleteText', { name: toDelete?.name })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
