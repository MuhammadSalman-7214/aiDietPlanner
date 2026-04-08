const { getDb } = require('../../config/db');

const mapFoodRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    category: row.category,
    dietType: row.diet_type,
    ingredients: row.ingredients ? JSON.parse(row.ingredients) : [],
    instructions: row.instructions ? JSON.parse(row.instructions) : [],
  };
};

const findFoods = async (query = {}) => {
  const db = getDb();
  const conditions = [];
  const values = [];

  if (query.dietType) {
    conditions.push('diet_type = ?');
    values.push(query.dietType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(`SELECT * FROM foods ${whereClause}`, values);
  return rows.map(mapFoodRow);
};

const createFood = async (data) => {
  const db = getDb();
  const {
    name,
    calories,
    protein,
    carbs,
    fats,
    category,
    dietType,
    ingredients,
    instructions,
  } = data;

  const [result] = await db.query(
    `INSERT INTO foods
      (name, calories, protein, carbs, fats, category, diet_type, ingredients, instructions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      name,
      calories,
      protein,
      carbs,
      fats,
      category,
      dietType || 'any',
      ingredients ? JSON.stringify(ingredients) : null,
      instructions ? JSON.stringify(instructions) : null,
    ]
  );

  const [rows] = await db.query('SELECT * FROM foods WHERE id = ? LIMIT 1', [result.insertId]);
  return mapFoodRow(rows[0]);
};

module.exports = { findFoods, createFood };
