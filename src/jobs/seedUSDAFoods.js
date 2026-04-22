const { createFood, findFoods, hasFoods, updateFoodNutrition } = require("../modules/meal/meal.repository");
const { fetchFoodsFromUSDA } = require("../integrations/usda/usda.service");
const { normalizeUsdaFood } = require("../modules/food-intelligence/food.usda.service");
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

const buildMetrics = (foods = []) => ({
  totalFoods: foods.length,
  validFoods: foods.filter((food) => ["valid", "valid_assumed_100g"].includes(food.nutritionStatus)).length,
  assumed100gFoods: foods.filter((food) => food.nutritionStatus === "valid_assumed_100g").length,
  stillInvalidFoods: foods.filter((food) => !["valid", "valid_assumed_100g"].includes(food.nutritionStatus)).length,
});

const seedUSDAFoods = async ({ skipIfFoodsExist = true, recoverExistingFoods = false } = {}) => {
  const foodsExist = await hasFoods();
  if (skipIfFoodsExist && foodsExist && !recoverExistingFoods) {
    return {
      inserted: 0,
      skipped: 0,
      upgraded: 0,
      metrics: null,
      alreadySeeded: true,
    };
  }

  const existingFoods = foodsExist ? await findFoods() : [];
  const seenNames = new Set((foodsExist ? await findFoods({ source: "usda" }) : []).map((food) => food.name.trim().toLowerCase()));
  let inserted = 0;
  let skipped = 0;

  const upgraded = [];
  for (const food of existingFoods) {
    if (food.nutritionStatus !== "invalid_missing_weight") continue;

    const recovered = normalizeUsdaFood(food);
    if (!["valid", "valid_assumed_100g"].includes(recovered.nutritionStatus)) continue;

    await updateFoodNutrition(food.id, {
      calories: recovered.calories,
      protein: recovered.protein,
      carbs: recovered.carbs,
      fats: recovered.fats,
      weightGrams: recovered.weightGrams,
      nutritionStatus: recovered.nutritionStatus,
      normalizationSource: recovered.normalizationSource,
      confidence: recovered.confidence,
      foodRole: recovered.foodRole,
    });

    upgraded.push(recovered);
  }

  for (const { query, category } of DEFAULT_QUERY_GROUPS) {
    const foods = await fetchFoodsFromUSDA(query);

    for (const food of foods) {
      const transformed = transformUSDAFood(food, { query, category });
      if (!transformed || !transformed.name) {
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
        weightGrams: transformed.weightGrams,
        category: transformed.category,
        dietType: transformed.diet_type || "balanced",
        source: transformed.source || "usda",
        normalizedName: transformed.normalizedName,
        componentTags: transformed.componentTags,
        nutritionStatus: transformed.nutritionStatus || "valid",
        foodRole: transformed.foodRole || null,
        normalizationSource: transformed.normalizationSource || null,
        confidence: transformed.confidence ?? null,
      });

      inserted += 1;
    }
  }

  const allFoods = await findFoods();
  const metrics = buildMetrics(allFoods);

  return {
    inserted,
    skipped,
    upgraded: upgraded.length,
    metrics,
    alreadySeeded: skipIfFoodsExist && foodsExist && inserted === 0,
  };
};

module.exports = { seedUSDAFoods };
