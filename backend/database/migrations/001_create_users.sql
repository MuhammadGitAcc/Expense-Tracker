-- 001_create_users.sql
-- Users table + shared helper function that keeps updated_at current.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  avatar_url     TEXT,
  currency       CHAR(3)      NOT NULL DEFAULT 'USD',
  language       VARCHAR(5)   NOT NULL DEFAULT 'en',
  theme          VARCHAR(10)  NOT NULL DEFAULT 'system',
  role           VARCHAR(10)  NOT NULL DEFAULT 'user',
  email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT users_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT users_language_check  CHECK (language IN ('en', 'ar')),
  CONSTRAINT users_theme_check     CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT users_role_check      CHECK (role IN ('user', 'admin'))
);

-- Emails are unique ignoring case: "A@x.com" and "a@x.com" are the same person.
CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
