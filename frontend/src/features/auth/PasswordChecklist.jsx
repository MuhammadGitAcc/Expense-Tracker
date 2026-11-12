import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { getPasswordChecks } from '@/utils/validators';

/** Live list of the password rules under the password field. */
export function PasswordChecklist({ value }) {
  const { t } = useTranslation();
  const checks = getPasswordChecks(value);

  return (
    <ul className="mt-2 grid gap-1 text-xs" aria-label={t('auth.passwordRules')}>
      {checks.map(({ key, ok }) => (
        <li
          key={key}
          className={cn('flex items-center gap-1.5', ok ? 'text-success' : 'text-content-muted')}
        >
          {ok ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Circle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{t(key)}</span>
          <span className="sr-only">{ok ? t('auth.ruleMet') : t('auth.ruleNotMet')}</span>
        </li>
      ))}
    </ul>
  );
}
