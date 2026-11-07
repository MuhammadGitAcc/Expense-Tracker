-- 002_demo_data.sql
-- Demo user with accounts, budgets, ~3 months of transactions and recurring items.
-- Run with:  npm run seed:demo   (never in production)
--
-- Re-runnable: the demo user is deleted first and recreated (everything they own
-- cascades away). Dates are relative to today so the dashboard always looks current.
-- :demo_email and :demo_password_hash are filled in by seed.js.

-- Cascades to accounts, transactions, budgets, etc. (all removed in one statement).
DELETE FROM users WHERE LOWER(email) = LOWER(:demo_email);

INSERT INTO users (id, name, email, password_hash, currency, language, theme, email_verified)
VALUES ('00000000-0000-4000-8000-000000000001', 'Demo User', :demo_email,
        :demo_password_hash, 'USD', 'en', 'system', TRUE);

-- ---------------------------------------------------------------- accounts
-- Opening balances; transaction totals are applied at the end of this file.
INSERT INTO accounts (id, user_id, name, type, balance, currency, color) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Wallet',          'cash',    600.00, 'USD', '#16A34A'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'Main Bank',       'bank',   2000.00, 'USD', '#3B82F6'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'Credit Card',     'card',      0.00, 'USD', '#EF4444'),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', 'Emergency Fund',  'savings',5000.00, 'USD', '#8B5CF6');

-- Helper tables live only for this transaction.
CREATE TEMP TABLE demo_months ON COMMIT DROP AS
  SELECT m AS months_ago,
         (DATE_TRUNC('month', CURRENT_DATE) - (m || ' month')::INTERVAL)::DATE AS first_day
  FROM generate_series(0, 2) AS m;

-- ---------------------------------------------------------------- expenses
-- (category, day of month, amount, account, payment method, note, tags)
CREATE TEMP TABLE demo_expense_templates (
  category TEXT, dom INT, amount NUMERIC(12,2), account TEXT, method TEXT, note TEXT, tags TEXT[]
) ON COMMIT DROP;

INSERT INTO demo_expense_templates VALUES
  ('Rent',          1, 750.00, 'Main Bank',   'bank_transfer', 'Monthly rent',          '{housing}'),
  ('Bills',         3,  60.00, 'Main Bank',   'bank_transfer', 'Electricity',           '{utilities}'),
  ('Bills',         4,  35.00, 'Main Bank',   'bank_transfer', 'Internet',              '{utilities}'),
  ('Food',          2,  42.50, 'Wallet',      'cash',          'Groceries',             '{groceries}'),
  ('Food',          6,  18.00, 'Credit Card', 'card',          'Lunch with colleagues', '{eating-out}'),
  ('Food',          9,  65.20, 'Credit Card', 'card',          'Weekly groceries',      '{groceries}'),
  ('Food',         14,  27.80, 'Wallet',      'cash',          'Dinner',                '{eating-out}'),
  ('Food',         20,  71.40, 'Credit Card', 'card',          'Supermarket',           '{groceries}'),
  ('Food',         25,  22.00, 'Wallet',      'cash',          'Takeaway',              '{eating-out}'),
  ('Transport',     5,  30.00, 'Wallet',      'cash',          'Bus pass top-up',       '{commute}'),
  ('Transport',    12,  45.00, 'Credit Card', 'card',          'Fuel',                  '{car}'),
  ('Transport',    22,  14.50, 'Wallet',      'cash',          'Taxi',                  '{}'),
  ('Shopping',      8,  89.99, 'Credit Card', 'card',          'New shoes',             '{clothing}'),
  ('Shopping',     18,  34.90, 'Credit Card', 'card',          'Home supplies',         '{home}'),
  ('Health',       10,  25.00, 'Main Bank',   'bank_transfer', 'Pharmacy',              '{pharmacy}'),
  ('Entertainment',11,  15.99, 'Credit Card', 'card',          'Streaming subscription','{subscription}'),
  ('Entertainment',16,  38.00, 'Credit Card', 'card',          'Cinema and snacks',     '{movies}'),
  ('Education',    13,  49.00, 'Credit Card', 'card',          'Online course',         '{learning}'),
  ('Gifts',        19,  40.00, 'Wallet',      'cash',          'Birthday gift',         '{}'),
  ('Travel',       24, 120.00, 'Main Bank',   'bank_transfer', 'Weekend trip booking',  '{trip}');

