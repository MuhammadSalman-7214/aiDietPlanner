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

const DEFAULT_MEALS_COUNT = 3;
const DEFAULT_ALTERNATIVE_LIMIT = 4;

const FOOD_FAMILY_RULES = [
  {
    family: "egg",
    patterns: [
      "egg white",
      "egg",
      "omelette",
      "scramble",
      "frittata",
      "quiche",
    ],
  },
  {
    family: "oat",
    patterns: ["oatmeal", "oats", "overnight oats", "porridge"],
  },
  { family: "yogurt", patterns: ["yogurt", "parfait", "skyr"] },
  { family: "chicken", patterns: ["chicken", "poultry"] },
  { family: "turkey", patterns: ["turkey"] },
  {
    family: "fish",
    patterns: ["salmon", "tuna", "fish", "seafood", "cod", "trout", "tilapia"],
  },
  { family: "beef", patterns: ["beef", "steak", "burger", "meatballs"] },
  { family: "tofu", patterns: ["tofu", "tempeh", "edamame"] },
  {
    family: "grain",
    patterns: [
      "rice",
      "quinoa",
      "pasta",
      "couscous",
      "bulgur",
      "barley",
      "noodle",
    ],
  },
  {
    family: "bread",
    patterns: ["bagel", "bread", "toast", "wrap", "sandwich", "bun"],
  },
  { family: "salad", patterns: ["salad", "greens", "vegetable bowl"] },
  {
    family: "fruit",
    patterns: [
      "fruit",
      "apple",
      "banana",
      "berries",
      "orange",
      "pear",
      "grape",
    ],
  },
  {
    family: "nuts",
    patterns: ["nuts", "peanut", "almond", "walnut", "seed", "trail mix"],
  },
  { family: "shake", patterns: ["shake", "smoothie", "protein drink"] },
  {
    family: "dairy",
    patterns: ["milk", "cheese", "cottage", "cream", "ricotta"],
  },
];

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const dedupeList = (items) => [
  ...new Set(
    items.map((item) => String(item).trim().toLowerCase()).filter(Boolean),
  ),
];

const mergeLists = (...lists) =>
  dedupeList(lists.flatMap((list) => normalizeList(list)));

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const roundValue = (value) => Math.round((Number(value) || 0) * 10) / 10;

const summarizeFoodItem = (food) => {
  if (!food) return null;
  return {
    id: food.id,
    name: food.name,
    calories: safeNumber(food.calories),
    protein: safeNumber(food.protein),
    carbs: safeNumber(food.carbs),
    fats: safeNumber(food.fats),
    category: food.category,
    dietType: food.dietType,
    ingredients: Array.isArray(food.ingredients) ? food.ingredients : [],
    instructions: Array.isArray(food.instructions) ? food.instructions : [],
  };
};

const getFoodFamily = (food) => {
  const text = normalizeText(
    [
      food?.name,
      ...(Array.isArray(food?.ingredients) ? food.ingredients : []),
      ...(Array.isArray(food?.instructions) ? food.instructions : []),
    ].join(" "),
  );

  for (const rule of FOOD_FAMILY_RULES) {
    if (rule.patterns.some((pattern) => text.includes(pattern))) {
      return rule.family;
    }
  }

  return food?.category || "general";
};

const getFoodTokens = (food) => {
  const text = normalizeText(
    [
      food?.name,
      ...(Array.isArray(food?.ingredients) ? food.ingredients : []),
    ].join(" "),
  );

  return new Set(text.split(" ").filter((token) => token.length > 2));
};

const COMPONENT_PRIORITY = {
  egg: 100,
  chicken: 95,
  fish: 94,
  turkey: 93,
  beef: 92,
  tofu: 91,
  yogurt: 88,
  dairy: 82,
  oat: 70,
  grain: 68,
  bread: 64,
  salad: 56,
  fruit: 46,
  nuts: 40,
  shake: 36,
  general: 20,
};

const splitItemParts = (food) => {
  const name = String(food?.name || "");
  return name
    .split(/,|\/|&|\bwith\b|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);
};

