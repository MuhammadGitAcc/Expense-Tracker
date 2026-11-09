'use strict';

const db = require('../config/db');

/**
 * Read-only SQL aggregates for the dashboard and the reports. Every query filters by
 * user_id, and sums are done by PostgreSQL with exact NUMERIC math (money comes back as
 * strings like "12.50"). Amounts are never converted between currencies, so every query
 * is limited to the accounts of ONE currency. Transfers are not income or expense and are
 * left out on purpose. Archived accounts still count: their history is real.
 * Dates are "YYYY-MM-DD" strings, both ends inclusive.
 */

// Income and expense rows of one user, one currency and one date range, as one list.
// Parameters: $1 user id, $2 currency, $3 from, $4 to.
const TRANSACTIONS_CTE = `
  tx AS (
    SELECT 'income'::text AS type, i.date, i.amount
    FROM incomes i
    JOIN accounts a ON a.id = i.account_id
    WHERE i.user_id = $1 AND a.currency = $2 AND i.date BETWEEN $3::date AND $4::date
    UNION ALL
    SELECT 'expense'::text, e.date, e.amount
    FROM expenses e
    JOIN accounts a ON a.id = e.account_id
    WHERE e.user_id = $1 AND a.currency = $2 AND e.date BETWEEN $3::date AND $4::date
  )`;

const SUMS = `
  ROUND(COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0), 2)  AS income,
  ROUND(COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0), 2) AS expense`;

/** Currencies of the user's accounts, for example ['EUR', 'USD']. */
async function listCurrencies(userId, client = db) {
  const { rows } = await client.query(
    'SELECT DISTINCT currency FROM accounts WHERE user_id = $1 ORDER BY currency',
    [userId],
  );
  return rows.map((row) => row.currency.trim());
}

/** Total balance of the active (not archived) accounts in one currency. */
async function balanceTotal(userId, currency, client = db) {
  const { rows } = await client.query(
    `SELECT ROUND(COALESCE(SUM(balance), 0), 2) AS total, COUNT(*)::int AS account_count
     FROM accounts
     WHERE user_id = $1 AND currency = $2 AND NOT is_archived`,
    [userId, currency],
  );
  return { total: rows[0].total, accountCount: rows[0].account_count };
}

/** Income, expense, savings (income - expense) and the savings rate of one date range. */
async function totals(userId, currency, from, to, client = db) {
  const { rows } = await client.query(
    `WITH ${TRANSACTIONS_CTE}
     SELECT ${SUMS},
            COUNT(*) FILTER (WHERE type = 'income')::int  AS income_count,
            COUNT(*) FILTER (WHERE type = 'expense')::int AS expense_count
     FROM tx`,
    [userId, currency, from, to],
  );
  const row = rows[0];
  const { rows: calc } = await client.query(
    `SELECT ($1::numeric - $2::numeric) AS savings,
            CASE WHEN $1::numeric > 0
                 THEN ROUND(($1::numeric - $2::numeric) * 100 / $1::numeric, 1)::float8
            END AS savings_rate`,
    [row.income, row.expense],
  );
  return {
    income: row.income,
    expense: row.expense,
    savings: calc[0].savings,
    savingsRate: calc[0].savings_rate, // percent, null when there was no income
    incomeCount: row.income_count,
    expenseCount: row.expense_count,
  };
}

/**
 * Income and expense per day or per month, with empty buckets filled with "0.00" so a chart
 * never has gaps. `period` is the bucket start: "2026-11-09" (day) or "2026-11" (month).
 */
async function series(userId, currency, from, to, granularity, client = db) {
  const isMonth = granularity === 'month';
  const { rows } = await client.query(
    `WITH ${TRANSACTIONS_CTE}
     SELECT to_char(b.bucket, ${isMonth ? "'YYYY-MM'" : "'YYYY-MM-DD'"}) AS period,
            ROUND(COALESCE(SUM(tx.amount) FILTER (WHERE tx.type = 'income'), 0), 2)  AS income,
            ROUND(COALESCE(SUM(tx.amount) FILTER (WHERE tx.type = 'expense'), 0), 2) AS expense,
            ROUND(COALESCE(SUM(tx.amount) FILTER (WHERE tx.type = 'income'), 0)
                - COALESCE(SUM(tx.amount) FILTER (WHERE tx.type = 'expense'), 0), 2) AS net
     FROM generate_series(
            ${isMonth ? "date_trunc('month', $3::date::timestamp)" : '$3::date::timestamp'},
            $4::date::timestamp,
            ${isMonth ? "interval '1 month'" : "interval '1 day'"}
          ) AS b(bucket)
     LEFT JOIN tx
       ON ${isMonth ? "date_trunc('month', tx.date::timestamp)" : 'tx.date::timestamp'} = b.bucket
     GROUP BY b.bucket
     ORDER BY b.bucket`,
    [userId, currency, from, to],
  );
  return rows;
}

