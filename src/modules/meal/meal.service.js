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
  safeNumber,
} = require("../food-intelligence/food.usda.service");
const {
  buildAlternativesForMealPlan,
  aggregateTotals,
  buildItemAlternatives,
} = require("../food-intelligence/food.alternative.service");

const DEFAULT_MEALS_COUNT = 3;
const DEFAULT_ALTERNATIVE_LIMIT = 5;

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

const summarizeFoodItem = (food) => {
  if (!food) return null;
  const normalizedFood = normalizeUsdaFood(food);
  return {
    id: normalizedFood.id,
    name: normalizedFood.name,
    calories: safeNumber(normalizedFood.calories),
    protein: safeNumber(normalizedFood.protein),
    carbs: safeNumber(normalizedFood.carbs),
    fats: safeNumber(normalizedFood.fats),
    category: normalizedFood.category,
    dietType: normalizedFood.dietType,
    normalizedName: normalizedFood.normalizedName,
    componentTags: normalizedFood.componentTags || [],
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

const isPreferableMealFood = (food) => {
  const name = normalizeText(food.name);
  const calories = safeNumber(food.calories);
  const protein = safeNumber(food.protein);
  const carbs = safeNumber(food.carbs);
  const fats = safeNumber(food.fats);
  const macroCalories = protein * 4 + carbs * 4 + fats * 9;

  if (!name || calories <= 0) return false;
  if (["babyfood", "mechanically deboned", "tail", "feet", "skin"].some((term) => name.includes(term))) {
    return false;
  }
  if (macroCalories > 0) {
    const deviation = Math.abs(calories - macroCalories) / Math.max(calories, 1);
    if (deviation > 0.2) return false;
  }
  return true;
};

const scoreFoodsByPreferences = (foods, preferences = []) => {
  const normalizedPreferences = mergeLists(preferences);
  if (normalizedPreferences.length === 0) return foods;

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
    .sort((a, b) => b.preferenceHits - a.preferenceHits)
    .map((entry) => entry.food);
};

const pickFoodsForTarget = (foods, targetCalories) => {
  if (!foods.length) {
    return { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
  }

  const sorted = foods
    .map((food) => ({ food, diff: Math.abs(targetCalories - safeNumber(food.calories)) }))
    .sort((a, b) => a.diff - b.diff)
    .map((entry) => entry.food);

  const items = [];
  let remaining = targetCalories;

  for (const food of sorted) {
    if (items.length >= 3) break;
    if (safeNumber(food.calories) <= remaining || items.length === 0) {
      items.push(food);
      remaining -= safeNumber(food.calories);
    }
    if (remaining <= 150) break;
  }

  return {
    items,
    totals: aggregateTotals(items),
  };
};

const buildMealSelection = (items = []) => ({
  items: items.map((item) => summarizeFoodItem(item)),
  totals: aggregateTotals(items),
});

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
      itemName: itemEntry.itemName,
      category: itemEntry.category,
      currentItem: itemEntry.currentItem,
      currentMacros: itemEntry.currentItem
        ? {
            calories: safeNumber(itemEntry.currentItem.calories),
            protein: safeNumber(itemEntry.currentItem.protein),
            carbs: safeNumber(itemEntry.currentItem.carbs),
            fats: safeNumber(itemEntry.currentItem.fats),
          }
        : null,
      replacementComponents: itemEntry.components.map((componentBlock) => ({
        component: componentBlock.replaceableComponent,
        recommended: componentBlock.recommended,
        totalMatches: Array.isArray(componentBlock.alternatives)
          ? componentBlock.alternatives.length
          : 0,
        bestMatches: Array.isArray(componentBlock.alternatives)
          ? componentBlock.alternatives.slice(0, 3).map((alternative, index) => ({
              rank: index + 1,
              ...alternative,
            }))
          : [],
        previewImpact: componentBlock.previewImpact,
        previewTotals: componentBlock.previewTotals,
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
  const safeFoods = filterExcludedFoods(foods, context.allergies, context.mealDislikes).filter(isPreferableMealFood);
  const prioritizedFoods = scoreFoodsByPreferences(safeFoods, context.mealPreferences);
  const targets = buildMealTargets(context.calories, context.mealsCount);

  const breakfast = buildMealSelection(
    pickFoodsForTarget(
      prioritizedFoods.filter((food) => food.category === "breakfast"),
      targets.breakfast,
    ).items,
  );
  const lunch = buildMealSelection(
    pickFoodsForTarget(
      prioritizedFoods.filter((food) => food.category === "lunch"),
      targets.lunch,
    ).items,
  );
  const dinner = buildMealSelection(
    pickFoodsForTarget(
      prioritizedFoods.filter((food) => food.category === "dinner"),
      targets.dinner,
    ).items,
  );
  const snacks = targets.snacks.map((target) =>
    buildMealSelection(
      pickFoodsForTarget(
        prioritizedFoods.filter((food) => food.category === "snack"),
        target,
      ).items,
    ),
  );

  const plan = {
    nutrition: {
      source: context.stats ? "user_profile" : "manual_override",
      targetCalories: context.calories,
      macros: context.macros,
      mealsCount: context.mealsCount,
    },
    mealTargets: targets,
    breakfast,
    lunch,
    dinner,
    snacks,
  };

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
  const foods = normalizeUsdaFoods(await mealRepo.findFoods());

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
  formatMealPlanResponse,
};
