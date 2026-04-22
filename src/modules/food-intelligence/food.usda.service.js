const { extractComponents, normalize } = require("./component.engine");
const {
  calculateCalories,
  percentDiff,
  roundValue,
  safeNumber,
} = require("./nutrition.utils");

const BLACKLIST_TERMS = [
  "fish oil",
  "animal fat",
  "chicken skin",
  "isolated oils",
  "fat",
  "oil",
  "skin",
  "raw",
  "byproduct",
  "babyfood",
  "supplement",
];

const MEAL_SAFE_MIN_CALORIES = 50;
const MEAL_SAFE_MAX_CALORIES = 700;

const WEIGHT_CONFIDENCE = {
  real_usda_weight: 1.0,
  unit_converted: 0.8,
  assumed_100g: 0.6,
  name_inferred: 0.4,
};

const ROLE_COMPONENTS = {
  egg: ["egg", "eggs", "egg white", "egg yolk", "omelette", "omelet"],
  chicken: ["chicken", "chicken breast", "chicken thigh"],
  turkey: ["turkey", "turkey breast"],
  beef: ["beef", "steak", "burger", "meatballs"],
  tofu: ["tofu", "tempeh"],
  beans: ["bean", "beans", "chickpea", "chickpeas", "lentil", "lentils"],
  rice: ["rice", "white rice", "brown rice", "basmati rice", "jasmine rice"],
  quinoa: ["quinoa"],
  oats: ["oat", "oats", "oatmeal", "porridge"],
  bread: ["bread", "bagel", "bagels", "bun", "toast", "wrap"],
  potato: ["potato", "potatoes", "sweet potato"],
  dairy: ["milk", "yogurt", "cheese", "cottage cheese", "kefir"],
  fish: ["fish", "salmon", "tuna", "cod", "tilapia"],
  nuts: ["nuts", "almond", "almonds", "walnut", "walnuts", "peanut", "peanuts"],
  avocado: ["avocado"],
  vegetable: [
    "vegetable",
    "vegetables",
    "broccoli",
    "spinach",
    "zucchini",
    "cauliflower",
    "salad",
  ],
};

const ROLE_PRIORITY = {
  protein: ["egg", "chicken", "turkey", "beef", "tofu", "beans", "fish", "dairy"],
  carb: ["rice", "quinoa", "oats", "bread", "potato"],
  fat: ["nuts", "avocado", "dairy"],
  mixed: ["vegetable", "bread", "dairy", "tofu", "beans"],
};

const getWeightGrams = (food = {}) => {
  const candidates = [
    food.weightGrams,
    food.weight_grams,
    food.servingSize,
    food.serving_size,
    food.gramWeight,
    food.gram_weight,
    food.portionWeight,
    food.portion_weight,
  ];

  for (const candidate of candidates) {
    const value = safeNumber(candidate);
    if (value > 0) return value;
  }

  const portions = Array.isArray(food.foodPortions) ? food.foodPortions : [];
  for (const portion of portions) {
    const value = safeNumber(portion?.gramWeight ?? portion?.gram_weight);
    if (value > 0) return value;
  }

  return null;
};

const getServingSizeUnit = (food = {}) =>
  normalizeFoodName(
    food.servingSizeUnit ||
    food.serving_size_unit ||
    food.householdServingFullText ||
    food.household_serving_full_text ||
    "",
  );

const getUnitConversionFactor = (unitText = "") => {
  const normalized = normalizeFoodName(unitText);
  if (!normalized) return null;
  if (normalized.includes("cup")) return 240;
  if (normalized.includes("tbsp") || normalized.includes("tablespoon")) return 15;
  if (normalized.includes("tsp") || normalized.includes("teaspoon")) return 5;
  if (normalized.includes("piece")) return 50;
  if (normalized.includes("slice")) return 30;
  if (normalized.includes("gram") || normalized === "g") return 1;
  if (normalized.includes("ounce") || normalized === "oz") return 28.35;
  return null;
};