/**
 * Totals per category of one type, biggest first. `percent` is the share of the grand
 * total (one decimal). The table name comes from a fixed list, never from the client.
 */
async function byCategory(userId, currency, type, from, to, client = db) {
  const table = type === 'income' ? 'incomes' : 'expenses';
  const { rows } = await client.query(
    `SELECT c.id, c.name, c.icon, c.color,
            ROUND(SUM(t.amount), 2) AS total,
            COUNT(*)::int AS count,
            ROUND(SUM(t.amount) * 100 / SUM(SUM(t.amount)) OVER (), 1)::float8 AS percent
     FROM ${table} t
     JOIN accounts a   ON a.id = t.account_id
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND a.currency = $2 AND t.date BETWEEN $3::date AND $4::date
     GROUP BY c.id, c.name, c.icon, c.color
     ORDER BY SUM(t.amount) DESC, c.name`,
    [userId, currency, from, to],
  );
  return rows.map((row) => ({
    category: { id: row.id, name: row.name, icon: row.icon, color: row.color },
    total: row.total,
    count: row.count,
    percent: row.percent,
  }));
}

/** Income and expense per account (accounts without activity are listed with zeros). */
async function byAccount(userId, currency, from, to, client = db) {
  const { rows } = await client.query(
    `SELECT a.id, a.name, a.type, a.color, a.is_archived, a.balance,
            ROUND(COALESCE(i.total, 0), 2) AS income,
            ROUND(COALESCE(e.total, 0), 2) AS expense,
            ROUND(COALESCE(i.total, 0) - COALESCE(e.total, 0), 2) AS net
     FROM accounts a
     LEFT JOIN (
       SELECT account_id, SUM(amount) AS total FROM incomes
       WHERE user_id = $1 AND date BETWEEN $3::date AND $4::date GROUP BY account_id
     ) i ON i.account_id = a.id
     LEFT JOIN (
       SELECT account_id, SUM(amount) AS total FROM expenses
       WHERE user_id = $1 AND date BETWEEN $3::date AND $4::date GROUP BY account_id
     ) e ON e.account_id = a.id
     WHERE a.user_id = $1 AND a.currency = $2
       AND (NOT a.is_archived OR i.total IS NOT NULL OR e.total IS NOT NULL)
     ORDER BY a.is_archived, a.name`,
    [userId, currency, from, to],
  );
  return rows.map((row) => ({
    account: {
      id: row.id,
      name: row.name,
      type: row.type,
      color: row.color,
      isArchived: row.is_archived,
      balance: row.balance,
    },
    income: row.income,
    expense: row.expense,
    net: row.net,
  }));
}

/** The newest income and expense rows together (for the dashboard's "recent" list). */
async function recentTransactions(userId, currency, limit, client = db) {
  const { rows } = await client.query(
    `SELECT * FROM (
       SELECT 'expense'::text AS type, e.id, e.amount, e.date, e.created_at, e.note,
              NULL::text AS source, c.id AS category_id, c.name AS category_name,
              c.icon AS category_icon, c.color AS category_color,
              a.id AS account_id, a.name AS account_name
       FROM expenses e
       JOIN accounts a   ON a.id = e.account_id
       JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = $1 AND a.currency = $2
       UNION ALL
       SELECT 'income'::text, i.id, i.amount, i.date, i.created_at, i.note,
              i.source, c.id, c.name, c.icon, c.color, a.id, a.name
       FROM incomes i
       JOIN accounts a   ON a.id = i.account_id
       JOIN categories c ON c.id = i.category_id
       WHERE i.user_id = $1 AND a.currency = $2
     ) t
     ORDER BY t.date DESC, t.created_at DESC, t.id
     LIMIT $3`,
    [userId, currency, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    date: row.date,
    note: row.note,
    source: row.source,
    category: {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      color: row.category_color,
    },
    account: { id: row.account_id, name: row.account_name },
  }));
}

module.exports = {
  listCurrencies,
  balanceTotal,
  totals,
  series,
  byCategory,
  byAccount,
  recentTransactions,
};
