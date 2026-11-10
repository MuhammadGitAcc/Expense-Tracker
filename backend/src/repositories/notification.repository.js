'use strict';

const db = require('../config/db');

/**
 * SQL for the notifications table. Every query filters by user_id: a client id is never
 * trusted on its own. The last argument `client` is optional: pass a transaction client to
 * join a transaction. create() is used by the Phase 5 jobs (recurring, budget alerts,
 * weekly summary).
 */

const COLUMNS = 'id, type, title, message, is_read, created_at';

const mapNotification = (row) =>
  row && {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
  };

/** Build the WHERE part shared by the list and its count. */
function buildFilters(userId, { isRead, type } = {}) {
  const where = ['user_id = $1'];
  const values = [userId];
  if (isRead !== undefined) {
    values.push(isRead);
    where.push(`is_read = $${values.length}`);
  }
  if (type !== undefined) {
    values.push(type);
    where.push(`type = $${values.length}`);
  }
  return { whereSql: where.join(' AND '), values };
}

/** One page of the user's notifications, newest first, and the total of the filtered set. */
async function list(userId, filters, { limit, offset }, client = db) {
  const { whereSql, values } = buildFilters(userId, filters);
  const [itemsResult, totalResult] = await Promise.all([
    client.query(
      `SELECT ${COLUMNS} FROM notifications
       WHERE ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    client.query(`SELECT COUNT(*)::int AS total FROM notifications WHERE ${whereSql}`, values),
  ]);
  return { items: itemsResult.rows.map(mapNotification), total: totalResult.rows[0].total };
}

/** How many unread notifications the user has (uses the partial index). */
async function countUnread(userId, client = db) {
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND NOT is_read',
    [userId],
  );
  return rows[0].count;
}

/** The user's OWN notification, or null. */
async function findById(id, userId, client = db) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM notifications WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return mapNotification(rows[0]) || null;
}

/** Mark one notification as read (idempotent). Resolves the notification, or null if not found. */
async function markRead(id, userId, client = db) {
  const { rows } = await client.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING ${COLUMNS}`,
    [id, userId],
  );
  return mapNotification(rows[0]) || null;
}

/** Mark every unread notification of the user as read. Resolves how many changed. */
async function markAllRead(userId, client = db) {
  const { rowCount } = await client.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read',
    [userId],
  );
  return rowCount;
}

/** Insert a notification (used by the jobs). Resolves the new notification. */
async function create({ userId, type, title, message }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [userId, type, title, message],
  );
  return mapNotification(rows[0]);
}

module.exports = { list, countUnread, findById, markRead, markAllRead, create };