const detectReplaceableComponent = (food) => {
  const parts = splitItemParts(food);
  const candidates = (parts.length > 1 ? parts : [food?.name || ""])
    .map((part) => {
      const normalizedPart = normalizeText(part);
      const partFood = {
        ...food,
        name: normalizedPart,
        ingredients: [normalizedPart],
      };
      const family = getFoodFamily(partFood);
      return {
        value: normalizedPart || normalizeText(food?.name || ""),
        family,
        priority: COMPONENT_PRIORITY[family] ?? COMPONENT_PRIORITY.general,
        length: normalizedPart.length,
      };
    })
    .filter((part) => part.value);

  if (candidates.length === 0) {
    const family = getFoodFamily(food);
    return {
      value: family,
      family,
    };
  }

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.length !== b.length) return a.length - b.length;
    return a.value.localeCompare(b.value);
  });

  const selected = candidates[0];
  return {
    value: selected.value,
    family: selected.family,
  };
};

const normalizeSimilarity = (baseValue, candidateValue) => {
  const denominator = Math.max(safeNumber(baseValue), safeNumber(candidateValue), 1);
  return clamp(1 - Math.abs(safeNumber(baseValue) - safeNumber(candidateValue)) / denominator, 0, 1);
};

const caloriesWithinTolerance = (baseFood, candidateFood) => {
  const baseCalories = safeNumber(baseFood.calories);
  const candidateCalories = safeNumber(candidateFood.calories);
  const limit = Math.max(baseCalories * 0.25, 1);
  return Math.abs(candidateCalories - baseCalories) <= limit;
};

const macroSimilarityScore = (baseFood, candidateFood) => {
  const calorieSimilarity = normalizeSimilarity(baseFood.calories, candidateFood.calories);
  const proteinSimilarity = normalizeSimilarity(baseFood.protein, candidateFood.protein);
  const carbsSimilarity = normalizeSimilarity(baseFood.carbs, candidateFood.carbs);
  const fatsSimilarity = normalizeSimilarity(baseFood.fats, candidateFood.fats);

  const weighted = (
    calorieSimilarity * 0.4 +
    proteinSimilarity * 0.3 +
    carbsSimilarity * 0.2 +
    fatsSimilarity * 0.1
  );

  return {
    score: roundValue(weighted * 100),
    calorieSimilarity,
    proteinSimilarity,
    carbsSimilarity,
    fatsSimilarity,
  };
};

const isDietTypeCompatible = (candidate, contextDietType) => {
  const normalizedContextDietType = normalizeText(contextDietType);
  if (!normalizedContextDietType || normalizedContextDietType === "any") return true;
  const normalizedCandidateDietType = normalizeText(candidate.dietType);
  return normalizedCandidateDietType === normalizedContextDietType || normalizedCandidateDietType === "any";
};

const componentMatchesFood = (candidateFood, replaceableComponent, family) => {
  const candidateText = normalizeText(
    [
      candidateFood?.name,
      ...(Array.isArray(candidateFood?.ingredients) ? candidateFood.ingredients : []),
      ...(Array.isArray(candidateFood?.instructions) ? candidateFood.instructions : []),
    ].join(" "),
  );

  if (!replaceableComponent) return true;
  if (family && getFoodFamily(candidateFood) === family) return true;
  if (candidateText.includes(replaceableComponent)) return true;
  return false;
};

const scoreAlternativeFood = (baseFood, candidateFood, context = {}) => {
  const similarity = macroSimilarityScore(baseFood, candidateFood);
  const calorieDelta = roundValue(safeNumber(candidateFood.calories) - safeNumber(baseFood.calories));
  const macroDelta = {
    calories: calorieDelta,
    protein: roundValue(safeNumber(candidateFood.protein) - safeNumber(baseFood.protein)),
    carbs: roundValue(safeNumber(candidateFood.carbs) - safeNumber(baseFood.carbs)),
    fats: roundValue(safeNumber(candidateFood.fats) - safeNumber(baseFood.fats)),
  };

  return {
    food: candidateFood,
    matchScore: similarity.score,
    macroDelta,
    calorieDelta,
    similarity,
  };
};

