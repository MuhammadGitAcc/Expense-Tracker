-- 003_create_accounts.sql
-- Wallets / accounts. balance is kept in sync by the app inside DB transactions.

CREATE TABLE accounts (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        VARCHAR(100)  NOT NULL,
  type        VARCHAR(10)   NOT NULL DEFAULT 'cash',
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    CHAR(3)       NOT NULL DEFAULT 'USD',
  color       VARCHAR(7)    NOT NULL DEFAULT '#3B82F6',
  is_archived BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT accounts_type_check    CHECK (type IN ('cash', 'bank', 'card', 'savings')),
  CONSTRAINT accounts_currency_fmt  CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT accounts_color_format  CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT accounts_user_name_unique UNIQUE (user_id, name)
);
