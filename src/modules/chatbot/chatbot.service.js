const { getOpenAIClient } = require('../../config/openai');
const { getCache, setCache } = require('../../cache/redisCache');
const mealService = require('../meal/meal.service');
const nutritionService = require('../nutrition/nutrition.service');
const logger = require('../../utils/logger');

const normalizeMessage = (message) => {
  const cleaned = message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const corrections = {
    calory: 'calorie',
    caleries: 'calories',
    protien: 'protein',
    brekfast: 'breakfast',
  };

  return cleaned.split(' ').map((word) => corrections[word] || word).join(' ');
};

const detectIntent = (message) => {
  if (/(replace|swap).*meal|meal replacement/.test(message)) return 'meal_replacement';
  if (/meal plan|generate meal|diet plan|meal generation/.test(message)) return 'meal_generation';
  if (/calorie|nutrition|macro|progress|intake/.test(message)) return 'nutrition_query';
  if (/recipe|cook|ingredients/.test(message)) return 'recipe_request';
  return 'nutrition_query';
};

const buildResponse = (intent, response) => ({ intent, response });

const handleMealGeneration = async () => {
  const plan = await mealService.generateMealPlan({ calories: 2000, dietType: 'any', mealsCount: 3 });
  return buildResponse('meal_generation', plan);
};

const handleMealReplacement = async () => {
  const plan = await mealService.generateMealPlan({ calories: 2000, dietType: 'any', mealsCount: 3 });
  return buildResponse('meal_replacement', plan.alternatives);
};

const handleNutritionQuery = async (userId) => {
  if (!userId) {
    return buildResponse('nutrition_query', { message: 'Authentication required for nutrition summary.' });
  }
  const summary = await nutritionService.getDailySummary({ userId });
  return buildResponse('nutrition_query', summary);
};

const handleRecipeRequest = async (sanitizedMessage) => {
  const cacheKey = `ai:recipe:${sanitizedMessage}`;
  const cached = await getCache(cacheKey);
  if (cached) return buildResponse('recipe_request', cached);

  const prompt = `Return a JSON object with keys: title, ingredients (array), steps (array).
User request: ${sanitizedMessage}`;

  try {
    const client = getOpenAIClient();
    const completion = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.output_text || '{}';
    const parsed = JSON.parse(text);
    await setCache(cacheKey, parsed, 3600);
    return buildResponse('recipe_request', parsed);
  } catch (err) {
    logger.warn({ err }, 'Recipe AI failed');
    return buildResponse('recipe_request', { title: 'Unavailable', ingredients: [], steps: [] });
  }
};

const chat = async ({ message, userId }) => {
  const normalized = normalizeMessage(message);
  const intent = detectIntent(normalized);

  if (intent === 'meal_generation') return handleMealGeneration();
  if (intent === 'meal_replacement') return handleMealReplacement();
  if (intent === 'nutrition_query') return handleNutritionQuery(userId);
  return handleRecipeRequest(normalized);
};

module.exports = { chat };
