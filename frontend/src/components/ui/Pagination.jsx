import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { PAGE_SIZES } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { fieldClasses } from '@/components/ui/FormField';

/** [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20]: first, last and the pages around the current one. */
function getPages(page, totalPages) {
  const wanted = new Set([1, totalPages]);
  for (let value = page - 1; value <= page + 1; value += 1) {
    if (value >= 1 && value <= totalPages) wanted.add(value);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((value, index) => {
    if (index > 0) {
      const gap = value - sorted[index - 1];
      if (gap === 2) result.push(value - 1);
      else if (gap > 2) result.push('ellipsis');
    }
    result.push(value);
  });
  return result;
}

/**
 * <Pagination page={page} limit={limit} total={meta.total}
 *   onPageChange={setPage} onLimitChange={(next) => { setLimit(next); setPage(1); }} />
 * Leave out onLimitChange to hide the page size menu. Shows nothing when total is 0.
 * Phones show "Page 2 of 7", larger screens show the page numbers.
 */
export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizes = PAGE_SIZES,
  className,
}) {
  const { t } = useTranslation();

  if (!total) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label={t('pagination.label')}
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-content-muted">
        <p>
          <span className="amount">{t('pagination.showing', { from, to, total })}</span>
        </p>
        {onLimitChange ? (
          <label className="flex items-center gap-2">
            <span>{t('pagination.perPage')}</span>
            <select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className={cn(fieldClasses(false), 'h-8 w-auto py-0')}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-1 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            iconStart={<ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
          >
            {t('pagination.previous')}
          </Button>

          <p className="px-2 text-sm text-content-muted sm:hidden">
            {t('pagination.pageOf', { page, totalPages })}
          </p>

          <ul className="hidden items-center gap-1 sm:flex">
            {getPages(page, totalPages).map((item, index) =>
              item === 'ellipsis' ? (
                <li
                  key={`ellipsis-${index}`}
                  className="px-1 text-content-muted"
                  aria-hidden="true"
                >
                  …
                </li>
              ) : (
                <li key={item}>
                  <Button
                    variant={item === page ? 'primary' : 'ghost'}
                    size="sm"
                    className="min-w-8 px-2"
                    aria-current={item === page ? 'page' : undefined}
                    aria-label={t('pagination.goToPage', { page: item })}
                    onClick={() => onPageChange(item)}
                  >
                    <span className="amount">{item}</span>
                  </Button>
                </li>
              ),
            )}
          </ul>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            iconEnd={<ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
          >
            {t('pagination.next')}
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
