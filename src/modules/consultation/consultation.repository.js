const { getDb } = require('../../config/db');

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    topic: row.topic,
    notes: row.notes,
    status: row.status,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const createRequest = async (userId, data) => {
  const db = getDb();
  const { topic, notes, scheduledAt } = data;
  const [result] = await db.query(
    `INSERT INTO consultations
      (user_id, topic, notes, status, scheduled_at, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, NOW(), NOW())`,
    [userId, topic, notes || null, scheduledAt || null]
  );
  const [rows] = await db.query('SELECT * FROM consultations WHERE id = ? LIMIT 1', [result.insertId]);
  return mapRow(rows[0]);
};

const listByUser = async (userId) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT * FROM consultations WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(mapRow);
};

module.exports = { createRequest, listByUser };
