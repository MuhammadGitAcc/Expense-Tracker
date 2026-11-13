import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateRecurring, useUpdateRecurring } from '@/features/recurring/useRecurring';
import { toast } from '@/hooks/useToast';
import { CATEGORY_TYPES, FREQUENCIES } from '@/utils/constants';
import { formatDate, isValidISODate, todayISO } from '@/utils/formatDate';
import { positiveMoneySchema, textSchema } from '@/utils/validators';

export const RECURRING_FORM_ID = 'recurring-form';

const MIN_DATE = '2000-01-01';
const MAX_DATE = '2100-12-31';

const inRange = (value) => value >= MIN_DATE && value <= MAX_DATE;
const dateSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine(isValidISODate, 'validation.dateInvalid')
  .refine(inRange, 'recurring.dateRange');
// The end date is optional: '' means "no end".
const optionalDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (isValidISODate(value) && inRange(value)),
    'recurring.dateRange',
  );

const createSchema = z
  .object({
    type: z.enum(CATEGORY_TYPES),
    amount: positiveMoneySchema,
    accountId: z.string().min(1, 'validation.required'),
    categoryId: z.string().min(1, 'validation.required'),
    frequency: z.enum(FREQUENCIES),
    startDate: dateSchema,
    endDate: optionalDateSchema,
    note: textSchema(1000),
  })
  .refine((values) => !values.endDate || values.endDate >= values.startDate, {
    message: 'recurring.endBeforeStart',
    path: ['endDate'],
  });

// Editing changes the amount, account, category, end date and note only.
const editSchema = z.object({
  amount: positiveMoneySchema,
  accountId: z.string().min(1, 'validation.required'),
  categoryId: z.string().min(1, 'validation.required'),
  endDate: optionalDateSchema,
  note: textSchema(1000),
});

/** Only what the person really changed goes to the API. */
function changedFields(recurring, values) {
  const changes = {};
  if (Number(values.amount) !== Number(recurring.amount)) changes.amount = values.amount;
  if (values.accountId !== recurring.account.id) changes.accountId = values.accountId;
  if (values.categoryId !== recurring.category.id) changes.categoryId = values.categoryId;
  if (values.endDate !== (recurring.endDate ?? '')) changes.endDate = values.endDate || null;
  if (values.note !== (recurring.note ?? '')) changes.note = values.note || null;
  return changes;
}

/**
 * Create or edit a recurring template (it moves no money: the server job creates the transactions).
 * Rendered inside a Modal: the Save button lives in the Modal footer with form={RECURRING_FORM_ID}.
 *
 * recurring: the template to edit (omit it to create).
 * accounts: the ACTIVE accounts. categories: ALL categories (filtered here by the template type).
 * onSaved(recurring) runs after the save; onPendingChange(bool) lets the footer button spin.
 */
export function RecurringForm({ recurring, accounts, categories, onSaved, onPendingChange }) {
  const { t, i18n } = useTranslation();
  const isEdit = Boolean(recurring);
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();

  // A template can use an archived account: keep it in the list so it is shown.
  const accountOptions = accounts.some((account) => account.id === recurring?.account.id)
    ? accounts
    : [...(recurring ? [recurring.account] : []), ...accounts];

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      type: recurring?.type ?? 'expense',
      amount: recurring?.amount ?? '',
      accountId: recurring?.account.id ?? accounts[0]?.id ?? '',
      categoryId: recurring?.category.id ?? '',
      frequency: recurring?.frequency ?? 'monthly',
      startDate: recurring?.startDate ?? todayISO(),
      endDate: recurring?.endDate ?? '',
      note: recurring?.note ?? '',
    },
  });

  const type = recurring?.type ?? watch('type');
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );
  const currency = accountOptions.find((account) => account.id === watch('accountId'))?.currency;

  const onSubmit = async (values) => {
    // The server refuses an end date before the next run: say so in the field instead.
    if (isEdit && values.endDate && values.endDate < recurring.nextRunDate) {
      setError('endDate', { message: 'recurring.endBeforeNextRun' });
      return;
    }

    onPendingChange?.(true);
    try {
      let saved = recurring;

      if (isEdit) {
        const changes = changedFields(recurring, values);
        if (Object.keys(changes).length > 0) {
          const body = await updateRecurring.mutateAsync({ id: recurring.id, ...changes });
          saved = body.data.recurring;
        }
      } else {
        const body = await createRecurring.mutateAsync({
          type: values.type,
          amount: values.amount,
          accountId: values.accountId,
          categoryId: values.categoryId,
          frequency: values.frequency,
          startDate: values.startDate,
          ...(values.endDate ? { endDate: values.endDate } : {}),
          ...(values.note ? { note: values.note } : {}),
        });
        saved = body.data.recurring;
      }

      toast.success(t(isEdit ? 'recurring.updated' : 'recurring.created'));
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
    <form id={RECURRING_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <p className="rounded-lg bg-surface-muted p-3 text-sm text-content-muted">
        {t('recurring.formNote')}
      </p>

      {isEdit ? (
        <p className="text-sm text-content-muted">
          {t(`recurring.types.${recurring.type}`)} ·{' '}
          {t(`recurring.frequency.${recurring.frequency}`)} ·{' '}
          {t('recurring.startedOn', { date: formatDate(recurring.startDate, i18n.language) })}
          <span className="mt-1 block text-xs">{t('recurring.fixedNote')}</span>
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label={t('recurring.type')}
            required
            options={CATEGORY_TYPES.map((value) => ({
              value,
              label: t(`recurring.types.${value}`),
            }))}
            error={errors.type?.message}
            // The category list depends on the type: start again from "choose a category".
            {...register('type', { onChange: () => setValue('categoryId', '') })}
          />
          <Select
            label={t('recurring.frequencyLabel')}
            required
            options={FREQUENCIES.map((value) => ({
              value,
              label: t(`recurring.frequency.${value}`),
            }))}
            error={errors.frequency?.message}
            {...register('frequency')}
          />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={t('recurring.amount')}
          required
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          data-autofocus
          hint={currency ? t('recurring.amountHint', { currency }) : undefined}
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label={t('recurring.account')}
          required
          options={accountOptions.map((account) => ({
            value: account.id,
            label: `${account.name} · ${account.currency}`,
          }))}
          error={errors.accountId?.message}
          {...register('accountId')}
        />
      </div>

      <Select
        label={t('recurring.category')}
        required
        placeholder={t('recurring.chooseCategory')}
        options={categoryOptions.map((category) => ({ value: category.id, label: category.name }))}
        error={errors.categoryId?.message}
        {...register('categoryId')}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {isEdit ? null : (
          <DatePicker
            label={t('recurring.startDate')}
            required
            min={MIN_DATE}
            max={MAX_DATE}
            hint={t('recurring.startDateHint')}
            error={errors.startDate?.message}
            {...register('startDate')}
          />
        )}
        <DatePicker
          label={t('recurring.endDate')}
          min={isEdit ? recurring.nextRunDate : MIN_DATE}
          max={MAX_DATE}
          hint={t('recurring.endDateHint')}
          error={errors.endDate?.message}
          {...register('endDate')}
        />
      </div>

      <Textarea
        label={t('recurring.note')}
        maxLength={1000}
        error={errors.note?.message}
        {...register('note')}
      />
    </form>
  );
}
