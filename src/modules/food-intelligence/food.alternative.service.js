const mealRepo = require("../meal/meal.repository");
const {
  extractComponents,
  getComponentVariants,
  normalize,
  selectReplaceableComponents,
} = require("./component.engine");
const { REPLACEMENTS } = require("./replacement.map");
const {
  classifyFoodRole,
  isMealSafeFood,
  normalizeUsdaFood,
  normalizeUsdaFoods,
  percentDiff,
  roundValue,
  safeNumber,
} = require("./food.usda.service");

const zeroTotals = () => ({ calories: 0, protein: 0, carbs: 0, fats: 0 });
const preciseRound = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

const aggregateTotals = (items = []) =>
  roundSelectionTotals(
    items.reduce(
      (acc, item) => ({
        calories: acc.calories + safeNumber(item.calories),
        protein: acc.protein + safeNumber(item.protein),
        carbs: acc.carbs + safeNumber(item.carbs),
        fats: acc.fats + safeNumber(item.fats),
      }),
      zeroTotals(),
    ),
  );

const roundSelectionTotals = (totals = {}) => ({
  calories: roundValue(totals.calories),
  protein: roundValue(totals.protein),
  carbs: roundValue(totals.carbs),
  fats: roundValue(totals.fats),
});

const normalizeFood = (food) => {
  const normalizedFood = normalizeUsdaFood(food);
  return {
    ...normalizedFood,
    normalizedName: normalize(normalizedFood.normalizedName || normalizedFood.name),
    componentTags: Array.isArray(normalizedFood.componentTags) && normalizedFood.componentTags.length > 0
      ? [...new Set(normalizedFood.componentTags.map((item) => normalize(item)).filter(Boolean))]
      : extractComponents(normalizedFood.name),
    foodRole: normalizedFood.foodRole || classifyFoodRole(normalizedFood),
  };
};

const normalizeForMatch = (food) => normalizeFood(food);

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

