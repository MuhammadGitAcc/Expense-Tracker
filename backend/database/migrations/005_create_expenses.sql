-- 005_create_expenses.sql
-- account_id / category_id use the default NO ACTION: you cannot delete an account
-- or category that still has expenses (the "safety check" from Phase 4), yet deleting
-- a whole user still works because their expenses are removed in the same statement.
-- recurring_id gets its foreign key in 008, once recurring_transactions exists.

CREATE TABLE expenses (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  account_id     UUID          NOT NULL REFERENCES accounts (id),
  category_id    UUID          NOT NULL REFERENCES categories (id),
  amount         NUMERIC(12,2) NOT NULL,
  date           DATE          NOT NULL DEFAULT CURRENT_DATE,
  note           TEXT,
  payment_method VARCHAR(20)   NOT NULL DEFAULT 'cash',
  tags           TEXT[]        NOT NULL DEFAULT '{}',
  receipt_url    TEXT,
  recurring_id   UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT expenses_amount_positive CHECK (amount > 0),
  CONSTRAINT expenses_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_wallet', 'other'))
);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
