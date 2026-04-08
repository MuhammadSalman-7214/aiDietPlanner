const dietService = require('./diet.service');

const calculateDiet = async (req, res, next) => {
  try {
    const result = dietService.calculateDiet(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const savePlan = async (req, res, next) => {
  try {
    const result = await dietService.savePlan(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getLatestPlan = async (req, res, next) => {
  try {
    const result = await dietService.getLatestPlan(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { calculateDiet, savePlan, getLatestPlan };
