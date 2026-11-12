import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';
import { changeLanguage } from '@/i18n';
import { LANGUAGES } from '@/utils/constants';

/** A small menu in the topbar and on the auth screens to switch English / Arabic. */
export function LanguageSwitcher({ className }) {
  const { t, i18n } = useTranslation();

  return (
    <Dropdown
      className={className}
      label={t('common.language')}
      items={LANGUAGES.map((language) => ({
        key: language.code,
        label: language.label,
        onSelect: () => changeLanguage(language.code),
        disabled: language.code === i18n.language,
      }))}
    >
      <Languages className="h-5 w-5" aria-hidden="true" />
    </Dropdown>
  );
}
