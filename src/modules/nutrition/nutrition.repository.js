const { getDb } = require('../../config/db');

const mapLogRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    loggedAt: row.logged_at ? new Date(row.logged_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const mapProgressRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    targetCalories: row.target_calories,
    consumedCalories: row.consumed_calories,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const createFoodLog = async ({ userId, name, calories, protein, carbs, fats, loggedAt }) => {
  const db = getDb();
  const [result] = await db.query(
    `INSERT INTO nutrition_logs
      (user_id, name, calories, protein, carbs, fats, logged_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, name, calories, protein, carbs, fats, loggedAt]
  );
  const [rows] = await db.query('SELECT * FROM nutrition_logs WHERE id = ? LIMIT 1', [
    result.insertId,
  ]);
  return mapLogRow(rows[0]);
};

const findLogsForDate = async (userId, dateStart, dateEnd) => {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT * FROM nutrition_logs
     WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
     ORDER BY logged_at ASC`,
    [userId, dateStart, dateEnd]
  );
  return rows.map(mapLogRow);
};

const upsertProgress = async ({ userId, date, targetCalories, consumedCalories }) => {
  const db = getDb();
  await db.query(
    `INSERT INTO nutrition_progress
      (user_id, date, target_calories, consumed_calories, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
      target_calories = VALUES(target_calories),
      consumed_calories = VALUES(consumed_calories),
      updated_at = NOW()`,
    [userId, date, targetCalories, consumedCalories]
  );

  const [rows] = await db.query(
    'SELECT * FROM nutrition_progress WHERE user_id = ? AND date = ? LIMIT 1',
    [userId, date]
  );
  return mapProgressRow(rows[0]);
};

const findProgress = async (userId, date) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT * FROM nutrition_progress WHERE user_id = ? AND date = ? LIMIT 1',
    [userId, date]
  );
  return mapProgressRow(rows[0]);
};

const findProgressRange = async (userId, startDate, endDate) => {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT * FROM nutrition_progress
     WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`,
    [userId, startDate, endDate]
  );
  return rows.map(mapProgressRow);
};

module.exports = { createFoodLog, findLogsForDate, upsertProgress, findProgress, findProgressRange };
