const mealRepo = require('./meal.repository');
const { getOpenAIClient } = require('../../config/openai');
const { validateAIMealSuggestion } = require('../../utils/validateAIResponse');
const logger = require('../../utils/logger');

const buildMealTargets = (calories, mealsCount) => {
  if (mealsCount === 3) {
    return { breakfast: calories * 0.3, lunch: calories * 0.35, dinner: calories * 0.35, snacks: [] };
  }
  if (mealsCount === 5) {
    const snack = calories * 0.075;
    return { breakfast: calories * 0.25, lunch: calories * 0.3, dinner: calories * 0.3, snacks: [snack, snack] };
  }
  const snack = calories * 0.15;
  return { breakfast: calories * 0.25, lunch: calories * 0.3, dinner: calories * 0.3, snacks: [snack] };
};

const filterExcludedFoods = (foods, allergies = [], dislikes = []) => {
  const exclusions = [...allergies, ...dislikes].map((item) => String(item).toLowerCase()).filter(Boolean);
  if (exclusions.length === 0) return foods;
  return foods.filter((food) => !exclusions.some((item) => food.name.toLowerCase().includes(item)));
};

const pickFoodsForTarget = (foods, targetCalories) => {
  if (!foods.length) return { items: [], totals: { calories: 0, protein: 0, carbs: 0, fats: 0 } };

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

  const totals = items.reduce((acc, item) => {
    acc.calories += item.calories;
    acc.protein += item.protein;
    acc.carbs += item.carbs;
    acc.fats += item.fats;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

  return { items, totals };
};

const generateMealPlan = async ({
  calories,
  dietType,
  allergies = [],
  mealDislikes = [],
  mealsCount = 3,
  isPremium = false,
}) => {
  const foods = await mealRepo.findFoods(dietType && dietType !== 'any' ? { dietType } : {});
  const safeFoods = filterExcludedFoods(foods, allergies, mealDislikes);

  const targets = buildMealTargets(calories, mealsCount);

  const breakfastFoods = safeFoods.filter((food) => food.category === 'breakfast');
  const lunchFoods = safeFoods.filter((food) => food.category === 'lunch');
  const dinnerFoods = safeFoods.filter((food) => food.category === 'dinner');
  const snackFoods = safeFoods.filter((food) => food.category === 'snack');

  const breakfast = pickFoodsForTarget(breakfastFoods, targets.breakfast);
  const lunch = pickFoodsForTarget(lunchFoods, targets.lunch);
  const dinner = pickFoodsForTarget(dinnerFoods, targets.dinner);
  const snacks = targets.snacks.map((target) => pickFoodsForTarget(snackFoods, target));

  const alternatives = {
    breakfast: breakfastFoods.slice(0, 3),
    lunch: lunchFoods.slice(0, 3),
    dinner: dinnerFoods.slice(0, 3),
    snacks: snackFoods.slice(0, 3),
  };

  return { breakfast, lunch, dinner, snacks, alternatives, isPremiumPlan: isPremium };
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

  const exclusions = [...allergies, ...mealDislikes].filter(Boolean);
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

const getAlternatives = async ({ calories, dietType, allergies = [], mealDislikes = [], mealType }) => {
  const foods = await mealRepo.findFoods(dietType && dietType !== 'any' ? { dietType } : {});
  const safeFoods = filterExcludedFoods(foods, allergies, mealDislikes);
  const pool = safeFoods.filter((food) => food.category === mealType);
  return pool.slice(0, 5);
};

module.exports = { generateMealPlan, generateAIMealSuggestions, getAlternatives };
