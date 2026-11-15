import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SearchBar } from '@/components/common/SearchBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDebounce } from '@/hooks/useDebounce';
import { categoryName } from '@/utils/categoryName';
import { PAYMENT_METHODS } from '@/utils/constants';

export const EMPTY_FILTERS = {
  search: '',
  from: '',
  to: '',
  categoryId: '',
  accountId: '',
  paymentMethod: '',
  minAmount: '',
  maxAmount: '',
  tag: '',
};

// Same sort choices as the table headers, for phones (they have no table).
export const SORT_OPTIONS = [
  { value: 'date:desc', key: 'dateDesc' },
  { value: 'date:asc', key: 'dateAsc' },
  { value: 'amount:desc', key: 'amountDesc' },
  { value: 'amount:asc', key: 'amountAsc' },
];

/** How many filters (not counting the search box) are set. */
export const countActiveFilters = (filters) =>
  Object.entries(filters).filter(([key, value]) => key !== 'search' && value !== '').length;

const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/;
const MAX_TAG_LENGTH = 30;

/**
 * Min amount, max amount and tag: typed text, sent to the page 400 ms after typing stops, and
 * only when it is valid (an invalid draft is shown as an error and counts as "not set").
 * It starts from `filters` and is re-created (key) when the filters are reset.
 */
function TypedFilters({ filters, onChange }) {
  const { t } = useTranslation();
  const [min, setMin] = useState(filters.minAmount);
  const [max, setMax] = useState(filters.maxAmount);
  const [tag, setTag] = useState(filters.tag);
  const debouncedMin = useDebounce(min, 400);
  const debouncedMax = useDebounce(max, 400);
  const debouncedTag = useDebounce(tag, 400);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const minError = debouncedMin && !AMOUNT.test(debouncedMin) ? 'validation.amountFormat' : null;
  const maxError = debouncedMax && !AMOUNT.test(debouncedMax) ? 'validation.amountFormat' : null;
  const rangeError =
    !minError &&
    !maxError &&
    debouncedMin &&
    debouncedMax &&
    Number(debouncedMin) > Number(debouncedMax)
      ? 'expenses.rangeInvalid'
      : null;
  const cleanTag = debouncedTag.trim().toLowerCase();
  const tagError = cleanTag.length > MAX_TAG_LENGTH ? 'validation.tooLong' : null;

  useEffect(() => {
    const amountsOk = !minError && !maxError && !rangeError;
    onChangeRef.current({
      minAmount: amountsOk ? debouncedMin : '',
      maxAmount: amountsOk ? debouncedMax : '',
      tag: tagError ? '' : cleanTag,
    });
  }, [debouncedMin, debouncedMax, cleanTag, minError, maxError, rangeError, tagError]);

  return (
    <>
      <Input
        label={t('expenses.minAmount')}
        placeholder="0.00"
        inputMode="decimal"
        autoComplete="off"
        value={min}
        onChange={(event) => setMin(event.target.value)}
        error={minError}
      />
      <Input
        label={t('expenses.maxAmount')}
        placeholder="0.00"
        inputMode="decimal"
        autoComplete="off"
        value={max}
        onChange={(event) => setMax(event.target.value)}
        error={maxError ?? rangeError}
      />
      <Input
        label={t('expenses.tagFilter')}
        autoComplete="off"
        value={tag}
        onChange={(event) => setTag(event.target.value)}
        error={tagError}
      />
    </>
  );
}

/**
 * The search box, the "Filters" button and the panel with every filter of the expense list.
 *
 * filters: the applied filters (see EMPTY_FILTERS). onChange(partialFilters) applies a change;
 * onReset() clears everything. categories: expense categories. accounts: ALL accounts, archived
 * ones too (old expenses may sit in an archived account).
 * sortValue ('date:desc') and onSortChange(value): the sort select, shown on phones only.
 */
export function ExpenseFilters({
  filters,
  onChange,
  onReset,
  categories = [],
  accounts = [],
  sortValue,
  onSortChange,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const active = countActiveFilters(filters);

  const reset = () => {
    setResetCount((count) => count + 1);
    onReset();
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-2">
        <SearchBar
          className="min-w-0 flex-1"
          value={filters.search}
          placeholder={t('expenses.searchPlaceholder')}
          onSearch={(search) => onChange({ search })}
        />
        <Button
          variant="outline"
          aria-expanded={open}
          aria-controls="expense-filters"
          iconStart={<SlidersHorizontal className="h-4 w-4" />}
          onClick={() => setOpen((value) => !value)}
        >
          {t('expenses.filters')}
          {active > 0 ? <Badge variant="primary">{active}</Badge> : null}
        </Button>
      </div>

      {open ? (
        <Card id="expense-filters" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DatePicker
              label={t('expenses.from')}
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => onChange({ from: event.target.value })}
            />
            <DatePicker
              label={t('expenses.to')}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => onChange({ to: event.target.value })}
            />
            <Select
              label={t('expenses.category')}
              value={filters.categoryId}
              onChange={(event) => onChange({ categoryId: event.target.value })}
              options={[
                { value: '', label: t('expenses.allCategories') },
                ...categories.map((category) => ({
                  value: category.id,
                  label: categoryName(t, category.name),
                })),
              ]}
            />
            <Select
              label={t('expenses.account')}
              value={filters.accountId}
              onChange={(event) => onChange({ accountId: event.target.value })}
              options={[
                { value: '', label: t('expenses.allAccounts') },
                ...accounts.map((account) => ({
                  value: account.id,
                  label: account.isArchived
                    ? t('expenses.archivedAccount', { name: account.name })
                    : account.name,
                })),
              ]}
            />
            <Select
              label={t('expenses.paymentMethod')}
              value={filters.paymentMethod}
              onChange={(event) => onChange({ paymentMethod: event.target.value })}
              options={[
                { value: '', label: t('expenses.allMethods') },
                ...PAYMENT_METHODS.map((method) => ({
                  value: method,
                  label: t(`expenses.paymentMethods.${method}`),
                })),
              ]}
            />
            <Select
              className="md:hidden"
              label={t('expenses.sortBy')}
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              options={SORT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(`expenses.sort.${option.key}`),
              }))}
            />
            <TypedFilters key={resetCount} filters={filters} onChange={onChange} />
          </div>

          {active > 0 ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('expenses.clearFilters')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
