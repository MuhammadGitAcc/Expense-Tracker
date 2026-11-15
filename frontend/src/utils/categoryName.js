// The default categories come from the database in English (they are shared by every user).
// This is the list of those names, each one has a translation under "defaultCategories".
const DEFAULT_CATEGORY_NAMES = new Set([
  'Food',
  'Transport',
  'Rent',
  'Bills',
  'Shopping',
  'Health',
  'Entertainment',
  'Education',
  'Travel',
  'Gifts',
  'Other',
  'Salary',
  'Freelance',
  'Investments',
]);

/** The category name in the current language. A category the person made keeps its own name. */
export function categoryName(t, name) {
  if (typeof name !== 'string') return name ?? '';
  return DEFAULT_CATEGORY_NAMES.has(name) ? t(`defaultCategories.${name}`) : name;
}
