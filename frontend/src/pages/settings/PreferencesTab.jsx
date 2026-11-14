import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { useUpdateProfile } from '@/features/settings/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { toast } from '@/hooks/useToast';
import { changeLanguage } from '@/i18n';
import { CURRENCIES, DEFAULT_LANGUAGE, LANGUAGES, THEMES } from '@/utils/constants';
import { currencySymbolOverride } from '@/utils/formatCurrency';
import { currencySchema } from '@/utils/validators';

const schema = z.object({
  currency: currencySchema,
  language: z.enum(LANGUAGES.map((language) => language.code)),
  theme: z.enum(THEMES),
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

export function PreferencesTab() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const update = useUpdateProfile();

  const profileCurrency = (user?.currency ?? 'USD').toUpperCase();
  // The API accepts any 3-letter code: keep the profile currency in the list even if it is unusual.
  const currencies = CURRENCIES.includes(profileCurrency)
    ? CURRENCIES
    : [profileCurrency, ...CURRENCIES];

  // The form starts with what is on screen now (the top bar switches only change this device),
  // so pressing Save also saves a choice made there.
  const currentLanguage = LANGUAGES.some((language) => language.code === i18n.language)
    ? i18n.language
    : DEFAULT_LANGUAGE;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currency: profileCurrency, language: currentLanguage, theme },
  });

  const onSubmit = (values) => {
    // Send only what differs from the profile.
    const changes = {};
    if (values.currency !== profileCurrency) changes.currency = values.currency;
    if (values.language !== user?.language) changes.language = values.language;
    if (values.theme !== user?.theme) changes.theme = values.theme;

    // Apply on this device at once, whatever the server says about the profile.
    if (values.language !== i18n.language) changeLanguage(values.language);
    if (values.theme !== theme) setTheme(values.theme);

    if (Object.keys(changes).length === 0) {
      toast.info(t('settings.nothingToSave'));
      return;
    }

    update.mutate(changes, {
      onSuccess: () => toast.success(t('settings.preferencesSaved')),
      onError: (error) => {
        if (isNetworkError(error)) {
          toast.error(t('errors.network'));
          return;
        }
        setError('root', { message: getErrorMessage(error, t('errors.generic')) });
      },
    });
  };

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader
          title={t('settings.preferencesTitle')}
          description={t('settings.preferencesText')}
        />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {errors.root ? (
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
              {errors.root.message}
            </p>
          ) : null}
          <Select
            label={t('settings.currencyLabel')}
            hint={t('settings.currencyHint')}
            error={errors.currency?.message}
            options={currencies.map((code) => ({
              value: code,
              label: currencyLabel(code, i18n.language),
            }))}
            {...register('currency')}
          />
          <Select
            label={t('settings.languageLabel')}
            error={errors.language?.message}
            options={LANGUAGES.map((language) => ({ value: language.code, label: language.label }))}
            {...register('language')}
          />
          <Select
            label={t('settings.themeLabel')}
            error={errors.theme?.message}
            options={THEMES.map((value) => ({ value, label: t(`settings.themes.${value}`) }))}
            {...register('theme')}
          />
          <Button type="submit" loading={update.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
