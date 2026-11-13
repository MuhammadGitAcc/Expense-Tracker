// The first part of every TanStack Query key that holds money data. Every hook of a money screen
// must build its keys as [root, ...] with one of these roots (expenseKeys.all = ['expenses'], ...).
export const MONEY_QUERY_ROOTS = [
  'expenses',
  'incomes',
  'accounts',
  'budgets',
  'dashboard',
  'reports',
  'notifications',
];

/**
 * Call after anything that moves money (an expense or income saved, edited or deleted, a receipt
 * changed ...). Balances, budget progress, dashboard, reports and the notification bell (a budget
 * alert may have been created) all depend on it. Queries on screen refetch at once; the others
 * are only marked stale. A root that has no query yet does no harm.
 */
export function invalidateMoneyData(queryClient) {
  return Promise.all(
    MONEY_QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  );
}