const getTokenSet = (value) =>
  new Set(
    normalize(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );

const calculateNameSimilarity = (original, candidate) => {
  const originalTokens = getTokenSet([original.name, ...(original.componentTags || [])].join(" "));
  const candidateTokens = getTokenSet([candidate.name, ...(candidate.componentTags || [])].join(" "));
  if (originalTokens.size === 0 || candidateTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of candidateTokens) {
    if (originalTokens.has(token)) overlap += 1;
  }

  return roundValue(overlap / Math.max(originalTokens.size, candidateTokens.size, 1));
};

const calculateMacroSimilarity = (original, candidate) => {
  const calorieSimilarity = 1 - percentDiff(original.calories, candidate.calories);
  const proteinSimilarity = 1 - percentDiff(original.protein, candidate.protein);
  const carbsSimilarity = 1 - percentDiff(original.carbs, candidate.carbs);
  const fatsSimilarity = 1 - percentDiff(original.fats, candidate.fats);

  return Math.max(
    0,
    roundValue(
      (calorieSimilarity * 0.2) +
      (proteinSimilarity * 0.3) +
      (carbsSimilarity * 0.25) +
      (fatsSimilarity * 0.25),
    ),
  );
};

const calculateMacroDeviation = (original, candidate) =>
  Math.max(
    percentDiff(original.calories, candidate.calories),
    percentDiff(original.protein, candidate.protein),
    percentDiff(original.carbs, candidate.carbs),
    percentDiff(original.fats, candidate.fats),
  );

const getSharedComponentMatch = (component, candidate) => {
  const componentVariants = getComponentVariants(component).map((variant) => normalize(variant)).filter(Boolean);
  const haystack = normalize([candidate.name, ...(candidate.componentTags || [])].join(" "));
  return componentVariants.some((variant) => haystack.includes(variant)) ? 1 : 0;
};

const getCategoryMatch = (category, candidate) => (candidate.category === category ? 1 : 0);

const getRoleMatch = (component, candidate) => {
  const candidateRole = candidate.foodRole || classifyFoodRole(candidate);
  if (!component) return 1;
  const componentRole =
    ["egg", "chicken", "turkey", "beef", "tofu", "beans", "fish"].includes(component)
      ? "protein"
      : ["rice", "quinoa", "oats", "bread", "wrap", "potato"].includes(component)
        ? "carb"
        : ["nuts", "avocado"].includes(component)
          ? "fat"
          : candidateRole;
  return candidateRole === componentRole ? 1 : 0;
};

const calculateScore = ({ original, alt, component, category, ignoreNameSimilarity = false }) => {
  const macroSimilarity = calculateMacroSimilarity(original, alt);
  const componentMatch = getSharedComponentMatch(component, alt) || matchReplacement(alt, component) ? 1 : 0;
  const categoryMatch = getCategoryMatch(category, alt);
  const nameSimilarity = ignoreNameSimilarity ? 0 : calculateNameSimilarity(original, alt);
  const roleMatch = getRoleMatch(component, alt);
  const confidenceBonus = Math.max(0, Math.min(1, Number(alt.confidence) || 0));

  return roundValue(
    (macroSimilarity * 0.4) +
    (Math.max(componentMatch, roleMatch) * 0.3) +
    (categoryMatch * 0.2) +
    (nameSimilarity * 0.1) +
    (confidenceBonus * 0.05),
  );
};

const calculateWholeItemScore = ({ original, alt, category }) => {
  const macroSimilarity = calculateMacroSimilarity(original, alt);
  const categoryMatch = getCategoryMatch(category, alt);
  const nameSimilarity = calculateNameSimilarity(original, alt);
  const roleMatch = getRoleMatch(null, alt);
  const confidenceBonus = Math.max(0, Math.min(1, Number(alt.confidence) || 0));

  return roundValue(
    (macroSimilarity * 0.6) +
    (roleMatch * 0.15) +
    (categoryMatch * 0.15) +
    (nameSimilarity * 0.05) +
    (confidenceBonus * 0.05),
  );
};

const isWithinStrictMacroTolerance = (original, candidate, tolerance = 0.25) => (
  percentDiff(original.calories, candidate.calories) <= tolerance &&
  percentDiff(original.protein, candidate.protein) <= tolerance &&
  percentDiff(original.carbs, candidate.carbs) <= tolerance &&
  percentDiff(original.fats, candidate.fats) <= tolerance
);

const scaleReplacementPortion = (original, replacement) => {
  const replacementCalories = Math.max(safeNumber(replacement.calories), 1);
  const scaleFactor = safeNumber(original.calories) / replacementCalories;

  return {
    calories: preciseRound(safeNumber(replacement.calories) * scaleFactor),
    protein: preciseRound(safeNumber(replacement.protein) * scaleFactor),
    carbs: preciseRound(safeNumber(replacement.carbs) * scaleFactor),
    fats: preciseRound(safeNumber(replacement.fats) * scaleFactor),
    scaleFactor: preciseRound(scaleFactor),
  };
};

const calculateAdjustedItem = (originalItem, componentSource, alternative) => {
  const sourceCalories = componentSource ? safeNumber(componentSource.calories) : safeNumber(originalItem.calories);
  const sourceProtein = componentSource ? safeNumber(componentSource.protein) : safeNumber(originalItem.protein);
  const sourceCarbs = componentSource ? safeNumber(componentSource.carbs) : safeNumber(originalItem.carbs);
  const sourceFats = componentSource ? safeNumber(componentSource.fats) : safeNumber(originalItem.fats);
  const scaled = scaleReplacementPortion(
    {
      calories: sourceCalories,
      protein: sourceProtein,
      carbs: sourceCarbs,
      fats: sourceFats,
    },
    alternative,
  );

  return {
    calories: preciseRound(safeNumber(originalItem.calories) - sourceCalories + scaled.calories),
    protein: preciseRound(safeNumber(originalItem.protein) - sourceProtein + scaled.protein),
    carbs: preciseRound(safeNumber(originalItem.carbs) - sourceCarbs + scaled.carbs),
    fats: preciseRound(safeNumber(originalItem.fats) - sourceFats + scaled.fats),
    scaledReplacement: scaled,
  };
};

const calculateTotalsDelta = (before, after) => ({
  calories: roundValue(safeNumber(after.calories) - safeNumber(before.calories)),
  protein: roundValue(safeNumber(after.protein) - safeNumber(before.protein)),
  carbs: roundValue(safeNumber(after.carbs) - safeNumber(before.carbs)),
  fats: roundValue(safeNumber(after.fats) - safeNumber(before.fats)),
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

const getConfidence = (score, usedFallback = false) => {
  if (usedFallback) {
    if (score >= 0.7) return "medium";
    return "low";
  }

  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
};

const getSafeSwapFlag = (original, replacement) => {
  const comparable = replacement?.scaledPortion || replacement;
  const macroDeviation =
    Math.max(
      percentDiff(original.calories, comparable.calories),
      percentDiff(original.protein, comparable.protein),
      percentDiff(original.carbs, comparable.carbs),
      percentDiff(original.fats, comparable.fats),
    );
  return {
    isSafeSwap: macroDeviation <= 0.25,
    macroDeviation: roundValue(macroDeviation),
  };
};

const summarizeChoice = (food, originalReference, { usedFallback = false } = {}) => {
  const scaled = scaleReplacementPortion(originalReference, food);
  const safety = getSafeSwapFlag(originalReference, {
    ...food,
    scaledPortion: scaled,
  });
  return {
    id: food.id,
    name: food.name,
    calories: safeNumber(food.calories),
    protein: safeNumber(food.protein),
    carbs: safeNumber(food.carbs),
    fats: safeNumber(food.fats),
    weightGrams: food.weightGrams ?? food.weight_grams ?? null,
    category: food.category || null,
    foodRole: food.foodRole || classifyFoodRole(food),
    matchScore: safeNumber(food.matchScore),
    isSafeSwap: safety.isSafeSwap,
    confidence: getConfidence(safeNumber(food.matchScore), usedFallback),
    normalizationSource: food.normalizationSource || null,
    scaleFactor: scaled.scaleFactor,
    scaledPortion: {
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fats: scaled.fats,
    },
    macroDelta: calculateTotalsDelta(originalReference, scaled),
  };
};

const getFallbackFoods = (component, foods = []) => {
  const fallbackLibrary = {
    protein: ["chicken", "tofu", "beans", "egg"],
    carb: ["rice", "oats", "potato"],
    fat: ["nuts", "avocado"],
  };

  const wanted = fallbackLibrary[
    ["rice", "quinoa", "oats", "bread", "wrap", "potato"].includes(component)
      ? "carb"
      : ["nuts", "avocado"].includes(component)
        ? "fat"
        : "protein"
  ] || [];

  return foods.filter((food) => {
    const haystack = normalize([food.name, ...(food.componentTags || [])].join(" "));
    return wanted.some((item) => getComponentVariants(item).some((variant) => haystack.includes(normalize(variant))));
  });
};

const rankAlternatives = ({
  candidates = [],
  component,
  originalItem,
  category,
  tolerance = 0.25,
  ignoreNameSimilarity = false,
  usedFallback = false,
  requireComponentMatch = true,
  requireRoleMatch = true,
  requireMacroMatch = true,
}) => candidates
  .filter((candidate) => isMealSafeFood(candidate))
  .filter((candidate) => {
    const componentMatch = getSharedComponentMatch(component, candidate) || matchReplacement(candidate, component);
    const roleMatch = getRoleMatch(component, candidate);
    const categoryMatch = getCategoryMatch(category, candidate);
    const strictMacro = isWithinStrictMacroTolerance(originalItem, candidate, tolerance);
    return categoryMatch &&
      (!requireMacroMatch || strictMacro) &&
      (!requireComponentMatch || componentMatch) &&
      (!requireRoleMatch || roleMatch);
  })
  .map((candidate) => ({
    ...candidate,
    matchScore: calculateScore({
      original: originalItem,
      alt: candidate,
      component,
      category,
      ignoreNameSimilarity,
    }),
    usedFallback,
  }))
  .sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return safeNumber(a.id) - safeNumber(b.id);
  });

const getValidAlternatives = (candidates, component, originalItem, category = originalItem?.category) => {
  const strictMatches = rankAlternatives({
    candidates,
    component,
    originalItem,
    category,
    tolerance: 0.25,
  });
  if (strictMatches.length > 0) return strictMatches;

  const relaxedMatches = rankAlternatives({
    candidates,
    component,
    originalItem,
    category,
    tolerance: 0.4,
    ignoreNameSimilarity: true,
  });
  if (relaxedMatches.length > 0) return relaxedMatches;

  const fallbackCandidates = getFallbackFoods(component, candidates);
  return rankAlternatives({
    candidates: fallbackCandidates,
    component,
    originalItem,
    category,
    tolerance: 0.4,
    ignoreNameSimilarity: true,
    usedFallback: true,
    requireComponentMatch: false,
    requireRoleMatch: false,
    requireMacroMatch: false,
  });
};

const rankWholeItemAlternatives = ({
  candidates = [],
  originalItem,
  category,
  tolerance = 0.3,
}) => {
  const validCandidates = candidates.filter((candidate) => isMealSafeFood(candidate));
  const categoryCandidates = validCandidates.filter((candidate) => getCategoryMatch(category, candidate));
  const pools = categoryCandidates.length > 0 ? [categoryCandidates, validCandidates] : [validCandidates];

  for (const pool of pools) {
    const ranked = pool
      .filter((candidate) => isWithinStrictMacroTolerance(originalItem, candidate, tolerance))
      .map((candidate) => ({
        ...candidate,
        matchScore: calculateWholeItemScore({
          original: originalItem,
          alt: candidate,
          category,
        }),
        usedFallback: pool !== categoryCandidates,
        macroDeviation: calculateMacroDeviation(originalItem, candidate),
      }))
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if (a.macroDeviation !== b.macroDeviation) return a.macroDeviation - b.macroDeviation;
        if (a.calories !== b.calories) return Math.abs(a.calories - originalItem.calories) - Math.abs(b.calories - originalItem.calories);
        return safeNumber(a.id) - safeNumber(b.id);
      });

    if (ranked.length > 0) return ranked;
  }

  return [];
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

