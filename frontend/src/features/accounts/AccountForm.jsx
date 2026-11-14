import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { AccountTypeIcon } from '@/components/common/AccountTypeIcon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateAccount, useUpdateAccount } from '@/features/accounts/useAccounts';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { ACCOUNT_TYPES, CURRENCIES } from '@/utils/constants';
import { currencySymbolOverride } from '@/utils/formatCurrency';
import { colorSchema, currencySchema, moneySchema } from '@/utils/validators';

export const ACCOUNT_FORM_ID = 'account-form';

// Ready-made colors; the color input next to them allows any other.
const SWATCHES = [
  '#3B82F6',
  '#0EA5E9',
  '#06B6D4',
  '#14B8A6',
  '#10B981',
  '#16A34A',
  '#F59E0B',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#D946EF',
  '#8B5CF6',
  '#6B7280',
];

const nameSchema = z.string().trim().min(1, 'validation.required').max(100, 'validation.tooLong');

// Creating takes everything; editing takes only name, type and color (the API never changes
// the balance or the currency of an existing account).
const createSchema = z.object({
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPES),
  balance: moneySchema,
  currency: currencySchema,
  color: colorSchema,
});
const editSchema = z.object({
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPES),
  color: colorSchema,
});

/** "USD · US Dollar" (the name follows the app language). Falls back to the plain code. */
function currencyLabel(code, language) {
  try {
    const name = new Intl.DisplayNames([language], { type: 'currency' }).of(code);
    const symbol = currencySymbolOverride(code, language) ?? code;
    return name && name !== code ? `${symbol} · ${name}` : symbol;
  } catch {
    return code;
  }
}

/**
 * Create or edit an account. Rendered inside a Modal: the Save button lives in the Modal footer
 * and points at this form with form={ACCOUNT_FORM_ID}.
 * account: the account to edit (omit it to create).
 * onSaved(account) runs after a successful save; onPendingChange(bool) lets the footer button spin.
 */
export function AccountForm({ account, onSaved, onPendingChange }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isEdit = Boolean(account);
  const create = useCreateAccount();
  const update = useUpdateAccount();

  const defaultCurrency = (user?.currency ?? 'USD').toUpperCase();
  // The API accepts any 3-letter code: keep the profile currency in the list even if it is unusual.
  const currencies = CURRENCIES.includes(defaultCurrency)
    ? CURRENCIES
    : [defaultCurrency, ...CURRENCIES];

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
      name: account?.name ?? '',
      type: account?.type ?? 'cash',
      balance: '0',
      currency: defaultCurrency,
      color: (account?.color ?? '#3B82F6').toUpperCase(),
    },
  });

  const type = watch('type');
  const color = watch('color');
  const name = watch('name');

  const onSubmit = (values) => {
    const mutation = isEdit ? update : create;
    const payload = isEdit
      ? { id: account.id, name: values.name, type: values.type, color: values.color }
      : {
          name: values.name,
          type: values.type,
          balance: values.balance,
          currency: values.currency,
          color: values.color,
        };

    onPendingChange?.(true);
    mutation.mutate(payload, {
      onSuccess: (body) => {
        toast.success(t(isEdit ? 'accounts.updated' : 'accounts.created'));
        onSaved?.(body.data?.account);
      },
      onError: (error) => {
        onPendingChange?.(false);
        if (isNetworkError(error)) {
          toast.error(t('errors.network'));
          return;
        }
        // For example "You already have an account with this name" (409).
        setError('root', { message: getErrorMessage(error, t('errors.generic')) });
      },
    });
  };

  return (
    <form id={ACCOUNT_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Input
        label={t('accounts.name')}
        required
        maxLength={100}
        data-autofocus
        error={errors.name?.message}
        {...register('name')}
      />

      <Select
        label={t('accounts.type')}
        options={ACCOUNT_TYPES.map((value) => ({ value, label: t(`accounts.types.${value}`) }))}
        {...register('type')}
      />

      {isEdit ? (
        <p className="rounded-lg bg-surface-muted p-3 text-sm text-content-muted">
          {t('accounts.fixedFields', { currency: account.currency })}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {/* No inputMode="decimal": the phone number pad has no minus sign, and an opening
              balance can be negative (a credit card, for example). */}
          <Input
            label={t('accounts.openingBalance')}
            hint={t('accounts.openingBalanceHint')}
            placeholder="0.00"
            autoComplete="off"
            error={errors.balance?.message}
            {...register('balance')}
          />
          <Select
            label={t('accounts.currency')}
            options={currencies.map((code) => ({
              value: code,
              label: currencyLabel(code, i18n.language),
            }))}
            error={errors.currency?.message}
            {...register('currency')}
          />
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-content">{t('accounts.color')}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              aria-pressed={hex === color}
              onClick={() => setValue('color', hex, { shouldDirty: true })}
              className={cn(
                'h-8 w-8 rounded-full border-2 transition-transform',
                hex === color ? 'scale-110 border-content' : 'border-transparent',
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            value={color.toLowerCase()}
            onChange={(event) =>
              setValue('color', event.target.value.toUpperCase(), { shouldDirty: true })
            }
            aria-label={t('accounts.customColor')}
            className="h-8 w-10 cursor-pointer rounded-md border border-line bg-surface p-0.5"
          />
        </div>
        {errors.color ? (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {t(errors.color.message)}
          </p>
        ) : null}
      </fieldset>

      <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-3">
        <AccountTypeIcon type={type} color={color} />
        <span className="min-w-0 truncate text-sm text-content-muted">
          {name.trim() || t('accounts.preview')}
        </span>
      </div>
    </form>
  );
}
