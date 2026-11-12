import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateTransfer } from '@/features/accounts/useAccounts';
import { toast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/formatCurrency';
import { todayISO } from '@/utils/formatDate';
import { isoDateSchema, positiveMoneySchema, textSchema } from '@/utils/validators';

export const TRANSFER_FORM_ID = 'transfer-form';

const schema = z
  .object({
    fromAccountId: z.string().min(1, 'validation.required'),
    toAccountId: z.string().min(1, 'validation.required'),
    amount: positiveMoneySchema,
    date: isoDateSchema,
    note: textSchema(500),
  })
  .refine((values) => values.fromAccountId !== values.toAccountId, {
    message: 'accounts.sameAccount',
    path: ['toAccountId'],
  });

/** Accounts that have at least one other account with the same currency. */
function transferableAccounts(accounts) {
  const counts = {};
  accounts.forEach((account) => {
    counts[account.currency] = (counts[account.currency] ?? 0) + 1;
  });
  return accounts.filter((account) => counts[account.currency] >= 2);
}

/** The other accounts a transfer from `from` can go to: same currency, not the same account. */
const destinationsFor = (accounts, from) =>
  from ? accounts.filter((a) => a.id !== from.id && a.currency === from.currency) : [];

/**
 * Move money between two of the user's own accounts. Rendered inside a Modal: the Save button
 * lives in the Modal footer and points at this form with form={TRANSFER_FORM_ID}.
 * accounts: the ACTIVE accounts (archived ones cannot be used). Only accounts that have a partner
 * with the same currency are offered, because the API refuses a transfer between currencies.
 * onSaved() runs after a successful transfer; onPendingChange(bool) lets the footer button spin.
 */
export function TransferForm({ accounts, onSaved, onPendingChange }) {
  const { t, i18n } = useTranslation();
  const create = useCreateTransfer();

  const sources = transferableAccounts(accounts);
  const firstFrom = sources[0];
  const firstTo = destinationsFor(accounts, firstFrom)[0];

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fromAccountId: firstFrom?.id ?? '',
      toAccountId: firstTo?.id ?? '',
      amount: '',
      date: todayISO(),
      note: '',
    },
  });

  const from = accounts.find((account) => account.id === watch('fromAccountId'));
  const destinations = destinationsFor(accounts, from);
  const label = (account) =>
    `${account.name} (${formatCurrency(account.balance, account.currency, i18n.language)})`;

  // A new source can make the chosen destination invalid (another currency, or the same account).
  const onFromChange = (event) => {
    const nextFrom = accounts.find((account) => account.id === event.target.value);
    const options = destinationsFor(accounts, nextFrom);
    if (!options.some((account) => account.id === getValues('toAccountId'))) {
      setValue('toAccountId', options[0]?.id ?? '');
    }
  };

  const onSubmit = ({ fromAccountId, toAccountId, amount, date, note }) => {
    onPendingChange?.(true);
    create.mutate(
      { fromAccountId, toAccountId, amount, date, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          toast.success(t('accounts.transferred'));
          onSaved?.();
        },
        onError: (error) => {
          onPendingChange?.(false);
          if (isNetworkError(error)) {
            toast.error(t('errors.network'));
            return;
          }
          setError('root', { message: getErrorMessage(error, t('errors.generic')) });
        },
      },
    );
  };

  return (
    <form id={TRANSFER_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Select
        label={t('accounts.from')}
        required
        data-autofocus
        options={sources.map((account) => ({ value: account.id, label: label(account) }))}
        error={errors.fromAccountId?.message}
        {...register('fromAccountId', { onChange: onFromChange })}
      />

      <Select
        label={t('accounts.to')}
        required
        placeholder={t('accounts.chooseAccount')}
        options={destinations.map((account) => ({ value: account.id, label: label(account) }))}
        error={errors.toAccountId?.message}
        {...register('toAccountId')}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={t('accounts.amount')}
          required
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          hint={from ? t('accounts.amountHint', { currency: from.currency }) : undefined}
          error={errors.amount?.message}
          {...register('amount')}
        />
        <DatePicker
          label={t('accounts.date')}
          required
          error={errors.date?.message}
          {...register('date')}
        />
      </div>

      <Input
        label={t('accounts.note')}
        maxLength={500}
        error={errors.note?.message}
        {...register('note')}
      />
    </form>
  );
}
