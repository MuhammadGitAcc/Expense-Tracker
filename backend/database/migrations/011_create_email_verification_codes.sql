-- 011_create_email_verification_codes.sql
-- Sign-up email verification (Phase 3B). Only HASHES of the 6-digit codes are stored.

CREATE TABLE email_verification_codes (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash  VARCHAR(255) NOT NULL,
  attempts   SMALLINT     NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT email_verification_codes_attempts_check CHECK (attempts >= 0)
);

-- Looking up the one active code of a user, and the latest code for the resend cooldown.
CREATE INDEX email_verification_codes_user_idx
  ON email_verification_codes (user_id, created_at DESC);

-- Accounts that existed before this feature keep working: mark them verified.
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;