import { Banknote, CreditCard, Landmark, PiggyBank, Wallet } from 'lucide-react';
import { cn } from '@/utils/cn';

// One icon for every account type of the API (cash, bank, card, savings).
export const ACCOUNT_TYPE_ICONS = {
  cash: Banknote,
  bank: Landmark,
  card: CreditCard,
  savings: PiggyBank,
};

/** A round colored badge with the icon of the account type. Unknown types fall back to a wallet. */
export function AccountTypeIcon({ type, color = '#3B82F6', size = 'md', className }) {
  const Icon = ACCOUNT_TYPE_ICONS[type] ?? Wallet;
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full', box, className)}
      // The account color is data from the API, so it is applied as an inline style.
      style={{ backgroundColor: `${color}26`, color }}
      aria-hidden="true"
    >
      <Icon className={glyph} />
    </span>
  );
}
