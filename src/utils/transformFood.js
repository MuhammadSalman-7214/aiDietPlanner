const { extractComponents, normalize } = require("../modules/food-intelligence/component.engine");
const {
  calculateCaloriesFromMacros,
  normalizeCalories,
  safeNumber,
} = require("../modules/food-intelligence/food.usda.service");

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
  const weightGrams = [
    food.servingSize,
    food.serving_size,
    food.gramWeight,
    food.weight,
    food.portionWeight,
    food.portion_weight,
  ]
    .map((value) => safeNumber(value))
    .find((value) => value > 0);
  const unitText = normalize(`${food.servingSizeUnit || food.serving_size_unit || food.householdServingFullText || food.household_serving_full_text || ""}`);
  const unitFactor =
    unitText.includes("cup") ? 240 :
    unitText.includes("tbsp") || unitText.includes("tablespoon") ? 15 :
    unitText.includes("tsp") || unitText.includes("teaspoon") ? 5 :
    unitText.includes("piece") ? 50 :
    unitText.includes("slice") ? 30 :
    unitText.includes("gram") || unitText === "g" ? 1 :
    unitText.includes("ounce") || unitText === "oz" ? 28.35 :
    null;
  const normalizedName = normalize(food.description);
  const componentTags = extractComponents(food.description);
  const baseMacroCalories = calculateCaloriesFromMacros({ protein, carbs, fats });
  const inferredWeight =
    normalizedName.includes("egg") ? 50 :
    normalizedName.includes("apple") ? 182 :
    normalizedName.includes("banana") ? 118 :
    normalizedName.includes("chicken breast") ? 120 :
    normalizedName.includes("bread slice") ? 30 :
    null;

  if (!weightGrams && !unitFactor && !inferredWeight) {
    const calories = normalizeCalories({
      calories: rawCalories,
      protein,
      carbs,
      fats,
    });
    const nutritionStatus =
      baseMacroCalories >= 50 &&
      baseMacroCalories <= 700 &&
      (protein > 0 || carbs > 0 || fats > 0)
        ? "valid_assumed_100g"
        : "invalid_missing_weight";

    return {
      name: food.description,
      calories,
      protein,
      carbs,
      fats,
      weightGrams: nutritionStatus === "valid_assumed_100g" ? 100 : null,
      category: context.category || mapCategory(food.description, context),
      diet_type: "balanced",
      source: "usda",
      normalizedName,
      componentTags,
      nutritionStatus,
      normalizationSource: nutritionStatus === "valid_assumed_100g" ? "assumed_100g" : "missing_weight",
      foodRole: null,
      confidence: nutritionStatus === "valid_assumed_100g" ? 0.6 : 0,
    };
  }

  let effectiveWeight = weightGrams;
  let normalizationSource = "real_usda_weight";

  if (!effectiveWeight && unitFactor && safeNumber(food.servingSize || food.serving_size) > 0) {
    effectiveWeight = safeNumber(food.servingSize || food.serving_size) * unitFactor;
    normalizationSource = "unit_converted";
  }

  if (!effectiveWeight && safeNumber(food.servingSize || food.serving_size) > 0 && inferredWeight) {
    effectiveWeight = inferredWeight;
    normalizationSource = "name_inferred";
  }

  if (!effectiveWeight && !safeNumber(food.servingSize || food.serving_size) && baseMacroCalories >= 50 && baseMacroCalories <= 700 && (protein > 0 || carbs > 0 || fats > 0)) {
    effectiveWeight = 100;
    normalizationSource = "assumed_100g";
  }

  const fallbackWeight = effectiveWeight || 100;
  const scaleFactor = 100 / Math.max(fallbackWeight, 1);
  const normalizedProtein = Math.round(protein * scaleFactor * 10) / 10;
  const normalizedCarbs = Math.round(carbs * scaleFactor * 10) / 10;
  const normalizedFats = Math.round(fats * scaleFactor * 10) / 10;
  const calories = normalizeCalories({
    calories: rawCalories * scaleFactor,
    protein: normalizedProtein,
    carbs: normalizedCarbs,
    fats: normalizedFats,
  });

  return {
    name: food.description,
    calories,
    protein: normalizedProtein,
    carbs: normalizedCarbs,
    fats: normalizedFats,
    weightGrams: 100,
    category: context.category || mapCategory(food.description, context),
    diet_type: "balanced",
    source: "usda",
    normalizedName,
    componentTags,
    nutritionStatus: "valid",
    normalizationSource,
    foodRole: null,
    confidence:
      normalizationSource === "real_usda_weight" ? 1.0
      : normalizationSource === "unit_converted" ? 0.8
      : normalizationSource === "assumed_100g" ? 0.6
      : 0.4,
  };
};

module.exports = { transformUSDAFood };
