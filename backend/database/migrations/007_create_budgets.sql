-- 007_create_budgets.sql
-- One budget per user + category + month + year. category_id NULL = overall budget.

CREATE TABLE budgets (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id     UUID          REFERENCES categories (id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,
  month           SMALLINT      NOT NULL,
  year            SMALLINT      NOT NULL,
  alert_threshold SMALLINT      NOT NULL DEFAULT 80,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT budgets_amount_positive  CHECK (amount > 0),
  CONSTRAINT budgets_month_range      CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT budgets_year_range       CHECK (year BETWEEN 2000 AND 2100),
  CONSTRAINT budgets_threshold_range  CHECK (alert_threshold BETWEEN 1 AND 100)
);

-- NULL category_id values are never equal in a normal UNIQUE constraint,
-- so the "overall" budget gets its own partial index.
CREATE UNIQUE INDEX budgets_category_unique
  ON budgets (user_id, category_id, year, month) WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX budgets_overall_unique
  ON budgets (user_id, year, month) WHERE category_id IS NULL;
