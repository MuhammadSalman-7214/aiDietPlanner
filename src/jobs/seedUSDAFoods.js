const { createFood, findFoods } = require("../modules/meal/meal.repository");
const { fetchFoodsFromUSDA } = require("../integrations/usda/usda.service");
const { transformUSDAFood } = require("../utils/transformFood");

const DEFAULT_QUERY_GROUPS = [
  { query: "egg", category: "breakfast" },
  { query: "egg white", category: "breakfast" },
  { query: "oatmeal", category: "breakfast" },
  { query: "yogurt", category: "breakfast" },
  { query: "tofu", category: "breakfast" },
  { query: "chickpea", category: "breakfast" },
  { query: "beans", category: "breakfast" },
  { query: "chicken", category: "lunch" },
  { query: "turkey", category: "lunch" },
  { query: "rice", category: "lunch" },
  { query: "quinoa", category: "lunch" },
  { query: "lentils", category: "lunch" },
  { query: "salmon", category: "dinner" },
  { query: "fish", category: "dinner" },
  { query: "beef", category: "dinner" },
  { query: "broccoli", category: "dinner" },
  { query: "spinach", category: "dinner" },
  { query: "zucchini", category: "dinner" },
  { query: "fruit", category: "snack" },
  { query: "nuts", category: "snack" },
];

const seedUSDAFoods = async ({ skipIfFoodsExist = true } = {}) => {
  const existingFoods = await findFoods({ source: "usda" });
  const seenNames = new Set(existingFoods.map((food) => food.name.trim().toLowerCase()));
  let inserted = 0;
  let skipped = 0;

  for (const { query, category } of DEFAULT_QUERY_GROUPS) {
    const foods = await fetchFoodsFromUSDA(query);

    for (const food of foods) {
      const transformed = transformUSDAFood(food, { query, category });
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
        dietType: transformed.diet_type || "balanced",
        source: transformed.source || "usda",
        normalizedName: transformed.normalizedName,
        componentTags: transformed.componentTags,
      });

      inserted += 1;
    }
  }

  return {
    inserted,
    skipped,
    alreadySeeded: skipIfFoodsExist && inserted === 0,
  };
};

module.exports = { seedUSDAFoods };
