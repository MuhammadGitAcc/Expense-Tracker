import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateIncome, useUpdateIncome } from '@/features/income/useIncome';
import { toast } from '@/hooks/useToast';
import { categoryName } from '@/utils/categoryName';
import { todayISO } from '@/utils/formatDate';
import { isoDateSchema, positiveMoneySchema, textSchema } from '@/utils/validators';

export const INCOME_FORM_ID = 'income-form';

const schema = z.object({
  amount: positiveMoneySchema,
  accountId: z.string().min(1, 'validation.required'),
  categoryId: z.string().min(1, 'validation.required'),
  date: isoDateSchema,
  source: textSchema(150),
  note: textSchema(1000),
});

/** Only what the person really changed goes to the API (a PUT that sends the amount touches balances). */
function changedFields(income, values) {
  const changes = {};
  // Number() only compares "12.5" with "12.50"; no money is calculated here.
  if (Number(values.amount) !== Number(income.amount)) changes.amount = values.amount;
  if (values.accountId !== income.account.id) changes.accountId = values.accountId;
  if (values.categoryId !== income.category.id) changes.categoryId = values.categoryId;
  if (values.date !== income.date) changes.date = values.date;
  if (values.source !== (income.source ?? '')) changes.source = values.source || null;
  if (values.note !== (income.note ?? '')) changes.note = values.note || null;
  return changes;
}

/**
 * Create or edit an income record. Rendered inside a Modal: the Save button lives in the Modal
 * footer and points at this form with form={INCOME_FORM_ID}.
 *
 * income: the record to edit (omit it to create).
 * accounts: the ACTIVE accounts. categories: the income categories.
 * onSaved(income) runs after the save; onPendingChange(bool) lets the footer button spin.
 */
export function IncomeForm({ income, accounts, categories, onSaved, onPendingChange }) {
  const { t } = useTranslation();
  const isEdit = Boolean(income);
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();

  // A record can sit in an archived account: keep that account in the list so it is shown.
  const accountOptions = accounts.some((account) => account.id === income?.account.id)
    ? accounts
    : [...(income ? [income.account] : []), ...accounts];

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: income?.amount ?? '',
      accountId: income?.account.id ?? accounts[0]?.id ?? '',
      categoryId: income?.category.id ?? '',
      date: income?.date ?? todayISO(),
      source: income?.source ?? '',
      note: income?.note ?? '',
    },
  });

  const currency = accountOptions.find((account) => account.id === watch('accountId'))?.currency;

  const onSubmit = async (values) => {
    onPendingChange?.(true);
    try {
      let saved = income;

      if (isEdit) {
        const changes = changedFields(income, values);
        if (Object.keys(changes).length > 0) {
          const body = await updateIncome.mutateAsync({ id: income.id, ...changes });
          saved = body.data.income;
        }
      } else {
        const body = await createIncome.mutateAsync({
          accountId: values.accountId,
          categoryId: values.categoryId,
          amount: values.amount,
          date: values.date,
          ...(values.source ? { source: values.source } : {}),
          ...(values.note ? { note: values.note } : {}),
        });
        saved = body.data.income;
      }

      toast.success(t(isEdit ? 'income.updated' : 'income.created'));
      onSaved?.(saved);
    } catch (error) {
      onPendingChange?.(false);
      if (isNetworkError(error)) {
        toast.error(t('errors.network'));
        return;
      }
      setError('root', { message: getErrorMessage(error, t('errors.generic')) });
    }
  };

  return (
    <form id={INCOME_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={t('income.amount')}
          required
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          data-autofocus
          hint={currency ? t('income.amountHint', { currency }) : undefined}
          error={errors.amount?.message}
          {...register('amount')}
        />
        <DatePicker
          label={t('income.date')}
          required
          error={errors.date?.message}
          {...register('date')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={t('income.account')}
          required
          options={accountOptions.map((account) => ({
            value: account.id,
            label: `${account.name} · ${account.currency}`,
          }))}
          error={errors.accountId?.message}
          {...register('accountId')}
        />
        <Select
          label={t('income.category')}
          required
          placeholder={t('income.chooseCategory')}
          options={categories.map((category) => ({
            value: category.id,
            label: categoryName(t, category.name),
          }))}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      </div>

      <Input
        label={t('income.source')}
        hint={t('income.sourceHint')}
        maxLength={150}
        autoComplete="off"
        error={errors.source?.message}
        {...register('source')}
      />

      <Textarea
        label={t('income.note')}
        maxLength={1000}
        error={errors.note?.message}
        {...register('note')}
      />
    </form>
  );
}
