const mealRepo = require("./meal.repository");
const dietRepo = require("../diet/diet.repository");
const userRepo = require("../user/user.repository");
const {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
} = require("../../utils/calorieCalculator");
const { AppError } = require("../../middlewares/error.middleware");
const { getOpenAIClient } = require("../../config/openai");
const { validateAIMealSuggestion } = require("../../utils/validateAIResponse");
const logger = require("../../utils/logger");
const {
  normalizeUsdaFood,
  normalizeUsdaFoods,
  normalizeDisplayName,
  classifyFoodRole,
  isMealSafeFood,
  roundValue,
  safeNumber,
} = require("../food-intelligence/food.usda.service");
const {
  buildAlternativesForMealPlan,
  aggregateTotals,
  buildItemAlternatives,
} = require("../food-intelligence/food.alternative.service");

const DEFAULT_MEALS_COUNT = 3;
const DEFAULT_ALTERNATIVE_LIMIT = 5;
const MEAL_PLAN_VERSION = 2;
const DEFAULT_MEAL_TIME_WINDOWS = {
  breakfast: { start: "07:00", end: "09:00" },
  lunch: { start: "12:00", end: "14:00" },
  dinner: { start: "18:00", end: "20:00" },
  snacks: [
    { start: "10:00", end: "11:00" },
    { start: "15:00", end: "16:00" },
    { start: "21:00", end: "22:00" },
  ],
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const dedupeList = (items) => [
  ...new Set(items.map((item) => String(item).trim().toLowerCase()).filter(Boolean)),
];

const mergeLists = (...lists) =>
  dedupeList(lists.flatMap((list) => normalizeList(list)));

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getFoodTags = (food) => [
  ...(Array.isArray(food?.componentTags) ? food.componentTags : []),
  ...(Array.isArray(food?.ingredients) ? food.ingredients : []),
].map((item) => normalizeText(item)).filter(Boolean);

const getFoodRole = (food) => food?.foodRole || classifyFoodRole(food);

const getFoodConfidence = (food) => {
  const confidence = Number(food?.confidence);
  return Number.isFinite(confidence) ? confidence : 0.5;
};

const preciseRound = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

const compareStrings = (left, right) =>
  String(left ?? "").localeCompare(String(right ?? ""), "en", {
    sensitivity: "base",
    numeric: true,
  });

const compareFoodsForSelection = (left, right) => {
  const confidenceDiff = getFoodConfidence(right) - getFoodConfidence(left);
  if (confidenceDiff !== 0) return confidenceDiff;

  const leftStatus = left?.nutritionStatus === "valid" ? 2 : left?.nutritionStatus === "valid_assumed_100g" ? 1 : 0;
  const rightStatus = right?.nutritionStatus === "valid" ? 2 : right?.nutritionStatus === "valid_assumed_100g" ? 1 : 0;
  if (rightStatus !== leftStatus) return rightStatus - leftStatus;

  const nameDiff = compareStrings(normalizeText(left?.name), normalizeText(right?.name));
  if (nameDiff !== 0) return nameDiff;

  return safeNumber(left?.id) - safeNumber(right?.id);
};

const sortFoodsForSelection = (foods = []) => [...foods].sort(compareFoodsForSelection);

const getMacroCalories = (totals = {}) => {
  const calories = safeNumber(totals.calories);
  if (calories <= 0) return { protein: 0, carbs: 0, fats: 0 };

  return {
    protein: (safeNumber(totals.protein) * 4) / calories,
    carbs: (safeNumber(totals.carbs) * 4) / calories,
    fats: (safeNumber(totals.fats) * 9) / calories,
  };
};

const getMacroBalance = (totals = {}) => {
  const percentages = getMacroCalories(totals);
  const proteinInRange = percentages.protein >= 0.2 && percentages.protein <= 0.35;
  const carbsInRange = percentages.carbs >= 0.4 && percentages.carbs <= 0.6;
  const fatsInRange = percentages.fats >= 0.2 && percentages.fats <= 0.35;
  const allFatMeal = safeNumber(totals.fats) > 0 && safeNumber(totals.protein) < 5 && safeNumber(totals.carbs) < 10;

  return {
    percentages,
    isBalanced: proteinInRange && carbsInRange && fatsInRange && !allFatMeal,
    allFatMeal,
  };
};

const hasDuplicateComponentTags = (items = []) => {
  const seen = new Set();
  for (const item of items) {
    for (const tag of getFoodTags(item)) {
      if (seen.has(tag)) return true;
      seen.add(tag);
    }
  }
  return false;
};

const matchesPreference = (food, preferences = []) => {
  const normalizedPreferences = mergeLists(preferences);
  if (normalizedPreferences.length === 0) return 0;

  const haystack = normalizeText([food?.name, ...(Array.isArray(food?.componentTags) ? food.componentTags : [])].join(" "));
  return normalizedPreferences.reduce(
    (score, preference) => score + (haystack.includes(normalizeText(preference)) ? 1 : 0),
    0,
  );
};

const scoreMealCombination = ({ items = [], targetCalories, preferences = [] }) => {
  if (items.length === 0) return -Infinity;

  const totals = aggregateTotals(items);
  const calorieDeviation = Math.abs(safeNumber(totals.calories) - safeNumber(targetCalories)) / Math.max(safeNumber(targetCalories), 1);
  const macroBalance = getMacroBalance(totals);
  const macroCenterPenalty =
    Math.abs(macroBalance.percentages.protein - 0.275) +
    Math.abs(macroBalance.percentages.carbs - 0.5) +
    Math.abs(macroBalance.percentages.fats - 0.275);
  const roleBonus = items.some((item) => getFoodRole(item) === "protein") ? 1 : 0;
  const preferenceBonus = items.reduce((sum, item) => sum + matchesPreference(item, preferences), 0);
  const confidenceBonus = items.reduce((sum, item) => sum + getFoodConfidence(item), 0) / Math.max(items.length, 1);
  const duplicatePenalty = hasDuplicateComponentTags(items) ? 1 : 0;
  const sizePenalty = Math.max(0, items.length - 3) * 0.2;

  return {
    total:
      100 -
      (calorieDeviation * 60) -
      (macroCenterPenalty * 20) -
      (duplicatePenalty * 35) +
      (roleBonus * 8) +
      (preferenceBonus * 2) -
      sizePenalty +
      (confidenceBonus * 3),
    calorieDeviation,
    macroCenterPenalty,
    duplicatePenalty,
    roleBonus,
    preferenceBonus,
    confidenceBonus,
    label: items
      .map((item) => `${normalizeText(item.name)}:${safeNumber(item.id)}`)
      .sort()
      .join("|"),
  };
};

const isBetterMealCombination = (candidate, best) => {
  if (!best) return true;
  if (candidate.total !== best.total) return candidate.total > best.total;
  if (candidate.calorieDeviation !== best.calorieDeviation) return candidate.calorieDeviation < best.calorieDeviation;
  if (candidate.macroCenterPenalty !== best.macroCenterPenalty) return candidate.macroCenterPenalty < best.macroCenterPenalty;
  if (candidate.duplicatePenalty !== best.duplicatePenalty) return candidate.duplicatePenalty < best.duplicatePenalty;
  if (candidate.roleBonus !== best.roleBonus) return candidate.roleBonus > best.roleBonus;
  if (candidate.preferenceBonus !== best.preferenceBonus) return candidate.preferenceBonus > best.preferenceBonus;
  if (candidate.confidenceBonus !== best.confidenceBonus) return candidate.confidenceBonus > best.confidenceBonus;
  return compareStrings(candidate.label, best.label) < 0;
};

const isMealSelectionValid = (items, targetCalories) => {
  const totals = aggregateTotals(items);
  const calorieDeviation = Math.abs(safeNumber(totals.calories) - safeNumber(targetCalories)) / Math.max(safeNumber(targetCalories), 1);
  const macroBalance = getMacroBalance(totals);
  return calorieDeviation <= 0.1 && macroBalance.isBalanced && !hasDuplicateComponentTags(items) && items.some((item) => getFoodRole(item) === "protein");
};

const pickTopFoods = (foods = [], limit = 5) => foods.slice(0, Math.max(limit, 1));

const buildMealSelectionFromCombo = (items = []) => ({
  items: items.map((item) => summarizeFoodItem(item)),
  totals: aggregateTotals(items),
});

const uniqueFoods = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = safeNumber(item.id) || normalizeText(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getMealCandidatePools = (foods = [], mealCategory, preferences = []) => {
  const categoryFoods = sortFoodsForSelection(foods.filter((food) => food.category === mealCategory));
  const rankedFoods = scoreFoodsByPreferences(categoryFoods, preferences);

  return {
    protein: rankedFoods.filter((food) => getFoodRole(food) === "protein"),
    carb: rankedFoods.filter((food) => getFoodRole(food) === "carb"),
    fat: rankedFoods.filter((food) => getFoodRole(food) === "fat"),
    mixed: rankedFoods.filter((food) => getFoodRole(food) === "mixed"),
    all: rankedFoods,
  };
};

const buildMealComboCandidates = (pools) => {
  const patterns = [
    ["protein", "carb", "fat"],
    ["protein", "carb", "mixed"],
    ["protein", "mixed", "fat"],
    ["protein", "carb"],
    ["protein", "fat"],
    ["protein", "mixed"],
    ["protein"],
  ];

  const combos = [];
  for (const pattern of patterns) {
    const lists = pattern.map((role) => pickTopFoods(pools[role] || [], 5));
    const stack = [[]];

    for (const list of lists) {
      const nextStack = [];
      for (const prefix of stack) {
        for (const candidate of list) {
          if (prefix.some((item) => safeNumber(item.id) === safeNumber(candidate.id))) continue;
          nextStack.push([...prefix, candidate]);
        }
      }
      stack.splice(0, stack.length, ...nextStack);
    }

    combos.push(...stack.filter((items) => items.length > 0));
  }

  return combos;
};

const selectBalancedMealItems = ({ foods = [], mealCategory, targetCalories, preferences = [] }) => {
  const pools = getMealCandidatePools(foods, mealCategory, preferences);
  const fallbackPools = {
    protein: pickTopFoods(pools.protein.length ? pools.protein : pools.all.filter((food) => safeNumber(food.protein) >= 10), 5),
    carb: pickTopFoods(pools.carb.length ? pools.carb : pools.all.filter((food) => safeNumber(food.carbs) >= 15), 5),
    fat: pickTopFoods(pools.fat.length ? pools.fat : pools.all.filter((food) => safeNumber(food.fats) >= 8), 5),
    mixed: pickTopFoods(pools.mixed.length ? pools.mixed : pools.all, 5),
  };

  const attempts = [pools, fallbackPools];
  let best = null;
  let bestValid = null;

  for (const attemptPools of attempts) {
    const combos = buildMealComboCandidates(attemptPools);
    for (const items of combos) {
      if (hasDuplicateComponentTags(items)) continue;
      const score = scoreMealCombination({ items, targetCalories, preferences });
      if (isBetterMealCombination(score, best?.score)) {
        best = { items, score };
      }
      if (isMealSelectionValid(items, targetCalories)) {
        if (isBetterMealCombination(score, bestValid?.score)) {
          bestValid = { items, score };
        }
      }
    }
  }

  if (bestValid?.items.length > 0) {
    return scaleMealSelectionToTarget(buildMealSelection(bestValid.items), targetCalories);
  }

  const bestItems = best?.items.length > 0 ? best.items : pickTopFoods(sortFoodsForSelection(pools.all), 3);
  return scaleMealSelectionToTarget(buildMealSelection(uniqueFoods(bestItems)), targetCalories);
};

const summarizeFoodItem = (food) => {
  if (!food) return null;
  const normalizedFood = normalizeUsdaFood(food);
  return {
    id: normalizedFood.id,
    name: normalizeDisplayName(normalizedFood.name),
    calories: safeNumber(normalizedFood.calories),
    protein: safeNumber(normalizedFood.protein),
    carbs: safeNumber(normalizedFood.carbs),
    fats: safeNumber(normalizedFood.fats),
    weightGrams: normalizedFood.weightGrams ?? normalizedFood.weight_grams ?? null,
    category: normalizedFood.category,
    dietType: normalizedFood.dietType || normalizedFood.diet_type,
    normalizedName: normalizedFood.normalizedName,
    componentTags: normalizedFood.componentTags || [],
    foodRole: normalizedFood.foodRole || classifyFoodRole(normalizedFood),
    nutritionStatus: normalizedFood.nutritionStatus || null,
    normalizationSource: normalizedFood.normalizationSource || null,
    confidence: normalizedFood.confidence ?? null,
    ingredients: Array.isArray(normalizedFood.ingredients) ? normalizedFood.ingredients : [],
    instructions: Array.isArray(normalizedFood.instructions) ? normalizedFood.instructions : [],
    source: normalizedFood.source,
  };
};

const buildMealTargets = (calories, mealsCount) => {
  if (mealsCount === 5) {
    const snack = calories * 0.075;
    return {
      breakfast: calories * 0.25,
      lunch: calories * 0.3,
      dinner: calories * 0.3,
      snacks: [snack, snack],
    };
  }

  if (mealsCount === 4) {
    const snack = calories * 0.15;
    return {
      breakfast: calories * 0.25,
      lunch: calories * 0.3,
      dinner: calories * 0.3,
      snacks: [snack],
    };
  }

  return {
    breakfast: calories * 0.3,
    lunch: calories * 0.35,
    dinner: calories * 0.35,
    snacks: [],
  };
};

const filterExcludedFoods = (foods, allergies = [], dislikes = []) => {
  const exclusions = mergeLists(allergies, dislikes);
  if (exclusions.length === 0) return foods;
  return foods.filter((food) => {
    const haystack = [
      food.name,
      ...(Array.isArray(food.ingredients) ? food.ingredients : []),
      ...(Array.isArray(food.instructions) ? food.instructions : []),
      ...(Array.isArray(food.componentTags) ? food.componentTags : []),
    ]
      .map((item) => normalizeText(item))
      .join(" ");

    return !exclusions.some((item) => haystack.includes(normalizeText(item)));
  });
};

const isPreferableMealFood = (food) => isMealSafeFood(food);

const scoreFoodsByPreferences = (foods, preferences = []) => {
  const normalizedPreferences = mergeLists(preferences);
  if (normalizedPreferences.length === 0) return sortFoodsForSelection(foods);

  return foods
    .map((food) => {
      const haystack = [
        food.name,
        ...(Array.isArray(food.componentTags) ? food.componentTags : []),
        ...(Array.isArray(food.ingredients) ? food.ingredients : []),
      ]
        .map((item) => normalizeText(item))
        .join(" ");

      const preferenceHits = normalizedPreferences.reduce(
        (count, pref) => count + (haystack.includes(normalizeText(pref)) ? 1 : 0),
        0,
      );

      return { food, preferenceHits };
    })
    .sort((a, b) => {
      if (b.preferenceHits !== a.preferenceHits) return b.preferenceHits - a.preferenceHits;
      return compareFoodsForSelection(a.food, b.food);
    })
    .map((entry) => entry.food);
};

const buildMealSelection = (items = []) => ({
  items: items.map((item) => summarizeFoodItem(item)),
  totals: aggregateTotals(items),
});

const scaleMealSelectionToTarget = (selection = {}, targetCalories = 0) => {
  const items = Array.isArray(selection?.items) ? selection.items : [];
  if (items.length === 0) {
    return {
      items: [],
      totals: aggregateTotals([]),
    };
  }

  const currentTotals = selection?.totals || aggregateTotals(items);
  const currentCalories = safeNumber(currentTotals.calories);
  const target = safeNumber(targetCalories);
  if (currentCalories <= 0 || target <= 0) {
    return {
      items,
      totals: aggregateTotals(items),
    };
  }

  const scaleFactor = target / currentCalories;
  const scaledItems = items.map((item) => ({
    ...item,
    calories: preciseRound(safeNumber(item.calories) * scaleFactor),
    protein: preciseRound(safeNumber(item.protein) * scaleFactor),
    carbs: preciseRound(safeNumber(item.carbs) * scaleFactor),
    fats: preciseRound(safeNumber(item.fats) * scaleFactor),
    weightGrams: item.weightGrams === null || item.weightGrams === undefined
      ? item.weightGrams
      : preciseRound(safeNumber(item.weightGrams) * scaleFactor),
  }));

  return {
    items: scaledItems,
    totals: aggregateTotals(scaledItems),
  };
};

const markdownEscape = (value) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ")
    .trim();

const roundCalories = (value) => Math.round(safeNumber(value));
const roundMacro = (value) => Math.round(safeNumber(value) * 10) / 10;

const buildUserSummary = (stats = {}) => ({
  age: stats.age === null || stats.age === undefined ? null : Math.round(safeNumber(stats.age)),
  gender: stats.gender ?? null,
  goal: stats.goal ?? null,
  activityLevel: stats.activityLevel ?? null,
  heightCm: stats.heightCm === null || stats.heightCm === undefined ? null : roundMacro(stats.heightCm),
  weightKg: stats.weightKg === null || stats.weightKg === undefined ? null : roundMacro(stats.weightKg),
});

const hasConstraintViolation = (items = [], constraints = {}) => {
  const allText = items
    .flatMap((item) => [
      item?.name,
      ...(Array.isArray(item?.componentTags) ? item.componentTags : []),
      ...(Array.isArray(item?.ingredients) ? item.ingredients : []),
    ])
    .map((entry) => normalizeText(entry))
    .join(" ");

  const allergies = normalizeList(constraints.mealAllergies);
  const dislikes = normalizeList(constraints.mealDislikes);
  const allergenHit = allergies.some((term) => allText.includes(normalizeText(term)));
  const dislikeHit = dislikes.some((term) => allText.includes(normalizeText(term)));

  return {
    allergenHit,
    dislikeHit,
  };
};

const getMealDisplayName = (mealType, index = null) => {
  if (mealType === "breakfast") return "Breakfast";
  if (mealType === "lunch") return "Lunch";
  if (mealType === "dinner") return "Dinner";
  if (mealType === "snack" && index !== null) return `Snack ${index + 1}`;
  return "Meal";
};

const normalizeMealTimeWindow = (mealType, timeWindow, index = null) => {
  const defaults = mealType === "snack"
    ? DEFAULT_MEAL_TIME_WINDOWS.snacks[index] || DEFAULT_MEAL_TIME_WINDOWS.snacks[DEFAULT_MEAL_TIME_WINDOWS.snacks.length - 1]
    : DEFAULT_MEAL_TIME_WINDOWS[mealType] || { start: "00:00", end: "00:00" };

  const start = typeof timeWindow?.start === "string" && timeWindow.start.trim()
    ? timeWindow.start.trim()
    : defaults.start;
  const end = typeof timeWindow?.end === "string" && timeWindow.end.trim()
    ? timeWindow.end.trim()
    : defaults.end;

  return {
    meal: getMealDisplayName(mealType, index),
    start,
    end,
    timezone: "UTC",
    editable: true,
  };
};

const applyMealTimeWindows = (plan = {}, mealTimeWindows = {}) => {
  const nextPlan = { ...plan };
  const breakfastTimeWindow = normalizeMealTimeWindow("breakfast", mealTimeWindows.breakfast);
  const lunchTimeWindow = normalizeMealTimeWindow("lunch", mealTimeWindows.lunch);
  const dinnerTimeWindow = normalizeMealTimeWindow("dinner", mealTimeWindows.dinner);

  nextPlan.mealTimeWindows = {
    breakfast: breakfastTimeWindow,
    lunch: lunchTimeWindow,
    dinner: dinnerTimeWindow,
    snacks: Array.isArray(mealTimeWindows.snacks)
      ? mealTimeWindows.snacks.map((window, index) => normalizeMealTimeWindow("snack", window, index))
      : DEFAULT_MEAL_TIME_WINDOWS.snacks.map((window, index) => normalizeMealTimeWindow("snack", window, index)),
  };

  if (nextPlan.breakfast) nextPlan.breakfast = { ...nextPlan.breakfast, timeWindow: breakfastTimeWindow };
  if (nextPlan.lunch) nextPlan.lunch = { ...nextPlan.lunch, timeWindow: lunchTimeWindow };
  if (nextPlan.dinner) nextPlan.dinner = { ...nextPlan.dinner, timeWindow: dinnerTimeWindow };

  if (Array.isArray(nextPlan.snacks)) {
    nextPlan.snacks = nextPlan.snacks.map((snack, index) => {
      const snackWindow = Array.isArray(mealTimeWindows.snacks)
        ? mealTimeWindows.snacks.find((entry) => Number(entry?.mealIndex) === index + 1)
        : null;
      return {
        ...snack,
        mealIndex: Number(snack?.mealIndex) || index + 1,
        timeWindow: normalizeMealTimeWindow("snack", snackWindow, index),
      };
    });
  }

  return nextPlan;
};

const getDefaultMealTimeWindows = () => ({
  breakfast: normalizeMealTimeWindow("breakfast"),
  lunch: normalizeMealTimeWindow("lunch"),
  dinner: normalizeMealTimeWindow("dinner"),
  snacks: DEFAULT_MEAL_TIME_WINDOWS.snacks.map((window, index) => normalizeMealTimeWindow("snack", window, index)),
});

const mergeMealTimeWindows = (plan = {}, mealTimeWindows = {}) => {
  const merged = { ...plan };
  if (mealTimeWindows.breakfast && merged.breakfast) {
    merged.breakfast = {
      ...merged.breakfast,
      timeWindow: normalizeMealTimeWindow("breakfast", mealTimeWindows.breakfast),
    };
  }
  if (mealTimeWindows.lunch && merged.lunch) {
    merged.lunch = {
      ...merged.lunch,
      timeWindow: normalizeMealTimeWindow("lunch", mealTimeWindows.lunch),
    };
  }
  if (mealTimeWindows.dinner && merged.dinner) {
    merged.dinner = {
      ...merged.dinner,
      timeWindow: normalizeMealTimeWindow("dinner", mealTimeWindows.dinner),
    };
  }
  if (Array.isArray(mealTimeWindows.snacks) && Array.isArray(merged.snacks)) {
    merged.snacks = merged.snacks.map((snack, index) => {
      const snackWindow = mealTimeWindows.snacks.find((entry) => Number(entry?.mealIndex) === index + 1);
      return snackWindow
        ? {
            ...snack,
            timeWindow: normalizeMealTimeWindow("snack", snackWindow, index),
          }
        : snack;
    });
  }
  return merged;
};

const getTargetForMeal = (targets, mealType, snackIndex = null) => {
  if (mealType === "breakfast") return safeNumber(targets?.breakfast);
  if (mealType === "lunch") return safeNumber(targets?.lunch);
  if (mealType === "dinner") return safeNumber(targets?.dinner);
  if (mealType === "snack") return safeNumber(targets?.snacks?.[snackIndex]);
  return 0;
};

const calculateGapPercent = (target, actual) => {
  if (!target) return 0;
  return roundValue((Math.abs(safeNumber(actual) - safeNumber(target)) / Math.max(safeNumber(target), 1)) * 100);
};

const getActualTotals = (plan) => {
  const nutritionTotals = plan?.nutrition?.actualTotals;
  if (nutritionTotals) return nutritionTotals;

  const mealItems = [
    ...(plan?.breakfast?.items || []),
    ...(plan?.lunch?.items || []),
    ...(plan?.dinner?.items || []),
    ...(Array.isArray(plan?.snacks) ? plan.snacks.flatMap((meal) => meal.items || []) : []),
  ];
  return aggregateTotals(mealItems);
};

const getMacroPercentages = (totals = {}) => {
  const calories = safeNumber(totals.calories);
  if (calories <= 0) return { protein: 0, carbs: 0, fats: 0 };

  return {
    protein: roundMacro((safeNumber(totals.protein) * 4 * 100) / calories),
    carbs: roundMacro((safeNumber(totals.carbs) * 4 * 100) / calories),
    fats: roundMacro((safeNumber(totals.fats) * 9 * 100) / calories),
  };
};

const getMealTotalsFromSelection = (selection = {}) => selection?.totals || aggregateTotals(selection?.items || []);

const getMealItemRows = (items = []) =>
  items.map((item) => ({
    name: normalizeDisplayName(item.name),
    calories: roundCalories(item.calories),
    protein: roundMacro(item.protein),
    carbs: roundMacro(item.carbs),
    fats: roundMacro(item.fats),
    weightGrams: item.weightGrams === null || item.weightGrams === undefined ? null : roundCalories(item.weightGrams),
  }));

const getFoodDetail = (item = {}) => ({
  id: item.id ?? null,
  name: item.name ? normalizeDisplayName(item.name) : null,
  calories: roundCalories(item.calories),
  protein: roundMacro(item.protein),
  carbs: roundMacro(item.carbs),
  fats: roundMacro(item.fats),
  weightGrams: item.weightGrams === null || item.weightGrams === undefined ? null : roundCalories(item.weightGrams),
  category: item.category ?? null,
  foodRole: item.foodRole ?? null,
});

const extractSwapSuggestions = (alternatives = {}) => {
  const formatted = [];

  const collect = (blocks = [], mealLabel) => {
    for (const block of blocks) {
      for (const componentBlock of Array.isArray(block.components) ? block.components : []) {
        if (!componentBlock?.recommended || componentBlock.reason === "no_valid_match_after_fallback") continue;
        if (componentBlock.isSafeSwap === false || componentBlock.recommended?.isSafeSwap === false) continue;
        const currentItem = block.currentItem || {};
        const currentItemId = currentItem.id ?? block.originalItemId ?? null;
        const alternatives = Array.isArray(componentBlock.alternatives)
          ? componentBlock.alternatives
            .filter((alternative) => alternative && alternative.id !== currentItemId)
            .slice(0, 3)
            .map((alternative) => ({
              id: alternative.id,
              name: normalizeDisplayName(alternative.name),
              calories: roundCalories(alternative.scaledPortion?.calories ?? alternative.calories),
              protein: roundMacro(alternative.scaledPortion?.protein ?? alternative.protein),
              carbs: roundMacro(alternative.scaledPortion?.carbs ?? alternative.carbs),
              fats: roundMacro(alternative.scaledPortion?.fats ?? alternative.fats),
              matchScore: roundMacro(alternative.matchScore ?? 0),
              isSafeSwap: Boolean(alternative.isSafeSwap),
            }))
          : [];

        if (alternatives.length < 2) continue;
        if (alternatives[0]?.id === currentItemId) continue;

        formatted.push({
          meal: mealLabel,
          currentItem: {
            id: currentItem.id ?? null,
            name: currentItem.name ? normalizeDisplayName(currentItem.name) : null,
            calories: roundCalories(currentItem.calories),
            protein: roundMacro(currentItem.protein),
            carbs: roundMacro(currentItem.carbs),
            fats: roundMacro(currentItem.fats),
          },
          alternatives,
        });
      }
    }
  };

  collect(alternatives.breakfast || [], "Breakfast");
  collect(alternatives.lunch || [], "Lunch");
  collect(alternatives.dinner || [], "Dinner");
  if (Array.isArray(alternatives.snacks)) {
    alternatives.snacks.forEach((snackMeal) => {
      collect(snackMeal.items || [], `Snack ${snackMeal.mealIndex}`);
    });
  }

  return formatted;
};

const renderMealMarkdown = (meal) => {
  const hasItems = Array.isArray(meal.items) && meal.items.length > 0;
  if (!hasItems) return "";

  const lines = [
    `### ${meal.mealName}`,
    `Target: ${roundCalories(meal.targetCalories)} kcal | Actual: ${roundCalories(meal.actualCalories)} kcal | Gap: ${roundMacro(meal.calorieGapPercent)}%`,
    "",
    "| Food Item | Calories | Protein | Carbs | Fats | Weight |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...meal.items.map((item) => `| ${markdownEscape(item.name)} | ${roundCalories(item.calories)} | ${roundMacro(item.protein)} | ${roundMacro(item.carbs)} | ${roundMacro(item.fats)} | ${item.weightGrams ?? "-"} |`),
    `| **Subtotal** | **${roundCalories(meal.subtotal.calories)}** | **${roundMacro(meal.subtotal.protein)}** | **${roundMacro(meal.subtotal.carbs)}** | **${roundMacro(meal.subtotal.fats)}** | - |`,
  ];
  return lines.join("\n");
};

const renderMealPlanMarkdown = (formatted = {}) => {
  const lines = [];
  lines.push(
    `## Daily Nutrition Targets`,
    `Calories: ${roundCalories(formatted.dailyNutritionTargets?.calories)} kcal`,
    `Protein: ${roundMacro(formatted.dailyNutritionTargets?.macros?.protein)} g | Carbs: ${roundMacro(formatted.dailyNutritionTargets?.macros?.carbs)} g | Fats: ${roundMacro(formatted.dailyNutritionTargets?.macros?.fats)} g`,
    "",
    `## Actual Daily Totals`,
    formatted.actualDailyTotals?.gap
      ? `Calories: ${roundCalories(formatted.actualDailyTotals?.calories)} kcal (${roundMacro(formatted.actualDailyTotals?.gap?.percent)}% gap, ${roundCalories(formatted.actualDailyTotals?.gap?.absolute)} kcal ${formatted.actualDailyTotals?.gap?.status || "deficit"})`
      : `Calories: ${roundCalories(formatted.actualDailyTotals?.calories)} kcal`,
    `Protein: ${roundMacro(formatted.actualDailyTotals?.macros?.protein)} g | Carbs: ${roundMacro(formatted.actualDailyTotals?.macros?.carbs)} g | Fats: ${roundMacro(formatted.actualDailyTotals?.macros?.fats)} g`,
    `Macro split: Protein ${roundMacro(formatted.actualDailyTotals?.macroPercentages?.protein)}% | Carbs ${roundMacro(formatted.actualDailyTotals?.macroPercentages?.carbs)}% | Fats ${roundMacro(formatted.actualDailyTotals?.macroPercentages?.fats)}%`,
    "",
  );

  if (formatted.meals?.length) {
    lines.push("## Meals", "");
    for (const meal of formatted.meals) {
      const section = renderMealMarkdown(meal);
      if (section) {
        lines.push(section, "");
      }
    }
  }

  if (formatted.swapSuggestions?.length) {
    lines.push("## Swap Suggestions", "");
    for (const swap of formatted.swapSuggestions) {
      const topAlternative = Array.isArray(swap.alternatives) ? swap.alternatives[0] : null;
      const safetyNote = topAlternative?.isSafeSwap ? "" : " - unverified swap";
      lines.push(
        `- ${swap.currentItem?.name || "Unknown item"} → ${topAlternative?.name || "Unknown alternative"} (match ${roundMacro(topAlternative?.matchScore ?? 0)})${safetyNote}`,
      );
    }
    lines.push("");
  }

  if (formatted.flags?.calorieGap) {
    lines.push(formatted.flags.calorieGap, "");
  }
  if (formatted.flags?.allergiesRespected) lines.push(formatted.flags.allergiesRespected, "");
  if (formatted.flags?.dislikesAvoided) lines.push(formatted.flags.dislikesAvoided, "");

  return lines.join("\n").trim();
};

const formatEssentialMealPlanResponse = (plan) => {
  if (!plan || typeof plan !== "object") return plan;

  const constraints = plan.nutrition?.constraints || {};
  const dailyTargets = {
    calories: roundCalories(plan.nutrition?.targetCalories),
    macros: {
      protein: roundMacro(plan.nutrition?.macros?.protein),
      carbs: roundMacro(plan.nutrition?.macros?.carbs),
      fats: roundMacro(plan.nutrition?.macros?.fats),
    },
  };

  const actualTotals = getActualTotals(plan);
  const actualMacroPercentages = getMacroPercentages(actualTotals);
  const calorieGapPercent = calculateGapPercent(dailyTargets.calories, actualTotals.calories);
  const calorieGapAbsolute = Math.abs(roundCalories(dailyTargets.calories) - roundCalories(actualTotals.calories));
  const calorieGapStatus = roundCalories(actualTotals.calories) >= roundCalories(dailyTargets.calories) ? "surplus" : "deficit";
  const mealTargets = plan.mealTargets || {};
  const meals = [];

  const pushMeal = (mealType, selection, label, snackIndex = null) => {
    const items = Array.isArray(selection?.items) ? selection.items : [];
    if (items.length === 0) {
      if (mealType === "snack") return;
    }

    const targetCalories = getTargetForMeal(mealTargets, mealType, snackIndex);
    const actualCalories = safeNumber(getMealTotalsFromSelection(selection).calories);
    const timeWindow = selection?.timeWindow
      ? normalizeMealTimeWindow(mealType, selection.timeWindow, snackIndex)
      : normalizeMealTimeWindow(mealType, null, snackIndex);
    meals.push({
      mealName: label,
      targetCalories: roundCalories(targetCalories),
      actualCalories: roundCalories(actualCalories),
      calorieGapPercent: calculateGapPercent(targetCalories, actualCalories),
      items: getMealItemRows(items),
      subtotal: getMealTotalsFromSelection(selection),
      timeWindow,
    });
  };

  pushMeal("breakfast", plan.breakfast, "Breakfast");
  pushMeal("lunch", plan.lunch, "Lunch");
  pushMeal("dinner", plan.dinner, "Dinner");
  if (Array.isArray(plan.snacks)) {
    plan.snacks.forEach((snack, index) => pushMeal("snack", snack, getMealDisplayName("snack", index), index));
  }

  const swapSuggestions = extractSwapSuggestions(plan.alternatives || {});
  const constraintStatus = hasConstraintViolation(
    meals.flatMap((meal) => meal.items),
    constraints,
  );
  const calorieGapFlag = actualTotals.calories < dailyTargets.calories && calorieGapPercent > 15
    ? `⚠️ Actual calories are ${calorieGapPercent}% below target.`
    : null;

  const formatted = {
    dailyNutritionTargets: dailyTargets,
    actualDailyTotals: {
      calories: roundCalories(actualTotals.calories),
      macros: {
        protein: roundMacro(actualTotals.protein),
        carbs: roundMacro(actualTotals.carbs),
        fats: roundMacro(actualTotals.fats),
      },
      macroPercentages: actualMacroPercentages,
      ...(calorieGapPercent > 2
        ? {
            gap: {
              percent: roundMacro(calorieGapPercent),
              absolute: roundCalories(calorieGapAbsolute),
              status: calorieGapStatus,
            },
          }
        : {}),
    },
    meals,
    swapSuggestions,
    flags: {
      calorieGap: calorieGapFlag,
      allergiesRespected: constraintStatus.allergenHit ? "⚠️ Allergy constraints may be violated." : "✅ Allergy constraints are respected.",
      dislikesAvoided: constraintStatus.dislikeHit ? "⚠️ Dislikes may be present." : "✅ Dislikes are avoided.",
    },
  };

  return formatted;
};

const getPlanMeals = (plan) => ({
  breakfast: plan?.breakfast || buildMealSelection([]),
  lunch: plan?.lunch || buildMealSelection([]),
  dinner: plan?.dinner || buildMealSelection([]),
  snacks: Array.isArray(plan?.snacks) ? plan.snacks : [],
});

const buildAlternativeSummary = (alternatives = {}) => {
  const summarizeMealItems = (items = []) =>
    items.map((itemEntry) => ({
      itemId: itemEntry.itemId,
      itemName: itemEntry.itemName ? normalizeDisplayName(itemEntry.itemName) : itemEntry.itemName,
      category: itemEntry.category,
      currentItem: itemEntry.currentItem
        ? {
            ...itemEntry.currentItem,
            name: normalizeDisplayName(itemEntry.currentItem.name),
          }
        : itemEntry.currentItem,
      currentMacros: itemEntry.currentItem
        ? {
            calories: safeNumber(itemEntry.currentItem.calories),
            protein: safeNumber(itemEntry.currentItem.protein),
            carbs: safeNumber(itemEntry.currentItem.carbs),
            fats: safeNumber(itemEntry.currentItem.fats),
          }
        : null,
      itemAlternatives: Array.isArray(itemEntry.itemAlternatives)
        ? itemEntry.itemAlternatives.slice(0, 3).map((alternative, index) => ({
            rank: index + 1,
            ...alternative,
            name: alternative.name ? normalizeDisplayName(alternative.name) : alternative.name,
          }))
        : [],
      itemAlternativeBlock: itemEntry.itemAlternativeBlock || null,
      replacementComponents: itemEntry.components.map((componentBlock) => ({
        component: componentBlock.replaceableComponent,
        recommended: componentBlock.recommended
          ? {
              ...componentBlock.recommended,
              name: normalizeDisplayName(componentBlock.recommended.name),
            }
          : componentBlock.recommended,
        totalMatches: Array.isArray(componentBlock.alternatives)
          ? componentBlock.alternatives.length
          : 0,
        bestMatches: Array.isArray(componentBlock.alternatives)
          ? componentBlock.alternatives.slice(0, 3).map((alternative, index) => ({
              rank: index + 1,
              ...alternative,
              name: alternative.name ? normalizeDisplayName(alternative.name) : alternative.name,
            }))
          : [],
        previewImpact: componentBlock.previewImpact,
        previewTotals: componentBlock.previewTotals,
        isSafeSwap: componentBlock.isSafeSwap ?? componentBlock.recommended?.isSafeSwap ?? false,
        confidence: componentBlock.confidence ?? componentBlock.recommended?.confidence ?? "low",
        reason: componentBlock.reason || null,
      })),
    }));

  return {
    breakfast: summarizeMealItems(alternatives.breakfast || []),
    lunch: summarizeMealItems(alternatives.lunch || []),
    dinner: summarizeMealItems(alternatives.dinner || []),
    snacks: Array.isArray(alternatives.snacks)
      ? alternatives.snacks.map((meal) => ({
          mealIndex: meal.mealIndex,
          items: summarizeMealItems(meal.items || []),
        }))
      : [],
  };
};

const formatMealPlanResponse = (plan) => {
  if (!plan || typeof plan !== "object" || !plan.alternatives) return plan;

  return {
    ...plan,
    alternativeSummary: buildAlternativeSummary(plan.alternatives),
  };
};

const resolveMealContext = async ({
  userId,
  calories,
  targetCalories,
  dietType,
  allergies = [],
  mealDislikes = [],
  mealsCount = DEFAULT_MEALS_COUNT,
}) => {
  const stats = await userRepo.getStatsByUserId(userId);
  if (!stats && !calories && !targetCalories) {
    throw new AppError(
      "User nutrition profile not found. Create your profile first or pass calories explicitly.",
      404,
    );
  }

  const requiredStats = [
    "age",
    "gender",
    "weightKg",
    "heightCm",
    "activityLevel",
    "goal",
  ];
  const missingStats = stats
    ? requiredStats.filter((field) => stats[field] === null || stats[field] === undefined)
    : requiredStats;

  const profileCalories =
    stats && missingStats.length === 0
      ? calculateTargetCalories(
          calculateTDEE(
            calculateBMR({
              age: stats.age,
              gender: stats.gender,
              weight: stats.weightKg,
              height: stats.heightCm,
            }),
            stats.activityLevel,
          ),
          stats.goal,
        )
      : null;

  const resolvedCalories = Number(targetCalories || calories || profileCalories);
  if (!Number.isFinite(resolvedCalories)) {
    if (stats && missingStats.length > 0 && !calories && !targetCalories) {
      throw new AppError(
        `Nutrition profile is incomplete. Missing: ${missingStats.join(", ")}`,
        422,
      );
    }
    throw new AppError("Unable to resolve target calories for meal generation", 400);
  }

  const resolvedDietType = dietType && dietType !== "any" ? dietType : "any";
  return {
    stats,
    calories: resolvedCalories,
    dietType: resolvedDietType,
    allergies: mergeLists(stats?.mealAllergies, allergies),
    mealDislikes: mergeLists(stats?.mealDislikes, mealDislikes),
    mealPreferences: mergeLists(stats?.mealPreferences),
    mealsCount,
    macros: calculateMacros(resolvedCalories, stats?.goal || "maintain"),
  };
};

const buildMealPlanCore = async ({
  userId,
  mealsCount = DEFAULT_MEALS_COUNT,
  resolvedContext,
  includeAlternatives = true,
}) => {
  const context = resolvedContext || (await resolveMealContext({ userId, mealsCount }));
  const foods = normalizeUsdaFoods(
    await mealRepo.findFoods(context.dietType !== "any" ? { dietType: context.dietType } : {}),
  );
  const sortedFoods = sortFoodsForSelection(foods);
  const targets = buildMealTargets(context.calories, context.mealsCount);
  const safeFoods = sortFoodsForSelection(
    filterExcludedFoods(sortedFoods, context.allergies, context.mealDislikes).filter(isPreferableMealFood),
  );
  const breakfast = selectBalancedMealItems({
    foods: safeFoods,
    mealCategory: "breakfast",
    targetCalories: targets.breakfast,
    preferences: context.mealPreferences,
  });
  const lunch = selectBalancedMealItems({
    foods: safeFoods,
    mealCategory: "lunch",
    targetCalories: targets.lunch,
    preferences: context.mealPreferences,
  });
  const dinner = selectBalancedMealItems({
    foods: safeFoods,
    mealCategory: "dinner",
    targetCalories: targets.dinner,
    preferences: context.mealPreferences,
  });
  const snacks = targets.snacks.map((target) =>
    selectBalancedMealItems({
      foods: safeFoods,
      mealCategory: "snack",
      targetCalories: target,
      preferences: context.mealPreferences,
    }),
  );

  const plan = applyMealTimeWindows({
    nutrition: {
      plannerVersion: MEAL_PLAN_VERSION,
      source: context.stats ? "user_profile" : "manual_override",
      targetCalories: context.calories,
      macros: context.macros,
      mealsCount: context.mealsCount,
      constraints: {
        mealPreferences: context.mealPreferences,
        mealAllergies: context.allergies,
        mealDislikes: context.mealDislikes,
      },
    },
    mealTargets: targets,
    breakfast,
    lunch,
    dinner,
    snacks,
  }, getDefaultMealTimeWindows());

  const mealBlocks = [breakfast, lunch, dinner, ...snacks];
  const allItems = mealBlocks.flatMap((meal) => meal.items || []);
  const dayTotals = aggregateTotals(allItems);
  const dayCalorieDeviation = Math.abs(safeNumber(dayTotals.calories) - safeNumber(context.calories)) / Math.max(safeNumber(context.calories), 1);
  const mealsBalanced = mealBlocks.every((meal, index) => {
    const target = index === 0 ? targets.breakfast : index === 1 ? targets.lunch : index === 2 ? targets.dinner : targets.snacks[index - 3];
    return isMealSelectionValid(meal.items || [], target);
  });

  if ((!mealsBalanced || dayCalorieDeviation > 0.1) && safeFoods.length > 0) {
    const fallbackFoods = sortFoodsForSelection(safeFoods.map((food) => ({
      ...food,
      foodRole: food.foodRole || classifyFoodRole(food),
    })));

    const rebuiltBreakfast = selectBalancedMealItems({
      foods: fallbackFoods,
      mealCategory: "breakfast",
      targetCalories: targets.breakfast,
      preferences: context.mealPreferences,
    });
    const rebuiltLunch = selectBalancedMealItems({
      foods: fallbackFoods,
      mealCategory: "lunch",
      targetCalories: targets.lunch,
      preferences: context.mealPreferences,
    });
    const rebuiltDinner = selectBalancedMealItems({
      foods: fallbackFoods,
      mealCategory: "dinner",
      targetCalories: targets.dinner,
      preferences: context.mealPreferences,
    });
    const rebuiltSnacks = targets.snacks.map((target) =>
      selectBalancedMealItems({
        foods: fallbackFoods,
        mealCategory: "snack",
        targetCalories: target,
        preferences: context.mealPreferences,
      }),
    );

    plan.breakfast = rebuiltBreakfast;
    plan.lunch = rebuiltLunch;
    plan.dinner = rebuiltDinner;
    plan.snacks = rebuiltSnacks;
  }

  const finalMeals = [plan.breakfast, plan.lunch, plan.dinner, ...plan.snacks];
  const finalTotals = aggregateTotals(finalMeals.flatMap((meal) => meal.items || []));
  plan.nutrition.actualTotals = finalTotals;
  plan.nutrition.macroPercentages = getMacroBalance(finalTotals).percentages;

  if (!includeAlternatives) return plan;

  const alternatives = await buildAlternativesForMealPlan(plan, {
    limit: DEFAULT_ALTERNATIVE_LIMIT,
  });

  return formatMealPlanResponse({
    ...plan,
    alternatives,
  });
};

const generateAndStoreMealPlan = async ({
  userId,
  mealsCount = DEFAULT_MEALS_COUNT,
}) => {
  const resolvedContext = await resolveMealContext({ userId, mealsCount });
  const plan = await buildMealPlanCore({
    userId,
    mealsCount,
    resolvedContext,
    includeAlternatives: true,
  });
  return dietRepo.createPlan(userId, plan);
};

const generateMealPlan = async (params) =>
  buildMealPlanCore({
    ...params,
    includeAlternatives: true,
  });

const enrichStoredMealPlan = async (record, userId) => {
  if (!record) {
    throw new AppError("Meal plan not found", 404);
  }

  const basePlan = record.plan || {};
  const plannerVersion = basePlan?.nutrition?.plannerVersion || 0;
  if (plannerVersion < MEAL_PLAN_VERSION) {
    return generateAndStoreMealPlan({
      userId,
      mealsCount: basePlan?.nutrition?.mealsCount || DEFAULT_MEALS_COUNT,
    });
  }

  const resolvedContext = await resolveMealContext({
    userId,
    targetCalories: basePlan?.nutrition?.targetCalories,
    mealsCount: basePlan?.nutrition?.mealsCount || DEFAULT_MEALS_COUNT,
  });

  const alternatives = await buildAlternativesForMealPlan(basePlan, {
    limit: DEFAULT_ALTERNATIVE_LIMIT,
    resolvedContext,
  });

  return {
    ...record,
    plan: formatMealPlanResponse({
      ...basePlan,
      alternatives,
    }),
  };
};

const getLatestMealPlan = async (userId) => {
  const plan = await dietRepo.findLatestPlan(userId);
  return enrichStoredMealPlan(plan, userId);
};

const updateMealTimeWindows = async (userId, mealTimeWindows = {}) => {
  const latest = await dietRepo.findLatestPlan(userId);
  if (!latest) {
    throw new AppError("Meal plan not found", 404);
  }

  const basePlan = latest.plan || {};
  const updatedPlan = mergeMealTimeWindows(basePlan, mealTimeWindows);
  updatedPlan.mealTimeWindows = {
    ...(basePlan.mealTimeWindows || {}),
    ...(mealTimeWindows.breakfast ? { breakfast: normalizeMealTimeWindow("breakfast", mealTimeWindows.breakfast) } : {}),
    ...(mealTimeWindows.lunch ? { lunch: normalizeMealTimeWindow("lunch", mealTimeWindows.lunch) } : {}),
    ...(mealTimeWindows.dinner ? { dinner: normalizeMealTimeWindow("dinner", mealTimeWindows.dinner) } : {}),
  };
  if (Array.isArray(mealTimeWindows.snacks)) {
    updatedPlan.mealTimeWindows.snacks = mealTimeWindows.snacks.map((entry, index) =>
      normalizeMealTimeWindow("snack", entry, index));
  }

  await dietRepo.createPlan(userId, updatedPlan);
  return getLatestMealPlan(userId);
};

const generateAIMealSuggestions = async ({
  calories,
  dietType,
  isPremium,
  allergies = [],
  mealDislikes = [],
}) => {
  if (!isPremium) return [];
  if (process.env.ENABLE_AI_MEAL_SUGGESTIONS !== "true") return [];

  const exclusions = mergeLists(allergies, mealDislikes);
  const prompt = `You are a nutrition assistant. Provide 2 meal suggestions for dietType: ${dietType}.
Each suggestion must be JSON with keys: name, calories, protein, carbs, fats.
Target calories per meal: ${Math.round(calories / 3)}.
Avoid ingredients/foods: ${exclusions.length ? exclusions.join(", ") : "none"}.`;

  try {
    const client = getOpenAIClient();
    const completion = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: "Return strict JSON array only." },
        { role: "user", content: prompt },
      ],
    });

    const text = completion.output_text || "";
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) =>
      validateAIMealSuggestion(item, Math.round(calories / 3)),
    );
  } catch (err) {
    logger.warn({ err }, "AI meal suggestion failed");
    return [];
  }
};

