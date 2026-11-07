-- 001_default_categories.sql
-- Default categories shared by every user (user_id NULL, is_default TRUE).
-- Re-runnable: existing defaults are left untouched.
-- Icon values are plain names the frontend maps to icons in Phase 7+.

INSERT INTO categories (user_id, name, type, icon, color, is_default) VALUES
  -- Expense categories
  (NULL, 'Food',          'expense', 'utensils',      '#F97316', TRUE),
  (NULL, 'Transport',     'expense', 'car',           '#3B82F6', TRUE),
  (NULL, 'Rent',          'expense', 'home',          '#8B5CF6', TRUE),
  (NULL, 'Bills',         'expense', 'receipt',       '#EF4444', TRUE),
  (NULL, 'Shopping',      'expense', 'shopping-bag',  '#EC4899', TRUE),
  (NULL, 'Health',        'expense', 'heart-pulse',   '#10B981', TRUE),
  (NULL, 'Entertainment', 'expense', 'film',          '#F59E0B', TRUE),
  (NULL, 'Education',     'expense', 'graduation-cap','#06B6D4', TRUE),
  (NULL, 'Travel',        'expense', 'plane',         '#0EA5E9', TRUE),
  (NULL, 'Gifts',         'expense', 'gift',          '#D946EF', TRUE),
  (NULL, 'Other',         'expense', 'tag',           '#6B7280', TRUE),
  -- Income categories
  (NULL, 'Salary',        'income',  'briefcase',     '#16A34A', TRUE),
  (NULL, 'Freelance',     'income',  'laptop',        '#14B8A6', TRUE),
  (NULL, 'Gifts',         'income',  'gift',          '#D946EF', TRUE),
  (NULL, 'Investments',   'income',  'trending-up',   '#2563EB', TRUE),
  (NULL, 'Other',         'income',  'tag',           '#6B7280', TRUE)
ON CONFLICT (type, LOWER(name)) WHERE user_id IS NULL DO NOTHING;
