const mealRepo = require('./meal.repository');
const userRepo = require('../user/user.repository');
const { calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros } = require('../../utils/calorieCalculator');
const { AppError } = require('../../middlewares/error.middleware');
const { getOpenAIClient } = require('../../config/openai');
const { validateAIMealSuggestion } = require('../../utils/validateAIResponse');
const logger = require('../../utils/logger');

const DEFAULT_MEALS_COUNT = 3;

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const dedupeList = (items) => [...new Set(items.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];

const mergeLists = (...lists) => dedupeList(lists.flatMap((list) => normalizeList(list)));

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
      .join(' ');

    return !exclusions.some((item) => haystack.includes(item));
  });
};

const pickFoodsForTarget = (foods, targetCalories) => {
  if (!foods.length) {
    return { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
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
    throw new AppError('User nutrition profile not found. Create your profile first or pass calories explicitly.', 404);
  }

  const requiredStats = ['age', 'gender', 'weightKg', 'heightCm', 'activityLevel', 'goal'];
  const missingStats = stats
    ? requiredStats.filter((field) => stats[field] === null || stats[field] === undefined)
    : requiredStats;

  const profileCalories = stats && missingStats.length === 0
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
      throw new AppError(`Nutrition profile is incomplete. Missing: ${missingStats.join(', ')}`, 422);
    }
    throw new AppError('Unable to resolve target calories for meal generation', 400);
  }

  const resolvedDietType = dietType && dietType !== 'any' ? dietType : 'any';
  const resolvedAllergies = mergeLists(stats?.mealAllergies, allergies);
  const resolvedDislikes = mergeLists(stats?.mealDislikes, mealDislikes);
  const resolvedPreferences = mergeLists(stats?.mealPreferences);
  const macros = calculateMacros(resolvedCalories, stats?.goal || 'maintain');

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

const generateMealPlan = async (params) => {
  const context = params.resolvedContext || await resolveMealContext(params);
  const foods = await mealRepo.findFoods(context.dietType !== 'any' ? { dietType: context.dietType } : {});
  const safeFoods = filterExcludedFoods(foods, context.allergies, context.mealDislikes);
  const targets = buildMealTargets(context.calories, context.mealsCount);

  const breakfastFoods = safeFoods.filter((food) => food.category === 'breakfast');
  const lunchFoods = safeFoods.filter((food) => food.category === 'lunch');
  const dinnerFoods = safeFoods.filter((food) => food.category === 'dinner');
  const snackFoods = safeFoods.filter((food) => food.category === 'snack');

  const breakfast = pickFoodsForTarget(breakfastFoods, targets.breakfast);
  const lunch = pickFoodsForTarget(lunchFoods, targets.lunch);
  const dinner = pickFoodsForTarget(dinnerFoods, targets.dinner);
  const snacks = targets.snacks.map((target) => pickFoodsForTarget(snackFoods, target));

  const breakfastSet = new Set(breakfast.items.map((item) => item.id));
  const lunchSet = new Set(lunch.items.map((item) => item.id));
  const dinnerSet = new Set(dinner.items.map((item) => item.id));
  const snackSet = new Set(snacks.flatMap((meal) => meal.items.map((item) => item.id)));

  const alternatives = {
    breakfast: breakfastFoods.filter((food) => !breakfastSet.has(food.id)).slice(0, 3),
    lunch: lunchFoods.filter((food) => !lunchSet.has(food.id)).slice(0, 3),
    dinner: dinnerFoods.filter((food) => !dinnerSet.has(food.id)).slice(0, 3),
    snacks: snackFoods.filter((food) => !snackSet.has(food.id)).slice(0, 3),
  };

  return {
    nutrition: {
      source: context.stats ? 'user_profile' : 'manual_override',
      targetCalories: context.calories,
      macros: context.macros,
      mealPreferences: context.mealPreferences,
      mealAllergies: context.allergies,
      mealDislikes: context.mealDislikes,
      mealsCount: context.mealsCount,
    },
    mealTargets: targets,
    breakfast,
    lunch,
    dinner,
    snacks,
    alternatives,
  };
};

const generateAIMealSuggestions = async ({
  calories,
  dietType,
  isPremium,
  allergies = [],
  mealDislikes = [],
}) => {
  if (!isPremium) return [];
  if (process.env.ENABLE_AI_MEAL_SUGGESTIONS !== 'true') return [];

  const exclusions = mergeLists(allergies, mealDislikes);
  const prompt = `You are a nutrition assistant. Provide 2 meal suggestions for dietType: ${dietType}.
Each suggestion must be JSON with keys: name, calories, protein, carbs, fats.
Target calories per meal: ${Math.round(calories / 3)}.
Avoid ingredients/foods: ${exclusions.length ? exclusions.join(', ') : 'none'}.`;

  try {
    const client = getOpenAIClient();
    const completion = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: 'Return strict JSON array only.' },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.output_text || '';
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => validateAIMealSuggestion(item, Math.round(calories / 3)));
  } catch (err) {
    logger.warn({ err }, 'AI meal suggestion failed');
    return [];
  }
};

const getAlternatives = async ({ userId, calories, targetCalories, dietType, allergies = [], mealDislikes = [], mealType, resolvedContext }) => {
  const context = resolvedContext || await resolveMealContext({
    userId,
    calories,
    targetCalories,
    dietType,
    allergies,
    mealDislikes,
  });

  const foods = await mealRepo.findFoods(context.dietType !== 'any' ? { dietType: context.dietType } : {});
  const safeFoods = filterExcludedFoods(foods, context.allergies, context.mealDislikes);
  const pool = safeFoods.filter((food) => food.category === mealType);
  return pool.slice(0, 5);
};

module.exports = {
  resolveMealContext,
  generateMealPlan,
  generateAIMealSuggestions,
  getAlternatives,
};