const findMealItemInPlan = (plan, { mealType, itemId, itemName }) => {
  const meals = getPlanMeals(plan);
  const searchName = normalizeText(itemName);

  const locateInSelection = (selection, label, snackIndex = null) => {
    const items = Array.isArray(selection?.items) ? selection.items : [];
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (itemId !== undefined && itemId !== null && safeNumber(item.id) === safeNumber(itemId)) return true;
        if (searchName && normalizeText(item.name) === searchName) return true;
        if (searchName && normalizeText(item.name).includes(searchName)) return true;
        return false;
      })
      .map(({ item, index }) => ({
        item,
        mealType: label,
        snackIndex,
        itemIndex: index,
      }));
  };

  if (mealType === "breakfast") return locateInSelection(meals.breakfast, "breakfast");
  if (mealType === "lunch") return locateInSelection(meals.lunch, "lunch");
  if (mealType === "dinner") return locateInSelection(meals.dinner, "dinner");
  if (mealType === "snack") {
    return meals.snacks.flatMap((meal, snackIndex) =>
      locateInSelection(meal, "snack", snackIndex),
    );
  }

  return [
    ...locateInSelection(meals.breakfast, "breakfast"),
    ...locateInSelection(meals.lunch, "lunch"),
    ...locateInSelection(meals.dinner, "dinner"),
    ...meals.snacks.flatMap((meal, snackIndex) =>
      locateInSelection(meal, "snack", snackIndex),
    ),
  ];
};

