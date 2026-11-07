-- 008_create_recurring_transactions.sql
-- Templates the daily job (Phase 5) turns into real expenses/incomes.
-- note, created_at and updated_at are small additions so generated rows can copy the note.

CREATE TABLE recurring_transactions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          VARCHAR(10)   NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  account_id    UUID          NOT NULL REFERENCES accounts (id),
  category_id   UUID          NOT NULL REFERENCES categories (id),
  frequency     VARCHAR(10)   NOT NULL,
  start_date    DATE          NOT NULL,
  end_date      DATE,
  next_run_date DATE          NOT NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  note          TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT recurring_type_check      CHECK (type IN ('income', 'expense')),
  CONSTRAINT recurring_amount_positive CHECK (amount > 0),
  CONSTRAINT recurring_frequency_check CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  CONSTRAINT recurring_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER recurring_set_updated_at
  BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Now that the table exists, link generated transactions back to their template.
-- Deleting a template keeps the history it already created.
ALTER TABLE expenses
  ADD CONSTRAINT expenses_recurring_fk
  FOREIGN KEY (recurring_id) REFERENCES recurring_transactions (id) ON DELETE SET NULL;

ALTER TABLE incomes
  ADD CONSTRAINT incomes_recurring_fk
  FOREIGN KEY (recurring_id) REFERENCES recurring_transactions (id) ON DELETE SET NULL;
