const mealService = require('./meal.service');
const { getCache, setCache } = require('../../cache/redisCache');

const generateMealPlan = async (req, res, next) => {
  try {
    const cacheKey = `meal:${req.user?.id || 'guest'}:${JSON.stringify(req.body)}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(201).json({
        success: true,
        data: {
          message: "Meal plan generated successfully.",
        },
      });
    }

    const payload = { ...req.body, isPremium: Boolean(req.user?.isPremium) };
    const plan = await mealService.generateMealPlan(payload);
    const aiSuggestions = await mealService.generateAIMealSuggestions(payload);

    const data = { ...plan, aiSuggestions };
    await setCache(cacheKey, data, 3600);

    // return res.json({ success: true, data, cached: false });

    return res.status(201).json({
      success: true,
      data: {
        message: "Meal plan generated successfully.",
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getAlternatives = async (req, res, next) => {
  try {
    const alternatives = await mealService.getAlternatives(req.body);
    return res.json({ success: true, data: alternatives });
  } catch (err) {
    return next(err);
  }
};

module.exports = { generateMealPlan, getAlternatives };