const getItemAlternatives = async ({
  userId,
  itemId,
  itemName,
  mealType,
  targetComponent,
  limit = DEFAULT_ALTERNATIVE_LIMIT,
}) => {
  const latest = await getLatestMealPlan(userId);
  const basePlan = latest.plan || {};
  const meals = getPlanMeals(basePlan);
  const matches = findMealItemInPlan(basePlan, { mealType, itemId, itemName });

  if (matches.length === 0) {
    throw new AppError("Meal item not found in the latest meal plan", 404);
  }
  if (matches.length > 1) {
    throw new AppError(
      "Multiple meal items matched the request. Please provide itemId or mealType to narrow it down.",
      409,
    );
  }

  const target = matches[0];
  const mealSelection =
    target.mealType === "breakfast"
      ? meals.breakfast
      : target.mealType === "lunch"
        ? meals.lunch
        : target.mealType === "dinner"
          ? meals.dinner
          : meals.snacks[target.snackIndex];

  const allItems = [
    ...(meals.breakfast.items || []),
    ...(meals.lunch.items || []),
    ...(meals.dinner.items || []),
    ...meals.snacks.flatMap((meal) => meal.items || []),
  ];
  const dayTotals = aggregateTotals(allItems);
  const foods = sortFoodsForSelection(normalizeUsdaFoods(await mealRepo.findFoods()).map((food) => normalizeForMatch(food)));

  return buildItemAlternatives({
    item: target.item,
    category: target.mealType === "snack" ? "snack" : target.mealType,
    mealTotals: mealSelection.totals || aggregateTotals(mealSelection.items || []),
    dayTotals,
    foods,
    explicitTargets: normalizeList(targetComponent),
    limit,
  });
};

const getAlternatives = getItemAlternatives;

module.exports = {
  resolveMealContext,
  generateAndStoreMealPlan,
  generateMealPlan,
  generateAIMealSuggestions,
  getItemAlternatives,
  getAlternatives,
  getLatestMealPlan,
  updateMealTimeWindows,
  formatMealPlanResponse,
  formatEssentialMealPlanResponse,
  selectBalancedMealItems,
  sortFoodsForSelection,
};
