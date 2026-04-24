const { createFood, findFoods, hasFoods, updateFoodNutrition } = require("../modules/meal/meal.repository");
const { fetchFoodsFromUSDA } = require("../integrations/usda/usda.service");
const { normalizeUsdaFood } = require("../modules/food-intelligence/food.usda.service");
const { transformUSDAFood } = require("../utils/transformFood");

const DEFAULT_QUERY_GROUPS = [
  { query: "egg", category: "breakfast" },
  { query: "egg white", category: "breakfast" },
  { query: "omelet", category: "breakfast" },
  { query: "oatmeal", category: "breakfast" },
  { query: "oats", category: "breakfast" },
  { query: "porridge", category: "breakfast" },
  { query: "yogurt", category: "breakfast" },
  { query: "greek yogurt", category: "breakfast" },
  { query: "cottage cheese", category: "breakfast" },
  { query: "banana", category: "breakfast" },
  { query: "apple", category: "breakfast" },
  { query: "berries", category: "breakfast" },
  { query: "peanut butter", category: "breakfast" },
  { query: "almond butter", category: "breakfast" },
  { query: "toast", category: "breakfast" },
  { query: "bagel", category: "breakfast" },
  { query: "chicken breast", category: "lunch" },
  { query: "chicken", category: "lunch" },
  { query: "turkey", category: "lunch" },
  { query: "ground turkey", category: "lunch" },
  { query: "beef", category: "lunch" },
  { query: "ground beef", category: "lunch" },
  { query: "fish", category: "lunch" },
  { query: "salmon", category: "lunch" },
  { query: "tuna", category: "lunch" },
  { query: "rice", category: "lunch" },
  { query: "brown rice", category: "lunch" },
  { query: "quinoa", category: "lunch" },
  { query: "lentils", category: "lunch" },
  { query: "beans", category: "lunch" },
  { query: "black beans", category: "lunch" },
  { query: "chickpea", category: "lunch" },
  { query: "tofu", category: "lunch" },
  { query: "tofu scramble", category: "lunch" },
  { query: "broccoli", category: "dinner" },
  { query: "spinach", category: "dinner" },
  { query: "zucchini", category: "dinner" },
  { query: "cauliflower", category: "dinner" },
  { query: "salad", category: "dinner" },
  { query: "sweet potato", category: "dinner" },
  { query: "potato", category: "dinner" },
  { query: "olive oil", category: "dinner" },
  { query: "avocado", category: "dinner" },
  { query: "salmon", category: "dinner" },
  { query: "cod", category: "dinner" },
  { query: "shrimp", category: "dinner" },
  { query: "pasta", category: "dinner" },
  { query: "whole wheat pasta", category: "dinner" },
  { query: "bread", category: "snack" },
  { query: "whole wheat bread", category: "snack" },
  { query: "nuts", category: "snack" },
  { query: "almonds", category: "snack" },
  { query: "walnuts", category: "snack" },
  { query: "fruit", category: "snack" },
  { query: "orange", category: "snack" },
  { query: "grapes", category: "snack" },
  { query: "hummus", category: "snack" },
  { query: "cheese", category: "snack" },
  { query: "milk", category: "snack" },
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