const applyReplacement = (plan, original, adjustedAlt) => ({
  previewImpact: {
    calories: roundValue(safeNumber(adjustedAlt.calories) - safeNumber(original.calories)),
    protein: roundValue(safeNumber(adjustedAlt.protein) - safeNumber(original.protein)),
    carbs: roundValue(safeNumber(adjustedAlt.carbs) - safeNumber(original.carbs)),
    fats: roundValue(safeNumber(adjustedAlt.fats) - safeNumber(original.fats)),
  },
  previewTotals: {
    calories: roundValue(safeNumber(plan.totalCalories) - safeNumber(original.calories) + safeNumber(adjustedAlt.calories)),
    protein: roundValue(safeNumber(plan.totalProtein) - safeNumber(original.protein) + safeNumber(adjustedAlt.protein)),
    carbs: roundValue(safeNumber(plan.totalCarbs) - safeNumber(original.carbs) + safeNumber(adjustedAlt.carbs)),
    fats: roundValue(safeNumber(plan.totalFats) - safeNumber(original.fats) + safeNumber(adjustedAlt.fats)),
  },
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
      reason: "no_valid_match_after_fallback",
    };
  }

  const summarizedAlternatives = alternatives.map((alternative) =>
    summarizeChoice(alternative, componentSource, { usedFallback: alternative.usedFallback }),
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
    adjustedItem,
  );

  return {
    originalItemId: originalItem.id,
    originalItemName: originalItem.name,
    replaceableComponent: component,
    alternatives: summarizedAlternatives.slice(0, 5),
    recommended,
    previewImpact: preview.previewImpact,
    previewTotals: {
      ...preview.previewTotals,
      meal: nestedPreviewTotals.meal,
      day: nestedPreviewTotals.day,
    },
    isSafeSwap: recommended.isSafeSwap,
    confidence: recommended.confidence,
  };
};

