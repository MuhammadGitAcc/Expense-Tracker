import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/formatCurrency';

const TONES = {
  neutral: '',
  income: 'text-income',
  expense: 'text-expense',
};

/**
 * Every money value on screen goes through this component.
 *
 * <CurrencyDisplay value="12.50" currency="USD" />                    $12.50
 * <CurrencyDisplay value={e.amount} currency={e.account.currency} tone="expense" showSign />   −$12.50 in red
 * <CurrencyDisplay value={summary.savings} currency={summary.currency} tone="auto" showSign />  green if positive, red if negative
 *
 * value: the API string ("12.50"), never calculated here. tone: neutral | income | expense | auto.
 * showSign: income gets "+", expense gets "−", auto gets "+" for a positive value (a negative
 * value always shows its own "-"). Uses the .amount class: numbers stay left-to-right in Arabic.
 */
export function CurrencyDisplay({
  value,
  currency = 'USD',
  tone = 'neutral',
  showSign = false,
  className,
}) {
  const { i18n } = useTranslation();
  const text = formatCurrency(value, currency, i18n.language);
  const hasValue = text !== '—';
  const number = Number(value);

  let toneClass = TONES[tone] ?? '';
  let prefix = '';

  if (tone === 'auto' && hasValue) {
    if (number > 0) toneClass = 'text-income';
    else if (number < 0) toneClass = 'text-expense';
  }

  if (showSign && hasValue) {
    if (tone === 'income') prefix = '+';
    else if (tone === 'expense') prefix = '\u2212';
    else if (tone === 'auto' && number > 0) prefix = '+';
  }

  return (
    <span className={cn('amount', toneClass, className)}>
      {prefix}
      {text}
    </span>
  );
}
