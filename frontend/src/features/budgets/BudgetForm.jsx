import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateBudget, useUpdateBudget } from '@/features/budgets/useBudgets';
import { toast } from '@/hooks/useToast';
import { formatMonthYear } from '@/utils/formatDate';
import { positiveMoneySchema } from '@/utils/validators';

export const BUDGET_FORM_ID = 'budget-form';
const OVERALL = 'overall';

const thresholdSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .regex(/^\d{1,3}$/, 'budgets.thresholdInvalid')
  .refine((value) => Number(value) >= 1 && Number(value) <= 100, 'budgets.thresholdInvalid');

const createSchema = z.object({
  categoryId: z.string().min(1, 'validation.required'),
  amount: positiveMoneySchema,
  alertThreshold: thresholdSchema,
});
// Editing changes the amount and the alert level only.
const editSchema = createSchema.omit({ categoryId: true });

/**
 * Create or edit a budget. Rendered inside a Modal: the Save button lives in the Modal footer and
 * points at this form with form={BUDGET_FORM_ID}.
 *
 * budget: the budget to edit (omit it to create). month, year: the month shown on the page.
 * categories: the EXPENSE categories. takenCategoryIds: ids that already have a budget this month.
 * hasOverall: the month already has an overall budget. currency: the profile currency.
 * onSaved(budget) runs after the save; onPendingChange(bool) lets the footer button spin.
 */
export function BudgetForm({
  budget,
  month,
  year,
  categories,
  takenCategoryIds = [],
  hasOverall = false,
  currency,
  onSaved,
  onPendingChange,
}) {
  const { t, i18n } = useTranslation();
  const isEdit = Boolean(budget);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();

  const options = [
    ...(hasOverall ? [] : [{ value: OVERALL, label: t('budgets.overallOption') }]),
    ...categories
      .filter((category) => !takenCategoryIds.includes(category.id))
      .map((category) => ({ value: category.id, label: category.name })),
  ];

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      categoryId: '',
      amount: budget?.amount ?? '',
      alertThreshold: String(budget?.alertThreshold ?? 80),
    },
  });

  const onSubmit = async (values) => {
    onPendingChange?.(true);
    try {
      let saved = budget;
      const alertThreshold = Number(values.alertThreshold);

      if (isEdit) {
        const changes = {};
        if (Number(values.amount) !== Number(budget.amount)) changes.amount = values.amount;
        if (alertThreshold !== budget.alertThreshold) changes.alertThreshold = alertThreshold;
        if (Object.keys(changes).length > 0) {
          const body = await updateBudget.mutateAsync({ id: budget.id, ...changes });
          saved = body.data.budget;
        }
      } else {
        const body = await createBudget.mutateAsync({
          categoryId: values.categoryId === OVERALL ? null : values.categoryId,
          amount: values.amount,
          month,
          year,
          alertThreshold,
        });
        saved = body.data.budget;
      }

      toast.success(t(isEdit ? 'budgets.updated' : 'budgets.created'));
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
    <form id={BUDGET_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <p className="text-sm text-content-muted">
        {t('budgets.forMonth', { month: formatMonthYear(year, month, i18n.language) })}
      </p>

      {isEdit ? (
        <p className="text-sm font-medium text-content">
          {budget.category ? budget.category.name : t('budgets.overall')}
        </p>
      ) : (
        <Select
          label={t('budgets.category')}
          required
          placeholder={t('budgets.chooseCategory')}
          options={options}
          hint={t('budgets.categoryHint')}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={t('budgets.amount')}
          required
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          data-autofocus
          hint={t('budgets.amountHint', { currency })}
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Input
          label={t('budgets.alertThreshold')}
          required
          inputMode="numeric"
          autoComplete="off"
          hint={t('budgets.alertThresholdHint')}
          error={errors.alertThreshold?.message}
          {...register('alertThreshold')}
        />
      </div>
    </form>
  );
}