const inferWeightFromName = (name = "") => {
  const normalized = normalizeFoodName(name);
  if (!normalized) return null;
  if (normalized.includes("egg")) return 50;
  if (normalized.includes("apple")) return 182;
  if (normalized.includes("banana")) return 118;
  if (normalized.includes("chicken breast")) return 120;
  if (normalized.includes("bread slice")) return 30;
  return null;
};

const getComponentTags = (foodName, explicitTags = []) => {
  const tags = Array.isArray(explicitTags) && explicitTags.length > 0
    ? explicitTags
    : extractComponents(foodName);

  return [...new Set(tags.map((tag) => normalize(tag)).filter(Boolean))];
};

const classifyFoodRole = ({ protein = 0, carbs = 0, fats = 0 }) => {
  if (safeNumber(protein) > 15) return "protein";
  if (safeNumber(carbs) > 20) return "carb";
  if (safeNumber(fats) > 15) return "fat";
  return "mixed";
};

const normalizeFoodName = (value) =>
  normalize(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();

const isBlacklistedFood = (food) => {
  const haystack = normalizeFoodName([
    food?.name,
    ...(Array.isArray(food?.componentTags) ? food.componentTags : []),
    ...(Array.isArray(food?.ingredients) ? food.ingredients : []),
  ].join(" "));

  return BLACKLIST_TERMS.some((term) => haystack.includes(normalizeFoodName(term)));
};

const normalizeFoodCore = (food = {}) => {
  const baseCalories = safeNumber(food.calories);
  const baseProtein = safeNumber(food.protein);
  const baseCarbs = safeNumber(food.carbs);
  const baseFats = safeNumber(food.fats);
  const normalizedName = normalizeFoodName(food.normalizedName || food.name);
  const rawComponentTags = getComponentTags(food.name, food.componentTags);
  const servingSize = safeNumber(food.servingSize || food.serving_size);
  const unitText = getServingSizeUnit(food);
  const directWeight = getWeightGrams(food);
  const unitFactor = getUnitConversionFactor(unitText);
  const inferredWeight = inferWeightFromName(food.name);
  const hasReasonableMacros = [baseProtein, baseCarbs, baseFats].some((value) => value > 0) &&
    baseProtein < 1000 &&
    baseCarbs < 1000 &&
    baseFats < 1000;
  const baseMacroCalories = calculateCalories({
    protein: baseProtein,
    carbs: baseCarbs,
    fats: baseFats,
  });

  let weightGrams = directWeight;
  let normalizationSource = directWeight ? "real_usda_weight" : null;

  if (!weightGrams && servingSize > 0 && unitFactor) {
    weightGrams = roundValue(servingSize * unitFactor);
    normalizationSource = "unit_converted";
  }

  if (!weightGrams && !servingSize && hasReasonableMacros && baseMacroCalories >= MEAL_SAFE_MIN_CALORIES && baseMacroCalories <= MEAL_SAFE_MAX_CALORIES) {
    weightGrams = 100;
    normalizationSource = "assumed_100g";
  }

  if (!weightGrams && servingSize > 0 && inferredWeight) {
    weightGrams = inferredWeight;
    normalizationSource = "name_inferred";
  }

  if (!weightGrams) {
    return {
      ...food,
      calories: roundValue(baseCalories || baseMacroCalories),
      protein: roundValue(baseProtein),
      carbs: roundValue(baseCarbs),
      fats: roundValue(baseFats),
      weightGrams: null,
      normalizedName,
      componentTags: rawComponentTags,
      foodRole: classifyFoodRole({ protein: baseProtein, carbs: baseCarbs, fats: baseFats }),
      nutritionStatus: "invalid_missing_weight",
      nutritionReason: "missing_weight",
      normalizationSource: "missing_weight",
      confidence: 0,
      isMealSafe: false,
    };
  }

  const scaleFactor = 100 / weightGrams;
  const protein = roundValue(baseProtein * scaleFactor);
  const carbs = roundValue(baseCarbs * scaleFactor);
  const fats = roundValue(baseFats * scaleFactor);
  const calculatedCalories = calculateCalories({ protein, carbs, fats });
  const storedCalories = roundValue((baseCalories || calculatedCalories) * scaleFactor);
  const calories = roundValue(storedCalories || calculatedCalories);
  const macroCalories = calculateCalories({ protein, carbs, fats });
  const hasNonZeroMacros = protein > 0 || carbs > 0 || fats > 0;
  const calorieDeviation = calories > 0
    ? Math.abs(macroCalories - calories) / Math.max(calories, 1)
    : 1;
  const statusValid = (
    calories >= MEAL_SAFE_MIN_CALORIES &&
    calories <= MEAL_SAFE_MAX_CALORIES &&
    hasNonZeroMacros &&
    calorieDeviation <= 0.2
  );
  const status = statusValid
    ? normalizationSource === "assumed_100g"
      ? "valid_assumed_100g"
      : "valid"
    : "invalid";

  return {
    ...food,
    calories,
    protein,
    carbs,
    fats,
    weightGrams: roundValue(weightGrams),
    normalizedName,
    componentTags: rawComponentTags,
    foodRole: classifyFoodRole({ protein, carbs, fats }),
    nutritionStatus: status,
    nutritionReason: statusValid ? null : "macro_calorie_mismatch",
    normalizationSource,
    confidence: WEIGHT_CONFIDENCE[normalizationSource] || 0,
    isMealSafe: statusValid,
  };
};

const isMealSafeFood = (food = {}) => {
  const calories = safeNumber(food.calories);
  const protein = safeNumber(food.protein);
  const carbs = safeNumber(food.carbs);
  const fats = safeNumber(food.fats);
  const totalCaloriesFromMacros = calculateCalories({ protein, carbs, fats });
  const fatCalories = fats * 9;
  const qualityRatio = calories > 0 ? fatCalories / calories : 0;
  const normalizedName = normalizeFoodName(food.name || food.normalizedName);

  if (!food || food.isMealSafe === false) return false;
  if (!normalizedName || isBlacklistedFood(food)) return false;
  if (calories < MEAL_SAFE_MIN_CALORIES || calories > MEAL_SAFE_MAX_CALORIES) return false;
  if (protein < 3 && carbs < 5) return false;
  if (qualityRatio > 0.6) return false;
  if (Math.abs(totalCaloriesFromMacros - calories) / Math.max(calories, 1) > 0.2) return false;

  return true;
};

const normalizeCalories = (food = {}) => normalizeFoodCore(food).calories;

const normalizeUsdaFood = (food) => {
  const normalized = normalizeFoodCore({
    ...food,
    protein: safeNumber(food?.protein),
    carbs: safeNumber(food?.carbs),
    fats: safeNumber(food?.fats),
  });

  return normalized;
};

const normalizeUsdaFoods = (foods = []) =>
  foods
    .map((food) => normalizeUsdaFood(food))
    .filter((food) => ["valid", "valid_assumed_100g"].includes(food.nutritionStatus) && isMealSafeFood(food));

const resolveComponentPriority = (foodRole, componentTags = []) => {
  const priorities = ROLE_PRIORITY[foodRole] || [];
  for (const component of priorities) {
    if (componentTags.includes(component)) return component;
  }
  return componentTags[0] || foodRole;
};

module.exports = {
  BLACKLIST_TERMS,
  calculateCaloriesFromMacros: calculateCalories,
  classifyFoodRole,
  getComponentTags,
  isMealSafeFood,
  normalizeCalories,
  normalizeFoodName,
  normalizeUsdaFood,
  normalizeUsdaFoods,
  resolveComponentPriority,
  roundValue,
  safeNumber,
  percentDiff,
  WEIGHT_CONFIDENCE,
};
