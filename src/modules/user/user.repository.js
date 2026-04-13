const { getDb } = require('../../config/db');

const mapUserRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isEmailVerified: Boolean(row.is_email_verified),
    isPremium: Boolean(row.is_premium),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    profileImageUrl: row.profile_image_url || null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const mapStatsRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    mealPreferences: row.meal_preferences ? JSON.parse(row.meal_preferences) : [],
    mealAllergies: row.meal_allergies ? JSON.parse(row.meal_allergies) : [],
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const findById = async (id) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT id, name, email, is_email_verified, is_premium, is_active, profile_image_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return mapUserRow(rows[0]);
};

const updateUser = async (id, data) => {
  const db = getDb();
  const fields = [];
  const values = [];

  const mapping = {
    name: 'name',
    passwordHash: 'password_hash',
    isActive: 'is_active',
    profileImageUrl: 'profile_image_url',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(`${column} = ?`);
      const value = key === 'isActive' ? (data[key] ? 1 : 0) : data[key];
      values.push(value);
    }
  });

  if (!fields.length) {
    const [rows] = await db.query(
      'SELECT id, name, email, is_email_verified, is_premium, is_active, profile_image_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return mapUserRow(rows[0]);
  }

  fields.push('updated_at = NOW()');
  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  const [rows] = await db.query(
    'SELECT id, name, email, is_email_verified, is_premium, is_active, profile_image_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return mapUserRow(rows[0]);
};

const deleteUserById = async (id) => {
  const db = getDb();
  await db.query('DELETE FROM users WHERE id = ?', [id]);
};

const getStatsByUserId = async (userId) => {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [userId]);
  return mapStatsRow(rows[0]);
};

const mapProfileRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    age: row.age,
    gender: row.gender,
    activityLevel: row.activity_level,
    goal: row.goal,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const getProfileByUserId = async (userId) => {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
  return mapProfileRow(rows[0]);
};

const createProfile = async (userId, data) => {
  const db = getDb();
  const { age, gender, activityLevel, goal } = data;
  const [result] = await db.query(
    `INSERT INTO user_profiles
      (user_id, age, gender, activity_level, goal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, age, gender, activityLevel, goal]
  );
  const [rows] = await db.query('SELECT * FROM user_profiles WHERE id = ? LIMIT 1', [result.insertId]);
  return mapProfileRow(rows[0]);
};

const updateProfileData = async (userId, data) => {
  const db = getDb();
  const fields = [];
  const values = [];

  const mapping = {
    age: 'age',
    gender: 'gender',
    activityLevel: 'activity_level',
    goal: 'goal',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(`${column} = ?`);
      values.push(data[key]);
    }
  });

  if (!fields.length) return getProfileByUserId(userId);

  fields.push('updated_at = NOW()');
  await db.query(`UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = ?`, [...values, userId]);
  const [rows] = await db.query('SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
  return mapProfileRow(rows[0]);
};

const exportUserData = async (userId) => {
  const db = getDb();
  const [userRows] = await db.query(
    'SELECT id, name, email, is_email_verified, is_premium, is_active, profile_image_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = mapUserRow(userRows[0]);
  const stats = await getStatsByUserId(userId);
  const profile = await getProfileByUserId(userId);
  const [logRows] = await db.query('SELECT * FROM nutrition_logs WHERE user_id = ? ORDER BY logged_at DESC', [userId]);
  const [progressRows] = await db.query(
    'SELECT * FROM nutrition_progress WHERE user_id = ? ORDER BY date DESC',
    [userId]
  );
  const [reminderRows] = await db.query('SELECT * FROM reminders WHERE user_id = ? ORDER BY scheduled_at DESC', [userId]);
  const [consultRows] = await db.query('SELECT * FROM consultations WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  const [planRows] = await db.query('SELECT * FROM diet_plans WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  const [weightRows] = await db.query(
    'SELECT * FROM user_weight_logs WHERE user_id = ? ORDER BY logged_at DESC',
    [userId]
  );

  return {
    user,
    stats,
    profile,
    nutritionLogs: logRows.map(mapLogRowForExport),
    nutritionProgress: progressRows.map(mapProgressRowForExport),
    reminders: reminderRows,
    consultations: consultRows,
    dietPlans: planRows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      plan: row.plan_json ? JSON.parse(row.plan_json) : {},
    })),
    weightLogs: weightRows.map((row) => ({
      id: row.id,
      weightKg: row.weight_kg,
      loggedAt: row.logged_at,
    })),
  };
};

const mapLogRowForExport = (row) => ({
  id: row.id,
  name: row.name,
  calories: row.calories,
  protein: row.protein,
  carbs: row.carbs,
  fats: row.fats,
  loggedAt: row.logged_at,
});

const mapProgressRowForExport = (row) => ({
  id: row.id,
  date: row.date,
  targetCalories: row.target_calories,
  consumedCalories: row.consumed_calories,
});

const createStats = async (userId, data) => {
  const db = getDb();
  const {
    heightCm,
    weightKg,
    mealPreferences,
    mealAllergies,
  } = data;

  await db.query(
    `INSERT INTO user_stats
      (user_id, height_cm, weight_kg, meal_preferences, meal_allergies, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      userId,
      heightCm,
      weightKg,
      mealPreferences,
      mealAllergies,
    ]
  );

  const [rows] = await db.query('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [userId]);
  return mapStatsRow(rows[0]);
};

const updateStats = async (userId, data) => {
  const db = getDb();
  const fields = [];
  const values = [];

  const mapping = {
    heightCm: 'height_cm',
    weightKg: 'weight_kg',
    mealPreferences: 'meal_preferences',
    mealAllergies: 'meal_allergies',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(`${column} = ?`);
      values.push(data[key]);
    }
  });

  if (!fields.length) return getStatsByUserId(userId);

  fields.push('updated_at = NOW()');
  await db.query(`UPDATE user_stats SET ${fields.join(', ')} WHERE user_id = ?`, [...values, userId]);
  const [rows] = await db.query('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [userId]);
  return mapStatsRow(rows[0]);
};

const createWeightLog = async (userId, weightKg, loggedAt) => {
  const db = getDb();
  await db.query(
    `INSERT INTO user_weight_logs (user_id, weight_kg, logged_at, created_at)
     VALUES (?, ?, ?, NOW())`,
    [userId, weightKg, loggedAt]
  );
};

const listWeightLogs = async (userId, startDate, endDate) => {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT * FROM user_weight_logs
     WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
     ORDER BY logged_at ASC`,
    [userId, startDate, endDate]
  );
  return rows.map((row) => ({
    id: row.id,
    weightKg: row.weight_kg,
    loggedAt: row.logged_at,
  }));
};

module.exports = {
  findById,
  updateUser,
  deleteUserById,
  getStatsByUserId,
  createStats,
  updateStats,
  getProfileByUserId,
  createProfile,
  updateProfileData,
  exportUserData,
  createWeightLog,
  listWeightLogs,
};
