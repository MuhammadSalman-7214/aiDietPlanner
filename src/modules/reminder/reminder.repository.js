const { getDb } = require('../../config/db');

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const createReminder = async (userId, data) => {
  const db = getDb();
  const { type, message, scheduledAt, enabled } = data;
  const [result] = await db.query(
    `INSERT INTO reminders
      (user_id, type, message, scheduled_at, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, type, message, scheduledAt, enabled ? 1 : 0]
  );
  const [rows] = await db.query('SELECT * FROM reminders WHERE id = ? LIMIT 1', [result.insertId]);
  return mapRow(rows[0]);
};

const listReminders = async (userId) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT * FROM reminders WHERE user_id = ? ORDER BY scheduled_at ASC',
    [userId]
  );
  return rows.map(mapRow);
};

const updateReminder = async (userId, reminderId, data) => {
  const db = getDb();
  const fields = [];
  const values = [];

  const mapping = {
    type: 'type',
    message: 'message',
    scheduledAt: 'scheduled_at',
    enabled: 'enabled',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(`${column} = ?`);
      values.push(key === 'enabled' ? (data[key] ? 1 : 0) : data[key]);
    }
  });

  if (!fields.length) return null;

  fields.push('updated_at = NOW()');
  await db.query(
    `UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    [...values, reminderId, userId]
  );
  const [rows] = await db.query('SELECT * FROM reminders WHERE id = ? AND user_id = ? LIMIT 1', [
    reminderId,
    userId,
  ]);
  return mapRow(rows[0]);
};

const deleteReminder = async (userId, reminderId) => {
  const db = getDb();
  await db.query('DELETE FROM reminders WHERE id = ? AND user_id = ?', [reminderId, userId]);
};

module.exports = { createReminder, listReminders, updateReminder, deleteReminder };
