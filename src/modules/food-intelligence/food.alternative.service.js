const mealRepo = require("../meal/meal.repository");
const {
  extractComponents,
  getComponentVariants,
  normalize,
  selectReplaceableComponents,
} = require("./component.engine");
const { REPLACEMENTS } = require("./replacement.map");
const {
  normalizeUsdaFood,
  normalizeUsdaFoods,
  roundValue,
  safeNumber,
} = require("./food.usda.service");

const zeroTotals = () => ({ calories: 0, protein: 0, carbs: 0, fats: 0 });

const aggregateTotals = (items = []) =>
  items.reduce(
    (acc, item) => ({
      calories: roundValue(acc.calories + safeNumber(item.calories)),
      protein: roundValue(acc.protein + safeNumber(item.protein)),
      carbs: roundValue(acc.carbs + safeNumber(item.carbs)),
      fats: roundValue(acc.fats + safeNumber(item.fats)),
    }),
    zeroTotals(),
  );

const normalizeFood = (food) => {
  const normalizedFood = normalizeUsdaFood(food);
  return {
    ...normalizedFood,
    normalizedName: normalize(normalizedFood.normalizedName || normalizedFood.name),
    componentTags: Array.isArray(normalizedFood.componentTags) && normalizedFood.componentTags.length > 0
      ? [...new Set(normalizedFood.componentTags.map((item) => normalize(item)).filter(Boolean))]
      : extractComponents(normalizedFood.name),
  };
};

const getCandidates = ({ foods = [], category, originalId }) => {
  const baseCandidates = foods.filter((food) => safeNumber(food.id) !== safeNumber(originalId));
  if (!category) return baseCandidates;

  const categoryCandidates = baseCandidates.filter((food) => food.category === category);
  return categoryCandidates.length > 0 ? categoryCandidates : baseCandidates;
};

const filterCandidates = (candidates, component) => {
  const blockedTerms = getComponentVariants(component).map((variant) => normalize(variant)).filter(Boolean);

  return candidates.filter((food) => {
    const haystack = normalize([
      food.name,
      ...(Array.isArray(food.componentTags) ? food.componentTags : []),
    ].join(" "));

    return blockedTerms.every((term) => !haystack.includes(term));
  });
};

const matchReplacement = (food, component) => {
  const allowed = REPLACEMENTS[component] || [];
  if (allowed.length === 0) return false;

  const haystack = normalize([
    food.name,
    ...(Array.isArray(food.componentTags) ? food.componentTags : []),
  ].join(" "));

  return allowed.some((allowedComponent) =>
    getComponentVariants(allowedComponent).some((variant) => haystack.includes(normalize(variant))),
  );
};

const calculateScore = (original, alt) => {
  const originalCalories = Math.max(safeNumber(original.calories), 1);
  const originalProtein = Math.max(safeNumber(original.protein), 1);
  const calDiff = Math.abs(safeNumber(original.calories) - safeNumber(alt.calories)) / originalCalories;
  const proteinDiff = Math.abs(safeNumber(original.protein) - safeNumber(alt.protein)) / originalProtein;

  return roundValue(Math.max(0, 100 - (calDiff * 50 + proteinDiff * 50)));
};

const findComponentReferenceFood = ({ component, foods = [], originalItem }) => {
  const sameComponentFoods = foods.filter((food) =>
    getComponentVariants(component).some((variant) =>
      normalize([food.name, ...(food.componentTags || [])].join(" ")).includes(normalize(variant)),
    ),
  );

  sameComponentFoods.sort((a, b) => {
    const aScore = safeNumber(a.protein) + safeNumber(a.carbs) + safeNumber(a.fats);
    const bScore = safeNumber(b.protein) + safeNumber(b.carbs) + safeNumber(b.fats);
    return aScore - bScore;
  });

  return sameComponentFoods[0] || originalItem;
};

const calculateAdjustedItem = (originalItem, componentSource, alternative) => ({
  calories: roundValue(
    safeNumber(originalItem.calories) - safeNumber(componentSource?.calories) + safeNumber(alternative.calories),
  ),
  protein: roundValue(
    safeNumber(originalItem.protein) - safeNumber(componentSource?.protein) + safeNumber(alternative.protein),
  ),
  carbs: roundValue(
    safeNumber(originalItem.carbs) - safeNumber(componentSource?.carbs) + safeNumber(alternative.carbs),
  ),
  fats: roundValue(
    safeNumber(originalItem.fats) - safeNumber(componentSource?.fats) + safeNumber(alternative.fats),
  ),
});

