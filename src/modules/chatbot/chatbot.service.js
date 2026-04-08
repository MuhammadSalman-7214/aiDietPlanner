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

const handleMealGeneration = async (isPremium) => {
  const plan = await mealService.generateMealPlan({
    calories: 2000,
    dietType: 'any',
    mealsCount: 3,
    isPremium,
  });
  return buildResponse('meal_generation', plan);
};

const handleMealReplacement = async (isPremium) => {
  const plan = await mealService.generateMealPlan({
    calories: 2000,
    dietType: 'any',
    mealsCount: 3,
    isPremium,
  });
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

const CHATBOT_LIMIT_GUEST = Number(process.env.CHATBOT_LIMIT_GUEST || 5);
const CHATBOT_LIMIT_FREE = Number(process.env.CHATBOT_LIMIT_FREE || 20);

const memoryCounts = new Map();

const getDayKey = () => new Date().toISOString().slice(0, 10);

const getCountKey = (userId) => (userId ? `chat:${userId}:${getDayKey()}` : `chat:guest:${getDayKey()}`);

const getCount = async (key) => {
  const cached = await getCache(key);
  if (cached !== null && cached !== undefined) return cached;
  return memoryCounts.get(key) || 0;
};

const setCount = async (key, value) => {
  await setCache(key, value, 86400);
  memoryCounts.set(key, value);
};

const enforceChatLimit = async ({ userId, isPremium }) => {
  if (isPremium) return;
  const limit = userId ? CHATBOT_LIMIT_FREE : CHATBOT_LIMIT_GUEST;
  if (limit <= 0) return;

  const key = getCountKey(userId);
  const current = await getCount(key);
  if (current >= limit) {
    return false;
  }
  await setCount(key, current + 1);
  return true;
};

const chat = async ({ message, userId, isPremium }) => {
  const allowed = await enforceChatLimit({ userId, isPremium });
  if (allowed === false) {
    return buildResponse('rate_limited', {
      message: 'Chat limit reached for today.',
      limit: userId ? CHATBOT_LIMIT_FREE : CHATBOT_LIMIT_GUEST,
    });
  }

  const normalized = normalizeMessage(message);
  const intent = detectIntent(normalized);

  if (intent === 'meal_generation') return handleMealGeneration(isPremium);
  if (intent === 'meal_replacement') return handleMealReplacement(isPremium);
  if (intent === 'nutrition_query') return handleNutritionQuery(userId);
  return handleRecipeRequest(normalized);
};

module.exports = { chat };
