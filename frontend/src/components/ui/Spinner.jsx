import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

const SIZES = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

function Icon({ size, className }) {
  return (
    <svg
      className={cn('animate-spin', SIZES[size] ?? SIZES.md, className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/** decorative: only the turning icon (inside a button that already says "busy"). */
export function Spinner({ size = 'md', label, decorative = false, className }) {
  const { t } = useTranslation();

  if (decorative) return <Icon size={size} className={className} />;

  return (
    <span role="status" className="inline-flex">
      <Icon size={size} className={className} />
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </span>
  );
}
