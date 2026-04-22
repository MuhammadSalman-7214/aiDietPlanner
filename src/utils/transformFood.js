const { extractComponents, normalize } = require("../modules/food-intelligence/component.engine");
const { normalizeCalories, safeNumber } = require("../modules/food-intelligence/food.usda.service");

const mapCategory = (name, context = {}) => {
  const lower = `${context.query || ""} ${name}`.toLowerCase();

  if (
    lower.includes("egg") ||
    lower.includes("oat") ||
    lower.includes("yogurt") ||
    lower.includes("tofu") ||
    lower.includes("chickpea") ||
    lower.includes("beans")
  ) return "breakfast";

  if (
    lower.includes("rice") ||
    lower.includes("chicken") ||
    lower.includes("turkey") ||
    lower.includes("quinoa") ||
    lower.includes("lentil")
  ) return "lunch";

  if (
    lower.includes("salad") ||
    lower.includes("vegetable") ||
    lower.includes("fish") ||
    lower.includes("salmon") ||
    lower.includes("beef") ||
    lower.includes("broccoli") ||
    lower.includes("spinach") ||
    lower.includes("zucchini") ||
    lower.includes("cauliflower")
  ) return "dinner";

  return "snack";
};

const transformUSDAFood = (food, context = {}) => {
  const nutrients = food.foodNutrients || [];

  const getNutrientValue = (predicate) => {
    const nutrient = nutrients.find((item) => predicate(item || {}));
    return nutrient ? safeNumber(nutrient.value) : 0;
  };

  const protein = getNutrientValue((nutrient) =>
    String(nutrient.nutrientName || "").toLowerCase().includes("protein"),
  );
  const carbs = getNutrientValue((nutrient) =>
    String(nutrient.nutrientName || "").toLowerCase().includes("carbohydrate"),
  );
  const fats = getNutrientValue((nutrient) =>
    String(nutrient.nutrientName || "").toLowerCase().includes("fat"),
  );
  const rawCalories = getNutrientValue(
    (nutrient) =>
      String(nutrient.nutrientNumber || "") === "1008" ||
      (
        String(nutrient.nutrientName || "").toLowerCase().includes("energy") &&
        String(nutrient.unitName || "").toLowerCase() === "kcal"
      ),
  );

  const normalizedName = normalize(food.description);
  const componentTags = extractComponents(food.description);
  const calories = normalizeCalories({
    calories: rawCalories,
    protein,
    carbs,
    fats,
  });

  return {
    name: food.description,
    calories,
    protein,
    carbs,
    fats,
    category: context.category || mapCategory(food.description, context),
    diet_type: "balanced",
    source: "usda",
    normalizedName,
    componentTags,
  };
};

module.exports = { transformUSDAFood };
