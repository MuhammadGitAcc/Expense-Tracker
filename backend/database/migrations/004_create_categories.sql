-- 004_create_categories.sql
-- Default categories have user_id NULL and is_default TRUE.
-- Custom categories belong to one user.

CREATE TABLE categories (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         REFERENCES users (id) ON DELETE CASCADE,
  name       VARCHAR(60)  NOT NULL,
  type       VARCHAR(10)  NOT NULL,
  icon       VARCHAR(50)  NOT NULL DEFAULT 'tag',
  color      VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
  is_default BOOLEAN      NOT NULL DEFAULT FALSE,

  CONSTRAINT categories_type_check   CHECK (type IN ('income', 'expense')),
  CONSTRAINT categories_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- A row is a default category exactly when it has no owner.
  CONSTRAINT categories_default_has_no_owner CHECK ((user_id IS NULL) = is_default)
);

-- UNIQUE (user_id, ...) does not work for NULL owners, so use two partial indexes.
CREATE UNIQUE INDEX categories_default_unique
  ON categories (type, LOWER(name)) WHERE user_id IS NULL;

CREATE UNIQUE INDEX categories_user_unique
  ON categories (user_id, type, LOWER(name)) WHERE user_id IS NOT NULL;
