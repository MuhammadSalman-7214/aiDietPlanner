const { createFood, findFoods } = require('../modules/meal/meal.repository');
const { fetchFoodsFromUSDA } = require('../integrations/usda/usda.service');
const { transformUSDAFood } = require('../utils/transformFood');

const DEFAULT_QUERY_TERMS = ['chicken', 'rice', 'egg', 'fruit', 'vegetable'];

const seedUSDAFoods = async ({ skipIfFoodsExist = true } = {}) => {
  if (skipIfFoodsExist) {
    const existingFoods = await findFoods();
    if (existingFoods.length > 0) {
      return { inserted: 0, skipped: 0, alreadySeeded: true };
    }
  }

  const seenNames = new Set();
  let inserted = 0;
  let skipped = 0;

  for (const query of DEFAULT_QUERY_TERMS) {
    const foods = await fetchFoodsFromUSDA(query);

    for (const food of foods) {
      const transformed = transformUSDAFood(food);
      if (!transformed || !transformed.name || !transformed.calories) {
        skipped += 1;
        continue;
      }

      const normalizedName = transformed.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        skipped += 1;
        continue;
      }

      seenNames.add(normalizedName);

      await createFood({
        name: transformed.name,
        calories: transformed.calories,
        protein: transformed.protein,
        carbs: transformed.carbs,
        fats: transformed.fats,
        category: transformed.category,
        dietType: transformed.diet_type || 'balanced',
      });

      inserted += 1;
    }
  }

  return { inserted, skipped, alreadySeeded: false };
};

module.exports = { seedUSDAFoods };
