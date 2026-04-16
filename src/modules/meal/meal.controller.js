const mealService = require('./meal.service');
const { getCache, setCache } = require('../../cache/redisCache');

const buildCacheKey = (userId, body, statsVersion) => {
  return `meal:${userId}:${statsVersion || 'nostats'}:${JSON.stringify(body)}`;
};

const generateMealPlan = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = {
      ...req.body,
      isPremium: Boolean(req.user?.isPremium),
      userId,
    };

    const resolvedContext = await mealService.resolveMealContext({
      userId,
      calories: payload.calories,
      targetCalories: payload.targetCalories,
      dietType: payload.dietType,
      allergies: payload.allergies,
      mealDislikes: payload.mealDislikes,
      mealsCount: payload.mealsCount,
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
      ...payload,
      resolvedContext,
    });
    const aiSuggestions = await mealService.generateAIMealSuggestions({
      calories: plan.nutrition.targetCalories,
      dietType: payload.dietType || 'any',
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
      calories: req.body.calories,
      targetCalories: req.body.targetCalories,
      dietType: req.body.dietType,
      allergies: req.body.allergies,
      mealDislikes: req.body.mealDislikes,
      mealsCount: req.body.mealsCount,
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
