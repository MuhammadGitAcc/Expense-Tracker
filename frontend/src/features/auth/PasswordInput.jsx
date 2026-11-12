import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';

/** An Input with a show/hide button. Accepts the same props (and the react-hook-form ref). */
export function PasswordInput({ ref, ...props }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
          className="flex h-8 w-8 items-center justify-center rounded-md text-content-muted hover:text-content"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}
