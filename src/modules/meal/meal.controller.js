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
      const formattedCached = cached?.markdown
        ? cached
        : mealService.formatEssentialMealPlanResponse(cached);
      return res.json({
        success: true,
        data: {
          ...formattedCached,
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
      allergies: plan.nutrition?.constraints?.mealAllergies || [],
      mealDislikes: plan.nutrition?.constraints?.mealDislikes || [],
    });

    const data = {
      ...mealService.formatEssentialMealPlanResponse(plan),
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
    const alternatives = await mealService.getItemAlternatives({
      userId: req.user.id,
      ...req.body,
    });
    return res.json({ success: true, data: alternatives });
  } catch (err) {
    return next(err);
  }
};

const getLatestMealPlan = async (req, res, next) => {
  try {
    const plan = await mealService.getLatestMealPlan(req.user.id);
    return res.json({
      success: true,
      data: {
        ...plan,
        plan: mealService.formatEssentialMealPlanResponse(plan.plan),
      },
    });
  } catch (err) {
    return next(err);
  }
};

const updateMealTimeWindows = async (req, res, next) => {
  try {
    const plan = await mealService.updateMealTimeWindows(req.user.id, req.body);
    return res.json({
      success: true,
      data: {
        ...plan,
        plan: mealService.formatEssentialMealPlanResponse(plan.plan),
      },
    });
  } catch (err) {
    return next(err);
  }
};

const completeMeal = async (req, res, next) => {
  try {
    const result = await mealService.completeMeal(req.user.id, req.body);
    return res.json({
      success: true,
      data: {
        message: result.message,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { generateMealPlan, getAlternatives, getLatestMealPlan, updateMealTimeWindows, completeMeal };
