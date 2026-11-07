-- 010_create_indexes.sql
-- Indexes for the access patterns of Phases 4-5. Primary keys, UNIQUE constraints and the
-- budget/category partial unique indexes already have their own indexes.

-- Expenses: list/filter by user + date, filter by category or account, tag search.
CREATE INDEX expenses_user_date_idx      ON expenses (user_id, date DESC);
CREATE INDEX expenses_user_category_idx  ON expenses (user_id, category_id);
CREATE INDEX expenses_account_idx        ON expenses (account_id);
CREATE INDEX expenses_category_idx       ON expenses (category_id);
CREATE INDEX expenses_recurring_idx      ON expenses (recurring_id) WHERE recurring_id IS NOT NULL;
CREATE INDEX expenses_tags_idx           ON expenses USING GIN (tags);

-- Incomes: same patterns.
CREATE INDEX incomes_user_date_idx       ON incomes (user_id, date DESC);
CREATE INDEX incomes_user_category_idx   ON incomes (user_id, category_id);
CREATE INDEX incomes_account_idx         ON incomes (account_id);
CREATE INDEX incomes_category_idx        ON incomes (category_id);
CREATE INDEX incomes_recurring_idx       ON incomes (recurring_id) WHERE recurring_id IS NOT NULL;

-- Accounts and categories are always read per user.
CREATE INDEX accounts_user_idx           ON accounts (user_id);
CREATE INDEX categories_user_idx         ON categories (user_id);

-- Budgets: foreign key lookup (the unique indexes cover user lookups).
CREATE INDEX budgets_category_idx        ON budgets (category_id) WHERE category_id IS NOT NULL;

-- Recurring: the daily job scans active templates that are due.
CREATE INDEX recurring_due_idx           ON recurring_transactions (next_run_date) WHERE is_active;
CREATE INDEX recurring_user_idx          ON recurring_transactions (user_id);
CREATE INDEX recurring_account_idx       ON recurring_transactions (account_id);
CREATE INDEX recurring_category_idx      ON recurring_transactions (category_id);

-- Notifications: bell badge (unread count) and newest-first list.
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx       ON notifications (user_id) WHERE NOT is_read;

-- Auth: cleanup of expired tokens and per-user lookups.
CREATE INDEX refresh_tokens_user_idx     ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_idx  ON refresh_tokens (expires_at);
CREATE INDEX password_reset_user_idx     ON password_reset_tokens (user_id);
