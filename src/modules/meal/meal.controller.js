const mealService = require('./meal.service');
const { getCache, setCache } = require('../../cache/redisCache');

const buildCacheKey = (userId, body, statsVersion) => {
  return `meal:${userId}:${statsVersion || 'nostats'}:${JSON.stringify(body)}`;
};

const generateMealPlan = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const mealsCount = req.body.mealsCount;

    const resolvedContext = await mealService.resolveMealContext({
      userId,
      mealsCount,
    });

    const cacheKey = buildCacheKey(
      userId,
      req.body,
      resolvedContext.stats?.updatedAt?.getTime?.() || resolvedContext.stats?.updatedAt || resolvedContext.calories,
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: {
          ...cached,
          cached: true,
        },
      });
    }

    const plan = await mealService.generateMealPlan({
      userId,
      mealsCount,
      resolvedContext,
    });
    const aiSuggestions = await mealService.generateAIMealSuggestions({
      calories: plan.nutrition.targetCalories,
      dietType: 'any',
      isPremium: Boolean(req.user?.isPremium),
      allergies: plan.nutrition.mealAllergies,
      mealDislikes: plan.nutrition.mealDislikes,
    });

    const data = {
      ...plan,
      aiSuggestions,
      cached: false,
    };
    await setCache(cacheKey, data, 3600);

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

const getAlternatives = async (req, res, next) => {
  try {
    const resolvedContext = await mealService.resolveMealContext({
      userId: req.user.id,
    });

    const alternatives = await mealService.getAlternatives({
      userId: req.user.id,
      ...req.body,
      resolvedContext,
    });
    return res.json({ success: true, data: alternatives });
  } catch (err) {
    return next(err);
  }
};

module.exports = { generateMealPlan, getAlternatives };
