import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/formatCurrency';

const BAR_COLORS = {
  ok: 'bg-success',
  warning: 'bg-warning',
  exceeded: 'bg-danger',
};

/**
 * The progress bar of one budget. status: ok | warning | exceeded (from the API).
 * percentUsed is a number such as 82.5 and may be above 100; the bar stops at 100.
 * Colour is never the only signal: the percentage is written next to the bar.
 */
export function BudgetProgress({ percentUsed, status, label }) {
  const { i18n } = useTranslation();
  const value = Number.isFinite(Number(percentUsed)) ? Number(percentUsed) : 0;
  const width = Math.min(Math.max(value, 0), 100);

  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            BAR_COLORS[status] ?? BAR_COLORS.ok,
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="amount w-14 shrink-0 text-end text-xs font-medium text-content-muted">
        {formatPercent(value, i18n.language)}
      </span>
    </div>
  );
}