const calculateTotalsDelta = (before, after) => ({
  calories: roundValue(safeNumber(after.calories) - safeNumber(before.calories)),
  protein: roundValue(safeNumber(after.protein) - safeNumber(before.protein)),
  carbs: roundValue(safeNumber(after.carbs) - safeNumber(before.carbs)),
  fats: roundValue(safeNumber(after.fats) - safeNumber(before.fats)),
});

const applyReplacement = (plan, original, alt) => ({
  previewImpact: {
    calories: roundValue(safeNumber(alt.calories) - safeNumber(original.calories)),
    protein: roundValue(safeNumber(alt.protein) - safeNumber(original.protein)),
    carbs: roundValue(safeNumber(alt.carbs) - safeNumber(original.carbs)),
    fats: roundValue(safeNumber(alt.fats) - safeNumber(original.fats)),
  },
  previewTotals: {
    calories: roundValue(safeNumber(plan.totalCalories) - safeNumber(original.calories) + safeNumber(alt.calories)),
    protein: roundValue(safeNumber(plan.totalProtein) - safeNumber(original.protein) + safeNumber(alt.protein)),
    carbs: roundValue(safeNumber(plan.totalCarbs) - safeNumber(original.carbs) + safeNumber(alt.carbs)),
    fats: roundValue(safeNumber(plan.totalFats) - safeNumber(original.fats) + safeNumber(alt.fats)),
  },
});

const calculatePreviewTotals = ({ mealTotals, dayTotals, originalItem, adjustedItem }) => {
  const nextMealTotals = {
    calories: roundValue(safeNumber(mealTotals.calories) - safeNumber(originalItem.calories) + safeNumber(adjustedItem.calories)),
    protein: roundValue(safeNumber(mealTotals.protein) - safeNumber(originalItem.protein) + safeNumber(adjustedItem.protein)),
    carbs: roundValue(safeNumber(mealTotals.carbs) - safeNumber(originalItem.carbs) + safeNumber(adjustedItem.carbs)),
    fats: roundValue(safeNumber(mealTotals.fats) - safeNumber(originalItem.fats) + safeNumber(adjustedItem.fats)),
  };

  const nextDayTotals = {
    calories: roundValue(safeNumber(dayTotals.calories) - safeNumber(originalItem.calories) + safeNumber(adjustedItem.calories)),
    protein: roundValue(safeNumber(dayTotals.protein) - safeNumber(originalItem.protein) + safeNumber(adjustedItem.protein)),
    carbs: roundValue(safeNumber(dayTotals.carbs) - safeNumber(originalItem.carbs) + safeNumber(adjustedItem.carbs)),
    fats: roundValue(safeNumber(dayTotals.fats) - safeNumber(originalItem.fats) + safeNumber(adjustedItem.fats)),
  };

  return {
    meal: nextMealTotals,
    day: nextDayTotals,
  };
};

const summarizeChoice = (food, originalReference) => ({
  id: food.id,
  name: food.name,
  calories: safeNumber(food.calories),
  protein: safeNumber(food.protein),
  carbs: safeNumber(food.carbs),
  fats: safeNumber(food.fats),
  matchScore: safeNumber(food.matchScore),
  macroDelta: calculateTotalsDelta(originalReference, food),
});

const getValidAlternatives = (candidates, component, originalItem) =>
  candidates
    .filter((candidate) => matchReplacement(candidate, component))
    .map((candidate) => ({
      ...candidate,
      matchScore: calculateScore(originalItem, candidate),
    }))
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return safeNumber(a.id) - safeNumber(b.id);
    });

const buildComponentAlternativeBlock = ({
  originalItem,
  component,
  alternatives,
  componentSource,
  mealTotals,
  dayTotals,
}) => {
  if (!alternatives.length) {
    return {
      originalItemId: originalItem.id,
      originalItemName: originalItem.name,
      replaceableComponent: component,
      alternatives: [],
      recommended: null,
      previewImpact: zeroTotals(),
      previewTotals: {
        calories: safeNumber(mealTotals.calories),
        protein: safeNumber(mealTotals.protein),
        carbs: safeNumber(mealTotals.carbs),
        fats: safeNumber(mealTotals.fats),
        meal: mealTotals,
        day: dayTotals,
      },
      reason: "no_valid_usda_match",
    };
  }

  const summarizedAlternatives = alternatives.map((alternative) =>
    summarizeChoice(alternative, componentSource),
  );
  const recommended = summarizedAlternatives[0];
  const adjustedItem = calculateAdjustedItem(originalItem, componentSource, recommended);
  const nestedPreviewTotals = calculatePreviewTotals({
    mealTotals,
    dayTotals,
    originalItem,
    adjustedItem,
  });
  const preview = applyReplacement(
    {
      totalCalories: mealTotals.calories,
      totalProtein: mealTotals.protein,
      totalCarbs: mealTotals.carbs,
      totalFats: mealTotals.fats,
    },
    componentSource,
    recommended,
  );

  return {
    originalItemId: originalItem.id,
    originalItemName: originalItem.name,
    replaceableComponent: component,
    alternatives: summarizedAlternatives,
    recommended,
    previewImpact: preview.previewImpact,
    previewTotals: {
      ...preview.previewTotals,
      meal: nestedPreviewTotals.meal,
      day: nestedPreviewTotals.day,
    },
  };
};

