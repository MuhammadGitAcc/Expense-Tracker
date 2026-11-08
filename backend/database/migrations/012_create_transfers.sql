-- 012_create_transfers.sql
-- Money moved between two accounts of the same user (Phase 4.2). The two balances are
-- updated in one database transaction by the API; this table keeps the history.
-- Like expenses, the account foreign keys use NO ACTION: an account with transfers cannot
-- be deleted (archive it), while deleting a user still removes everything.

CREATE TABLE transfers (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_account_id UUID          NOT NULL REFERENCES accounts (id),
  to_account_id   UUID          NOT NULL REFERENCES accounts (id),
  amount          NUMERIC(12,2) NOT NULL,
  date            DATE          NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT transfers_amount_positive CHECK (amount > 0),
  CONSTRAINT transfers_different_accounts CHECK (from_account_id <> to_account_id)
);

CREATE INDEX transfers_user_date_idx ON transfers (user_id, date DESC, created_at DESC);
CREATE INDEX transfers_from_account_idx ON transfers (from_account_id);
CREATE INDEX transfers_to_account_idx ON transfers (to_account_id);