INSERT INTO expenses (user_id, account_id, category_id, amount, date, note, payment_method, tags)
SELECT '00000000-0000-4000-8000-000000000001', a.id, c.id, t.amount,
       m.first_day + (t.dom - 1), t.note, t.method, t.tags
FROM demo_months m
CROSS JOIN demo_expense_templates t
JOIN accounts   a ON a.user_id = '00000000-0000-4000-8000-000000000001' AND a.name = t.account
JOIN categories c ON c.user_id IS NULL AND c.type = 'expense' AND c.name = t.category
WHERE m.first_day + (t.dom - 1) <= CURRENT_DATE;

-- ----------------------------------------------------------------- incomes
INSERT INTO incomes (user_id, account_id, category_id, amount, date, source, note)
SELECT '00000000-0000-4000-8000-000000000001', a.id, c.id, v.amount,
       m.first_day + (v.dom - 1), v.source, v.note
FROM demo_months m
CROSS JOIN (VALUES
  ('Salary',    1, 2800.00, 'Main Bank', 'Acme Corp',      'Monthly salary'),
  ('Freelance',15,  350.00, 'Main Bank', 'Side project',   'Website job'),
  ('Investments',20, 40.00, 'Emergency Fund', 'Savings interest', NULL)
) AS v(category, dom, amount, account, source, note)
JOIN accounts   a ON a.user_id = '00000000-0000-4000-8000-000000000001' AND a.name = v.account
JOIN categories c ON c.user_id IS NULL AND c.type = 'income' AND c.name = v.category
WHERE m.first_day + (v.dom - 1) <= CURRENT_DATE;

-- ----------------------------------------------------------------- budgets
-- Current month: overall budget plus three category budgets.
INSERT INTO budgets (user_id, category_id, amount, month, year, alert_threshold)
SELECT '00000000-0000-4000-8000-000000000001', c.id, v.amount,
       EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, v.threshold
FROM (VALUES
  ('Food',          300.00, 80),
  ('Transport',     120.00, 80),
  ('Entertainment',  60.00, 75)
) AS v(category, amount, threshold)
JOIN categories c ON c.user_id IS NULL AND c.type = 'expense' AND c.name = v.category;

INSERT INTO budgets (user_id, category_id, amount, month, year, alert_threshold)
VALUES ('00000000-0000-4000-8000-000000000001', NULL, 1800.00,
        EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, 90);

-- --------------------------------------------------------------- recurring
INSERT INTO recurring_transactions
  (user_id, type, amount, account_id, category_id, frequency, start_date, next_run_date, note)
SELECT '00000000-0000-4000-8000-000000000001', v.type, v.amount, a.id, c.id, v.frequency,
       v.start_date, v.next_run_date, v.note
FROM (VALUES
  ('expense', 750.00, 'Main Bank', 'Rent',   'monthly',
     (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 month')::DATE,
     (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE, 'Monthly rent'),
  ('income', 2800.00, 'Main Bank', 'Salary', 'monthly',
     (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 month')::DATE,
     (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE, 'Monthly salary'),
  ('expense', 15.99, 'Credit Card', 'Entertainment', 'monthly',
     (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 month')::DATE + 10,
     (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE + 10, 'Streaming subscription')
) AS v(type, amount, account, category, frequency, start_date, next_run_date, note)
JOIN accounts   a ON a.user_id = '00000000-0000-4000-8000-000000000001' AND a.name = v.account
JOIN categories c ON c.user_id IS NULL AND c.type = v.type AND c.name = v.category;

-- ----------------------------------------------------------- notifications
INSERT INTO notifications (user_id, type, title, message, is_read) VALUES
  ('00000000-0000-4000-8000-000000000001', 'system', 'Welcome to Expense Tracker',
     'This is demo data. Explore the dashboard, budgets and reports.', FALSE),
  ('00000000-0000-4000-8000-000000000001', 'budget_warning', 'Food budget at 80%',
     'You have used 80% of your Food budget this month.', FALSE);

-- ------------------------------------------------- make balances consistent
-- balance = opening balance + all incomes - all expenses (same rule the app follows).
UPDATE accounts a
SET balance = a.balance
  + COALESCE((SELECT SUM(i.amount) FROM incomes  i WHERE i.account_id = a.id), 0)
  - COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.account_id = a.id), 0)
WHERE a.user_id = '00000000-0000-4000-8000-000000000001';