const buildItemAlternatives = async ({
  item,
  category,
  mealTotals,
  dayTotals,
  foods,
  explicitTargets = [],
  limit = 5,
}) => {
  const normalizedItem = normalizeFood(item);
  const extractedComponents = extractComponents(normalizedItem.name);
  const replaceableComponents = selectReplaceableComponents(extractedComponents, explicitTargets);

  const componentBlocks = replaceableComponents.map((component) => {
    const candidates = getCandidates({
      foods,
      category,
      originalId: normalizedItem.id,
    });
    const filteredCandidates = filterCandidates(candidates, component).map((food) => normalizeFood(food));
    const alternatives = getValidAlternatives(filteredCandidates, component, normalizedItem).slice(0, limit);
    const componentSource = findComponentReferenceFood({
      component,
      foods: foods.map((food) => normalizeFood(food)),
      originalItem: normalizedItem,
    });

    return buildComponentAlternativeBlock({
      originalItem: normalizedItem,
      component,
      alternatives,
      componentSource,
      mealTotals,
      dayTotals,
    });
  });

  return {
    itemId: normalizedItem.id,
    itemName: normalizedItem.name,
    category,
    currentItem: normalizedItem,
    components: componentBlocks.length > 0
      ? componentBlocks
      : [
          {
            originalItemId: normalizedItem.id,
            originalItemName: normalizedItem.name,
            replaceableComponent: null,
            alternatives: [],
            recommended: null,
            previewImpact: zeroTotals(),
            previewTotals: {
              calories: safeNumber(mealTotals.calories),
              protein: safeNumber(mealTotals.protein),
              carbs: safeNumber(mealTotals.carbs),
              fats: safeNumber(mealTotals.fats),
              meal: mealTotals,
              day: dayTotals,
            },
            reason: "no_valid_usda_match",
          },
        ],
  };
};

const buildAlternativesForMealPlan = async (plan, { limit = 5 } = {}) => {
  const foods = normalizeUsdaFoods(await mealRepo.findFoods()).map((food) => normalizeFood(food));

  const breakfastItems = Array.isArray(plan?.breakfast?.items) ? plan.breakfast.items : [];
  const lunchItems = Array.isArray(plan?.lunch?.items) ? plan.lunch.items : [];
  const dinnerItems = Array.isArray(plan?.dinner?.items) ? plan.dinner.items : [];
  const snackMeals = Array.isArray(plan?.snacks) ? plan.snacks : [];
  const allItems = [...breakfastItems, ...lunchItems, ...dinnerItems, ...snackMeals.flatMap((meal) => meal.items || [])];
  const dayTotals = aggregateTotals(allItems);

  const buildBlocks = async (items, mealCategory, totals) =>
    Promise.all(items.map((item) =>
      buildItemAlternatives({
        item,
        category: mealCategory,
        mealTotals: totals,
        dayTotals,
        foods,
        limit,
      }),
    ));

  return {
    breakfast: await buildBlocks(breakfastItems, "breakfast", aggregateTotals(breakfastItems)),
    lunch: await buildBlocks(lunchItems, "lunch", aggregateTotals(lunchItems)),
    dinner: await buildBlocks(dinnerItems, "dinner", aggregateTotals(dinnerItems)),
    snacks: await Promise.all(snackMeals.map(async (meal, index) => ({
      mealIndex: index + 1,
      items: await buildBlocks(meal.items || [], "snack", aggregateTotals(meal.items || [])),
    }))),
    generatedAt: new Date().toISOString(),
    source: "user_meal_plan",
  };
};

module.exports = {
  aggregateTotals,
  applyReplacement,
  buildAlternativesForMealPlan,
  buildItemAlternatives,
  calculateScore,
  filterCandidates,
  findComponentReferenceFood,
  getCandidates,
  getValidAlternatives,
  matchReplacement,
};
