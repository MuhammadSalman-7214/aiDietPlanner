const { extractComponents, normalize } = require("./component.engine");
const {
  calculateCalories,
  normalizeCalories,
  roundValue,
  safeNumber,
} = require("./nutrition.utils");

const normalizeUsdaFood = (food) => {
  const calorieNormalizedFood = normalizeCalories({
    ...food,
    protein: safeNumber(food?.protein),
    carbs: safeNumber(food?.carbs),
    fats: safeNumber(food?.fats),
  });
  const normalizedName =
    food?.normalizedName ||
    normalize(food?.name);
  const componentTags =
    Array.isArray(food?.componentTags) && food.componentTags.length > 0
      ? [...new Set(food.componentTags.map((item) => normalize(item)).filter(Boolean))]
      : extractComponents(food?.name);

  return {
    ...calorieNormalizedFood,
    protein: safeNumber(food?.protein),
    carbs: safeNumber(food?.carbs),
    fats: safeNumber(food?.fats),
    normalizedName,
    componentTags,
  };
};

const normalizeUsdaFoods = (foods = []) => foods.map((food) => normalizeUsdaFood(food));

module.exports = {
  safeNumber,
  roundValue,
  calculateCaloriesFromMacros: calculateCalories,
  normalizeCalories: (food) => normalizeCalories(food).calories,
  normalizeUsdaFood,
  normalizeUsdaFoods,
};