const buildCandidatePool = (foods, baseFood, context = {}) => {
  const baseCategory = baseFood.category;
  const replaceableComponent = context.replaceableComponent || detectReplaceableComponent(baseFood).value;
  const replaceableFamily = context.replaceableFamily || detectReplaceableComponent(baseFood).family;
  const categoryFoods = foods.filter((food) => food.category === baseCategory && food.id !== baseFood.id);
  const dietCompatibleFoods = categoryFoods.filter((food) =>
    isDietTypeCompatible(food, context.dietType || context.dietTypePreference),
  );

  const categoryPool = dietCompatibleFoods.length > 0 ? dietCompatibleFoods : categoryFoods;
  const componentPool = categoryPool.filter((food) => componentMatchesFood(food, replaceableComponent, replaceableFamily));
  const pool = componentPool.length > 0 ? componentPool : categoryPool;

  return pool.filter((food) => caloriesWithinTolerance(baseFood, food));
};

const buildAlternativeBlock = ({
  plan,
  mealSelection,
  item,
  mealType,
  itemIndex,
  foods,
  resolvedContext,
  alternativeLimit = DEFAULT_ALTERNATIVE_LIMIT,
}) => {
  const component = detectReplaceableComponent(item);
  const candidatePool = buildCandidatePool(foods, item, {
    dietType: resolvedContext.dietType,
    replaceableComponent: component.value,
    replaceableFamily: component.family,
  });

  const ranked = candidatePool
    .map((food) => scoreAlternativeFood(item, food, {
      replaceableComponent: component.value,
      replaceableFamily: component.family,
    }))
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.calorieDelta - b.calorieDelta;
    })
    .slice(0, alternativeLimit);

  const recommendedFood = ranked[0]?.food || null;
  const simulatedPlan = recommendedFood
    ? replaceItemInMeal(plan, {
        mealType,
        itemIndex,
        snackIndex: mealSelection.snackIndex,
      }, recommendedFood)
    : plan;

  return {
    originalItemId: item.id,
    originalItemName: item.name,
    replaceableComponent: component.value,
    category: item.category,
    alternatives: ranked.map((entry) => ({
      id: entry.food.id,
      name: entry.food.name,
      calories: safeNumber(entry.food.calories),
      protein: safeNumber(entry.food.protein),
      carbs: safeNumber(entry.food.carbs),
      fats: safeNumber(entry.food.fats),
      matchScore: entry.matchScore,
      macroDelta: entry.macroDelta,
    })),
    recommended: recommendedFood
      ? {
          id: recommendedFood.id,
          name: recommendedFood.name,
        }
      : null,
    previewTotals: recommendedFood
      ? aggregatePlanTotals(simulatedPlan)
      : aggregatePlanTotals(plan),
  };
};

const mapMealForAlternatives = ({
  plan,
  mealSelection,
  mealType,
  foods,
  resolvedContext,
  alternativeLimit = DEFAULT_ALTERNATIVE_LIMIT,
}) => {
  const items = Array.isArray(mealSelection?.items) ? mealSelection.items : [];
  return items.map((item, itemIndex) =>
    buildAlternativeBlock({
      plan,
      mealSelection,
      item,
      mealType,
      itemIndex,
      foods,
      resolvedContext,
      alternativeLimit,
    }),
  );
};

