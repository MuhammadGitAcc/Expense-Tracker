-- 013_add_budget_alert_level.sql
-- Remembers the highest alert already sent for a budget, so the user is told once when a
-- budget reaches its alert level and once when it is exceeded (not on every new expense).
-- NULL = no alert sent (or the budget is back under its alert level).

ALTER TABLE budgets
  ADD COLUMN last_alert_level VARCHAR(10),
  ADD CONSTRAINT budgets_last_alert_level_check
    CHECK (last_alert_level IS NULL OR last_alert_level IN ('warning', 'exceeded'));