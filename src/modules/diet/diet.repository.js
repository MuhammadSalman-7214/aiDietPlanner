const { getDb } = require('../../config/db');

const createPlan = async (userId, plan) => {
  const db = getDb();
  const [result] = await db.query(
    `INSERT INTO diet_plans (user_id, plan_json, created_at)
     VALUES (?, ?, NOW())`,
    [userId, JSON.stringify(plan)]
  );
  const [rows] = await db.query('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0]
    ? {
        id: rows[0].id,
        userId: rows[0].user_id,
        plan: JSON.parse(rows[0].plan_json),
        createdAt: rows[0].created_at ? new Date(rows[0].created_at) : null,
      }
    : null;
};

const findLatestPlan = async (userId) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT * FROM diet_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    userId: rows[0].user_id,
    plan: JSON.parse(rows[0].plan_json),
    createdAt: rows[0].created_at ? new Date(rows[0].created_at) : null,
  };
};

module.exports = { createPlan, findLatestPlan };
