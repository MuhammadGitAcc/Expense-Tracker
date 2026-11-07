-- 006_create_incomes.sql
-- Same delete rules as expenses (see 005).

CREATE TABLE incomes (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  account_id   UUID          NOT NULL REFERENCES accounts (id),
  category_id  UUID          NOT NULL REFERENCES categories (id),
  amount       NUMERIC(12,2) NOT NULL,
  date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  source       VARCHAR(150),
  note         TEXT,
  recurring_id UUID,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT incomes_amount_positive CHECK (amount > 0)
);

CREATE TRIGGER incomes_set_updated_at
  BEFORE UPDATE ON incomes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
