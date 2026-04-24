const { createFood, findFoods } = require("../modules/meal/meal.repository");
const {
  fetchOFFfoods,
  OFF_RATE_LIMIT_DELAY_MS,
  sleep,
} = require("../services/openFoodFacts.service");
const { extractComponents, normalize } = require("../modules/food-intelligence/component.engine");

const OFF_QUERIES = [
  "brown rice",
  "lentils",
  "chickpeas",
  "black beans",
  "sweet potato",
  "broccoli",
  "spinach",
  "Greek yogurt",
  "cottage cheese",
  "almonds",
  "walnuts",
  "olive oil",
  "banana",
  "apple",
  "oats",
  "whole wheat bread",
];

const buildMetrics = (foods = []) => ({
  totalFoods: foods.length,
  openFoodFactsFoods: foods.filter((food) => food.source === "open_food_facts").length,
});

const seedOpenFoodFacts = async ({ skipIfFoodsExist = false } = {}) => {
  const existingFoods = await findFoods();
  if (skipIfFoodsExist && existingFoods.length > 0) {
    return {
      inserted: 0,
      skipped: 0,
      metrics: buildMetrics(existingFoods),
      alreadySeeded: true,
    };
  }

  const seenNames = new Set(
    existingFoods.map((food) => String(food.name || "").trim().toLowerCase()).filter(Boolean),
  );
  let inserted = 0;
  let skipped = 0;

  for (const query of OFF_QUERIES) {
    const foods = await fetchOFFfoods(query);

    for (const food of foods) {
      if (!food?.name || !Number.isFinite(Number(food.calories))) {
        skipped += 1;
        continue;
      }

      const normalizedName = normalize(food.name);
      if (seenNames.has(normalizedName)) {
        skipped += 1;
        continue;
      }

      seenNames.add(normalizedName);

      await createFood({
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        weightGrams: food.weightGrams || 100,
        category: "snack",
        dietType: "balanced",
        source: food.source,
        normalizedName,
        componentTags: extractComponents(food.name),
        nutritionStatus: "valid",
        foodRole: null,
        normalizationSource: "open_food_facts",
        confidence: 0.55,
      });

      inserted += 1;
    }

    await sleep(OFF_RATE_LIMIT_DELAY_MS);
  }

  const allFoods = await findFoods();
  return {
    inserted,
    skipped,
    metrics: buildMetrics(allFoods),
    alreadySeeded: false,
  };
};

module.exports = { seedOpenFoodFacts, OFF_QUERIES };
