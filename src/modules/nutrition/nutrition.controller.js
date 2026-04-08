const nutritionService = require('./nutrition.service');

const logFood = async (req, res, next) => {
  try {
    const result = await nutritionService.logFood({ userId: req.user.id, ...req.body });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getDaily = async (req, res, next) => {
  try {
    const result = await nutritionService.getDailySummary({ userId: req.user.id, date: req.query.date });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const analyze = async (req, res, next) => {
  try {
    const result = await nutritionService.analyzeDaily({ userId: req.user.id, date: req.query.date });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getSummaryRange = async (req, res, next) => {
  try {
    const period = req.query.period || 'weekly';
    const result = await nutritionService.getSummaryRange({
      userId: req.user.id,
      period,
      date: req.query.date,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const analyzeRange = async (req, res, next) => {
  try {
    const period = req.query.period || 'weekly';
    const result = await nutritionService.analyzeRange({
      userId: req.user.id,
      period,
      date: req.query.date,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getMissedTargets = async (req, res, next) => {
  try {
    const period = req.query.period || 'weekly';
    const result = await nutritionService.getMissedTargets({
      userId: req.user.id,
      period,
      date: req.query.date,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { logFood, getDaily, analyze, getSummaryRange, analyzeRange, getMissedTargets };
