import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { CATEGORY_ICON_NAMES, CategoryIcon } from '@/components/common/CategoryIcon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateCategory, useUpdateCategory } from '@/features/categories/useCategories';
import { toast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { CATEGORY_TYPES } from '@/utils/constants';
import { colorSchema } from '@/utils/validators';

export const CATEGORY_FORM_ID = 'category-form';

// Ready-made colors; the color input next to them allows any other.
const SWATCHES = [
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#D946EF',
  '#8B5CF6',
  '#3B82F6',
  '#0EA5E9',
  '#06B6D4',
  '#14B8A6',
  '#10B981',
  '#16A34A',
  '#F59E0B',
  '#6B7280',
];

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(60, 'validation.tooLong'),
  type: z.enum(CATEGORY_TYPES),
  icon: z.string().min(1, 'validation.required'),
  color: colorSchema,
});

/**
 * Create or edit a category. Rendered inside a Modal: the Save button lives in the Modal footer
 * and points at this form with form={CATEGORY_FORM_ID}.
 * category: the category to edit (omit it to create). defaultType: type for a new one.
 * onSaved(category) runs after a successful save (category = the saved one from the API); onPendingChange(bool) lets the footer button spin.
 */
export function CategoryForm({ category, defaultType = 'expense', onSaved, onPendingChange }) {
  const { t } = useTranslation();
  const isEdit = Boolean(category);
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? defaultType,
      icon: category?.icon ?? 'tag',
      color: (category?.color ?? '#6B7280').toUpperCase(),
    },
  });

  const icon = watch('icon');
  const color = watch('color');

  const onSubmit = ({ name, type, icon: iconName, color: hex }) => {
    const mutation = isEdit ? update : create;
    // The type cannot be changed after creation (the API refuses it).
    const payload = isEdit
      ? { id: category.id, name, icon: iconName, color: hex }
      : { name, type, icon: iconName, color: hex };

    onPendingChange?.(true);
    mutation.mutate(payload, {
      onSuccess: (body) => {
        toast.success(t(isEdit ? 'categories.updated' : 'categories.created'));
        onSaved?.(body.data?.category);
      },
      onError: (error) => {
        onPendingChange?.(false);
        if (isNetworkError(error)) {
          toast.error(t('errors.network'));
          return;
        }
        // For example "a category with this name already exists" (409).
        setError('root', { message: getErrorMessage(error, t('errors.generic')) });
      },
    });
  };

  return (
    <form id={CATEGORY_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Input
        label={t('categories.name')}
        required
        maxLength={60}
        data-autofocus
        error={errors.name?.message}
        {...register('name')}
      />

      <Select
        label={t('categories.type')}
        disabled={isEdit}
        hint={isEdit ? t('categories.typeLocked') : undefined}
        options={CATEGORY_TYPES.map((value) => ({ value, label: t(`categories.types.${value}`) }))}
        {...register('type')}
      />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-content">{t('categories.icon')}</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {CATEGORY_ICON_NAMES.map((name) => {
            const selected = name === icon;
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={selected}
                onClick={() => setValue('icon', name, { shouldDirty: true })}
                className={cn(
                  'flex h-10 items-center justify-center rounded-lg border transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft'
                    : 'border-line hover:bg-surface-muted',
                )}
              >
                <CategoryIcon icon={name} color={selected ? color : '#6B7280'} size="sm" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-content">{t('categories.color')}</legend>
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
            aria-label={t('categories.customColor')}
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
        <CategoryIcon icon={icon} color={color} />
        <span className="text-sm text-content-muted">{t('categories.preview')}</span>
      </div>
    </form>
  );
}
