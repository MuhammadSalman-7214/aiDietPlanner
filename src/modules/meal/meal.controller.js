const mealService = require('./meal.service');
const { getCache, setCache } = require('../../cache/redisCache');

const generateMealPlan = async (req, res, next) => {
  try {
    const cacheKey = `meal:${JSON.stringify(req.body)}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    const plan = await mealService.generateMealPlan(req.body);
    const aiSuggestions = await mealService.generateAIMealSuggestions(req.body);

    const data = { ...plan, aiSuggestions };
    await setCache(cacheKey, data, 3600);

    return res.json({ success: true, data, cached: false });
  } catch (err) {
    return next(err);
  }
};

module.exports = { generateMealPlan };
