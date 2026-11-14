import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Paperclip, Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  useCreateExpense,
  useRemoveReceipt,
  useUpdateExpense,
  useUploadReceipt,
} from '@/features/expenses/useExpenses';
import { toast } from '@/hooks/useToast';
import { categoryName } from '@/utils/categoryName';
import { PAYMENT_METHODS } from '@/utils/constants';
import { todayISO } from '@/utils/formatDate';
import { isoDateSchema, positiveMoneySchema, textSchema } from '@/utils/validators';

export const EXPENSE_FORM_ID = 'expense-form';

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

/** "Food, Lunch,food" to ['food', 'lunch'] (trimmed, lower-case, no duplicates), like the API. */
export const parseTags = (text) => [
  ...new Set(
    text
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  ),
];

const schema = z.object({
  amount: positiveMoneySchema,
  accountId: z.string().min(1, 'validation.required'),
  categoryId: z.string().min(1, 'validation.required'),
  date: isoDateSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  tags: z
    .string()
    .refine((text) => parseTags(text).length <= MAX_TAGS, 'expenses.tagsMax')
    .refine(
      (text) => parseTags(text).every((tag) => tag.length <= MAX_TAG_LENGTH),
      'expenses.tagLong',
    ),
  note: textSchema(1000),
});

/** Only what the person really changed goes to the API (a PUT that sends the amount touches balances). */
function changedFields(expense, values) {
  const changes = {};
  // Number() only compares "12.5" with "12.50"; no money is calculated here.
  if (Number(values.amount) !== Number(expense.amount)) changes.amount = values.amount;
  if (values.accountId !== expense.account.id) changes.accountId = values.accountId;
  if (values.categoryId !== expense.category.id) changes.categoryId = values.categoryId;
  if (values.date !== expense.date) changes.date = values.date;
  if (values.paymentMethod !== expense.paymentMethod) changes.paymentMethod = values.paymentMethod;

  const tags = parseTags(values.tags);
  if (tags.join('\n') !== expense.tags.join('\n')) changes.tags = tags;

  if (values.note !== (expense.note ?? '')) changes.note = values.note || null;
  return changes;
}

/**
 * Create or edit an expense. Rendered inside a Modal: the Save button lives in the Modal footer
 * and points at this form with form={EXPENSE_FORM_ID}.
 *
 * expense: the expense to edit (omit it to create).
 * accounts: the ACTIVE accounts. categories: the expense categories.
 * onSaved(expense) runs after the save; onPendingChange(bool) lets the footer button spin;
 * onViewReceipt(expense) opens the receipt viewer.
 *
 * The receipt is a second request (POST /expenses/:id/receipt) after the expense is saved. When
 * only that second request fails, the expense is kept and a warning explains what to retry.
 */
export function ExpenseForm({
  expense,
  accounts,
  categories,
  onSaved,
  onPendingChange,
  onViewReceipt,
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(expense);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const uploadReceipt = useUploadReceipt();
  const removeReceipt = useRemoveReceipt();

  const [file, setFile] = useState(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const hasReceipt = isEdit && Boolean(expense.receiptUrl);

  // An expense can sit in an archived account: keep that account in the list so it is shown.
  const accountOptions = accounts.some((account) => account.id === expense?.account.id)
    ? accounts
    : [...(expense ? [expense.account] : []), ...accounts];

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: expense?.amount ?? '',
      accountId: expense?.account.id ?? accounts[0]?.id ?? '',
      categoryId: expense?.category.id ?? '',
      date: expense?.date ?? todayISO(),
      paymentMethod: expense?.paymentMethod ?? 'cash',
      tags: expense?.tags.join(', ') ?? '',
      note: expense?.note ?? '',
    },
  });

  const currency = accountOptions.find((account) => account.id === watch('accountId'))?.currency;

  const onSubmit = async (values) => {
    onPendingChange?.(true);
    try {
      let saved = expense;

      if (isEdit) {
        const changes = changedFields(expense, values);
        if (Object.keys(changes).length > 0) {
          const body = await updateExpense.mutateAsync({ id: expense.id, ...changes });
          saved = body.data.expense;
        }
      } else {
        const body = await createExpense.mutateAsync({
          accountId: values.accountId,
          categoryId: values.categoryId,
          amount: values.amount,
          date: values.date,
          paymentMethod: values.paymentMethod,
          tags: parseTags(values.tags),
          ...(values.note ? { note: values.note } : {}),
        });
        saved = body.data.expense;
      }

      // The expense is saved. A receipt problem must not look like a failed save.
      try {
        if (file) await uploadReceipt.mutateAsync({ id: saved.id, file });
        else if (removeExisting) await removeReceipt.mutateAsync(saved.id);
      } catch {
        toast.warning(t('expenses.receiptFailed'));
        onSaved?.(saved);
        return;
      }

      toast.success(t(isEdit ? 'expenses.updated' : 'expenses.created'));
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
    <form id={EXPENSE_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={t('expenses.amount')}
          required
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          data-autofocus
          hint={currency ? t('expenses.amountHint', { currency }) : undefined}
          error={errors.amount?.message}
          {...register('amount')}
        />
        <DatePicker
          label={t('expenses.date')}
          required
          error={errors.date?.message}
          {...register('date')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={t('expenses.account')}
          required
          options={accountOptions.map((account) => ({
            value: account.id,
            label: `${account.name} · ${account.currency}`,
          }))}
          error={errors.accountId?.message}
          {...register('accountId')}
        />
        <Select
          label={t('expenses.category')}
          required
          placeholder={t('expenses.chooseCategory')}
          options={categories.map((category) => ({
            value: category.id,
            label: categoryName(t, category.name),
          }))}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={t('expenses.paymentMethod')}
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: t(`expenses.paymentMethods.${method}`),
          }))}
          {...register('paymentMethod')}
        />
        <Input
          label={t('expenses.tags')}
          hint={t('expenses.tagsHint')}
          autoComplete="off"
          error={errors.tags?.message}
          {...register('tags')}
        />
      </div>

      <Textarea
        label={t('expenses.note')}
        maxLength={1000}
        error={errors.note?.message}
        {...register('note')}
      />

      {hasReceipt ? (
        <div className="rounded-lg border border-line p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-content">
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            {t('expenses.receiptCurrent')}
          </p>
          {removeExisting ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-content-muted">{t('expenses.receiptWillBeRemoved')}</p>
              <Button
                size="sm"
                variant="outline"
                iconStart={<Undo2 className="h-4 w-4" />}
                onClick={() => setRemoveExisting(false)}
              >
                {t('expenses.receiptKeep')}
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onViewReceipt?.(expense)}>
                {t('expenses.receiptView')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                iconStart={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setFile(null);
                  setRemoveExisting(true);
                }}
              >
                {t('expenses.receiptRemove')}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {!removeExisting ? (
        <FileUpload
          label={hasReceipt ? t('expenses.receiptReplace') : t('expenses.receipt')}
          value={file}
          onChange={setFile}
        />
      ) : null}
    </form>
  );
}