const buildWholeItemAlternativeBlock = ({
  originalItem,
  alternatives,
  mealTotals,
  dayTotals,
}) => {
  if (!alternatives.length) {
    return {
      originalItemId: originalItem.id,
      originalItemName: originalItem.name,
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
      reason: "no_valid_match_after_fallback",
    };
  }

  const summarizedAlternatives = alternatives.map((alternative) =>
    summarizeChoice(alternative, originalItem, { usedFallback: alternative.usedFallback }),
  );
  const recommended = summarizedAlternatives[0];
  const adjustedItem = calculateAdjustedItem(originalItem, null, recommended);
  const nestedPreviewTotals = calculatePreviewTotals({
    mealTotals,
    dayTotals,
    originalItem,
    adjustedItem,
  });

  return {
    originalItemId: originalItem.id,
    originalItemName: originalItem.name,
    replaceableComponent: null,
    alternatives: summarizedAlternatives.slice(0, 5),
    recommended,
    previewImpact: {
      calories: roundValue(safeNumber(adjustedItem.calories) - safeNumber(originalItem.calories)),
      protein: roundValue(safeNumber(adjustedItem.protein) - safeNumber(originalItem.protein)),
      carbs: roundValue(safeNumber(adjustedItem.carbs) - safeNumber(originalItem.carbs)),
      fats: roundValue(safeNumber(adjustedItem.fats) - safeNumber(originalItem.fats)),
    },
    previewTotals: {
      calories: safeNumber(nestedPreviewTotals.meal.calories),
      protein: safeNumber(nestedPreviewTotals.meal.protein),
      carbs: safeNumber(nestedPreviewTotals.meal.carbs),
      fats: safeNumber(nestedPreviewTotals.meal.fats),
      meal: nestedPreviewTotals.meal,
      day: nestedPreviewTotals.day,
    },
    isSafeSwap: recommended.isSafeSwap,
    confidence: recommended.confidence,
    reason: null,
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
  const wholeItemAlternatives = rankWholeItemAlternatives({
    candidates: foods,
    originalItem: normalizedItem,
    category,
    tolerance: 0.3,
  }).slice(0, limit);

  const componentBlocks = replaceableComponents.map((component) => {
    const candidates = getCandidates({
      foods,
      category,
      originalId: normalizedItem.id,
    });
    const filteredCandidates = filterCandidates(candidates, component).map((food) => normalizeForMatch(food));
    const alternatives = getValidAlternatives(filteredCandidates, component, normalizedItem, category).slice(0, limit);
    const componentSource = findComponentReferenceFood({
      component,
      foods: foods.map((food) => normalizeForMatch(food)),
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

  const itemAlternativeBlock =
    wholeItemAlternatives.length > 0
      ? buildWholeItemAlternativeBlock({
          originalItem: normalizedItem,
          alternatives: wholeItemAlternatives,
          mealTotals,
          dayTotals,
        })
      : {
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
          reason: "no_valid_match_after_fallback",
        };

  return {
    itemId: normalizedItem.id,
    itemName: normalizedItem.name,
    category,
    currentItem: normalizedItem,
    itemAlternatives: wholeItemAlternatives.slice(0, 5),
    itemAlternativeBlock,
    components: componentBlocks.length > 0
      ? componentBlocks
      : [itemAlternativeBlock],
  };
};

const buildAlternativesForMealPlan = async (plan, { limit = 5 } = {}) => {
  const foods = normalizeUsdaFoods(await mealRepo.findFoods())
    .map((food) => normalizeForMatch(food))
    .sort((left, right) => {
      const leftConfidence = Number(left.confidence) || 0;
      const rightConfidence = Number(right.confidence) || 0;
      if (rightConfidence !== leftConfidence) return rightConfidence - leftConfidence;
      if (left.normalizationSource !== right.normalizationSource) {
        const sourceRank = {
          real_usda_weight: 3,
          unit_converted: 2,
          assumed_100g: 1,
          name_inferred: 0,
          missing_weight: -1,
        };
        return (sourceRank[right.normalizationSource] || 0) - (sourceRank[left.normalizationSource] || 0);
      }
      const nameCompare = String(left.name || "").localeCompare(String(right.name || ""), "en", {
        sensitivity: "base",
        numeric: true,
      });
      if (nameCompare !== 0) return nameCompare;
      return safeNumber(left.id) - safeNumber(right.id);
    });

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
  rankWholeItemAlternatives,
  scaleReplacementPortion,
};