const sumMealTotals = (items = []) =>
  items.reduce(
    (acc, item) => {
      acc.calories += safeNumber(item?.calories);
      acc.protein += safeNumber(item?.protein);
      acc.carbs += safeNumber(item?.carbs);
      acc.fats += safeNumber(item?.fats);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );

const buildMealSelection = (items = [], extra = {}) => ({
  items: items.map((item) => summarizeFoodItem(item)),
  totals: sumMealTotals(items),
  ...extra,
});

const getPlanMeals = (plan) => ({
  breakfast: plan?.breakfast || {
    items: [],
    totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
  },
  lunch: plan?.lunch || {
    items: [],
    totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
  },
  dinner: plan?.dinner || {
    items: [],
    totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
  },
  snacks: Array.isArray(plan?.snacks) ? plan.snacks : [],
});

const aggregatePlanTotals = (plan) => {
  const meals = getPlanMeals(plan);
  const mealEntries = [
    meals.breakfast?.items || [],
    meals.lunch?.items || [],
    meals.dinner?.items || [],
    ...meals.snacks.map((meal) => meal.items || []),
  ];

  return mealEntries.flat().reduce(
    (acc, item) => {
      acc.calories += safeNumber(item?.calories);
      acc.protein += safeNumber(item?.protein);
      acc.carbs += safeNumber(item?.carbs);
      acc.fats += safeNumber(item?.fats);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
};

const findMealItemInPlan = (plan, { mealType, itemId, itemName }) => {
  const meals = getPlanMeals(plan);
  const searchName = normalizeText(itemName);

  const locateInSelection = (selection, label, snackIndex = null) => {
    const items = Array.isArray(selection?.items) ? selection.items : [];
    const matches = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (
          itemId !== undefined &&
          itemId !== null &&
          safeNumber(item.id) === safeNumber(itemId)
        ) return true;
        if (searchName && normalizeText(item.name) === searchName) return true;
        if (searchName && normalizeText(item.name).includes(searchName)) return true;
        return false;
      });

    return matches.map(({ item, index }) => ({
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
    return meals.snacks.flatMap((meal, snackIndex) => locateInSelection(meal, "snack", snackIndex));
  }

  return [
    ...locateInSelection(meals.breakfast, "breakfast"),
    ...locateInSelection(meals.lunch, "lunch"),
    ...locateInSelection(meals.dinner, "dinner"),
    ...meals.snacks.flatMap((meal, snackIndex) => locateInSelection(meal, "snack", snackIndex)),
  ];
};

const replaceItemInMeal = (plan, target, replacement) => {
  const clone = {
    ...plan,
    breakfast: plan.breakfast
      ? { ...plan.breakfast, items: [...plan.breakfast.items] }
      : { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    lunch: plan.lunch
      ? { ...plan.lunch, items: [...plan.lunch.items] }
      : { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    dinner: plan.dinner
      ? { ...plan.dinner, items: [...plan.dinner.items] }
      : { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    snacks: Array.isArray(plan.snacks)
      ? plan.snacks.map((meal) => ({ ...meal, items: [...(meal.items || [])] }))
      : [],
  };

  const selection =
    target.mealType === "breakfast"
      ? clone.breakfast
      : target.mealType === "lunch"
        ? clone.lunch
        : target.mealType === "dinner"
          ? clone.dinner
          : clone.snacks[target.snackIndex];

  if (!selection) return null;

  selection.items[target.itemIndex] = summarizeFoodItem(replacement);
  selection.totals = sumMealTotals(selection.items);

  return {
    ...clone,
    nutrition: plan.nutrition ? { ...plan.nutrition } : undefined,
    mealTargets: plan.mealTargets ? { ...plan.mealTargets } : undefined,
    breakfast: clone.breakfast,
    lunch: clone.lunch,
    dinner: clone.dinner,
    snacks: clone.snacks,
  };
};

const buildMealAlternativesForPlan = async ({
  plan,
  resolvedContext,
  userId,
  alternativeLimit = DEFAULT_ALTERNATIVE_LIMIT,
}) => {
  const foods = await mealRepo.findFoods();
  const safeFoods = filterExcludedFoods(
    foods,
    resolvedContext.allergies,
    resolvedContext.mealDislikes,
  );
  const meals = getPlanMeals(plan);

  const breakfastAlternatives = mapMealForAlternatives({
    plan,
    mealSelection: meals.breakfast,
    mealType: "breakfast",
    foods: safeFoods,
    resolvedContext,
    alternativeLimit,
  }).map((block) => block);

  const lunchAlternatives = mapMealForAlternatives({
    plan,
    mealSelection: meals.lunch,
    mealType: "lunch",
    foods: safeFoods,
    resolvedContext,
    alternativeLimit,
  }).map((block) => block);

  const dinnerAlternatives = mapMealForAlternatives({
    plan,
    mealSelection: meals.dinner,
    mealType: "dinner",
    foods: safeFoods,
    resolvedContext,
    alternativeLimit,
  }).map((block) => block);

  const snackAlternatives = meals.snacks.map((meal, snackIndex) => ({
    mealIndex: snackIndex + 1,
    items: (Array.isArray(meal.items) ? meal.items : []).map((item, itemIndex) =>
      buildAlternativeBlock({
        plan,
        mealSelection: { ...meal, snackIndex },
        item,
        mealType: "snack",
        itemIndex,
        foods: safeFoods,
        resolvedContext,
        alternativeLimit,
      }),
    ),
  }));

  return {
    breakfast: breakfastAlternatives,
    lunch: lunchAlternatives,
    dinner: dinnerAlternatives,
    snacks: snackAlternatives,
    generatedAt: new Date().toISOString(),
    source: userId ? "user_meal_plan" : "manual_override",
  };
};

const buildMealPlanCore = async ({
  userId,
  mealsCount = DEFAULT_MEALS_COUNT,
  resolvedContext,
  includeAlternatives = true,
}) => {
  const context =
    resolvedContext || (await resolveMealContext({ userId, mealsCount }));
  const foods = await mealRepo.findFoods(
    context.dietType !== "any" ? { dietType: context.dietType } : {},
  );
  const safeFoods = filterExcludedFoods(
    foods,
    context.allergies,
    context.mealDislikes,
  );
  const prioritizedFoods = scoreFoodsByPreferences(
    safeFoods,
    context.mealPreferences,
  );
  const targets = buildMealTargets(context.calories, context.mealsCount);

  const breakfastFoods = prioritizedFoods.filter(
    (food) => food.category === "breakfast",
  );
  const lunchFoods = prioritizedFoods.filter(
    (food) => food.category === "lunch",
  );
  const dinnerFoods = prioritizedFoods.filter(
    (food) => food.category === "dinner",
  );
  const snackFoods = prioritizedFoods.filter(
    (food) => food.category === "snack",
  );

  const breakfast = buildMealSelection(
    pickFoodsForTarget(breakfastFoods, targets.breakfast).items,
  );
  const lunch = buildMealSelection(
    pickFoodsForTarget(lunchFoods, targets.lunch).items,
  );
  const dinner = buildMealSelection(
    pickFoodsForTarget(dinnerFoods, targets.dinner).items,
  );
  const snacks = targets.snacks.map((target) =>
    buildMealSelection(pickFoodsForTarget(snackFoods, target).items),
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

  if (!includeAlternatives) {
    return plan;
  }

  return {
    ...plan,
    alternatives: await buildMealAlternativesForPlan({
      plan,
      resolvedContext: context,
      userId,
    }),
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
    ]
      .map((item) => String(item).toLowerCase())
      .join(" ");

    return !exclusions.some((item) => haystack.includes(item));
  });
};

const pickFoodsForTarget = (foods, targetCalories) => {
  if (!foods.length) {
    return {
      items: [],
      totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
    };
  }

  const sorted = foods
    .map((food) => ({ food, diff: Math.abs(targetCalories - food.calories) }))
    .sort((a, b) => a.diff - b.diff)
    .map((entry) => entry.food);

  const items = [];
  let remaining = targetCalories;

  for (const food of sorted) {
    if (items.length >= 3) break;
    if (food.calories <= remaining || items.length === 0) {
      items.push(food);
      remaining -= food.calories;
    }
    if (remaining <= 150) break;
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.calories += item.calories;
      acc.protein += item.protein;
      acc.carbs += item.carbs;
      acc.fats += item.fats;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );

  return { items, totals };
};

const scoreFoodsByPreferences = (foods, preferences = []) => {
  const normalizedPreferences = mergeLists(preferences);
  if (normalizedPreferences.length === 0) return foods;

  return foods
    .map((food) => {
      const haystack = [
        food.name,
        ...(Array.isArray(food.ingredients) ? food.ingredients : []),
      ]
        .map((item) => String(item).toLowerCase())
        .join(" ");

      const preferenceHits = normalizedPreferences.reduce(
        (count, pref) => count + (haystack.includes(pref) ? 1 : 0),
        0,
      );

      return { food, preferenceHits };
    })
    .sort((a, b) => b.preferenceHits - a.preferenceHits)
    .map((entry) => entry.food);
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
    ? requiredStats.filter(
        (field) => stats[field] === null || stats[field] === undefined,
      )
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

  const resolvedCalories = Number(
    targetCalories || calories || profileCalories,
  );
  if (!Number.isFinite(resolvedCalories)) {
    if (stats && missingStats.length > 0 && !calories && !targetCalories) {
      throw new AppError(
        `Nutrition profile is incomplete. Missing: ${missingStats.join(", ")}`,
        422,
      );
    }
    throw new AppError(
      "Unable to resolve target calories for meal generation",
      400,
    );
  }

  const resolvedDietType = dietType && dietType !== "any" ? dietType : "any";
  const resolvedAllergies = mergeLists(stats?.mealAllergies, allergies);
  const resolvedDislikes = mergeLists(stats?.mealDislikes, mealDislikes);
  const resolvedPreferences = mergeLists(stats?.mealPreferences);
  const macros = calculateMacros(resolvedCalories, stats?.goal || "maintain");

  return {
    stats,
    calories: resolvedCalories,
    dietType: resolvedDietType,
    allergies: resolvedAllergies,
    mealDislikes: resolvedDislikes,
    mealPreferences: resolvedPreferences,
    mealsCount,
    macros,
  };
};

const generateAndStoreMealPlan = async ({
  userId,
  mealsCount = DEFAULT_MEALS_COUNT,
}) => {
  const resolvedContext = await resolveMealContext({
    userId,
    mealsCount,
  });

  const plan = await buildMealPlanCore({
    userId,
    mealsCount,
    resolvedContext,
    includeAlternatives: false,
  });

  return dietRepo.createPlan(userId, plan);
};

const generateMealPlan = async (params) => {
  return buildMealPlanCore({
    ...params,
    includeAlternatives: true,
  });
};

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

  const alternatives = await buildMealAlternativesForPlan({
    plan: basePlan,
    resolvedContext,
    userId,
  });

  return {
    ...record,
    plan: {
      ...basePlan,
      alternatives,
    },
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

const getItemAlternatives = async ({
  userId,
  itemId,
  itemName,
  mealType,
  limit = DEFAULT_ALTERNATIVE_LIMIT,
}) => {
  const latest = await getLatestMealPlan(userId);
  const basePlan = latest.plan || {};
  const resolvedContext = await resolveMealContext({
    userId,
    targetCalories: basePlan?.nutrition?.targetCalories,
    mealsCount: basePlan?.nutrition?.mealsCount || DEFAULT_MEALS_COUNT,
  });

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
  const foods = await mealRepo.findFoods();
  const safeFoods = filterExcludedFoods(
    foods,
    resolvedContext.allergies,
    resolvedContext.mealDislikes,
  );
  const itemContext = {
    ...resolvedContext,
    dietTypePreference: target.item.dietType || resolvedContext.dietType,
  };
  const mealSelection =
    target.mealType === "breakfast"
      ? basePlan.breakfast
      : target.mealType === "lunch"
        ? basePlan.lunch
        : target.mealType === "dinner"
          ? basePlan.dinner
          : basePlan.snacks[target.snackIndex];

  return buildAlternativeBlock({
    plan: basePlan,
    mealSelection: {
      ...mealSelection,
      snackIndex: target.snackIndex,
    },
    item: target.item,
    mealType: target.mealType,
    itemIndex: target.itemIndex,
    foods: safeFoods,
    resolvedContext: itemContext,
    alternativeLimit: limit,
  });
};

module.exports = {
  resolveMealContext,
  generateAndStoreMealPlan,
  generateMealPlan,
  generateAIMealSuggestions,
  getItemAlternatives,
  getLatestMealPlan,
};
