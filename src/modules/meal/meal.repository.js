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
    source: row.source || 'manual',
    normalizedName: row.normalized_name || null,
    componentTags: row.component_tags ? JSON.parse(row.component_tags) : [],
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

  if (query.source) {
    conditions.push('source = ?');
    values.push(query.source);
  }

  if (query.category) {
    conditions.push('category = ?');
    values.push(query.category);
  }

  if (query.normalizedName) {
    conditions.push('normalized_name = ?');
    values.push(query.normalizedName);
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
    source,
    normalizedName,
    componentTags,
    ingredients,
    instructions,
  } = data;

  const [result] = await db.query(
    `INSERT INTO foods
      (name, calories, protein, carbs, fats, category, diet_type, source, normalized_name, component_tags, ingredients, instructions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      name,
      calories,
      protein,
      carbs,
      fats,
      category,
      dietType || 'any',
      source || 'manual',
      normalizedName || null,
      componentTags ? JSON.stringify(componentTags) : null,
      ingredients ? JSON.stringify(ingredients) : null,
      instructions ? JSON.stringify(instructions) : null,
    ]
  );

  const [rows] = await db.query('SELECT * FROM foods WHERE id = ? LIMIT 1', [result.insertId]);
  return mapFoodRow(rows[0]);
};

const updateFoodMetadata = async (foodId, { normalizedName, componentTags }) => {
  const db = getDb();
  await db.query(
    `UPDATE foods
     SET normalized_name = ?, component_tags = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      normalizedName || null,
      componentTags ? JSON.stringify(componentTags) : null,
      foodId,
    ],
  );
  const [rows] = await db.query('SELECT * FROM foods WHERE id = ? LIMIT 1', [foodId]);
  return mapFoodRow(rows[0]);
};

const findFoodComponentsByFoodId = async (foodId) => {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT * FROM food_components WHERE food_id = ? ORDER BY id ASC',
    [foodId],
  );
  return rows.map((row) => ({
    id: row.id,
    foodId: row.food_id,
    componentName: row.component_name,
  }));
};

const replaceFoodComponents = async (foodId, components = []) => {
  const db = getDb();
  await db.query('DELETE FROM food_components WHERE food_id = ?', [foodId]);

  for (const component of components) {
    await db.query(
      `INSERT INTO food_components (food_id, component_name, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())`,
      [foodId, component],
    );
  }

  return findFoodComponentsByFoodId(foodId);
};

module.exports = {
  findFoods,
  createFood,
  updateFoodMetadata,
  findFoodComponentsByFoodId,
  replaceFoodComponents,
};
