const { getDb } = require('../../config/db');

const mapPlanRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan_json ? JSON.parse(row.plan_json) : {},
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const sanitizePlanForStorage = (plan) => {
  if (!plan || typeof plan !== 'object') return plan;

  const sanitized = Array.isArray(plan) ? [...plan] : { ...plan };
  if (sanitized.nutrition && typeof sanitized.nutrition === 'object' && !Array.isArray(sanitized.nutrition)) {
    const {
      mealPreferences,
      mealAllergies,
      mealDislikes,
      ...nutrition
    } = sanitized.nutrition;
    sanitized.nutrition = nutrition;
  }

  return sanitized;
};

const createPlan = async (userId, plan) => {
  const db = getDb();
  const storedPlan = sanitizePlanForStorage(plan);
  const [latestRows] = await db.query(
    `SELECT id
     FROM diet_plans
     WHERE user_id = ?
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 1`,
    [userId],
  );

  if (latestRows[0]) {
    await db.query(
      `UPDATE diet_plans
       SET plan_json = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(storedPlan), latestRows[0].id],
    );

    const [rows] = await db.query('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [latestRows[0].id]);
    return mapPlanRow(rows[0]);
  }

  const [result] = await db.query(
    `INSERT INTO diet_plans (user_id, plan_json, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW())`,
    [userId, JSON.stringify(storedPlan)],
  );
  const [rows] = await db.query('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [result.insertId]);
  return mapPlanRow(rows[0]);
};

const findLatestPlan = async (userId) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT * FROM diet_plans WHERE user_id = ? ORDER BY COALESCE(updated_at, created_at) DESC, id DESC LIMIT 1',
    [userId],
  );
  return mapPlanRow(rows[0]);
};

module.exports = { createPlan, findLatestPlan };
